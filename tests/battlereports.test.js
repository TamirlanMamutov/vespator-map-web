import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { settings } from "../BattleReports/config.js";
import * as R from "../BattleReports/reports.js";
import * as U from "../BattleReports/uplink.js";
import * as IMG from "../BattleReports/images.js";

const DATA = new URL("../BattleReports/data/battle_reports.json", import.meta.url);

test("battle report archive parses and every report validates", async () => {
  const reports = R.parseReports(await readFile(DATA, "utf8"));
  assert.ok(reports.length >= 1);
  assert.equal(new Set(reports.map((r) => r.id)).size, reports.length, "report IDs are unique");
  for (const report of reports) assert.deepEqual(R.validateReport(report, reports, report.id), [], report.id);
});

test("uplink defaults publish into vespator-map-web/BattleReports", () => {
  assert.equal(settings.uplinkRepo, "TamirlanMamutov/vespator-map-web");
  assert.equal(settings.uplinkBranch, "main");
  assert.equal(settings.uplinkPath, "BattleReports/data/battle_reports.json");
  assert.equal(settings.uplinkPath, U.DEFAULT_PATH);
  assert.equal(U.DEFAULT_ASSET_DIR, "BattleReports/assets/reports");
  const config = U.normalizeUplink({ repo: settings.uplinkRepo, branch: settings.uplinkBranch, path: settings.uplinkPath });
  assert.equal(U.rawUrl(config), "https://raw.githubusercontent.com/TamirlanMamutov/vespator-map-web/main/BattleReports/data/battle_reports.json");
  assert.equal(U.assetPath(config, "BR-003", "header", "png", 1700000000000), "BattleReports/assets/reports/BR-003_header_1700000000000.png");
});

test("map and chronicle navigation and module assets resolve under the Pages subpath", async () => {
  const mapHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const chronicleHtml = await readFile(new URL("../BattleReports/index.html", import.meta.url), "utf8");
  const mapUrl = new URL("https://TamirlanMamutov.github.io/vespator-map-web/index.html");
  assert.match(mapHtml, /href="BattleReports\/index\.html">\[ 📜 BATTLE CHRONICLES \]/);
  assert.match(chronicleHtml, /id="map-link"[^>]*href="\.\.\/index\.html">\[ 🗺 TACTICAL COGITATOR \]/);
  const chronicleUrl = new URL("BattleReports/index.html", mapUrl);
  assert.equal(new URL(settings.mapUrl, chronicleUrl).href, mapUrl.href);
  assert.equal(new URL(settings.feedUrl, chronicleUrl).pathname, "/vespator-map-web/BattleReports/data/battle_reports.json");
  for (const match of chronicleHtml.matchAll(/(?:src|href)="([^"]+\.(?:js|css)(?:\?[^"]*)?)"/g)) {
    const url = new URL(match[1], chronicleUrl);
    assert.ok(url.pathname.startsWith("/vespator-map-web/BattleReports/"), match[1]);
    const source = new URL(`../BattleReports/${match[1]}`, import.meta.url);
    source.search = "";
    assert.ok((await readFile(source)).length > 0, match[1]);
  }
});

test("asset names are sanitized", () => {
  assert.equal(U.assetFileName("../br 7!", "Aftermath", ".JPG", 5), "BR-7_aftermath_5.jpg");
});

test("artwork fields accept web URLs and raster data images only", () => {
  assert.ok(R.isImageUrl("https://raw.githubusercontent.com/a/b/main/x.png"));
  assert.ok(R.isImageUrl("data:image/jpeg;base64,/9j/4AAQ"));
  assert.ok(!R.isImageUrl("data:image/svg+xml;base64,PHN2Zz4="));
  assert.ok(!R.isImageUrl("javascript:alert(1)"));
});

test("legacy reports without rosters or unit IDs retain all named Crusade records", async () => {
  const legacy = JSON.parse(await readFile(DATA, "utf8"));
  for (const report of legacy) for (const player of report.players) delete player.roster;
  const reports = R.parseReports(JSON.stringify(legacy));
  reports.forEach((report, index) => report.players.forEach((player, playerIndex) => {
    assert.deepEqual(player.roster, []);
    assert.deepEqual(player.outOfActionTests, legacy[index].players[playerIndex].outOfActionTests);
    assert.deepEqual(player.markedForGreatness, legacy[index].players[playerIndex].markedForGreatness);
    assert.deepEqual(player.rankPromotions, legacy[index].players[playerIndex].rankPromotions);
    assert.deepEqual(R.validateReport(report, reports, report.id), []);
  }));
});

test("YellowScribe units and armyData dictionaries preserve order, Unicode and starting stats", () => {
  const data = {
    faction: "Imperial Knights", detachment: "Noble Lance", pointsTotal: 680,
    order: ["knight", "armiger"],
    units: {
      armiger: { name: "Armiger Warglaive", points: 150, keywords: ["Vehicle", "Battleline"] },
      knight: { name: "Knight Valiant", customName: "Севериан Вальгард фон Зеттюр", points: 530,
        keywords: ["Vehicle", "Character", "Warlord"],
        crusade: { currentXp: 16, rank: "Battle-Hardened", crusadePoints: 2,
          enhancements: [{ name: "Ancient Oath" }], relics: ["Auto-medicae"], scars: ["Fatigued"] } },
    },
  };
  const parsed = R.parseRoster(JSON.stringify(data));
  assert.equal(parsed.faction, "Imperial Knights");
  assert.equal(parsed.detachment, "Noble Lance");
  assert.equal(parsed.pointsTotal, 680);
  assert.deepEqual(parsed.warnings, []);
  assert.equal(parsed.roster[0].customName, "Севериан Вальгард фон Зеттюр");
  assert.equal(parsed.roster[0].isWarlord, true);
  assert.equal(parsed.roster[0].xp, 16);
  assert.equal(parsed.roster[0].crusadePoints, 2);
  assert.deepEqual(parsed.roster[0].honors, ["Ancient Oath", "Auto-medicae"]);
  assert.deepEqual(parsed.roster[0].scars, ["Fatigued"]);
  assert.match(parsed.roster[1].role, /Battleline/);
  const stored = R.parseRoster(JSON.stringify({ armyData: data.units, order: data.order }));
  assert.equal(stored.roster[0].baseName, "Knight Valiant");
  assert.equal(stored.pointsTotal, 680);
  assert.ok(stored.warnings.some((warning) => warning.includes("Faction")));
});

test("converted BattleScribe forces aggregate nested costs without importing equipment or models twice", () => {
  const cost = (value) => [{ cost: [{ $: { name: "pts", value: String(value) } }] }];
  const parsed = R.parseRoster(JSON.stringify({
    roster: [{ $: { name: "Test army" }, costs: cost(85), forces: [{ force: [{
      $: { catalogueName: "Necrons", name: "Canoptek Court" },
      selections: [{ selection: [
        { $: { type: "unit", name: "Technomancer", customName: "Torinakh, Prime" }, costs: cost(0),
          categories: [{ category: [{ $: { name: "Character", primary: "true" } }] }],
          selections: [{ selection: [
            { $: { type: "model", name: "Technomancer" }, costs: cost(80) },
            { $: { type: "upgrade", name: "Warlord" }, costs: cost(0) },
            { $: { type: "upgrade", name: "Enhancement: Dust Mantle" }, costs: cost(5) },
          ] }] },
        { $: { type: "upgrade", name: "Army configuration" }, selections: [{ selection: [] }] },
      ] }],
    }] }] }],
  }));
  assert.equal(parsed.faction, "Necrons");
  assert.equal(parsed.detachment, "Canoptek Court");
  assert.equal(parsed.roster.length, 1);
  assert.equal(parsed.roster[0].points, 85);
  assert.equal(parsed.roster[0].role, "Character");
  assert.equal(parsed.roster[0].isWarlord, true);
  assert.deepEqual(parsed.roster[0].honors, ["Enhancement: Dust Mantle"]);
  assert.deepEqual(parsed.warnings, []);
});

test("canonical JSON arrays and fenced clipboard text parse points, PL and Crusade metadata", () => {
  const text = [
    "```text", "Faction: Necrons", "Detachment: Canoptek Court", "Total Army Points: 335",
    "CHARACTERS", "Torinakh, Prime — Technomancer (85 Points)",
    "• Warlord", "• XP: 6", "• Rank: Bloodied", "• Crusade Points: 1",
    "• Enhancement: Dust Mantle", "• Scar: Fatigued",
    "OTHER DATASHEETS", "Canoptek Wraiths [12 PL, 250pts]", "```",
  ].join("\n");
  const parsed = R.parseRoster(text);
  assert.equal(parsed.pointsTotal, 335);
  assert.equal(parsed.roster.length, 2);
  assert.equal(parsed.roster[0].customName, "Torinakh, Prime");
  assert.equal(parsed.roster[0].baseName, "Technomancer");
  assert.equal(parsed.roster[0].xp, 6);
  assert.equal(parsed.roster[0].rank, "Bloodied");
  assert.deepEqual(parsed.roster[0].scars, ["Fatigued"]);
  assert.equal(parsed.roster[1].powerLevel, 12);
  assert.deepEqual(parsed.warnings, []);
  const json = R.parseRoster(JSON.stringify(parsed));
  assert.equal(json.faction, "Necrons");
  assert.equal(json.detachment, "Canoptek Court");
  assert.equal(json.pointsTotal, 335);
  assert.deepEqual(R.tags("Torinakh, Prime; Dust Mantle\nAncient Oath"), ["Torinakh, Prime", "Dust Mantle", "Ancient Oath"]);
});

test("invalid imports fail explicitly; absent costs and mismatched totals produce review warnings", () => {
  for (const [text, pattern] of [
    ["", /Paste/], ["deadbeef", /share code/], ['{"code":"deadbeef"}', /No units/],
    ['{"units":', /Invalid roster JSON/], ["arbitrary clipboard text", /No units/],
    ['{"units":[{"name":"Knight","points":-1}]}', /non-negative/],
    ['{"units":[{"name":"Knight","points":"abc"}]}', /non-negative/],
    ['{"units":[{"name":"Knight","rank":"Champion"}]}', /unsupported rank/],
  ]) assert.throws(() => R.parseRoster(text), pattern);
  const parsed = R.parseRoster('{"faction":"Necrons","detachment":"Court","pointsTotal":500,"units":[{"name":"Wraiths"}]}');
  assert.equal(parsed.roster[0].points, 0);
  assert.ok(parsed.warnings.some((warning) => warning.includes("points unavailable")));
  assert.ok(parsed.warnings.some((warning) => warning.includes("Declared total 500")));
});

test("share-code ingestion uses the official endpoint, supports clipboard code forms and fails explicitly", async () => {
  for (const text of ["DEADBEEF", "YellowScribe code: deadbeef", '{"code":"deadbeef"}', "```text\nCode: deadbeef\n```"]) {
    let request;
    const parsed = await R.ingestRoster(text, async (url, init) => {
      request = { url, init };
      return { ok: true, text: async () => '{"armyData":{"u":{"name":"Technomancer","points":85}}}' };
    });
    assert.equal(parsed.roster[0].baseName, "Technomancer");
    assert.equal(request.url, "https://yellowscribe.link/get_army_by_id?id=deadbeef");
    assert.equal(request.init.credentials, "omit");
    assert.equal(request.init.referrerPolicy, "no-referrer");
    assert.ok(request.init.signal);
  }
  await assert.rejects(R.ingestRoster("deadbeef", async () => ({ ok: false, status: 404 })), /HTTP 404.*expire/);
  await assert.rejects(R.ingestRoster("deadbeef", async () => { throw new TypeError("Failed to fetch"); }), /CORS.*decoded/);
  await assert.rejects(R.ingestRoster('{"code":"invalid"}'), /eight hexadecimal/);
  await assert.rejects(R.ingestRoster('{"units":'), /Invalid roster JSON/);
  const local = await R.ingestRoster('{"units":[{"name":"Wraiths","points":250}]}', () => { assert.fail("JSON imports must not use the network"); });
  assert.equal(local.pointsTotal, 250);
});

test("import appends unique player-local IDs while preserving existing links and updating army metadata", () => {
  const player = R.blankPlayer();
  const unit = { ...R.blankUnit(), baseName: "Existing unit", points: 50 };
  player.roster.push(unit);
  player.markedForGreatness = { unitId: unit.id, unit: R.unitName(unit), xp: 3 };
  const parsed = R.parseRoster('{"faction":"Necrons","detachment":"Court","units":[{"name":"Technomancer","isWarlord":true,"points":85},{"name":"Wraiths","points":250}]}');
  R.appendRoster(player, parsed);
  R.appendRoster(player, parsed);
  assert.equal(player.roster.length, 5);
  assert.equal(new Set(player.roster.map((item) => item.id)).size, 5);
  assert.equal(player.markedForGreatness.unitId, unit.id);
  assert.equal(player.pointsTotal, 720);
  assert.equal(player.faction, "Necrons");
  assert.equal(player.warlord, "Technomancer");
});

function linkedPlayer() {
  const player = R.blankPlayer();
  const unit = { ...R.blankUnit(), baseName: "Technomancer", customName: "Torinakh, Prime",
    points: 85, xp: 2, honors: ["Ancient Oath"], scars: ["Old wound"] };
  player.roster.push(unit, { ...R.blankUnit([unit]), baseName: "Wraiths", points: 250 });
  player.agendas.push({ unitId: unit.id, name: "Study", xp: 1, completed: true },
    { unitId: unit.id, name: "Incomplete", xp: 10, completed: false });
  player.markedForGreatness = { unitId: unit.id, xp: 99, reason: "Held the line" };
  player.outOfActionTests.push({ unitId: unit.id, passed: false, scar: "Fatigued" });
  player.rankPromotions.push({ unitId: unit.id, newRank: "Bloodied", reward: "Auto-medicae" });
  return player;
}

test("unit-linked post-game XP, ranks, honors and scars are reversible and never double applied", () => {
  const player = linkedPlayer();
  const unit = player.roster[0];
  const expected = { xp: 6, earnedXp: 4, rank: "Bloodied", honors: ["Ancient Oath", "Auto-medicae"], scars: ["Old wound", "Fatigued"] };
  assert.deepEqual(R.unitProgress(player, unit), expected);
  assert.equal(R.unitProgress(player, player.roster[1]).xp, 0);
  assert.deepEqual(R.eligibleRanks(player, unit), ["Bloodied"]);
  const report = { ...R.blankReport(), title: "Test", players: [player] };
  const restored = R.parseReports(R.serializeReports([report]))[0].players[0];
  assert.equal(restored.roster[0].xp, 2, "starting XP is persisted, not post-game XP");
  assert.equal(restored.markedForGreatness.xp, 3);
  assert.deepEqual(R.unitProgress(restored, restored.roster[0]), expected);
  assert.equal(R.serializeReports(R.parseReports(R.serializeReports([report]))), R.serializeReports([report]));
  player.agendas[0].completed = false;
  player.markedForGreatness.unitId = player.roster[1].id;
  player.outOfActionTests[0].passed = true;
  player.rankPromotions = [];
  assert.deepEqual(R.unitProgress(player, unit), { xp: 2, earnedXp: 0, rank: "Battle-Ready", honors: ["Ancient Oath"], scars: ["Old wound"] });
  assert.equal(R.unitProgress(player, player.roster[1]).xp, 3);
});

test("rank thresholds and validation enforce eligible ranks and valid roster links", () => {
  const player = linkedPlayer();
  player.faction = "Necrons";
  const report = R.normalizeReport({ ...R.blankReport(), title: "Test", players: [player] });
  assert.deepEqual(R.validateReport(report), []);
  const unit = player.roster[0];
  player.markedForGreatness.unitId = "";
  player.agendas = [];
  for (const [xp, rank] of [[5, null], [6, "Bloodied"], [16, "Battle-Hardened"], [31, "Heroic"], [51, "Legendary"]]) {
    unit.xp = xp;
    assert.equal(R.eligibleRanks(player, unit).at(-1) || null, rank);
  }
  player.rankPromotions.push({ unitId: unit.id, newRank: "Heroic", reward: "Hero's Mantle" },
    { unitId: unit.id, newRank: "Bloodied", reward: "Veteran Trait" });
  assert.equal(R.unitProgress(player, unit).rank, "Heroic", "adding a lower-rank honor must not demote a unit");
  report.players[0].rankPromotions[0].newRank = "Legendary";
  assert.ok(R.validateReport(report).some((error) => error.includes("not eligible")));
  report.players[0].markedForGreatness.unitId = "missing";
  assert.ok(R.validateReport(report).some((error) => error.includes("not in the roster")));
  report.players[0].roster.push(report.players[0].roster[0]);
  assert.ok(R.validateReport(report).some((error) => error.includes("duplicate unit ID")));
});

test("renaming synchronizes display names; removal keeps all references as Custom / Other", () => {
  const player = linkedPlayer();
  const unit = player.roster[0];
  unit.customName = "Торинакх, Прайм";
  const normalized = R.normalizePlayer(player);
  assert.equal(normalized.agendas[0].unit, R.unitName(unit));
  assert.equal(normalized.markedForGreatness.unit, R.unitName(unit));
  R.unlinkUnit(player, unit.id);
  assert.equal(player.roster.length, 1);
  assert.equal(player.markedForGreatness.xp, 3, "the linked award stays +3 XP after unlinking");
  for (const record of [...player.agendas, ...player.outOfActionTests, player.markedForGreatness, ...player.rankPromotions]) {
    assert.equal(record.unitId, undefined);
    assert.equal(record.unit, "Торинакх, Прайм — Technomancer");
  }
});

test("roster schema and pict-feeds survive draft JSON and mocked archive uplink together", async () => {
  const player = linkedPlayer();
  player.faction = "Necrons";
  const report = R.normalizeReport({ ...R.blankReport(), title: "Roster and artwork", players: [player],
    headerImageUrl: "data:image/png;base64,AQID", aftermathImageUrl: "https://example.com/after.png" });
  const draft = JSON.parse(JSON.stringify({ reports: [report], baseSha: "original", changes: [report.id] }));
  const text = R.serializeReports(draft.reports);
  const config = U.normalizeUplink({ repo: "test/archive", token: `github_pat_${"A".repeat(30)}` });
  let transmitted;
  await U.writeRemoteFile(config, { text, sha: "original", message: "Test" }, async (url, init) => {
    transmitted = JSON.parse(init.body);
    return { ok: true, json: async () => ({ content: { sha: "new" }, commit: { sha: "commit" } }) };
  });
  const decoded = U.decodeBase64(transmitted.content);
  const restored = R.parseReports(decoded)[0];
  assert.deepEqual(restored, report);
  assert.equal(transmitted.sha, "original");
  assert.deepEqual(IMG.dataUrlToBytes(restored.headerImageUrl).bytes, new Uint8Array([1, 2, 3]));
  const image = { type: "image/png", name: "test.png" };
  assert.equal(IMG.imageFromTransfer({ files: [image] }), image);
  assert.equal(IMG.imageFromTransfer({ items: [{ kind: "file", type: image.type, getAsFile: () => image }] }), image);
  assert.equal(IMG.urlFromTransfer({ getData: () => report.aftermathImageUrl }), report.aftermathImageUrl);
});
