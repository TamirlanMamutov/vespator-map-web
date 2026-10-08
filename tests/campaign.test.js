import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ALLIANCES, DEFAULT_BADGES, SLOT_CATEGORIES, INFRASTRUCTURE_TYPES, MAX_INFRASTRUCTURE, validateCampaign, neighbors, dominantAlliance, planetNames,
  slotInfo, occupiedSlots, setSlot, setInfrastructureCapacity, setPowerLevel, fleetTitle,
  commissionFleet, decommissionFleet, canTransfer, moveFleet, setDestroyed, serializeCampaign, planetById,
  normalizeCampaign, TERRAIN_TWISTS, TWIST_NAMES, MAX_TWISTS, twistKey, constructInfrastructure,
  activeVectors, assaultTargets, launchAssault, recallAssault, assaultTitle, isOrbitalStrike,
  deployKillTeam, extractKillTeam, activeKillTeams, killTeamTitle, KILL_TEAM_CODENAMES,
  STORAGE_KEY, campaignFingerprint, packState, unpackState,
} from "../campaign.js";
import {
  EMBLEMS, TERRAIN_GLYPHS, BADGE_EMBLEMS, ALLIANCE_EMBLEMS, INFRASTRUCTURE_EMBLEMS, FACTION_EMBLEMS,
  SHIP_SILHOUETTES, SHIP_BADGES, factionEmblem, fleetEmblem, glyphKey, emblemLayers, shipKey, shipScale, shipClass, shipPath, factionAccent,
} from "../emblems.js";
import { terrainTheme, TERRAIN_THEMES, seededRandom } from "../terrain.js";

const source = readFileSync(new URL("../campaign_data.json", import.meta.url), "utf8");
const WAR_STATE = JSON.parse(readFileSync(new URL("./fixtures/war-state.json", import.meta.url), "utf8"));
// The live file as last published by the War Council. Only static sector facts (worlds, lanes,
// terrain, coordinates) may be pinned against it; volatile war state gets schema checks only.
const live = () => JSON.parse(source);
// Behaviour tests run on the live sector with a pinned war state (power, slots, fleets, assaults,
// kill teams, Exterminatus), so Warmaster publishes can never cause false CI failures.
const fresh = () => {
  const data = live();
  for (const planet of data.planets) {
    const state = WAR_STATE.planets[planet.id];
    assert.ok(state, `tests/fixtures/war-state.json is missing ${planet.id}`);
    Object.assign(planet, structuredClone(state));
  }
  data.offensiveVectors = structuredClone(WAR_STATE.offensiveVectors);
  data.activeKillTeams = structuredClone(WAR_STATE.activeKillTeams);
  return data;
};
const vectorKey = ({ from, to, alliance }) => `${from}>${to}:${alliance}`;
const laneKey = ([a, b]) => [a, b].sort().join("|");
const OFFICIAL_TWISTS = [
  "Spaceport", "Desolate Wastes", "Xenoflora Jungle", "Rad Zone", "Forge Complex",
  "Hab Sprawl", "Delvesite Facility", "Dead Lands", "Tomb Complex",
];

test("campaign data validates with all 13 worlds and 18 unique warp lanes", () => {
  const data = validateCampaign(fresh());
  assert.equal(data.planets.length, 13);
  assert.equal(data.warpLanes.length, 18);
  assert.equal(new Set(data.warpLanes.map(laneKey)).size, 18);
});

test("warp-lane topology matches the expanded sector map", () => {
  const data = fresh();
  const links = (id) => new Set(neighbors(data, id));
  assert.deepEqual(links("sidon"), new Set(["knossos", "sarif_iv", "pluto_ii"]));
  assert.deepEqual(links("knossos"), new Set(["sidon", "sarif_iv"]));
  assert.deepEqual(links("sarif_iv"), new Set(["sidon", "knossos", "harvest"]));
  assert.deepEqual(links("harvest"), new Set(["sarif_iv", "myrkvidr", "niflegard", "gj_3378b"]));
  assert.deepEqual(links("myrkvidr"), new Set(["harvest", "niflegard"]));
  assert.deepEqual(links("niflegard"), new Set(["harvest", "myrkvidr"]));
  assert.deepEqual(links("pluto_ii"), new Set(["sidon", "amazon_xi", "nickel"]));
  assert.deepEqual(links("nickel"), new Set(["pluto_ii", "amazon_xi", "atacama", "baikonur"]));
  assert.deepEqual(links("aetna"), new Set(["atacama", "baikonur"]));
  assert.deepEqual(links("baikonur"), new Set(["nickel", "aetna", "gj_3378b"]));
  const expected = [
    "sidon-knossos", "sidon-sarif_iv", "sidon-pluto_ii", "knossos-sarif_iv", "sarif_iv-harvest", "harvest-myrkvidr",
    "harvest-niflegard", "harvest-gj_3378b", "niflegard-myrkvidr", "pluto_ii-amazon_xi", "pluto_ii-nickel", "amazon_xi-nickel",
    "nickel-atacama", "nickel-baikonur", "atacama-aetna", "atacama-gj_3378b", "baikonur-aetna", "baikonur-gj_3378b",
  ].map((lane) => laneKey(lane.split("-")));
  assert.deepEqual(new Set(data.warpLanes.map(laneKey)), new Set(expected));
});

test("exactly the nine official Vespator Front terrain twists exist", () => {
  assert.deepEqual(TWIST_NAMES, OFFICIAL_TWISTS);
  assert.equal(MAX_TWISTS, 3);
  for (const [icon, name] of Object.entries(TERRAIN_TWISTS)) {
    assert.equal(twistKey(name), icon);
    assert.ok(TERRAIN_GLYPHS[icon]?.layers.length, `${icon} glyph`);
    assert.equal(TERRAIN_GLYPHS[icon].label, name);
    assert.ok(TERRAIN_THEMES[icon], `${icon} theme`);
  }
  assert.deepEqual(Object.keys(TERRAIN_GLYPHS).filter((key) => key !== "unknown"), Object.keys(TERRAIN_TWISTS));
  assert.equal(twistKey("Glacier"), null);
  assert.equal(glyphKey("blizzard"), "unknown");
});

test("every world lists official twists with matching placard glyphs", () => {
  const data = fresh();
  assert.equal(normalizeCampaign(data), 0, "the shipped data is already canonical");
  for (const planet of data.planets) {
    assert.ok(planet.terrainTwists.length >= 1 && planet.terrainTwists.length <= MAX_TWISTS, planet.id);
    assert.ok(planet.terrainTwists.every((twist) => OFFICIAL_TWISTS.includes(twist)), planet.id);
    assert.deepEqual(planet.terrainIcons, planet.terrainTwists.map(twistKey), planet.id);
    assert.equal(planet.terrainTraits, undefined);
    assert.equal(planet.terrainCategory, undefined);
  }
  assert.deepEqual(planetById(data, "baikonur").terrainTwists, ["Spaceport", "Hab Sprawl"]);
  assert.deepEqual(planetById(data, "sarif_iv").terrainIcons, ["tomb_complex", "hab_sprawl", "xenoflora_jungle"]);
});

test("invented terrain is rejected and legacy terrain fields migrate", () => {
  const withTwists = (twists) => ({ ...fresh(), planets: fresh().planets.map((p, i) => i ? p : { ...p, terrainTwists: twists }) });
  assert.throws(() => validateCampaign(withTwists(["Glacier"])), /terrainTwists/);
  assert.throws(() => validateCampaign(withTwists(["Rad Zone", "Rad Zone"])), /terrainTwists/);
  assert.throws(() => validateCampaign(withTwists(["Rad Zone", "Spaceport", "Dead Lands", "Hab Sprawl"])), /terrainTwists/);
  assert.throws(() => validateCampaign(withTwists([])), /terrainTwists/);
  assert.throws(() => validateCampaign({ ...fresh(), planets: fresh().planets.map((p, i) => i ? p : { ...p, terrainIcons: ["ice_glacier"] }) }), /terrainIcons/);
  const legacy = fresh();
  const sidon = planetById(legacy, "sidon");
  delete sidon.terrainTwists;
  sidon.terrainTraits = ["Choking Fallout", "Slag Runoff"];
  sidon.terrainCategory = "Ash Wastes";
  sidon.terrainIcons = ["rad_zone", "dead_lands"];
  assert.equal(normalizeCampaign(legacy), 1);
  assert.deepEqual(sidon.terrainTwists, ["Rad Zone", "Dead Lands"]);
  assert.deepEqual(sidon.terrainIcons, ["rad_zone", "dead_lands"]);
  assert.ok(!("terrainTraits" in sidon) && !("terrainCategory" in sidon));
  assert.equal(normalizeCampaign(legacy), 0);
});

test("offensive vectors load from the data, including the orbital strike", () => {
  const data = fresh();
  normalizeCampaign(data);
  assert.deepEqual(data.offensiveVectors.map(vectorKey), ["gj_3378b>harvest:Imperium", "pluto_ii>pluto_ii:Chaos"]);
  assert.deepEqual(data.offensiveVectors.map(isOrbitalStrike), [false, true]);
  assert.equal(activeVectors(data).length, 2);
  assert.equal(assaultTitle(data, data.offensiveVectors[1]), "Orbital Bombardment");
  // Whatever the War Council last published must load and parse the same way.
  const published = live();
  normalizeCampaign(published);
  assert.ok(Array.isArray(published.offensiveVectors));
  const ids = new Set(published.planets.map((planet) => planet.id));
  for (const vector of published.offensiveVectors) {
    const key = vectorKey(vector);
    assert.match(key, /^[a-z0-9_]+>[a-z0-9_]+:(Imperium|Xenos|Chaos)$/, key);
    assert.ok(ids.has(vector.from) && ids.has(vector.to), key);
    assert.equal(isOrbitalStrike(vector), vector.from === vector.to, key);
    assert.ok(vector.from === vector.to || neighbors(published, vector.from).includes(vector.to), `${key} follows a warp lane`);
    assert.ok(assaultTitle(published, vector).length, key);
  }
  assert.equal(new Set(published.offensiveVectors.map(vectorKey)).size, published.offensiveVectors.length);
  const bare = fresh();
  delete bare.offensiveVectors;
  normalizeCampaign(bare);
  assert.deepEqual(bare.offensiveVectors, []);
  validateCampaign({ ...fresh(), offensiveVectors: [{ from: "sidon", to: "sidon", alliance: "Xenos" }] });
  const bad = (vectors) => assert.throws(() => validateCampaign({ ...fresh(), offensiveVectors: vectors }), /offensive vector/);
  bad([{ from: "knossos", to: "myrkvidr", alliance: "Xenos" }]);
  bad([{ from: "sidon", to: "knossos", alliance: "Orks" }]);
  bad([{ from: "sidon", to: "atlantis", alliance: "Xenos" }]);
  bad([{ from: "sidon", to: "sidon", alliance: "Xenos" }, { from: "sidon", to: "sidon", alliance: "Xenos" }]);
});

test("Warmaster assaults target linked worlds or the host world itself and survive export", () => {
  const data = fresh();
  normalizeCampaign(data);
  assert.deepEqual(assaultTargets(data, "aetna"), ["aetna", "atacama", "baikonur"]);
  const strike = launchAssault(data, "aetna", "aetna", "Chaos", "  Ember Rain  ");
  assert.deepEqual(strike, { from: "aetna", to: "aetna", alliance: "Chaos", label: "Ember Rain" });
  assert.ok(isOrbitalStrike(strike));
  assert.deepEqual(launchAssault(data, "knossos", "knossos", "Xenos"), { from: "knossos", to: "knossos", alliance: "Xenos" });
  assert.equal(assaultTitle(data, data.offensiveVectors.at(-1)), "Xenos Orbital Strike on Knossos");
  assert.deepEqual(launchAssault(data, "knossos", "sidon", "Xenos"), { from: "knossos", to: "sidon", alliance: "Xenos" });
  assert.equal(assaultTitle(data, data.offensiveVectors.at(-1)), "Xenos Assault on Sidon");
  assert.throws(() => launchAssault(data, "aetna", "gj_3378b", "Chaos"), /direct warp lane/);
  assert.throws(() => launchAssault(data, "aetna", "aetna", "Chaos"), /already assaulting/);
  assert.throws(() => launchAssault(data, "aetna", "atacama", "Tyranids"), /Unknown alliance/);
  setDestroyed(data, "atacama", true);
  assert.deepEqual(assaultTargets(data, "aetna"), ["aetna", "baikonur"]);
  assert.deepEqual(assaultTargets(data, "atacama"), []);
  assert.throws(() => launchAssault(data, "atacama", "atacama", "Xenos"), /Exterminatus/);
  setDestroyed(data, "pluto_ii", true);
  assert.equal(activeVectors(data).length, 4, "the Pluto II orbital strike is suspended");
  assert.equal(data.offensiveVectors.length, 5, "suspended assaults stay on record");
  recallAssault(data, 0);
  assert.throws(() => recallAssault(data, 99), /no longer exists/);
  const exported = JSON.parse(serializeCampaign(data));
  assert.deepEqual(exported.offensiveVectors, data.offensiveVectors);
  assert.deepEqual(exported.warpLanes, fresh().warpLanes);
  assert.deepEqual(exported.planets.map((p) => p.terrainTwists), fresh().planets.map((p) => p.terrainTwists));
  assert.ok(exported.planets.every((p) => !("terrainTraits" in p)));
});

test("constructing infrastructure fills the first empty slot, then grows capacity", () => {
  const data = fresh();
  const planet = planetById(data, "niflegard");
  assert.equal(constructInfrastructure(data, "niflegard", "Fortification Line", "Xenos"), 1);
  assert.deepEqual(planet.infrastructure.slots[1], { type: "Fortification Line", alliance: "Xenos" });
  assert.equal(constructInfrastructure(data, "niflegard", "Stronghold", "Chaos"), 2);
  assert.equal(planet.infrastructure.maxSlots, 3);
  assert.deepEqual(planet.infrastructure.slots[2], { type: "Chaos Stronghold", alliance: "Chaos" });
  while (planet.infrastructure.maxSlots < MAX_INFRASTRUCTURE) constructInfrastructure(data, "niflegard", "Staging Grounds", "Imperium");
  assert.throws(() => constructInfrastructure(data, "niflegard", "Support Facility", "Xenos"), /no free infrastructure slots/);
  assert.throws(() => constructInfrastructure(data, "sidon", "Empty", "Xenos"), /Choose an infrastructure type/);
  assert.throws(() => constructInfrastructure(data, "sidon", "Support Facility", "Orks"), /Unknown alliance/);
  setDestroyed(data, "sidon", true);
  assert.throws(() => constructInfrastructure(data, "sidon", "Support Facility", "Xenos"), /Exterminatus/);
  validateCampaign(data);
  for (const type of INFRASTRUCTURE_TYPES) assert.ok(EMBLEMS[INFRASTRUCTURE_EMBLEMS[type]], type);
});

test("terrain glyph artwork renders for every placard icon", () => {
  for (const planet of fresh().planets) {
    for (const icon of planet.terrainIcons) {
      assert.equal(glyphKey(icon), icon, `${planet.id} glyph ${icon}`);
      assert.ok(emblemLayers(icon).every((layer) => typeof layer.d === "string" && layer.d.length), icon);
    }
  }
  assert.ok(emblemLayers("unknown").length);
});

test("3D surfaces follow each world's primary terrain twist", () => {
  const data = fresh();
  const theme = (id) => terrainTheme(planetById(data, id));
  const expected = {
    sidon: "rad_zone", pluto_ii: "rad_zone", knossos: "forge_complex", harvest: "forge_complex",
    myrkvidr: "xenoflora_jungle", amazon_xi: "xenoflora_jungle", niflegard: "delvesite_facility",
    sarif_iv: "tomb_complex", nickel: "tomb_complex", atacama: "tomb_complex",
    baikonur: "spaceport", aetna: "desolate_wastes", gj_3378b: "hab_sprawl",
  };
  for (const [id, key] of Object.entries(expected)) assert.equal(theme(id).key, key, id);
  assert.ok(theme("pluto_ii").effects.includes("pulse"));
  assert.ok(theme("gj_3378b").effects.includes("shield"));
  assert.ok(theme("knossos").effects.includes("seams"));
  assert.equal(terrainTheme({ terrain: "Unknown", terrainIcons: [] }).key, "unknown");
  for (const t of Object.values(TERRAIN_THEMES)) assert.ok(!/ice|glacier|blizzard/i.test(t.label), t.label);
  assert.equal(seededRandom("x")(), seededRandom("x")());
});

test("fleets carry ship badges with canonical silhouettes and faction emblems", () => {
  const data = fresh();
  const fleets = data.planets.flatMap((planet) => planet.fleets);
  assert.equal(fleets.length, 5);
  const kinds = Object.fromEntries(fleets.map((fleet) => [fleet.faction, shipKey(fleet)]));
  assert.deepEqual(kinds, { Necrons: "necron", Aeldari: "aeldari", "Thousand Sons": "thousand_sons", "Imperial Knights": "imperium", "Imperial Guard": "imperium" });
  for (const fleet of fleets) {
    assert.ok(SHIP_BADGES[fleet.badge], fleet.badge);
    assert.ok(EMBLEMS[fleetEmblem(fleet)], fleet.faction);
    assert.equal(fleetEmblem(fleet), FACTION_EMBLEMS[fleet.faction]);
    assert.equal(fleetTitle(fleet), `${fleet.faction} Battlegroup`);
    assert.ok(shipClass(fleet).length);
  }
  assert.equal(shipKey({ faction: "Death Guard", alliance: "Chaos" }), "death_guard");
  assert.equal(shipKey({ faction: "Unknown Renegades", alliance: "Chaos" }), "chaos");
  assert.equal(shipKey({ faction: "Unknown", alliance: "Xenos", badge: "aeldari_cruiser" }), "aeldari");
  assert.equal(shipScale({ badge: "imperial_battleship" }), 1.2);
  assert.equal(shipScale({ badge: "unknown" }), 1);
  for (const badge of Object.values(DEFAULT_BADGES)) assert.ok(SHIP_BADGES[badge] && EMBLEMS[BADGE_EMBLEMS[badge]], badge);
  for (const [key, ship] of Object.entries(SHIP_SILHOUETTES)) {
    assert.ok(ship.hull.length >= 12, key);
    assert.ok(ship.hull.every(([x, y]) => Math.abs(x) <= 12 && Math.abs(y) <= 12), `${key} fits the 24-unit box`);
    assert.match(shipPath(key), /^M[-\d.]+ [-\d.]+(L[-\d.]+ [-\d.]+)+Z$/);
  }
  assert.equal(new Set(Object.values(SHIP_SILHOUETTES).map((ship) => shipPath(Object.keys(SHIP_SILHOUETTES).find((k) => SHIP_SILHOUETTES[k] === ship)))).size, 6);
  assert.equal(fleetTitle({ faction: "Necrons", name: "Szarekhan Dynasty" }), "Szarekhan Dynasty");
});

test("Thousand Sons and Death Guard carry distinct hulls, crests and accents", () => {
  const sons = { faction: "Thousand Sons", alliance: "Chaos", badge: "chaos_grand_cruiser" };
  const guard = { faction: "Death Guard", alliance: "Chaos", badge: "chaos_grand_cruiser" };
  assert.notEqual(shipPath(shipKey(sons)), shipPath(shipKey(guard)));
  assert.equal(fleetEmblem(sons), "tzeentchEye");
  assert.equal(fleetEmblem(guard), "nurgleTrefoil");
  assert.equal(shipClass(sons), "Khopesh Sorcery Cruiser");
  assert.equal(shipClass(guard), "Terminus Plague Ram-Barge");
  assert.equal(factionAccent("Thousand Sons").accent, "#00FFFF");
  assert.equal(factionAccent("Death Guard").accent, "#7F9C3E");
  assert.equal(factionAccent("Necrons"), null);
  assert.ok(SHIP_SILHOUETTES.thousand_sons.sigils.length && SHIP_SILHOUETTES.death_guard.exhaust.length);
  for (const key of ["tzeentchEye", "nurgleTrefoil"]) assert.ok(EMBLEMS[key].layers.every((layer) => /^M[-\d.]/.test(layer.d) && !/NaN|undefined/.test(layer.d)), key);
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

test("live War Council state is well-formed (power, slots, fleets, kill teams)", () => {
  // Exact values change with every Cloud Uplink publish, so only the schema is pinned here.
  const data = live();
  normalizeCampaign(data);
  assert.doesNotThrow(() => validateCampaign(structuredClone(data)));
  for (const planet of data.planets) {
    assert.deepEqual(Object.keys(planet.powerLevels).sort(), [...ALLIANCES].sort(), planet.id);
    for (const alliance of ALLIANCES) {
      const level = planet.powerLevels[alliance];
      assert.ok(Number.isInteger(level) && level >= 1 && level <= 4, `${planet.id} ${alliance}=${level}`);
    }
    assert.ok(planet.infrastructure.slots.length <= planet.infrastructure.maxSlots, planet.id);
    assert.ok(planet.infrastructure.maxSlots <= MAX_INFRASTRUCTURE, planet.id);
    assert.ok(occupiedSlots(planet) <= planet.infrastructure.slots.length, planet.id);
    for (const fleet of planet.fleets) {
      assert.ok(ALLIANCES.includes(fleet.alliance) && data.alliances[fleet.alliance].factions.includes(fleet.faction), `${planet.id} ${fleet.faction}`);
      assert.ok(EMBLEMS[fleetEmblem(fleet)] && shipPath(shipKey(fleet)) && fleetTitle(fleet).length, `${planet.id} ${fleet.faction}`);
    }
  }
  assert.ok(Array.isArray(data.activeKillTeams));
  for (const operation of data.activeKillTeams) assert.ok(killTeamTitle(data, operation).length, operation.id);
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
  // Fix the levels locally: campaign_data.json is live War Council state and changes between publishes.
  setPowerLevel(data, "pluto_ii", "Imperium", 2);
  setPowerLevel(data, "pluto_ii", "Xenos", 1);
  setPowerLevel(data, "pluto_ii", "Chaos", 7);
  const planet = planetById(data, "pluto_ii");
  assert.deepEqual(planet.powerLevels, { Imperium: 2, Xenos: 1, Chaos: 4 });
  assert.equal(dominantAlliance(planet), "Chaos");
  setPowerLevel(data, "pluto_ii", "Imperium", 4);
  assert.equal(dominantAlliance(planet), null, "tied top levels leave the world contested");
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

test("kill teams deploy to any surviving world, persist in activeKillTeams and can be extracted", () => {
  const data = fresh();
  normalizeCampaign(data);
  assert.deepEqual(data.activeKillTeams, []);
  const far = data.planets.find((planet) => planet.id !== "sidon" && !neighbors(data, "sidon").includes(planet.id));
  const operation = deployKillTeam(data, "sidon", far.id, "Chaos", "  Vox-Array Sabotage ");
  assert.match(operation.id, /^kt-[a-z0-9]{1,6}$/);
  assert.deepEqual({ ...operation, id: undefined }, { id: undefined, alliance: "Chaos", target: far.id, codename: "Vox-Array Sabotage", from: "sidon" });
  const local = deployKillTeam(data, "sidon", "sidon", "Imperium", KILL_TEAM_CODENAMES[0]);
  assert.equal(local.target, "sidon");
  assert.doesNotThrow(() => validateCampaign(data));
  assert.equal(activeKillTeams(data).length, 2);
  assert.equal(killTeamTitle(data, operation), `Chaos Kill Team: Vox-Array Sabotage @ ${far.name}`);
  assert.throws(() => deployKillTeam(data, "sidon", far.id, "Xenos", "vox-array sabotage"), /already active/);
  assert.throws(() => deployKillTeam(data, "sidon", far.id, "Xenos", "   "), /codename/);
  assert.throws(() => deployKillTeam(data, "sidon", far.id, "Orks", "Waaagh"), /Unknown alliance/);
  assert.throws(() => deployKillTeam(data, "sidon", "nowhere", "Xenos", "Ghost"), /no longer exists/);
  setDestroyed(data, far.id, true);
  assert.throws(() => deployKillTeam(data, "sidon", far.id, "Xenos", "Crypt Infiltration"), /destroyed world/);
  assert.deepEqual(activeKillTeams(data).map((entry) => entry.id), [local.id]);
  extractKillTeam(data, operation.id);
  assert.equal(data.activeKillTeams.length, 1);
  assert.throws(() => extractKillTeam(data, operation.id), /no longer exists/);
  const exported = JSON.parse(serializeCampaign(data));
  assert.deepEqual(exported.activeKillTeams, [local]);
});

test("activeKillTeams validation rejects malformed operations", () => {
  const base = () => {
    const data = fresh();
    data.activeKillTeams = [{ id: "kt-alpha", alliance: "Xenos", target: "sidon", codename: "Crypt Infiltration" }];
    return data;
  };
  assert.doesNotThrow(() => validateCampaign(base()));
  const cases = [
    (data) => { data.activeKillTeams = {}; },
    (data) => { data.activeKillTeams[0].target = "nowhere"; },
    (data) => { data.activeKillTeams[0].from = "nowhere"; },
    (data) => { data.activeKillTeams[0].alliance = "Orks"; },
    (data) => { data.activeKillTeams[0].codename = ""; },
    (data) => { data.activeKillTeams[0].id = "bad id!"; },
    (data) => { data.activeKillTeams.push({ ...data.activeKillTeams[0] }); },
    (data) => { data.activeKillTeams.push({ ...data.activeKillTeams[0], id: "kt-beta", codename: "CRYPT INFILTRATION" }); },
  ];
  for (const corrupt of cases) {
    const data = base();
    corrupt(data);
    assert.throws(() => validateCampaign(data), /Invalid campaign/);
  }
});

test("local auto-save envelope round-trips the live state under the canonical storage key", () => {
  assert.equal(STORAGE_KEY, "vespator_cogitator_active_state");
  const canonical = fresh();
  normalizeCampaign(canonical);
  const baseline = campaignFingerprint(serializeCampaign(canonical));
  assert.match(baseline, /^[0-9a-f]{8}$/);
  const again = fresh();
  normalizeCampaign(again);
  assert.equal(campaignFingerprint(serializeCampaign(again)), baseline);
  const live = structuredClone(canonical);
  setPowerLevel(live, "sidon", "Chaos", 4);
  constructInfrastructure(live, "sidon", INFRASTRUCTURE_TYPES[0], "Chaos");
  deployKillTeam(live, "sidon", "sidon", "Xenos", "Crypt Infiltration");
  assert.notEqual(campaignFingerprint(serializeCampaign(live)), baseline);
  const packed = packState(live, { baseline, dirty: true, savedAt: "2025-01-01T00:00:00.000Z" });
  const restored = unpackState(packed);
  assert.deepEqual(restored.campaign, live);
  assert.equal(restored.baseline, baseline);
  assert.equal(restored.dirty, true);
  assert.equal(restored.savedAt, "2025-01-01T00:00:00.000Z");
  assert.equal(planetById(restored.campaign, "sidon").powerLevels.Chaos, 4);
  assert.equal(restored.campaign.activeKillTeams[0].codename, "Crypt Infiltration");
  // A bare campaign object (e.g. hand-written) is accepted and treated as unexported.
  const bare = unpackState(JSON.stringify(live));
  assert.deepEqual(bare.campaign, live);
  assert.equal(bare.dirty, true);
  assert.equal(bare.baseline, null);
  assert.throws(() => unpackState("{not json"), SyntaxError);
  assert.throws(() => unpackState(JSON.stringify({ version: 99, campaign: live })), /newer cogitator/);
  const broken = structuredClone(live);
  broken.planets[0].powerLevels.Chaos = 9;
  assert.throws(() => unpackState(JSON.stringify({ version: 1, campaign: broken })), /Invalid campaign/);
  assert.throws(() => packState(broken), /Invalid campaign/);
});

test("kill team emblem is available for 2D badges and 3D sprites", () => {
  assert.ok(EMBLEMS.killTeam);
  assert.ok(emblemLayers("killTeam").length >= 2);
});