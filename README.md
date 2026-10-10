# Hermes Profiles for bb

Adds a selectable bb ACP provider for each configured Hermes profile. Each provider starts `hermes -p <profile> acp`, so its Hermes configuration, credentials, identity and sessions remain isolated from other profiles. The plugin uses bb's published ACP bridge; it does not implement a second ACP adapter.

## Install and configure

Requires bb 0.45+ with Plugin SDK 0.6.15+, and `hermes` on the execution machine's `PATH`.

```sh
cd bb-plugin-hermes-profiles
npm install
bb plugin install . --yes
bb plugin config hermes-profiles set profiles 'default,coder,designer'
bb plugin reload hermes-profiles
bb provider list
```

The default setting is `default`. List the profiles you want exposed, separated by commas; use exact Hermes names (`hermes profile list`). A profile not installed on a selected machine will fail to start there. BB provider IDs remain stable for the same profile name, for example `hermes-profile-coder`.

Pick **Hermes · coder** in bb's new-thread provider selector. The bundled **Hermes Agent** provider remains available and follows Hermes's active/sticky profile; **Hermes · default** explicitly selects Hermes's root profile. To hide the bundled provider without uninstalling Hermes, run `bb provider disable acp-hermes-agent`.

Profiles are registered when the plugin loads. After changing the setting, run `bb plugin reload hermes-profiles`. Removing a profile unregisters its provider, so existing threads using it cannot continue until it is added again. Profile names are case-insensitive in Hermes and should be entered in lowercase here. `-` and `_` are encoded distinctly in provider IDs.

## Profile icons and labels

Each profile gets a monogram icon so the provider picker no longer shows identical robots. The plugin picks one or two letters automatically and avoids collisions. For example: `coder` → `CD`, `copyreviewer` → `CR`, `copywriter` → `CW`, `researcher` → `R`. Icons are written to `icons/generated/` each time the plugin loads and follow bb's light/dark theme.

The optional `presentation` setting changes how a profile looks in bb. It never changes the Hermes profile or the provider ID:

```sh
bb plugin config hermes-profiles set presentation '{
  "designer": { "label": "Design", "badge": "DS", "color": "#7C3AED" },
  "researcher": { "icon": "Search" },
  "coder": { "color": { "light": "#0F766E", "dark": "#5EEAD4" } }
}'
bb plugin reload hermes-profiles
```

| Field | Effect |
|---|---|
| `label` | Picker name after `Hermes · ` (1–60 characters) |
| `badge` | 1–2 letters or digits for the monogram; must be unique |
| `icon` | A bb glyph name such as `Palette` or `Search`, used instead of the monogram |
| `color` | Icon tint, `#RRGGBB` or `{ "light": …, "dark": … }` |

Invalid JSON, unknown fields, and duplicate badges are rejected when the setting is saved. Entries for profiles that are not in `profiles` are ignored and logged (`bb plugin logs hermes-profiles`). Don't rely on color alone to tell profiles apart: keep the badges or glyphs distinct.

## Check

```sh
bb provider models hermes-profile-coder
bb thread spawn --project <project-id> --provider hermes-profile-coder --prompt 'Hallo'
```

This is a full-trust local BB plugin. It passes no profile credentials through bb settings: Hermes reads them from its own per-profile home on the machine where the thread runs.
