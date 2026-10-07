import * as cheerio from "cheerio";

const TEAM_ID = process.env.NEXT_PUBLIC_TEAM_ID ?? "11953";
const BASE_URL = "https://strahovskaliga.cz";
const PROFILE_PATH = "/TymProfil/";

export interface TeamInfo {
  tid: string;
  name: string;
  active: boolean | null;
  league: string | null;
  owner: { name: string; profileUrl: string } | null;
  address: string | null;
  description: string | null;
  logoUrl: string | null;
}

export interface SeasonStats {
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  scoreFor: number;
  scoreAgainst: number;
}

export interface MatchTeam {
  tid: string | null;
  name: string;
  logoUrl: string | null;
}

export interface MatchFixture {
  id: string;
  date: string | null;
  time: string | null;
  home: MatchTeam;
  away: MatchTeam;
  homeScore: number | null;
  awayScore: number | null;
  isPlayed: boolean;
}

export interface Player {
  profileId: string | null;
  name: string;
  nickname: string | null;
  email: string | null;
  phone: string | null;
  matchesPlayed: number;
  goals: number;
}

export interface HistorySeason {
  season: string;
  standing: string;
  league: string;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  scoreFor: number;
  scoreAgainst: number;
}

export interface TeamProfile {
  team: TeamInfo;
  stats: SeasonStats;
  matches: MatchFixture[];
  players: Player[];
  history: HistorySeason[];
  seasonLabel: string | null;
  playerPhotos: Record<string, string>;
}

const MAX_MATCH_LOOKUPS = 60;

function toNumber(text: string | undefined | null): number {
  if (!text) return 0;
  const match = text.replace(/\s/g, "").match(/-?\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function cleanText(text: string | undefined | null): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function resolveUrl(path: string | undefined): string | null {
  if (!path) return null;
  try {
    return new URL(path, `${BASE_URL}${PROFILE_PATH}`).toString();
  } catch {
    return null;
  }
}

function extractTid(href: string | undefined): string | null {
  if (!href) return null;
  const match = href.match(/TID=(\d+)/i) || href.match(/ID=(\d+)/i);
  return match ? match[1] : null;
}

async function fetchDecodedHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "cs-CZ,cs;q=0.9,en;q=0.8",
      Referer: BASE_URL,
    },
    next: { revalidate: 600 },
  });

  if (!response.ok) {
    throw new Error(`Strahovska liga odpovedela stavem ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  return new TextDecoder("windows-1250").decode(buffer);
}

function parseTeamInfo($: cheerio.CheerioAPI, tid: string): TeamInfo {
  const infoTable = $("#profil table.table-hover").first();
  const rows: Record<string, string> = {};
  let owner: TeamInfo["owner"] = null;

  infoTable.find("tr").each((_, el) => {
    $(el)
      .find("td")
      .each((_, td) => {
        const strong = $(td).find("strong").first();
        const label = cleanText(strong.text()).replace(/:$/, "");
        if (!label) return;

        const clone = $(td).clone();
        clone.find("strong").remove();
        const value = cleanText(clone.text());

        if (label === "Majitel") {
          const link = $(td).find("a").first();
          owner = {
            name: cleanText(link.text()),
            profileUrl: resolveUrl(link.attr("href")) ?? "",
          };
          return;
        }

        rows[label] = value;
      });
  });

  const logoUrl = resolveUrl(infoTable.find("img.TeamPic").attr("src"));

  return {
    tid,
    name: rows["Název"] ?? "",
    active: rows["Aktivní"] ? rows["Aktivní"].toLowerCase() === "ano" : null,
    league: rows["Liga"] ?? null,
    owner,
    address: rows["Adresa"] ?? null,
    description: rows["Popis"] ?? null,
    logoUrl,
  };
}

function parseSeasonStats($: cheerio.CheerioAPI): SeasonStats {
  const table = $("#profil table.TdCenter").first();
  const cells = table.find("tbody tr").first().find("td");
  const score = cleanText(cells.eq(5).text());
  const [scoreFor, scoreAgainst] = score.split(":").map((s) => toNumber(s));

  return {
    matches: toNumber(cells.eq(0).text()),
    wins: toNumber(cells.eq(1).text()),
    draws: toNumber(cells.eq(2).text()),
    losses: toNumber(cells.eq(3).text()),
    points: toNumber(cells.eq(4).text()),
    scoreFor: scoreFor ?? 0,
    scoreAgainst: scoreAgainst ?? 0,
  };
}

function parseMatchTeam(
  $: cheerio.CheerioAPI,
  cell: cheerio.Cheerio<any>,
): MatchTeam {
  const link = cell.find("a").first();
  return {
    tid: extractTid(link.attr("href")),
    name: cleanText(link.find("strong").text() || link.text()),
    logoUrl: resolveUrl(cell.find("img").attr("src")),
  };
}

function parseMatches($: cheerio.CheerioAPI): MatchFixture[] {
  const rows = $("#zapasySmall table tbody tr");
  const matches: MatchFixture[] = [];

  rows.each((_, el) => {
    const row = $(el);
    const cells = row.find("td");
    if (cells.length < 3) return;

    const home = parseMatchTeam($, cells.eq(0));
    const away = parseMatchTeam($, cells.eq(2));

    const middle = cells.eq(1);
    const smallText = cleanText(middle.find("small").text());
    const fullText = cleanText(middle.text());
    const scoreText = fullText.replace(smallText, "").trim();

    const dateMatch = smallText.match(/\d{1,2}\.\s*\d{1,2}\.\s*\d{4}/);
    const timeMatch = smallText.match(/\d{1,2}:\d{2}/);
    const scoreMatch = scoreText.match(/(\d+)\s*:\s*(\d+)/);

    matches.push({
      id: row.attr("id") ?? `${home.tid}-${away.tid}-${dateMatch?.[0] ?? ""}`,
      date: dateMatch ? dateMatch[0] : null,
      time: timeMatch ? timeMatch[0] : null,
      home,
      away,
      homeScore: scoreMatch ? parseInt(scoreMatch[1], 10) : null,
      awayScore: scoreMatch ? parseInt(scoreMatch[2], 10) : null,
      isPlayed: Boolean(scoreMatch),
    });
  });

  return matches;
}

function parsePlayers($: cheerio.CheerioAPI): Player[] {
  const rows = $(".transformable table tbody tr");
  const players: Player[] = [];

  rows.each((_, el) => {
    const cells = $(el).find("td");
    if (cells.length < 5) return;

    const link = cells.eq(0).find("a").first();
    const productivity = cleanText(cells.eq(4).text());
    const prodMatch = productivity.match(/(\d+)\s*z[áa]pas\w*\s*-\s*(\d+)\s*g[óo]l\w*/i);

    const email = cleanText(cells.eq(2).text());
    const phone = cleanText(cells.eq(3).text());

    players.push({
      profileId: extractTid(link.attr("href")),
      name: cleanText(link.text()),
      nickname: cleanText(cells.eq(1).text()) || null,
      email: email || null,
      phone: phone || null,
      matchesPlayed: prodMatch ? parseInt(prodMatch[1], 10) : 0,
      goals: prodMatch ? parseInt(prodMatch[2], 10) : 0,
    });
  });

  return players;
}

function parseHistory($: cheerio.CheerioAPI): HistorySeason[] {
  const rows = $('#historie [ng-show="tab.isSet(2)"] table tbody tr');
  const history: HistorySeason[] = [];

  rows.each((_, el) => {
    const cells = $(el).find("td");
    if (cells.length < 8) return;

    const season = cleanText(cells.eq(0).text());
    if (!season || season.toLowerCase() === "celkem") return;

    const score = cleanText(cells.eq(7).text());
    const [scoreFor, scoreAgainst] = score.split(":").map((s) => toNumber(s));

    history.push({
      season,
      standing: cleanText(cells.eq(1).text()),
      league: cleanText(cells.eq(2).text()),
      matches: toNumber(cells.eq(3).text()),
      wins: toNumber(cells.eq(4).text()),
      draws: toNumber(cells.eq(5).text()),
      losses: toNumber(cells.eq(6).text()),
      scoreFor: scoreFor ?? 0,
      scoreAgainst: scoreAgainst ?? 0,
    });
  });

  return history;
}

function extractSeasonYids(
  $: cheerio.CheerioAPI,
): { season: string; yid: string }[] {
  const seasons: { season: string; yid: string }[] = [];

  $('#historie [ng-show="tab.isSet(2)"] table tbody tr').each((_, el) => {
    const row = $(el);
    const season = cleanText(row.find("td").eq(0).text());
    const onclick = row.find("button").attr("onclick") ?? "";
    const match = onclick.match(/Redir\(\d+,\s*(\d+)\)/i);
    if (season && match) {
      seasons.push({ season, yid: match[1] });
    }
  });

  return seasons;
}

async function fetchSeasonMatchIds(tid: string, yid: string): Promise<string[]> {
  try {
    const html = await fetchDecodedHtml(
      `${BASE_URL}${PROFILE_PATH}?TID=${tid}&YID=${yid}`,
    );
    const $ = cheerio.load(html);
    return parseMatches($)
      .map((m) => m.id)
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchMatchLineupPhotos(
  matchId: string,
): Promise<[string, string][]> {
  try {
    const html = await fetchDecodedHtml(
      `${BASE_URL}/DetailZapasu/?MID=${matchId}`,
    );
    const $ = cheerio.load(html);
    const entries: [string, string][] = [];

    $("tr").each((_, el) => {
      const row = $(el);
      const photo = row.find('img[alt="Profilova fotka"]').first();
      if (!photo.length) return;

      const link = row.find('a[href*="ID="]').first();
      const profileId = extractTid(link.attr("href"));
      const photoUrl = resolveUrl(photo.attr("src"));
      if (profileId && photoUrl) {
        entries.push([profileId, photoUrl]);
      }
    });

    return entries;
  } catch {
    return [];
  }
}

async function buildPlayerPhotoMap(
  $: cheerio.CheerioAPI,
  tid: string,
  currentSeasonLabel: string | null,
  currentMatches: MatchFixture[],
): Promise<Record<string, string>> {
  const matchIds = new Set<string>(currentMatches.map((m) => m.id));

  const otherSeasons = extractSeasonYids($).filter(
    (s) => s.season !== currentSeasonLabel,
  );

  const seasonMatchLists = await Promise.all(
    otherSeasons.map((s) => fetchSeasonMatchIds(tid, s.yid)),
  );
  seasonMatchLists.flat().forEach((id) => matchIds.add(id));

  const idsToFetch = [...matchIds].slice(0, MAX_MATCH_LOOKUPS);
  const lineups = await Promise.all(idsToFetch.map(fetchMatchLineupPhotos));

  const photoMap: Record<string, string> = {};
  lineups.flat().forEach(([profileId, photoUrl]) => {
    photoMap[profileId] = photoUrl;
  });

  return photoMap;
}

export async function getTeamProfile(
  tid: string = TEAM_ID,
): Promise<TeamProfile> {
  const html = await fetchDecodedHtml(
    `${BASE_URL}${PROFILE_PATH}?TID=${tid}`,
  );
  const $ = cheerio.load(html);

  const seasonLabel =
    cleanText($("#pasteRocnik .col-md-6").first().text()) || null;
  const currentSeasonName = seasonLabel?.replace(/^Z[áa]pasy\s*-\s*/i, "") ?? null;
  const matches = parseMatches($);

  const playerPhotos = await buildPlayerPhotoMap(
    $,
    tid,
    currentSeasonName,
    matches,
  );

  return {
    team: parseTeamInfo($, tid),
    stats: parseSeasonStats($),
    matches,
    players: parsePlayers($),
    history: parseHistory($),
    seasonLabel,
    playerPhotos,
  };
}

export { TEAM_ID };
