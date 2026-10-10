import { z } from "zod";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const color = z.string().regex(HEX_COLOR, "Colors must be #RRGGBB.");

const overrideSchema = z
  .object({
    label: z.string().trim().min(1).max(60).optional(),
    badge: z.string().regex(/^[A-Za-z0-9]{1,2}$/, "Badges are 1-2 letters or digits.").optional(),
    icon: z.string().regex(/^[A-Z][A-Za-z0-9]{1,63}$/, "Icons must be BB glyph names such as Palette.").optional(),
    color: z.union([color, z.object({ light: color, dark: color }).strict()]).optional(),
  })
  .strict();

export const presentationSchema = z.record(z.string(), overrideSchema).refine((overrides) => {
  const badges = Object.values(overrides).flatMap((override) => override.badge?.toUpperCase() ?? []);
  return new Set(badges).size === badges.length;
}, "Custom profile badges must be unique.");
export type ProfileOverride = z.infer<typeof overrideSchema>;

export interface ProfilePresentation {
  label: string;
  badge: string;
  icon?: string;
  tint?: { light: string; dark: string };
}

export function parsePresentation(json: string): Record<string, ProfileOverride> {
  return presentationSchema.parse(JSON.parse(json));
}

function commonPrefixLength(a: string, b: string): number {
  let index = 0;
  while (index < a.length && a[index] === b[index]) index += 1;
  return index;
}

/** Initial letter, or the first letter after the prefix shared with colliding profiles. */
export function defaultBadges(profiles: readonly string[], reserved: readonly string[] = []): Record<string, string> {
  const badges: Record<string, string> = {};
  for (const profile of profiles) {
    const name = profile.replace(/[^a-z0-9]/g, "");
    const peers = profiles.filter((other) => other !== profile && other.replace(/[^a-z0-9]/g, "")[0] === name[0]);
    if (peers.length === 0) {
      badges[profile] = name[0].toUpperCase();
      continue;
    }
    const prefix = Math.max(...peers.map((peer) => commonPrefixLength(name, peer.replace(/[^a-z0-9]/g, ""))));
    badges[profile] = `${name[0]}${name[Math.max(1, prefix)] ?? name.at(-1) ?? ""}`.toUpperCase();
  }

  const used = new Set(reserved);
  for (const profile of profiles) {
    const base = badges[profile];
    const badge = [base, ..."23456789ABCDEFGHJKLMNPQRSTUVWXYZ".split("").map((suffix) => `${base[0]}${suffix}`)].find(
      (candidate) => !used.has(candidate),
    );
    if (badge === undefined) throw new Error(`Too many profiles share the badge initial ${base[0]}; set badges explicitly.`);
    used.add(badge);
    badges[profile] = badge;
  }
  return badges;
}

/** Overrides for profiles not in `profiles` are ignored; the caller reports them. */
export function profilePresentations(
  profiles: readonly string[],
  overrides: Record<string, ProfileOverride>,
): Record<string, ProfilePresentation> {
  const explicit = profiles.flatMap((profile) => overrides[profile]?.badge?.toUpperCase() ?? []);
  const badges = defaultBadges(
    profiles.filter((profile) => overrides[profile]?.badge === undefined),
    explicit,
  );
  const result: Record<string, ProfilePresentation> = {};
  for (const profile of profiles) {
    const override = overrides[profile] ?? {};
    result[profile] = {
      label: override.label ?? profile,
      badge: (override.badge ?? badges[profile]).toUpperCase(),
      ...(override.icon === undefined ? {} : { icon: override.icon }),
      ...(override.color === undefined
        ? {}
        : { tint: typeof override.color === "string" ? { light: override.color, dark: override.color } : override.color }),
    };
  }
  return result;
}

export function monogramSvg(badge: string): string {
  const fontSize = badge.length === 1 ? 13 : 10;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="6" fill="none" stroke="#000" stroke-width="2"/><text x="12" y="12.5" fill="#000" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif" font-size="${fontSize}" font-weight="800" text-anchor="middle" dominant-baseline="middle">${badge}</text></svg>\n`;
}
