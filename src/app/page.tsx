import Image from "next/image";
import { getTeamProfile } from "@/lib/strahov";
import { teamContent } from "@/content/team";
import { getAvatarColor, getInitials, getPlayerPhotoUrl } from "@/lib/player-photos";

export const revalidate = 600;

function youtubeEmbedUrl(text: string | null): string | null {
  if (!text) return null;
  const match = text.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/,
  );
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

function PlayerAvatar({
  name,
  photoUrl,
}: {
  name: string;
  photoUrl: string | null;
}) {
  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt={name}
        width={40}
        height={40}
        unoptimized
        className="h-10 w-10 rounded-full object-cover ring-1 ring-zinc-200 dark:ring-zinc-700"
      />
    );
  }

  return (
    <div
      className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white ${getAvatarColor(name)}`}
    >
      {getInitials(name)}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-white px-3 py-4 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
        {value}
      </span>
      <span className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
    </div>
  );
}

function TeamBadge({
  name,
  logoUrl,
  highlight,
}: {
  name: string;
  logoUrl: string | null;
  highlight: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1 text-center">
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={name}
          width={40}
          height={40}
          unoptimized
          className="h-10 w-10 rounded-full object-cover ring-1 ring-zinc-200 dark:ring-zinc-700"
        />
      ) : (
        <div className="h-10 w-10 rounded-full bg-zinc-200 dark:bg-zinc-700" />
      )}
      <span
        className={`text-sm leading-tight ${
          highlight
            ? "font-semibold text-emerald-700 dark:text-emerald-400"
            : "text-zinc-700 dark:text-zinc-300"
        }`}
      >
        {name}
      </span>
    </div>
  );
}

export default async function Home() {
  let data: Awaited<ReturnType<typeof getTeamProfile>> | null = null;
  let errorMessage: string | null = null;

  try {
    data = await getTeamProfile();
  } catch (err) {
    errorMessage =
      err instanceof Error ? err.message : "Neznámá chyba při načítání dat.";
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-red-600">
          Data se nepodařilo načíst
        </h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          Server strahovskaliga.cz momentálně neodpovídá, nebo zablokoval
          požadavek. Zkuste stránku obnovit za chvíli.
        </p>
        {errorMessage && (
          <p className="mt-2 text-sm text-zinc-400">{errorMessage}</p>
        )}
      </main>
    );
  }

  const { team, stats, matches, players, history, seasonLabel, playerPhotos } =
    data;

  const played = matches.filter((m) => m.isPlayed);
  const upcoming = matches.filter((m) => !m.isPlayed);

  const embedUrl = youtubeEmbedUrl(team.description);
  const descriptionText = (team.description ?? "")
    .replace(/https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/i, "")
    .trim();
  const hasAbout = Boolean(descriptionText || embedUrl);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      {/* Header */}
      <header className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        {team.logoUrl && (
          <Image
            src={team.logoUrl}
            alt={team.name}
            width={88}
            height={88}
            unoptimized
            className="h-22 w-22 rounded-xl object-cover ring-1 ring-zinc-200 dark:ring-zinc-800"
          />
        )}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
            {team.name || "Náš tým"}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {team.league ? `${team.league} · ` : ""}
            Strahovská liga
            {team.active === false && " · neaktivní"}
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Kapitán: <span className="font-medium">{teamContent.captainName}</span>
          </p>
          {team.owner && team.owner.name !== teamContent.captainName && (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Majitel: {team.owner.name}
            </p>
          )}
          {team.address && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Domácí hřiště: {team.address}
            </p>
          )}
        </div>
      </header>

      {/* About */}
      {hasAbout && (
        <section className="mt-8 rounded-lg bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
          <h2 className="mb-2 text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            O týmu
          </h2>
          {descriptionText && (
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {descriptionText}
            </p>
          )}
          {embedUrl && (
            <div className="mt-4 aspect-video w-full max-w-lg overflow-hidden rounded-lg">
              <iframe
                src={embedUrl}
                title="Tým ve videu"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          )}
        </section>
      )}

      {/* Season stats */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-zinc-800 dark:text-zinc-200">
          Statistiky {seasonLabel ? `– ${seasonLabel}` : "sezóny"}
        </h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          <StatCard label="Zápasy" value={stats.matches} />
          <StatCard label="Výhry" value={stats.wins} />
          <StatCard label="Remízy" value={stats.draws} />
          <StatCard label="Prohry" value={stats.losses} />
          <StatCard label="Body" value={stats.points} />
          <StatCard
            label="Skóre"
            value={`${stats.scoreFor}:${stats.scoreAgainst}`}
          />
        </div>
      </section>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-2">
        {/* Matches */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            Zápasy
          </h2>
          <div className="space-y-2">
            {matches.length === 0 && (
              <p className="text-sm text-zinc-500">Žádné zápasy k zobrazení.</p>
            )}
            {matches.map((match) => (
              <div
                key={match.id}
                className="flex items-center gap-3 rounded-lg bg-white px-3 py-3 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800"
              >
                <TeamBadge
                  name={match.home.name}
                  logoUrl={match.home.logoUrl}
                  highlight={match.home.tid === team.tid}
                />
                <div className="flex flex-col items-center gap-1 px-2">
                  {match.isPlayed ? (
                    <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                      {match.homeScore} : {match.awayScore}
                    </span>
                  ) : (
                    <span className="text-lg font-bold text-zinc-400">vs</span>
                  )}
                  <span className="whitespace-nowrap text-xs text-zinc-500 dark:text-zinc-400">
                    {match.date}
                    {match.time ? ` ${match.time}` : ""}
                  </span>
                </div>
                <TeamBadge
                  name={match.away.name}
                  logoUrl={match.away.logoUrl}
                  highlight={match.away.tid === team.tid}
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-zinc-400">
            Odehráno: {played.length} · Nadcházející: {upcoming.length}
          </p>
        </section>

        {/* Roster */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            Soupiska ({players.length})
          </h2>
          <div className="overflow-hidden rounded-lg shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-100 text-left text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                <tr>
                  <th className="px-3 py-2 font-medium" colSpan={2}>
                    Jméno
                  </th>
                  <th className="px-3 py-2 font-medium">Přezdívka</th>
                  <th className="px-3 py-2 text-right font-medium">Zápasy</th>
                  <th className="px-3 py-2 text-right font-medium">Góly</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
                {players.map((player, i) => (
                  <tr key={`${player.profileId}-${i}`}>
                    <td className="py-2 pl-3">
                      <PlayerAvatar
                        name={player.name}
                        photoUrl={
                          getPlayerPhotoUrl(player.profileId) ??
                          (player.profileId
                            ? playerPhotos[player.profileId] ?? null
                            : null)
                        }
                      />
                    </td>
                    <td className="px-3 py-2 text-zinc-800 dark:text-zinc-200">
                      {player.name}
                      {player.name === teamContent.captainName && (
                        <span
                          title="Kapitán"
                          className="ml-1 text-amber-500"
                        >
                          ★
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">
                      {player.nickname}
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-800 dark:text-zinc-200">
                      {player.matchesPlayed}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                      {player.goals}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* History */}
      {history.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            Historie týmu
          </h2>
          <div className="overflow-x-auto rounded-lg shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800">
            <table className="w-full min-w-[500px] text-sm">
              <thead className="bg-zinc-100 text-left text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                <tr>
                  <th className="px-3 py-2 font-medium">Ročník</th>
                  <th className="px-3 py-2 font-medium">Umístění</th>
                  <th className="px-3 py-2 font-medium">Liga</th>
                  <th className="px-3 py-2 text-right font-medium">Z</th>
                  <th className="px-3 py-2 text-right font-medium">V</th>
                  <th className="px-3 py-2 text-right font-medium">R</th>
                  <th className="px-3 py-2 text-right font-medium">P</th>
                  <th className="px-3 py-2 text-right font-medium">Skóre</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
                {history.map((season) => (
                  <tr key={season.season}>
                    <td className="px-3 py-2 text-zinc-800 dark:text-zinc-200">
                      {season.season}
                    </td>
                    <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">
                      {season.standing}
                    </td>
                    <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">
                      {season.league}
                    </td>
                    <td className="px-3 py-2 text-right">{season.matches}</td>
                    <td className="px-3 py-2 text-right">{season.wins}</td>
                    <td className="px-3 py-2 text-right">{season.draws}</td>
                    <td className="px-3 py-2 text-right">{season.losses}</td>
                    <td className="px-3 py-2 text-right">
                      {season.scoreFor}:{season.scoreAgainst}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
