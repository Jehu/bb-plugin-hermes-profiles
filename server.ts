import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BbPluginApi, PluginProviderDeclaration } from "@get-bb/plugin-sdk";
import { z } from "zod";
import { monogramSvg, parsePresentation, profilePresentations, type ProfilePresentation } from "./presentation";

const PROFILE_NAME = /^(?:default|[a-z0-9][a-z0-9_-]{0,63})$/;
// Hermes exposes effort as the "reasoning_effort" session config, not as an ACP thought_level option.
const REASONING_LEVELS = ["none", "low", "medium", "high", "xhigh", "max"] as const;

function providerId(profile: string): string {
  const encoded = profile.replaceAll("-", "-0").replaceAll("_", "-1");
  if (encoded.length <= 49) return `hermes-profile-${encoded}`;
  return `hermes-profile-${encoded.slice(0, 36)}-${createHash("sha256").update(profile).digest("hex").slice(0, 12)}`;
}

export function parseProfiles(names: string): string[] {
  const profiles = names.split(",").map((name) => name.trim());
  if (profiles.some((name) => !PROFILE_NAME.test(name)) || new Set(profiles).size !== profiles.length) {
    throw new Error("Profiles must be unique, comma-separated Hermes profile names (default is allowed).");
  }
  return profiles;
}

export function profileProviders(
  profiles: readonly string[],
  presentations: Record<string, ProfilePresentation>,
): PluginProviderDeclaration[] {
  return profiles.map((profile) => {
    const presentation = presentations[profile];
    const id = providerId(profile);
    const displayName = `Hermes · ${presentation.label}`;
    return {
      id,
      displayName,
      family: "acp",
      icon: presentation.icon ?? `./icons/generated/${id}.svg`,
      strings: {
        signInHint: `Configure Hermes profile ${profile} on the selected machine.`,
        expiredHint: `Reauthenticate Hermes profile ${profile} on the selected machine.`,
        installUrl: "https://github.com/NousResearch/hermes-agent",
        ...(presentation.tint === undefined ? {} : { iconTint: presentation.tint }),
      },
      experimental_bridgeOptions: {
        acpDialect: "generic",
        acpLaunchSpec: {
          displayName,
          command: "hermes",
          args: ["-p", profile, "acp"],
          env: {},
          nativeReasoning: {
            configId: "reasoning_effort",
            supportedLevels: [...REASONING_LEVELS],
            defaultLevel: "medium",
          },
        },
      },
      experimental_visibility: "installed",
      models: { scope: "host" },
      maintenance: { health: true },
      capabilities: {
        supportsServiceTier: false,
        supportsNativeUserQuestion: false,
        supportsManualCompaction: false,
        supportsThreadArchive: false,
        supportsThreadRename: false,
        fork: "none",
        permissionModes: ["accept-edits", "full"],
        reasoningLevels: [...REASONING_LEVELS],
      },
      composerActions: [],
    };
  });
}

export default async function plugin(bb: BbPluginApi) {
  const settings = bb.settings.define({
    profiles: {
      type: "string",
      label: "Hermes profiles (comma-separated)",
      default: "default",
    },
    presentation: {
      type: "string",
      label: "Profile presentation (JSON)",
      experimental_multiline: true,
      experimental_schema: z.string().refine((value) => {
        try {
          parsePresentation(value);
          return true;
        } catch {
          return false;
        }
      }, 'Use {"designer":{"label":"Design","badge":"DS","icon":"Palette","color":"#7C3AED"}}.'),
      default: "{}",
    },
  });
  const values = await settings.get();
  const profiles = parseProfiles(values.profiles);
  const overrides = parsePresentation(values.presentation);
  const unused = Object.keys(overrides).filter((profile) => !profiles.includes(profile));
  if (unused.length > 0) bb.log.warn(`Ignoring presentation for unconfigured profiles: ${unused.join(", ")}`);
  const presentations = profilePresentations(profiles, overrides);

  // Path installs load server.ts; built installs load dist/server.js. Provider SVG paths are plugin-root-relative.
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const iconDir = join(basename(moduleDir) === "dist" ? dirname(moduleDir) : moduleDir, "icons", "generated");
  mkdirSync(iconDir, { recursive: true });
  for (const profile of profiles) {
    writeFileSync(join(iconDir, `${providerId(profile)}.svg`), monogramSvg(presentations[profile].badge));
  }
  for (const provider of profileProviders(profiles, presentations)) {
    bb.providers.register(provider);
  }
}
