# Imperial Cogitator — War on the Vespator Front

A static, dependency-free tactical campaign terminal for the *War on the Vespator Front* Warhammer 40,000 Crusade. Everything is rendered as vector graphics (SVG for the 2D map, WebGL via Three.js for the 3D view) directly from [`campaign_data.json`](campaign_data.json). `map.png` is a design reference only and is never loaded by the site.

## Features

- **All 13 systems and 18 warp lanes** read straight from `campaign_data.json`. Both the 2D map and the 3D projection place every world at its exact `x`/`y` coordinates, so the sector's outer perimeter is the same in both views. Current topology:
  - Sidon links to Knossos, Pluto II and Sarif IV.
  - Knossos links only to Sidon and Sarif IV.
  - Pluto II links to Sidon, Amazon XI and Nickel.
  - Sarif IV links to Sidon, Knossos and Harvest.
  - Nickel links to Pluto II, Amazon XI, Atacama and Baikonur.
  - Baikonur links to Nickel, Aetna and GJ 3378b.
  - Aetna links only to Atacama and Baikonur.
  - Harvest links to Sarif IV, Myrkviðr, Niflegard and GJ 3378b.
  - Niflegard links to Harvest and Myrkviðr.
- **The 9 official terrain twists:** Spaceport, Desolate Wastes, Xenoflora Jungle, Rad Zone, Forge Complex, Hab Sprawl, Delvesite Facility, Dead Lands and Tomb Complex. Each world lists its own `terrainTwists` (see [Terrain twists](#terrain-twists)). Under every map placard, green circular terrain glyphs show that world's twists. They replace the old faction circles.
- **Collapsible Theatre Index.** `[ ◀ HIDE INDEX / ▶ SHOW INDEX ]` at the top left hides the left panel. The tactical canvas widens to fill the space and refits without distortion. The choice is remembered between visits.
- **Canonical ship silhouettes** in 2D and 3D:
  - Imperium: gothic cathedral wedge cruiser with a prow ram
  - Chaos: winged slaughter cruiser with a spiked, jagged prow
  - Necrons: crescent scythe raider
  - Aeldari: curved solar-sail blade
- **`[ VECTORS: ON / OFF ]` toggle** in the top HUD shows or hides the active `offensiveVectors`, coloured by alliance (Imperium gold, Xenos green, Chaos red). The setting is remembered between visits.
  - In Tactical 2D, animated chevrons glide along the warp lane toward the target, with a pulsing arrowhead, a target reticle and the assault label.
  - In Cogitator 3D, comet-tailed projectiles travel along curved orbital arcs from origin to target and loop continuously.
  - **Orbital strikes** (`from` equals `to`) target the host world itself:
    - In 2D, a looping arrow curves around the orbit reticle, then dives toward the core with a pulsing impact marker.
    - In 3D, a particle conduit spirals down from high orbit to the surface.
  - Vectors that touch an Exterminated world are suspended and not drawn.
- **Kill Team operations** (`activeKillTeams`): covert ops shown as ✠ skull-and-dagger markers in the alliance colour on the map, in the dossier's **COVERT OPERATIONS** section, and as tethered emblems in 3D. Deploying one plays:
  - in 2D, a sniper-reticle lock-on around the target, phosphor scanlines sweeping the reticle, and three stealth chevrons contracting to the core that leave the covert badge;
  - in 3D, a stealth dart streaking down a steep descent cone into the planet, then an expanding electromagnetic shockwave ring with glitching scanline particles at the impact site.
- **Auto-persistence.** Every Warmaster edit saves to browser `localStorage`, so refreshing or restarting the browser keeps the live campaign (see [Persistence](#persistence-auto-save-reset-export)).
- **Per-alliance Power Levels (1–4).** Each world has a separate rating for Imperium (`#E5A93C`), Xenos (`#33FF33`), and Chaos (`#FF3333`). They appear as segmented vertical gauge cards on the map, in the theatre index, and in the dossier.
- **Planetary Dossier** showing:
  - designation, world and system name
  - a **Terrain Profile**: the classification plus each active terrain twist with its official glyph badge
  - infrastructure slot badges (Empty, Fortification Line, Support Facility, Staging Grounds, Stronghold) with alliance ownership
  - garrisoned fleet cards, each with its ship silhouette and faction insignia
  - linked warp lanes
  - inbound and outbound **Offensive Vectors**
- **Faction insignia:** Aquila (Imperial Guard), Knight Crest (Imperial Knights), Necron Ankh, Aeldari Rune, Chaos Star (Thousand Sons), and Nurgle Fly (Death Guard).
- **`[ TACTICAL 2D / COGITATOR 3D ]` toggle** in the top HUD. The 3D view shows:
  - rotating planets whose procedural surface comes from their first terrain twist. Examples:
    - Xenoflora Jungle: green jungle swirls under cloud cover
    - Rad Zone: blotched surface with a pulsing hazard glow
    - Forge Complex: smog with rust-coloured seams
    - Tomb Complex: glowing necron circuitry
    - Desolate Wastes: cracked, smoking crust
  - golden void-shield rings around fortress worlds
  - glowing warp-lane conduits
  - extruded faction ships orbiting their worlds
  - a construction effect: a rotating wireframe scaffold sphere with particle sparks
  - an Exterminatus animation that shatters the world into flaming debris
- **Retro CRT look:** scanlines, flicker, phosphor glow, and terminal typography. Respects `prefers-reduced-motion`.
- **Cloud Uplink and live sync:** the Warmaster publishes straight to GitHub from any device. Players auto-sync every 60 seconds or with **↻ RESYNC**.
- **Mobile / iOS Safari:** at 960px wide or less, the HUD commands fold into a **☰ COMMAND** drawer with 44px touch targets. The Planetary Dossier becomes a bottom sheet: tap or swipe its handle, and it opens automatically when you select a world. The layout respects safe areas (notch, home bar), and inputs use 16px text so iOS doesn't zoom in.

## Run locally (zero install)

ES modules need HTTP, so don't open `index.html` as a `file://` URL.

```bash
cd MapWebPage
python -m http.server 8000
```

Then open <http://localhost:8000>. Any static server works, for example `npx serve .`.

Three.js r180 is vendored in [`vendor/`](vendor/) with its MIT licence in `vendor/THREE-LICENSE.txt`, so the 3D view works offline and needs no `npm install`.

## Player vs. Warmaster mode

Players get **read-only** access: pan, zoom, switch between 2D and 3D, search, and open dossiers.

Press **◇ WARMASTER OVERRIDE** and enter the passkey from [`config.js`](config.js) (`warmasterPasskey`) to unlock:

| Command | How |
| --- | --- |
| Power Levels | Click any gauge segment on the map card, or use the dossier segment buttons and −/+ steppers. Each alliance is set independently, from 1 to 4. |
| Fleet movement | In Tactical 2D, drag a fleet marker onto a world connected by a **direct** warp lane, or use the dossier **TRANSFER** selector. Moves to non-adjacent or destroyed worlds are refused. |
| Fleets | Commission (faction, optional name) or decommission fleets in the dossier. Unnamed fleets display as `<Faction> Battlegroup`. |
| Infrastructure | Change slot capacity (max 6; only empty slots can be trimmed), set each slot's type (Empty, Active, Fortification Line, Support Facility, Staging Grounds, Stronghold) and owning alliance, toggle **DESTROYED**, or clear a slot (✕). Strongholds rename automatically (Imperial / Xenos / Chaos Stronghold). |
| Construct | **▲ CONSTRUCT INFRASTRUCTURE**: choose a type and an alliance. It builds in the first empty slot, opening a new slot if needed (max 6). Raising capacity with **+** also plays the effect. In 2D, the effect is expanding alliance-coloured hexagonal wireframes over a holographic blueprint scan. In 3D, it is the scaffold sphere. |
| Exterminatus | **☢ INITIATE EXTERMINATUS** turns the world into a red shattered hazard wireframe, blocks its lanes, and plays the destruction sequence in 3D. **↺ RESTORE WORLD** reverses it. |
| Launch Assault | In the dossier's **OFFENSIVE VECTORS** section, pick the attacking alliance and a target: either a world connected by a direct lane, or **⊙ ORBITAL STRIKE** against the host world itself. Add an optional designation, then press **⚔ LAUNCH ASSAULT**. The source must be intact, the target not destroyed, and the same from/to/alliance cannot be launched twice. Press **✕** on a vector card to recall it. |
| Kill Team | **[ ⚔ DEPLOY KILL TEAM OPERATION ]** in the dossier's **COVERT OPERATIONS** section opens a panel: pick the operation alliance (Imperium / Xenos / Chaos), the infiltration target (any intact world; the current world is listed first), and a codename (suggestions include "Operative Extraction", "Vox-Array Sabotage", "Crypt Infiltration"). Codenames are 1–80 characters and must be unique per target world. Press **✕** on an operation card to extract the team. |
| Persist | **⇩ EXPORT COGITATOR STATE** downloads an updated `campaign_data.json` with the lanes, offensive vectors (including orbital strikes), kill team operations, infrastructure and terrain twists. |
| Publish | **[ ☁ TRANSMIT TO WAR COUNCIL (PUBLISH) ]** commits the live state straight to `campaign_data.json` on GitHub (see [Cloud Uplink](#cloud-uplink-publish-from-any-device)). **☁ CLOUD UPLINK** configures the repository, branch and token. |
| Reset | **[ ↺ RESET TO ORIGINAL CANONICAL STATE ]** asks for confirmation, then wipes the local auto-save and reloads `campaign_data.json`. |

> The passkey is only a UI lock: anyone can read the static files. Real authority is whoever can commit to the repository.

## Persistence (auto-save, reset, export)

Every Warmaster change (power levels, infrastructure, construction, fleets, assaults, kill teams, Exterminatus, imported files) is written immediately to `localStorage` under the key **`vespator_cogitator_active_state`**. The saved envelope is `{ version, savedAt, dirty, baseline, campaign }`, where `baseline` is a fingerprint of the `campaign_data.json` it was based on.

On page load:

1. If the browser has a saved state, it is loaded instead of the defaults. The status line reports "restored from local auto-save" and the save time.
2. If nothing is saved, `campaign_data.json` is the baseline.
3. If a saved state has been **exported** (nothing unexported) and the server's `campaign_data.json` has since changed, the newer feed wins and the old auto-save is discarded. Unexported edits are never discarded automatically; instead a notice says the feed has drifted.

Auto-save is per browser and per device. To publish changes for everyone, either press **☁ TRANSMIT TO WAR COUNCIL** (below), or do it by hand:

1. **⇩ EXPORT COGITATOR STATE**.
2. Replace `MapWebPage/campaign_data.json` with the downloaded file.
3. Commit and push. The site redeploys, and the Discord bot reads the new state.

**↺ RESET TO ORIGINAL CANONICAL STATE** (Warmaster only) clears the auto-save and reloads `campaign_data.json` after a confirmation. **↻ RESYNC** (HUD) and **↻ RE-SYNC FEED** (index) pull the latest feed; they only ask for confirmation when this browser holds unpublished edits. **↑ LOAD JSON** loads a file for previewing and auto-saves it. Every fetch uses `cache: "no-store"` plus a timestamp query string, so neither the browser nor the GitHub Pages CDN serves a stale copy. If `localStorage` is unavailable (private mode, quota), the status line says so and the page warns before closing with unexported edits.

## Live auto-sync for players

Whenever this browser has **no unpublished edits**, the cogitator re-reads `campaign_data.json?t=<timestamp>` every **60 seconds** (`feedPollSeconds` in [`config.js`](config.js); `0` disables polling), and again when the tab returns to the foreground. A newer feed is adopted in place: the selected world, camera and 2D/3D view are kept. The map header shows **FEED hh:mm:ss · AUTO 60s**. Press **↻ RESYNC** to pull immediately.

Unpublished Warmaster edits are never overwritten automatically. If a newer feed arrives while you have edits, the header shows **FEED ⚠ UPDATE HELD**: either transmit your edits (the cogitator warns about the divergence first) or RESET to adopt the feed.

Players read the copy served with the site, so they see a transmission once the Pages workflow has redeployed (about a minute). A device with a Cloud Uplink token reads directly from the repository branch through the API, so it sees the change immediately.

## Cloud Uplink (publish from any device)

The Warmaster can commit the live campaign to GitHub from a phone or desktop, with no git client, using the [GitHub Contents API](https://docs.github.com/en/rest/repos/contents).

1. Create a **fine-grained personal access token** at GitHub → Settings → Developer settings → Fine-grained tokens:
   - Repository access: **Only select repositories** → `vespator-map-web`
   - Permissions: **Contents: Read and write** (Metadata: read-only is added automatically). Nothing else.
   - A short expiry, for example 30–90 days.
2. Unlock Warmaster mode and press **☁ CLOUD UPLINK**. Enter the repository (`owner/repo`; defaults from `uplinkRepo` in `config.js`), the branch (default `main`) and the token. **TEST LINK** checks access and push permission; **SAVE UPLINK** stores the settings.
3. Press **[ ☁ TRANSMIT TO WAR COUNCIL (PUBLISH) ]**. The cogitator:
   1. `GET /repos/{owner}/{repo}/contents/campaign_data.json?ref={branch}` to read the current file SHA;
   2. if GitHub's file changed since this browser last synced (another Warmaster, the bot, a manual commit), asks before overwriting;
   3. `PUT /repos/{owner}/{repo}/contents/campaign_data.json` with the base64 (UTF-8) JSON, the SHA and the branch;
   4. shows **TRANSMITTING ASTROPATHIC COGITATOR FEED... SUCCESS** with a link to the commit, and clears the unpublished-edits flag.

   The commit triggers the Pages workflow, so the site redeploys for every player. Errors (expired token, missing permission, 409 conflict, rate limit, offline, 30 s timeout) appear in the transmission log; the edits stay auto-saved so you can retry.

**Token storage and security**

- The token is stored only in this browser: in `localStorage` (`vespator_cogitator_uplink`) when *Remember on this device* is ticked, otherwise in `sessionStorage` until the tab closes. **FORGET TOKEN** erases it. Enter it once per device.
- It is sent only to `api.github.com`. It is never written into the campaign state, exports, commits or the repository.
- Browser storage is not a vault. Any script running on the same origin can read it, and all `<user>.github.io` project sites share one origin. Only use a token scoped to this one repository with Contents permission, keep its expiry short, and revoke it on GitHub if a device is lost.
- The Warmaster passkey is only a UI lock. The token is what actually grants write access.

## Data schema

```jsonc
{
  "campaignName": "The Vespator Front",
  "alliances": {
    "Imperium": { "color": "#E5A93C", "factions": ["Imperial Guard", "Imperial Knights"] },
    "Xenos":    { "color": "#33FF33", "factions": ["Necrons", "Aeldari"] },
    "Chaos":    { "color": "#FF3333", "factions": ["Thousand Sons", "Death Guard"] }
  },
  "planets": [{
    "id": "gj_3378b", "name": "GJ 3378b", "subName": "GJ 3378", "x": 870, "y": 820,
    "powerLevels": { "Imperium": 4, "Xenos": 3, "Chaos": 1 },        // each 1–4
    "infrastructure": {
      "maxSlots": 3,                                                  // 0–6
      "slots": ["active", "empty", { "type": "Imperial Stronghold", "alliance": "Imperium", "destroyed": true }]
    },
    "terrain": "Hab Sprawl & Rad Zone Citadel",
    "terrainTwists": ["Hab Sprawl", "Rad Zone", "Spaceport"],        // 1-3 of the 9 official twists
    "terrainIcons": ["hab_sprawl", "rad_zone", "spaceport"],          // glyph keys, kept in step with terrainTwists
    "fleets": [{ "alliance": "Imperium", "faction": "Imperial Knights", "badge": "knight_helm" }],  // optional "name"
    "destroyed": false
  }],
  "warpLanes": [["harvest", "gj_3378b"], ["sidon", "sarif_iv"]],
  "offensiveVectors": [
    { "from": "gj_3378b", "to": "harvest", "alliance": "Imperium", "label": "Crusade Spearhead" },  // label optional, 1–80 chars
    { "from": "pluto_ii", "to": "pluto_ii", "alliance": "Chaos", "label": "Orbital Bombardment" }  // from == to: orbital strike
  ],
  "activeKillTeams": [
    // id unique; target any world; codename 1–80 chars, unique per target; "from" (optional) = dossier it was launched from
    { "id": "kt-a1b2c3", "alliance": "Xenos", "target": "sidon", "codename": "Crypt Infiltration", "from": "knossos" }
  ]
}
```

### Terrain twists

| Twist | Glyph key | Worlds |
| --- | --- | --- |
| Spaceport | `spaceport` | Baikonur, GJ 3378b |
| Desolate Wastes | `desolate_wastes` | Sidon, Harvest, Pluto II, Nickel, Aetna |
| Xenoflora Jungle | `xenoflora_jungle` | Myrkviðr, Harvest, Sarif IV, Amazon XI |
| Rad Zone | `rad_zone` | Sidon, Pluto II, Aetna, GJ 3378b |
| Forge Complex | `forge_complex` | Knossos, Harvest |
| Hab Sprawl | `hab_sprawl` | Knossos, Sarif IV, Baikonur, GJ 3378b |
| Delvesite Facility | `delvesite_facility` | Sidon, Niflegard, Atacama |
| Dead Lands | `dead_lands` | Myrkviðr, Niflegard, Pluto II, Amazon XI, Atacama |
| Tomb Complex | `tomb_complex` | Sarif IV, Nickel, Atacama |

`normalizeCampaign` in [`campaign.js`](campaign.js) rebuilds `terrainIcons` from `terrainTwists` on every load, so the glyphs always match the twists. Older files without `terrainTwists` are migrated from any official twist names found in `terrainTraits` or `terrainIcons`. The obsolete `terrainTraits` and `terrainCategory` fields are dropped, and the status bar reports how many worlds were migrated. The source file is never rewritten; **export** and commit to persist the result.

Infrastructure slots are the strings `"empty"` and `"active"` until a Warmaster gives a slot a type, owner or destroyed state. It then becomes an object `{ "type", "alliance"?, "destroyed"? }`. Fleet `badge` keys are `imperial_aquila`, `knight_helm`, `necron_monolith`, `craftworld_rune`, `chaos_star` and `nurgle_fly`.

[`campaign.js`](campaign.js) validates every load and import:

- exactly the three alliances, with unique factions
- integer Power Levels from 1 to 4
- 1–3 distinct official `terrainTwists` per world
- `infrastructure.slots` has exactly `maxSlots` entries
- each fleet's alliance matches its faction
- lanes that are not duplicated
- offensive vectors that either follow a direct lane between two worlds or target their own world (`from == to`, an orbital strike), with a valid alliance, an optional label of 1–80 characters, and no duplicate from/to/alliance

Unknown extra properties are preserved on export.

## Tests and build

```bash
npm test          # node --test: rules, data integrity, emblems, terrain themes, Cloud Uplink API client
python build.py   # copies the static site + vendor/ into dist/
```

## Publish only `MapWebPage/` to GitHub

[`setup_repo.sh`](setup_repo.sh) creates a Git repository rooted **inside** `MapWebPage/`. Sibling folders such as `../DiscordBot/` are never included.

```bash
cd MapWebPage
bash setup_repo.sh
```

The script:

1. runs `git init -b main`
2. commits the folder
3. runs `gh repo create vespator-map-web --private --source=. --remote=origin --push`

It needs `git` and an authenticated GitHub CLI (`gh auth login`). It refuses to replace an existing `origin`.

Then go to **Settings → Pages → Source** and select **GitHub Actions**. [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs on every push to `main`: it tests, builds `dist/`, and deploys to Pages. Pages on a private repository requires a GitHub plan that supports it (Pro, Team, or Enterprise).

## Syncing with the Discord bot

The neighbouring `DiscordBot/` folder is a separate project; nothing here modifies it. `campaign_data.json` is the shared contract between the two.

- **Read (simplest):** the bot fetches the published JSON over HTTP, for example `https://<user>.github.io/vespator-map-web/campaign_data.json`. For a private repo without public Pages, use the GitHub contents API with a read-only token:
  ```bash
  curl -H "Authorization: Bearer $GITHUB_TOKEN" \
       -H "Accept: application/vnd.github.raw+json" \
       https://api.github.com/repos/<user>/vespator-map-web/contents/campaign_data.json
  ```
- **Read (same machine):** open `../MapWebPage/campaign_data.json` directly, read-only, and reload it when the file changes.
- **Write:** have the bot (or a Warmaster) commit an updated `campaign_data.json`, either with `git commit` + `git push` or the contents API `PUT` with the file's current `sha`. The Pages workflow redeploys automatically. Keep to the schema above. Slots are `"empty"`, `"active"`, or `{ type, alliance?, destroyed? }`. Strongholds are named `<Imperial|Xenos|Chaos> Stronghold`, and other typed slots are `Fortification Line`, `Support Facility`, or `Staging Grounds`. When reading over HTTP, add a cache-busting query (`?t=<timestamp>`) so the bot always sees the latest deploy.
- **Offensive vectors:** read `offensiveVectors` to announce active assaults, for example "⚔ Chaos — Warp Incursion: Pluto II → Nickel". A vector whose `from` equals its `to` is an orbital strike on that world, for example "⊙ Chaos — Orbital Bombardment: Pluto II". Ignore any vector whose source or target has `destroyed: true`; `activeVectors` does this. A bot can add an assault with `launchAssault(data, from, to, alliance, label)` or remove one with `recallAssault(data, index)`, then commit the file.
- **Kill teams:** read `activeKillTeams` to announce covert ops, for example "✠ Xenos — Crypt Infiltration: Sidon". Operations on a destroyed world are dormant; `activeKillTeams(data)` filters them out. A bot can add one with `deployKillTeam(data, from, target, alliance, codename)` or remove one with `extractKillTeam(data, id)`. The array is optional: a file without it loads as `[]`.
- Live edits in a Warmaster's browser exist only in that browser's `localStorage` until they are transmitted (Cloud Uplink) or exported and committed, so the bot only sees the committed file. A transmission is a normal commit: the bot can read it immediately through the contents API (above), or over Pages once the redeploy finishes. Before writing, a bot should read the file's current `sha` and send it with its `PUT`, so it can never silently overwrite a Warmaster's transmission; GitHub answers `409` if the file changed in between.
- Useful helpers for a JavaScript bot: `normalizeCampaign`, `validateCampaign`, `activeVectors`, `constructInfrastructure`, `moveFleet`, `setPowerLevel`, `setSlot`, `slotInfo`, `fleetTitle`, and `serializeCampaign` from [`campaign.js`](campaign.js) are pure ES modules with no DOM dependencies.

## Files

| File | Purpose |
| --- | --- |
| `index.html`, `styles.css` | Shell and CRT styling |
| `app.js` | 2D SVG map, theatre index, dossier, Warmaster commands, export/import |
| `view3d.js` | Integrated Three.js Cogitator 3D view (lazy-loaded on toggle) |
| `campaign.js` | Schema validation and campaign rules |
| `emblems.js`, `terrain.js` | Faction insignia, ship silhouettes, the 9 terrain twist glyphs, and terrain surface/3D effect themes |
| `config.js` | Warmaster passkey, map scale, Cloud Uplink defaults (`uplinkRepo`, `uplinkBranch`, `uplinkPath`) and `feedPollSeconds` |
| `uplink.js` | GitHub Contents API client (read SHA, PUT commit, verify access) and device token storage; no DOM dependencies |
| `vendor/` | Three.js r180 (MIT) |
| `tests/` | Node test suite |
| `build.py`, `.github/workflows/deploy.yml` | Static build and GitHub Pages deployment |
| `setup_repo.sh` | One-time private GitHub repository bootstrap |

The 3D view is built into the main interface, so the former `create_3d_branch.sh` script is no longer needed.
