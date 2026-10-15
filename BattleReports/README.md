# Vespator Front — Battle Reports Archive

A static web app with no dependencies that publishes the campaign's battle reports from
[`data/battle_reports.json`](./data/battle_reports.json) and lets the Warmaster edit
them and push changes straight to GitHub.

It lives inside the `vespator-map-web` repository and is deployed with the map:

The local `MapWebPage/` folder is this Git repository's root, so source paths on
GitHub start with `BattleReports/`, not `MapWebPage/BattleReports/`.
The map HUD links to **BATTLE CHRONICLES**; **TACTICAL COGITATOR** returns to the
map using `../index.html`, which also works when serving the repository locally.

| What | URL |
|---|---|
| Web app | <https://tamirlanmamutov.github.io/vespator-map-web/BattleReports/> |
| Data (Pages) | <https://tamirlanmamutov.github.io/vespator-map-web/BattleReports/data/battle_reports.json> |
| Data (raw, for the bot) | <https://raw.githubusercontent.com/TamirlanMamutov/vespator-map-web/main/BattleReports/data/battle_reports.json> |

## Run

Serve the folder over HTTP (ES modules don't load from `file://`):

```
python -m http.server 8000
```

Then open <http://localhost:8000/>.

## Deploy

`../.github/workflows/deploy.yml` runs on every push to `main`:

1. `npm test`, which includes `tests/battlereports.test.js`. This validates every
   report and the uplink defaults.
2. `python build.py`, which copies this folder's app files, `data/battle_reports.json`
   and any `assets/**` images into `dist/BattleReports/`.

Every **TRANSMIT** or pict-feed upload is a commit to `main`, so it triggers a redeploy
by itself. The Pages copy updates about 1–2 minutes later. Until then, **⇩ PULL** in the
Uplink dialog reads the branch directly.

### Cache busting

Every stylesheet, script tag and module `import` carries a version query (`?v=1.2`),
so returning visitors don't run stale cached code. When you deploy changes, raise the
version **everywhere at once**: in `index.html` and in the `import` lines of
`app.js` and `images.js`. A module imported under two different URLs gets loaded
twice, as two separate copies.

## Modes

**Public archive (read-only).** Reports are listed newest-first; you can toggle the sort
and search by planet, faction, commander, mission or text. Each card shows header
artwork, metadata, side-by-side player headers with alliance badges, VP and the
victory stamp, then the context, highlights and aftermath (with artwork). Below that are
collapsible Crusade rosters: CP/RP, faction resources, agendas, Out of Action tests and
scars, Marked for Greatness, promotions and an XP breakdown. `#BR-002` links straight
to a report.

**Warmaster edit & dispatch.** Click **◇ WARMASTER ACCESS** and enter the passkey
(`passkey` in [`config.js`](./config.js)). This is only a UI gate. The real protection is
the GitHub token, since the archive JSON is public anyway. Once unlocked you can:

- create, edit and delete reports. Every field of the schema is editable, and you can
  add or remove players, agendas, OOA tests and promotions;
- see live hints for battle XP and `start + gained − spent` RP (informational only);
- preview artwork as thumbnails (accepts `http(s)` URLs, or files you drop or paste);
- export or import `battle_reports.json`.

Edits are saved as a local draft in this browser (offered back after a reload) until you
**⇪ TRANSMIT** them.

### Order of Battle and roster ingestion

Each player has an expandable **ORDER OF BATTLE / ACTIVE ROSTER**, an army points
tally, and **+ ADD UNIT MANUALLY**. Unit cards track custom and datasheet names,
role, Warlord status, points/PL, starting XP/rank/Crusade points, existing honors
(including enhancements and relics), and scars. Separate honors/scars with semicolons
or new lines; commas inside names are preserved.

**IMPORT YELLOWSCRIBE / ROSTER DATA → AUTO-PARSE ROSTER** accepts:

- YellowScribe `units` or `armyData` dictionaries (and their `order` array);
- JSON armies with `units` or `roster` arrays;
- converted BattleScribe `.ros`/`.rosz` JSON with `forces → selections`, including
  XML-to-JSON `$` attributes and array wrappers;
- clipboard text or fenced code blocks, with unit lines such as
  `Canoptek Wraiths (250 Points)` or `Knight Valiant [22 PL, 530pts]`.
  `Faction:`, `Detachment:`, `Total Army Points:`, `Custom Name:`, `XP:`,
  `Rank:`, `Crusade Points:`, `Enhancement:`, `Relic:` and `Scar:` are recognized.
- an eight-character YellowScribe share code, `Code: deadbeef`, or
  `{"code":"deadbeef"}`. Only the code is sent to the official
  `https://yellowscribe.link/get_army_by_id` lookup endpoint; army JSON/text
  is parsed locally.

Import **appends** units with fresh player-local IDs; it never replaces existing
cards or links. Faction, detachment and Warlord metadata populate when present.
Missing metadata/costs and a declared-total mismatch are reported for manual review.
Raw ZIP `.rosz` files must be converted to JSON or text first. Share codes usually
expire after about ten minutes. Lookup requires internet access and the service
allowing cross-origin browser requests; failures are displayed explicitly with a
prompt to paste the decoded JSON/text export. No proxy or guessed roster is used.

Post-game targets use reactive, player-specific selectors showing custom + datasheet
names. **Custom / Other Unit** preserves older reports and unlisted reinforcements.
Deleting a card retains its existing post-game records as named Custom / Other
references. Renaming a card refreshes selectors and persisted display names.

Unit cards show a live **POST-GAME** result: completed linked agenda XP and Marked
for Greatness (+3 XP), promotions/rewards, and scars from failed Out of Action tests.
The editable XP/rank/honors/scars remain **starting** values: results are derived from
the linked records, not cumulatively rewritten, so saving/reopening never awards XP
or scars twice. Unchecking a completed agenda or changing the selected unit reverses
the corresponding derived award. Promotions use thresholds 6/16/31/51 XP and offer
eligible ranks above the starting rank.

### AI Narrative Drafter / Image Helper

The panel in the editor turns rough bullet points into a Gothic grimdark prompt for
the chosen section (context, highlights or aftermath), voice and language
(RU/EN). It includes the battle's metadata and forces. Copy the prompt into any AI
chat, paste the reply into the output box and press **APPLY TO SECTION**. Nothing is
sent to an AI service automatically. **OFFLINE DRAFT** builds a template draft
without any AI. **BUILD ART PROMPT** writes an image-generation prompt for the header
or aftermath artwork. Paste the resulting image URL into the artwork field, or drop
the image file onto the field (see below).

> Discord attachment links expire after a while. Existing images in the data
> that show "PICT-FEED LOST" need to be re-hosted.

### Artwork: URL or drop zone

The **Header** and **Aftermath** image fields accept either input:

- **URL box**: paste any `https://…` image link.
- **Drop zone** `[ DRAG & DROP PICT-FEED OR CLICK TO UPLOAD ]`: drag in an image
  file, click it (or press Enter/Space) to browse, or focus it and press **Ctrl+V** to
  paste an image from the clipboard. Dropping or pasting an image link works too.

What happens next depends on the uplink:

| Uplink | Result |
|---|---|
| Configured with a token | The image is committed straight to the repository as `assets/reports/<ID>_<header\|aftermath>_<timestamp>.<ext>`. This sits next to the data folder, so with `BattleReports/data/battle_reports.json` it goes to `BattleReports/assets/reports/`. The field is then set to the file's `raw.githubusercontent.com` URL. |
| No token (offline) | The image is shrunk to a compressed JPEG data URL (max 1280 px) and stored inside the report, so you can preview and save it immediately. |

While the upload runs the field shows `[ TRANSMITTING PICT-FEED TO ARCHIVES... ]`,
then `[ PICT-FEED SECURED ]` with a link to the commit.

On **TRANSMIT**, any offline (data URL) images are first uploaded as assets and swapped
for their raw URLs. This matters because Discord can only embed http(s) images, and the
bot skips data URLs.

Notes:

- Large images are re-encoded as JPEG before upload. Files that are already web-sized
  PNG/JPEG/WebP (≤ 5 MB) or GIF (≤ 8 MB) are uploaded unchanged.
- Raw URLs only work for **public** repositories.
- Each upload is its own commit. If you cancel the edit, the image stays in
  `assets/reports/` and can be deleted by hand.

## Uplink (GitHub publishing)

**☁ UPLINK** configures where [`uplink.js`](./uplink.js) commits the JSON through
the GitHub Contents API:

| Field | Default |
|---|---|
| Repository | `TamirlanMamutov/vespator-map-web` |
| Branch | `main` |
| File path | `BattleReports/data/battle_reports.json` (artwork goes to `BattleReports/assets/reports/`) |

Defaults live in [`config.js`](./config.js). Create a **fine-grained personal access
token** at GitHub → Settings → Developer settings:

- Repository access: *Only select repositories* → `vespator-map-web`
- Permissions: **Contents: Read and write** (Metadata: read-only is added automatically)

The map's War Council uplink needs the same permission on the same repository, so one
token can serve both apps.

The token stays in this browser only: localStorage if you tick "remember", otherwise
sessionStorage. **TRANSMIT** checks that the remote file hasn't changed since the archive
was loaded and asks before overwriting someone else's commit. **⇩ PULL** reloads from
the branch directly, skipping the GitHub Pages cache delay.

## Discord bot

The dialog also shows the raw URL of the file. Set it as `REPORTS_DATA_URL` in the
`DiscordBot` and use `/post-report [report_id]` to publish a report (see
`DiscordBot/README.md`).

## Schema

`battle_reports.json` is an array, stored in chronological order:

```jsonc
{
  "id": "BR-002", "battleNumber": 2, "title": "…", "date": "2026-08-22",
  "location": "…", "mission": "…", "battleSize": "600pt",
  "headerImageUrl": "https://…", "aftermathImageUrl": "https://…",
  "narrativeContext": "…", "highlights": ["…"], "narrativeAftermath": "…",
  "players": [{
    "handle": "@user", "discordId": "123…",          // discordId optional
    "commander": "…", "faction": "…", "alliance": "Imperium|Xenos|Chaos",
    "warlord": "…", "score": 60, "isWinner": true, "startCP": 0, "endCP": 1,
    "detachment": "Canoptek Court", "pointsTotal": 250, // calculated from roster
    "roster": [{
      "id": "unit-1", "customName": "Dust Wraiths", "baseName": "Canoptek Wraiths",
      "points": 250, "role": "Infantry", "isWarlord": false,
      "xp": 3, "rank": "Battle-Ready", "honors": [], "scars": [],
      "crusadePoints": 0, "powerLevel": 0
    }],
    "rp": { "start": 5, "gained": 1, "spent": 0, "total": 6, "spentOn": "…" },
    "specialResource": { "name": "Awakening Points", "start": 2, "end": 1, "note": "…" }, // optional
    "agendas": [{ "name": "…", "unitId": "unit-1", "unit": "Dust Wraiths — Canoptek Wraiths", "completed": true, "xp": 1 }],
    "outOfActionTests": [{ "unitId": "unit-1", "unit": "Dust Wraiths — Canoptek Wraiths", "passed": false, "scar": "Fatigued" }],
    "markedForGreatness": { "unitId": "unit-1", "unit": "Dust Wraiths — Canoptek Wraiths", "xp": 3, "reason": "…" },
    "rankPromotions": [{ "unitId": "unit-1", "unit": "Dust Wraiths — Canoptek Wraiths", "newRank": "Bloodied", "reward": "…" }]
  }]
}
```

`roster` defaults to `[]` when absent; BR-001/BR-002 retain their legacy named
records without inventing a historical army list. `unitId` is optional for legacy
and Custom / Other records; `unit` remains the backward-compatible display name
for the chronicle and Discord bot. Starting ranks are Battle-Ready, Bloodied,
Battle-Hardened, Heroic, and Legendary.

## Files

| File | Purpose |
|---|---|
| `index.html`, `styles.css` | Layout and CRT phosphor theme |
| `app.js` | UI: archive rendering, passkey, editor, draft, transmit |
| `reports.js` | Schema, roster parsing, unit references, normalization, validation, post-game math |
| `ai_helper.js` | Prompt builders and offline drafter |
| `uplink.js` | GitHub Contents API client (JSON archive and image assets) |
| `images.js` | Drop/paste image intake, resize/compress, data URL helpers |
| `config.js` | Passkey, uplink defaults, map link |
