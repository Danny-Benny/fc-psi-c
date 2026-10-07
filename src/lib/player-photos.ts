import { existsSync } from "fs";
import { join } from "path";

const PHOTOS_DIR = join(process.cwd(), "public", "players");
const EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

export function getPlayerPhotoUrl(profileId: string | null): string | null {
  if (!profileId) return null;

  for (const ext of EXTENSIONS) {
    if (existsSync(join(PHOTOS_DIR, `${profileId}.${ext}`))) {
      return `/players/${profileId}.${ext}`;
    }
  }

  return null;
}

const AVATAR_COLORS = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-sky-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-fuchsia-500",
];

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "");
  return initials.join("") || "?";
}

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) % AVATAR_COLORS.length;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
