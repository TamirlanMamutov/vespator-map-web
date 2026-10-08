import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ALLIANCES, DEFAULT_BADGES, SLOT_CATEGORIES, validateCampaign, neighbors, dominantAlliance, planetNames,
  slotInfo, occupiedSlots, setSlot, setInfrastructureCapacity, setPowerLevel, fleetTitle,
  commissionFleet, decommissionFleet, canTransfer, moveFleet, setDestroyed, serializeCampaign, planetById,
  normalizeCampaign, terrainCategory, CRUSADE_TERRAIN, TERRAIN_CATEGORIES,
  activeVectors, assaultTargets, launchAssault, recallAssault, assaultTitle,
} from "../campaign.js";
import {
  EMBLEMS, TERRAIN_GLYPHS, BADGE_EMBLEMS, ALLIANCE_EMBLEMS, INFRASTRUCTURE_EMBLEMS, FACTION_EMBLEMS,
  factionEmblem, fleetEmblem, glyphKey,
} from "../emblems.js";
import { terrainTheme, TERRAIN_THEMES, seededRandom } from "../terrain.js";

const source = readFileSync(new URL("../campaign_data.json", import.meta.url), "utf8");
const fresh = () => JSON.parse(source);
const laneKey = ([a, b]) => [a, b].sort().join("|");

test("campaign data validates with all 13 worlds and 16 unique warp lanes", () => {
  const data = validateCampaign(fresh());
  assert.equal(data.planets.length, 13);
  assert.equal(data.warpLanes.length, 16);
  assert.equal(new Set(data.warpLanes.map(laneKey)).size, 16);
});

test("warp-lane topology matches the adjusted sector map", () => {
  const data = fresh();
  const links = (id) => new Set(neighbors(data, id));
  assert.deepEqual(links("knossos"), new Set(["sidon", "sarif_iv"]));
  assert.deepEqual(links("pluto_ii"), new Set(["sidon", "amazon_xi", "nickel"]));
  assert.deepEqual(links("sarif_iv"), new Set(["knossos", "harvest"]));
  assert.deepEqual(links("baikonur"), new Set(["nickel", "aetna", "gj_3378b"]));
  assert.deepEqual(links("nickel"), new Set(["pluto_ii", "amazon_xi", "atacama", "baikonur"]));
  assert.deepEqual(links("aetna"), new Set(["atacama", "baikonur"]));
  assert.deepEqual(links("harvest"), new Set(["sarif_iv", "niflegard", "gj_3378b"]));
  assert.deepEqual(links("niflegard"), new Set(["harvest", "myrkvidr"]));
  assert.deepEqual(links("myrkvidr"), new Set(["niflegard"]));
  for (const [a, b] of [["knossos", "myrkvidr"], ["pluto_ii", "sarif_iv"], ["sarif_iv", "baikonur"], ["nickel", "aetna"], ["aetna", "gj_3378b"], ["knossos", "harvest"]]) {
    assert.equal(links(a).has(b), false, `${a} must not link to ${b}`);
  }
  const expected = [
    "sidon-knossos", "sidon-pluto_ii", "knossos-sarif_iv", "sarif_iv-harvest", "harvest-niflegard", "harvest-gj_3378b",
    "niflegard-myrkvidr", "pluto_ii-amazon_xi", "pluto_ii-nickel", "amazon_xi-nickel", "nickel-atacama", "nickel-baikonur",
    "atacama-aetna", "atacama-gj_3378b", "baikonur-aetna", "baikonur-gj_3378b",
  ].map((lane) => laneKey(lane.split("-")));
  assert.deepEqual(new Set(data.warpLanes.map(laneKey)), new Set(expected));
});

test("official Crusade terrain twists are applied to every world", () => {
  const data = fresh();
  normalizeCampaign(data);
  const expected = {
    "Ash Wastes": [["sidon", "knossos"], ["Choking Fallout", "Corroded Redoubts", "Slag Runoff"]],
    "Death World": [["amazon_xi", "myrkvidr"], ["Predatory Foliage", "Spore Choke", "Bio-Resonant Canopy"]],
    "Tomb World": [["nickel", "atacama", "sarif_iv"], ["Awoken Monolith Array", "Gauss Dispersion", "Phase Flares"]],
    "Warp Rift": [["pluto_ii", "aetna"], ["Perils of the Empyrean", "Molten Sump", "Screaming Geysers"]],
    "Fortress Bastion": [["gj_3378b", "niflegard", "baikonur", "harvest"], ["Void Shield Grid", "Trench Bastions", "Heavy Munitions Depot"]],
  };
  assert.deepEqual(TERRAIN_CATEGORIES, Object.keys(expected));
  let covered = 0;
  for (const [category, [worlds, twists]] of Object.entries(expected)) {
    assert.deepEqual(CRUSADE_TERRAIN[category].twists, twists);
    for (const id of worlds) {
      const planet = planetById(data, id);
      assert.equal(planet.terrainCategory, category, id);
      assert.equal(terrainCategory(planet), category, id);
      assert.deepEqual(planet.terrainTraits, twists, id);
      covered++;
    }
  }
  assert.equal(covered, data.planets.length);
  assert.equal(normalizeCampaign(data), 0, "normalizing twice changes nothing");
  assert.equal(terrainCategory({ id: "new_world", terrain: "Necron Crypt Plateau" }), "Tomb World");
  assert.throws(() => validateCampaign({ ...fresh(), planets: fresh().planets.map((p, i) => i ? p : { ...p, terrainCategory: "Ocean" }) }), /terrainCategory/);
});

test("offensive vectors load from the data and follow warp lanes", () => {
  const data = fresh();
  normalizeCampaign(data);
  assert.deepEqual(data.offensiveVectors.map(({ from, to, alliance }) => `${from}>${to}:${alliance}`), [
    "gj_3378b>harvest:Imperium", "pluto_ii>nickel:Chaos", "sarif_iv>harvest:Xenos",
  ]);
  for (const assault of data.offensiveVectors) assert.ok(neighbors(data, assault.from).includes(assault.to));
  assert.equal(activeVectors(data).length, 3);
  assert.equal(assaultTitle(data, data.offensiveVectors[0]), "Crusade Spearhead");
  const bare = fresh();
  delete bare.offensiveVectors;
  normalizeCampaign(bare);
  assert.deepEqual(bare.offensiveVectors, []);
  const bad = (vectors) => assert.throws(() => validateCampaign({ ...fresh(), offensiveVectors: vectors }), /offensive vector/);
  bad([{ from: "knossos", to: "myrkvidr", alliance: "Xenos" }]);
  bad([{ from: "sidon", to: "sidon", alliance: "Xenos" }]);
  bad([{ from: "sidon", to: "knossos", alliance: "Orks" }]);
  bad([{ from: "sidon", to: "knossos", alliance: "Xenos" }, { from: "sidon", to: "knossos", alliance: "Xenos" }]);
});

test("Warmaster assaults launch only toward connected operational worlds and survive export", () => {
  const data = fresh();
  normalizeCampaign(data);
  assert.deepEqual(new Set(assaultTargets(data, "aetna")), new Set(["atacama", "baikonur"]));
  const assault = launchAssault(data, "aetna", "baikonur", "Chaos", "  Ember Tide  ");
  assert.deepEqual(assault, { from: "aetna", to: "baikonur", alliance: "Chaos", label: "Ember Tide" });
  assert.deepEqual(launchAssault(data, "knossos", "sidon", "Xenos"), { from: "knossos", to: "sidon", alliance: "Xenos" });
  assert.equal(assaultTitle(data, data.offensiveVectors.at(-1)), "Xenos Assault on Sidon");
  assert.throws(() => launchAssault(data, "aetna", "gj_3378b", "Chaos"), /direct warp lane/);
  assert.throws(() => launchAssault(data, "aetna", "baikonur", "Chaos"), /already assaulting/);
  assert.throws(() => launchAssault(data, "aetna", "atacama", "Tyranids"), /Unknown alliance/);
  setDestroyed(data, "atacama", true);
  assert.throws(() => launchAssault(data, "aetna", "atacama", "Chaos"), /destroyed world/);
  assert.throws(() => launchAssault(data, "atacama", "aetna", "Xenos"), /Exterminatus/);
  setDestroyed(data, "harvest", true);
  assert.equal(activeVectors(data).length, 3, "assaults touching destroyed worlds are suspended");
  assert.equal(data.offensiveVectors.length, 5, "suspended assaults stay on record");
  recallAssault(data, 0);
  assert.throws(() => recallAssault(data, 99), /no longer exists/);
  const exported = JSON.parse(serializeCampaign(data));
  assert.deepEqual(exported.offensiveVectors, data.offensiveVectors);
  assert.deepEqual(exported.warpLanes, fresh().warpLanes);
  assert.equal(exported.planets.find((p) => p.id === "niflegard").terrainTraits[1], "Trench Bastions");
});
test("world coordinates keep the outer perimeter and never overlap", () => {
  const { planets } = fresh();
  for (let i = 0; i < planets.length; i++) {
    for (let k = i + 1; k < planets.length; k++) {
      const gap = Math.hypot(planets[i].x - planets[k].x, planets[i].y - planets[k].y);
      assert.ok(gap >= 100, `${planets[i].id} and ${planets[k].id} are only ${gap.toFixed(0)} apart`);
    }
  }
  const at = (id) => planets.find((planet) => planet.id === id);
  assert.ok(at("knossos").x < at("harvest").x && at("myrkvidr").y > at("knossos").y);
  assert.ok(at("gj_3378b").y > at("atacama").y && at("gj_3378b").x > at("harvest").x);
});

test("power matrices match the campaign record", () => {
  const data = fresh();
  const power = (id) => planetById(data, id).powerLevels;
  assert.deepEqual(power("niflegard"), { Imperium: 1, Xenos: 4, Chaos: 1 });
  assert.deepEqual(power("myrkvidr"), { Imperium: 1, Xenos: 2, Chaos: 1 });
  assert.deepEqual(power("knossos"), { Imperium: 1, Xenos: 3, Chaos: 1 });
  assert.deepEqual(power("sarif_iv"), { Imperium: 1, Xenos: 3, Chaos: 2 });
  assert.deepEqual(power("pluto_ii"), { Imperium: 1, Xenos: 1, Chaos: 4 });
  assert.deepEqual(power("gj_3378b"), { Imperium: 4, Xenos: 3, Chaos: 1 });
  for (const planet of data.planets) {
    for (const alliance of ALLIANCES) assert.ok(planet.powerLevels[alliance] >= 1 && planet.powerLevels[alliance] <= 4);
  }
});

test("every world has a terrain profile with three twists and known glyphs", () => {
  for (const planet of fresh().planets) {
    assert.equal(planet.terrainTraits.length, 3, planet.id);
    assert.ok(planet.terrainIcons.length > 0, planet.id);
    for (const icon of planet.terrainIcons) {
      assert.equal(glyphKey(icon), icon, `${planet.id} glyph ${icon}`);
      assert.ok(TERRAIN_GLYPHS[icon].layers.length && TERRAIN_GLYPHS[icon].label, icon);
    }
  }
  assert.equal(glyphKey("not-a-real-icon"), "unknown");
});

test("terrain classes map to the requested 3D surfaces and effects", () => {
  const data = fresh();
  const theme = (id) => terrainTheme(planetById(data, id));
  assert.equal(theme("niflegard").key, "ice");
  assert.ok(theme("niflegard").effects.includes("clouds"));
  assert.equal(theme("knossos").key, "smog");
  assert.ok(theme("knossos").effects.includes("seams"));
  assert.equal(theme("myrkvidr").key, "forest");
  assert.equal(theme("pluto_ii").key, "infernal");
  assert.ok(theme("pluto_ii").effects.includes("pulse"));
  assert.equal(theme("aetna").key, "scorched");
  assert.ok(theme("aetna").effects.includes("smoke"));
  assert.equal(theme("harvest").key, "agri");
  assert.equal(theme("gj_3378b").key, "fortress");
  assert.ok(theme("gj_3378b").effects.includes("shield"));
  assert.equal(theme("amazon_xi").key, "jungle");
  for (const planet of data.planets) assert.ok(TERRAIN_THEMES[theme(planet.id).key]);
  assert.equal(seededRandom("x")(), seededRandom("x")());
});

test("warp-lane network is fully connected", () => {
  const data = fresh();
  const seen = new Set([data.planets[0].id]);
  const queue = [data.planets[0].id];
  while (queue.length) {
    for (const next of neighbors(data, queue.shift())) if (!seen.has(next)) { seen.add(next); queue.push(next); }
  }
  assert.equal(seen.size, data.planets.length);
});

test("names split into world and system designation", () => {
  const data = fresh();
  for (const planet of data.planets) {
    const { world, system } = planetNames(planet);
    assert.equal(world, planet.name);
    assert.equal(system, planet.subName);
  }
  assert.deepEqual(planetNames({ name: "Alpha / Beta" }), { world: "Alpha", system: "Beta" });
});

test("fleets carry badges with emblems and default titles", () => {
  const data = fresh();
  const fleets = data.planets.flatMap((planet) => planet.fleets);
  assert.equal(fleets.length, 5);
  for (const fleet of fleets) {
    assert.ok(EMBLEMS[BADGE_EMBLEMS[fleet.badge]], fleet.badge);
    assert.equal(fleetEmblem(fleet), BADGE_EMBLEMS[fleet.badge]);
    assert.equal(fleetTitle(fleet), `${fleet.faction} Battlegroup`);
  }
  for (const badge of Object.values(DEFAULT_BADGES)) assert.ok(EMBLEMS[BADGE_EMBLEMS[badge]], badge);
  assert.equal(fleetTitle({ faction: "Necrons", name: "Szarekhan Dynasty" }), "Szarekhan Dynasty");
});

test("fleets transfer only along direct lanes between operational worlds", () => {
  const data = fresh();
  assert.equal(canTransfer(data, "knossos", "harvest"), false);
  assert.throws(() => moveFleet(data, "sarif_iv", 0, "aetna"), /direct warp lane/);
  const fleet = planetById(data, "sarif_iv").fleets[0];
  moveFleet(data, "sarif_iv", 0, "harvest");
  assert.ok(planetById(data, "harvest").fleets.includes(fleet));
  setDestroyed(data, "niflegard", true);
  assert.equal(canTransfer(data, "harvest", "niflegard"), false);
  assert.throws(() => moveFleet(data, "harvest", 0, "niflegard"), /destroyed/);
});

test("commissioning works with or without a fleet name", () => {
  const data = fresh();
  commissionFleet(data, "sidon", "Death Guard");
  commissionFleet(data, "sidon", "Imperial Guard", "  Cadian 8th  ");
  const [unnamed, named] = planetById(data, "sidon").fleets.slice(-2);
  assert.deepEqual(unnamed, { alliance: "Chaos", faction: "Death Guard", badge: DEFAULT_BADGES["Death Guard"] });
  assert.equal(named.name, "Cadian 8th");
  validateCampaign(data);
});

test("Power Levels are set per alliance and clamped to 1-4", () => {
  const data = fresh();
  assert.equal(setPowerLevel(data, "sidon", "Xenos", 9), 4);
  assert.equal(setPowerLevel(data, "sidon", "Chaos", -3), 1);
  assert.throws(() => setPowerLevel(data, "sidon", "Tyranids", 2), /Unknown alliance/);
  const planet = planetById(data, "pluto_ii");
  assert.equal(dominantAlliance(planet), "Chaos");
});

test("validation rejects bad power, slot counts and faction mismatches", () => {
  const badPower = fresh();
  badPower.planets[0].powerLevels.Chaos = 5;
  assert.throws(() => validateCampaign(badPower), /Power Level/);
  const badSlots = fresh();
  badSlots.planets[0].infrastructure.slots.push("empty");
  assert.throws(() => validateCampaign(badSlots), /maxSlots/);
  const badFleet = fresh();
  badFleet.planets[0].fleets.push({ faction: "Necrons", alliance: "Chaos", badge: "chaos_star" });
  assert.throws(() => validateCampaign(badFleet), /belongs to Xenos/);
});

test("infrastructure slots can be typed, owned, destroyed, cleared and resized", () => {
  const data = fresh();
  const planet = planetById(data, "harvest");
  planet.infrastructure.slots.forEach((_, index) => setSlot(data, planet.id, index, { category: "Empty" }));
  setInfrastructureCapacity(data, planet.id, 0);
  setInfrastructureCapacity(data, planet.id, 3);
  assert.deepEqual(planet.infrastructure, { maxSlots: 3, slots: ["empty", "empty", "empty"] });
  setSlot(data, planet.id, 0, { category: "Stronghold", alliance: "Imperium" });
  assert.deepEqual(planet.infrastructure.slots[0], { type: "Imperial Stronghold", alliance: "Imperium" });
  setSlot(data, planet.id, 0, { alliance: "Chaos" });
  assert.equal(slotInfo(planet.infrastructure.slots[0]).type, "Chaos Stronghold");
  setSlot(data, planet.id, 1, { category: "Active" });
  assert.equal(planet.infrastructure.slots[1], "active");
  setSlot(data, planet.id, 2, { category: "Support Facility", alliance: "Xenos", destroyed: true });
  assert.deepEqual(slotInfo(planet.infrastructure.slots[2]), { category: "Support Facility", type: "Support Facility", alliance: "Xenos", destroyed: true, empty: false });
  assert.equal(occupiedSlots(planet), 3);
  assert.throws(() => setInfrastructureCapacity(data, planet.id, 2), /Only empty/);
  assert.equal(planet.infrastructure.slots.length, 3);
  setSlot(data, planet.id, 1, { category: "Empty" });
  setInfrastructureCapacity(data, planet.id, 2);
  assert.equal(planet.infrastructure.maxSlots, 2);
  validateCampaign(data);
  for (const category of SLOT_CATEGORIES) assert.ok(EMBLEMS[INFRASTRUCTURE_EMBLEMS[category]], category);
});

test("Exterminatus locks orders except decommissioning and restoration", () => {
  const data = fresh();
  setDestroyed(data, "gj_3378b", true);
  assert.throws(() => setPowerLevel(data, "gj_3378b", "Chaos", 3), /Exterminatus/);
  assert.throws(() => setSlot(data, "gj_3378b", 0, { category: "Empty" }), /Exterminatus/);
  decommissionFleet(data, "gj_3378b", 0);
  setDestroyed(data, "gj_3378b", false);
  assert.equal(setPowerLevel(data, "gj_3378b", "Chaos", 3), 3);
});

test("serialization round-trips and preserves unknown keys", () => {
  const data = fresh();
  data.discordSync = { channel: "vespator" };
  data.planets[0].notes = "kept";
  assert.deepEqual(JSON.parse(serializeCampaign(data)), data);
});

test("every alliance and faction has an emblem", () => {
  const data = fresh();
  for (const alliance of ALLIANCES) {
    assert.ok(EMBLEMS[ALLIANCE_EMBLEMS[alliance]], alliance);
    for (const faction of data.alliances[alliance].factions) assert.ok(FACTION_EMBLEMS[faction] && EMBLEMS[factionEmblem(faction, alliance)], faction);
  }
});