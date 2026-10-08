import {
  ALLIANCES, MIN_POWER, MAX_POWER, MAX_INFRASTRUCTURE, SLOT_CATEGORIES,
  validateCampaign, normalizeCampaign, planetById, neighbors, planetNames, dominantAlliance, slotInfo, occupiedSlots,
  setPowerLevel, setInfrastructureCapacity, setSlot, fleetTitle, terrainCategory,
  commissionFleet, decommissionFleet, canTransfer, moveFleet, setDestroyed, serializeCampaign,
  activeVectors, assaultTargets, launchAssault, recallAssault, assaultTitle,
} from "./campaign.js";
import { EMBLEMS, TERRAIN_GLYPHS, ALLIANCE_EMBLEMS, INFRASTRUCTURE_EMBLEMS, factionEmblem, fleetEmblem, glyphKey, emblemLayers } from "./emblems.js";
import { terrainTheme } from "./terrain.js";
import { settings } from "./config.js";

const $ = (id) => document.getElementById(id);
const svgNS = "http://www.w3.org/2000/svg";
const SCALE = settings.mapScale || 1;
const TAG = { width: 236, height: 132, card: 164, gauge: 64, infra: 30 };
const ALLIANCE_INITIAL = { Imperium: "I", Xenos: "X", Chaos: "C" };
const map = $("tactical-map");
const pointers = new Map();

let campaign;
let selectedId;
let warmaster = false;
let dirty = false;
let view = { x: 0, y: 0, width: 1000, height: 1000 };
let fitWidth = 1000;
let fittedView = null;
let gesture = null;
let suppressClick = false;
let tagLayout = new Map();
let recentExterminatus = null;
let threeView = null;
let threeActive = false;
let threeLoading = false;
let showVectors = readPreference("vespator.vectors") !== "off";

function readPreference(name) {
  try { return localStorage.getItem(name); } catch { return null; }
}
function writePreference(name, value) {
  try { localStorage.setItem(name, value); } catch { /* storage unavailable; preference lasts for this tab */ }
}

// ---------- DOM helpers ----------
function element(tag, attributes = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === null) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (typeof value === "boolean") node[key] = value;
    else node.setAttribute(key, value);
  }
  node.append(...children.filter(Boolean));
  return node;
}

function vector(tag, attributes = {}, text) {
  const node = document.createElementNS(svgNS, tag);
  for (const [key, value] of Object.entries(attributes)) if (value !== undefined && value !== null) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

function emblemGroup(key, size, attributes = {}) {
  const group = vector("g", { class: "emblem", ...attributes });
  const inner = vector("g", { transform: `scale(${size / 24})` });
  for (const layer of emblemLayers(key)) {
    inner.append(vector("path", layer.mode === "fill"
      ? { d: layer.d, fill: "currentColor", stroke: "none" }
      : { d: layer.d, fill: "none", stroke: "currentColor", "stroke-width": 1.9, "stroke-linecap": "round", "stroke-linejoin": "round", "stroke-dasharray": layer.dash }));
  }
  group.append(inner);
  return group;
}

function emblemIcon(key, size = 20, className = "emblem-icon") {
  const svg = vector("svg", { viewBox: "-12 -12 24 24", width: size, height: size, class: className, "aria-hidden": "true", focusable: "false" });
  svg.append(emblemGroup(key, 24));
  return svg;
}

function report(message, error = false) {
  $("status").textContent = message;
  $("status").classList.toggle("error", error);
}

const UNASSIGNED = "#CFE8CF";
const color = (alliance) => campaign.alliances[alliance]?.color || UNASSIGNED;
const allianceStyle = (alliance) => `--alliance:${color(alliance)}`;
const pos = (planet) => ({ x: planet.x * SCALE, y: planet.y * SCALE });
const pad = (value, size = 2) => String(value).padStart(size, "0");
const designation = (planet) => `VF-${pad(campaign.planets.indexOf(planet) + 1, 3)}`;
const currentPlanet = () => planetById(campaign, selectedId);
const shorten = (value, length) => value.length > length ? `${value.slice(0, length - 1)}…` : value;

// ---------- State changes ----------
function mutate(action, message) {
  if (!warmaster) { report("Command denied: authorize Warmaster override first.", true); return; }
  const before = structuredClone(campaign);
  try {
    action();
    validateCampaign(campaign);
    dirty = true;
    render();
    report(message);
  } catch (error) {
    campaign = before;
    render();
    report(error.message, true);
  }
}

function confirmAction(title, message, accept) {
  const dialog = $("confirm-dialog");
  $("confirm-title").textContent = title;
  $("confirm-message").textContent = message;
  $("confirm-accept").textContent = accept;
  dialog.returnValue = "";
  dialog.showModal();
  return new Promise((resolve) => dialog.addEventListener("close", () => resolve(dialog.returnValue === "accept"), { once: true }));
}

function selectPlanet(id, focus = false) {
  if (!planetById(campaign, id)) return;
  selectedId = id;
  render();
  const planet = currentPlanet();
  if (focus && !threeActive) {
    const point = pos(planet);
    view.x = point.x + TAG.width / 3 - view.width / 2;
    view.y = point.y - view.height / 2;
    applyView();
  }
  report(`Dossier linked: ${planet.name}${planet.destroyed ? " — WORLD DESTROYED" : ""}.`);
}

// ---------- Rendering ----------
function render() {
  renderStats();
  renderIndex();
  renderMap();
  renderDossier();
  document.title = `${campaign.campaignName} // Imperial Cogitator`;
  $("mode-badge").textContent = warmaster ? "WARMASTER AUTHORIZED" : "READ-ONLY ACCESS";
  $("mode-badge").classList.toggle("admin", warmaster);
  $("override").textContent = warmaster ? "◇ LOCK COMMAND" : "◇ WARMASTER OVERRIDE";
  $("export").hidden = !warmaster;
  $("export").classList.toggle("pending", dirty);
  $("unsaved").classList.toggle("dirty", dirty);
  $("unsaved").textContent = dirty ? "UNEXPORTED CHANGES — local memory only. Use EXPORT COGITATOR STATE before closing." : "Source: campaign_data.json";
  updateHint();
  updateVectorToggle();
  threeView?.update(campaign, selectedId);
}

function updateVectorToggle() {
  const button = $("vector-toggle");
  button.setAttribute("aria-pressed", String(showVectors));
  button.querySelector(".vec-on").classList.toggle("active", showVectors);
  button.querySelector(".vec-off").classList.toggle("active", !showVectors);
  map.classList.toggle("vectors-hidden", !showVectors);
}

function updateHint() {
  $("map-hint").textContent = threeActive
    ? "DRAG TO PAN · RIGHT-DRAG/SHIFT-DRAG TO ROTATE · SCROLL TO ZOOM · CLICK A WORLD"
    : warmaster ? "DRAG FLEETS ALONG WARP LANES · CLICK GAUGE SEGMENTS · SCROLL TO ZOOM" : "DRAG TO PAN · SCROLL TO ZOOM · CLICK A WORLD";
}

function renderStats() {
  const active = campaign.planets.filter((planet) => !planet.destroyed);
  const fleets = campaign.planets.reduce((sum, planet) => sum + planet.fleets.length, 0);
  const built = campaign.planets.reduce((sum, planet) => sum + occupiedSlots(planet), 0);
  const capacity = campaign.planets.reduce((sum, planet) => sum + planet.infrastructure.maxSlots, 0);
  const lost = campaign.planets.length - active.length;
  $("campaign-stats").replaceChildren(...[
    [pad(campaign.planets.length), "SYSTEMS"],
    [pad(campaign.warpLanes.length), "WARP LANES"],
    [pad(fleets), "FLEETS"],
    [pad(activeVectors(campaign).length), "ASSAULTS", activeVectors(campaign).length ? "assault" : ""],
    [`${built}/${capacity}`, "INFRASTRUCTURE"],
    [pad(lost), "EXTERMINATUS", lost ? "danger" : ""],
  ].map(([value, label, extra]) => element("div", { class: `stat ${extra || ""}` }, [element("strong", { text: value }), element("span", { text: label })])));
  $("dominance").replaceChildren(...ALLIANCES.map((alliance) => {
    const total = active.reduce((sum, planet) => sum + planet.powerLevels[alliance], 0);
    const led = active.filter((planet) => dominantAlliance(planet) === alliance).length;
    return element("div", { class: "dominance-item", style: allianceStyle(alliance), title: `${alliance}: total Power Level ${total} across operational worlds; leads ${led}` }, [
      emblemIcon(ALLIANCE_EMBLEMS[alliance], 22),
      element("div", {}, [element("strong", { text: `${alliance.toUpperCase()} ${total}` }), element("small", { text: `LEADS ${led} WORLD${led === 1 ? "" : "S"}` })]),
    ]);
  }));
  $("world-count").textContent = pad(campaign.planets.length);
  $("lane-count").textContent = `${pad(campaign.warpLanes.length)} WARP LANES`;
}

function miniGauge(planet) {
  return element("span", { class: "mini-gauge", "aria-label": ALLIANCES.map((alliance) => `${alliance} ${planet.powerLevels[alliance]}`).join(", ") },
    ALLIANCES.map((alliance) => element("span", { class: "mini-bar", style: allianceStyle(alliance), title: `${alliance} PL ${planet.powerLevels[alliance]}` },
      [MAX_POWER, 3, 2, 1].map((level) => element("i", { class: level <= planet.powerLevels[alliance] ? "on" : "" })))));
}

function renderIndex() {
  const query = $("search").value.trim().toLowerCase();
  const planets = campaign.planets.filter((planet) => [
    planet.name, planet.subName, planet.id, planet.terrain, ...planet.terrainTraits,
    ...(planet.terrainIcons || []).map((icon) => TERRAIN_GLYPHS[glyphKey(icon)].label),
    ...planet.fleets.flatMap((fleet) => [fleetTitle(fleet), fleet.faction, fleet.alliance]),
    ...planet.infrastructure.slots.map(slotInfo).filter((slot) => !slot.empty).flatMap((slot) => [slot.type, slot.alliance]),
    planet.destroyed ? "destroyed exterminatus" : "",
  ].join(" ").toLowerCase().includes(query));
  $("world-list").replaceChildren(...planets.map((planet) => {
    const lead = dominantAlliance(planet);
    const { world, system } = planetNames(planet);
    return element("button", {
      type: "button",
      class: `world-button${planet.id === selectedId ? " selected" : ""}${planet.destroyed ? " destroyed" : ""}`,
      style: lead ? allianceStyle(lead) : "",
      "aria-current": planet.id === selectedId ? "true" : "false",
      onclick: () => selectPlanet(planet.id, true),
    }, [
      planet.destroyed ? element("span", { class: "world-icon hazard-icon", text: "☢", "aria-hidden": "true" }) : emblemIcon(lead ? ALLIANCE_EMBLEMS[lead] : "staging", 20, "world-icon"),
      element("span", { class: "world-meta" }, [
        element("strong", { text: `${world.toUpperCase()}` }),
        element("small", { text: planet.destroyed ? "EXTERMINATUS / WORLD LOST" : `${system} · ${planet.terrain}` }),
        planet.fleets.length ? element("small", { class: "fleet-count", text: `◈ ${planet.fleets.length} FLEET${planet.fleets.length === 1 ? "" : "S"}` }) : null,
      ]),
      miniGauge(planet),
    ]);
  }));
  if (!planets.length) $("world-list").append(element("p", { class: "empty-message", text: "No matching systems." }));
}

function renderLegend() {
  $("legend").replaceChildren(...ALLIANCES.map((alliance) => element("div", { class: "legend-item", style: allianceStyle(alliance) }, [
    emblemIcon(ALLIANCE_EMBLEMS[alliance], 26, "legend-symbol"),
    element("div", {}, [
      element("strong", { text: `${alliance.toUpperCase()} · ${color(alliance).toUpperCase()}` }),
      ...campaign.alliances[alliance].factions.map((faction) => element("small", { class: "legend-faction" }, [
        emblemIcon(factionEmblem(faction, alliance), 14), document.createTextNode(` ${faction} — ${EMBLEMS[factionEmblem(faction, alliance)].label}`),
      ])),
    ]),
  ])));
  $("infra-legend").replaceChildren(...[...SLOT_CATEGORIES, "Special"].map((category) =>
    element("span", { class: `infra-key${category === "Empty" ? " empty" : ""}` }, [emblemIcon(INFRASTRUCTURE_EMBLEMS[category], 16), document.createTextNode({ Special: "Special (e.g. Plague Basin)", Active: "Active Facility" }[category] || category)])));
}

// ---------- Map layout ----------
function overlap(a, b) {
  return Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
}

function segmentHitsRect(a, b, rect) {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const checks = [[-dx, a.x - rect.x], [dx, rect.x + rect.w - a.x], [-dy, a.y - rect.y], [dy, rect.y + rect.h - a.y]];
  for (const [p, q] of checks) {
    if (p === 0) { if (q < 0) return false; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
    else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return true;
}

function layoutTags() {
  const nodes = campaign.planets.map(pos);
  const lanes = campaign.warpLanes.map(([a, b]) => [pos(planetById(campaign, a)), pos(planetById(campaign, b))]);
  const placed = [];
  const layout = new Map();
  const { width: w, height: h } = TAG;
  for (const planet of campaign.planets) {
    const p = pos(planet);
    const candidates = [
      [p.x + 54, p.y - h / 2], [p.x - 54 - w, p.y - h / 2], [p.x + 40, p.y - 40 - h], [p.x + 40, p.y + 40],
      [p.x - 40 - w, p.y - 40 - h], [p.x - 40 - w, p.y + 40], [p.x - w / 2, p.y - 58 - h], [p.x - w / 2, p.y + 58],
      [p.x + 54, p.y - h / 2 - 40], [p.x + 54, p.y - h / 2 + 40], [p.x - 54 - w, p.y - h / 2 - 40], [p.x - 54 - w, p.y - h / 2 + 40],
    ];
    let best = null;
    let bestScore = Infinity;
    candidates.forEach(([x, y], order) => {
      const rect = { x, y, w, h };
      const padded = { x: x - 8, y: y - 8, w: w + 16, h: h + 16 };
      let score = order * 10;
      for (const other of placed) {
        const shared = overlap(padded, other);
        if (shared > 0) score += 20000 + shared * 30;
      }
      for (const node of nodes) score += overlap(rect, { x: node.x - 48, y: node.y - 48, w: 96, h: 96 }) * 30;
      for (const [a, b] of lanes) if (segmentHitsRect(a, b, rect)) score += 6000;
      if (score < bestScore) { bestScore = score; best = rect; }
    });
    placed.push(best);
    layout.set(planet.id, best);
  }
  return layout;
}

function chamfer(x, y, w, h, c = 8) {
  return `M${x + c} ${y}H${x + w}V${y + h - c}L${x + w - c} ${y + h}H${x}V${y + c}Z`;
}

function renderGauge(planet, x, y) {
  const group = vector("g", { class: "gauge", transform: `translate(${x} ${y})` });
  group.append(vector("path", { d: chamfer(0, 0, TAG.gauge, TAG.height, 7), class: "card-frame" }));
  group.append(vector("text", { x: 6, y: 11, class: "tiny-label" }, "POWERLEVEL"));
  const cell = { w: 14, h: 21, x0: 14, y0: 17 };
  for (let row = 0; row < MAX_POWER; row++) {
    const level = MAX_POWER - row;
    group.append(vector("text", { x: 7, y: cell.y0 + row * cell.h + 14, class: "axis-label", "text-anchor": "middle" }, level));
    ALLIANCES.forEach((alliance, column) => {
      const value = planet.powerLevels[alliance];
      const lit = level <= value;
      group.append(vector("rect", {
        x: cell.x0 + column * (cell.w + 2), y: cell.y0 + row * cell.h, width: cell.w, height: cell.h - 2,
        class: `gauge-cell${lit ? " lit" : ""}${level === value ? " peak" : ""}${warmaster && !planet.destroyed ? " editable" : ""}`,
        style: allianceStyle(alliance), "data-planet": planet.id, "data-alliance": alliance, "data-level": level,
      }, undefined));
    });
  }
  ALLIANCES.forEach((alliance, column) => {
    const cx = cell.x0 + column * (cell.w + 2) + cell.w / 2;
    group.append(vector("text", { x: cx, y: cell.y0 + MAX_POWER * cell.h + 10, class: "gauge-value", style: allianceStyle(alliance), "text-anchor": "middle" }, planet.powerLevels[alliance]));
    group.append(emblemGroup(ALLIANCE_EMBLEMS[alliance], 11, { transform: `translate(${cx} ${cell.y0 + MAX_POWER * cell.h + 22})`, style: `color:${color(alliance)}` }));
  });
  group.append(vector("title", {}, `Power Levels — ${ALLIANCES.map((alliance) => `${alliance} ${planet.powerLevels[alliance]}`).join(", ")}`));
  return group;
}

function renderTag(planet, rect) {
  const { world, system } = planetNames(planet);
  const tag = vector("g", { class: `system-tag${planet.id === selectedId ? " selected" : ""}${planet.destroyed ? " destroyed" : ""}`, transform: `translate(${rect.x} ${rect.y})`, "data-planet": planet.id });
  const slots = planet.infrastructure.slots;
  const infraWidth = Math.max(70, 18 + Math.max(1, slots.length) * 22);
  const infra = vector("g", { class: "infra-strip" });
  infra.append(vector("path", { d: chamfer(0, 0, infraWidth, TAG.infra - 2, 6), class: "card-frame" }));
  slots.forEach((raw, index) => {
    const slot = slotInfo(raw);
    const cx = 15 + index * 22;
    if (slot.empty) {
      infra.append(vector("circle", { cx, cy: 12, r: 8, class: "infra-empty" }, undefined), vector("title", {}, "Empty slot"));
      return;
    }
    const chip = vector("g", { class: `infra-chip${slot.destroyed ? " wrecked" : ""}${slot.alliance ? "" : " unassigned"}`, style: `color:${color(slot.alliance)}` });
    chip.append(vector("circle", { cx, cy: 12, r: 9 }), emblemGroup(INFRASTRUCTURE_EMBLEMS[slot.category], 12, { transform: `translate(${cx} 12)` }));
    if (slot.destroyed) chip.append(vector("path", { d: `M${cx - 7} 5L${cx + 7} 19M${cx + 7} 5L${cx - 7} 19`, class: "wreck-mark" }));
    chip.append(vector("title", {}, `${slot.type} — ${slot.alliance || "Unassigned"}${slot.destroyed ? " (DESTROYED)" : ""}`));
    infra.append(chip);
  });
  infra.append(vector("text", { x: 4, y: TAG.infra - 4, class: "tiny-label" }, "INFRASTRUCTURE"));
  tag.append(infra);
  const card = vector("g", { class: "name-card", transform: `translate(0 ${TAG.infra + 6})` });
  const cardHeight = TAG.height - TAG.infra - 6;
  card.append(vector("path", { d: chamfer(0, 0, TAG.card, cardHeight, 9), class: "card-frame" }));
  card.append(vector("text", { x: TAG.card / 2, y: 20, class: "tag-name", "text-anchor": "middle" }, shorten(world, 16)));
  card.append(vector("text", { x: TAG.card / 2, y: 33, class: "tag-system", "text-anchor": "middle" }, shorten(system, 24)));
  card.append(vector("text", { x: TAG.card / 2, y: 46, class: `tag-terrain${planet.destroyed ? " danger" : ""}`, "text-anchor": "middle" }, planet.destroyed ? "⚠ EXTERMINATUS ENACTED" : shorten(planet.terrain.toUpperCase(), 30)));
  const lead = dominantAlliance(planet);
  ALLIANCES.forEach((alliance, index) => {
    const cx = TAG.card / 2 + (index - 1) * 40;
    const badge = vector("g", { class: `alliance-badge${lead === alliance ? " leading" : ""}`, style: `color:${color(alliance)}`, transform: `translate(${cx} 68)` });
    badge.append(vector("circle", { r: 13 }), emblemGroup(ALLIANCE_EMBLEMS[alliance], 16), vector("title", {}, `${alliance} — Power Level ${planet.powerLevels[alliance]}${lead === alliance ? " (leading)" : ""}`));
    card.append(badge);
  });
  tag.append(card, renderGauge(planet, TAG.card + 8, 0));
  return tag;
}

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

// Animated chevrons glide along each assaulted lane, offset to the attacker's right so opposing assaults never overlap.
function renderVectors() {
  const labels = [];
  if (!showVectors) { $("vector-labels").replaceChildren(); return []; }
  const stack = new Map();
  const rings = new Map();
  const groups = activeVectors(campaign).map((assault) => {
    const from = pos(planetById(campaign, assault.from));
    const to = pos(planetById(campaign, assault.to));
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const u = { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
    const n = { x: -u.y, y: u.x };
    const laneKey = `${assault.from}>${assault.to}`;
    const lane = stack.get(laneKey) || 0;
    stack.set(laneKey, lane + 1);
    const side = 11 + lane * 13;
    const start = { x: from.x + u.x * 44 + n.x * side, y: from.y + u.y * 44 + n.y * side };
    const end = { x: to.x - u.x * 52 + n.x * side, y: to.y - u.y * 52 + n.y * side };
    const travel = Math.hypot(end.x - start.x, end.y - start.y);
    const angle = Math.atan2(u.y, u.x) * 180 / Math.PI;
    const title = assaultTitle(campaign, assault);
    const target = planetById(campaign, assault.to);
    const group = vector("g", {
      class: "assault-vector", style: `color:${color(assault.alliance)}`, "data-from": assault.from, "data-to": assault.to, "data-alliance": assault.alliance,
    });
    group.append(vector("title", {}, `${title}\n${assault.alliance}: ${planetById(campaign, assault.from).name} → ${target.name}`));
    const ring = rings.get(assault.to) || 0;
    rings.set(assault.to, ring + 1);
    group.append(vector("circle", { cx: to.x, cy: to.y, r: 47 + ring * 6, class: "assault-reticle" }));
    group.append(vector("line", { x1: start.x, y1: start.y, x2: end.x, y2: end.y, class: "vector-track" }));
    const duration = Math.min(4.2, Math.max(1.8, travel / 110));
    const path = `M${start.x} ${start.y}L${end.x} ${end.y}`;
    const count = Math.max(3, Math.min(6, Math.round(travel / 70)));
    for (let i = 0; i < count; i++) {
      const chevron = vector("path", { d: "M-8-8L2 0-8 8M-1-8L9 0-1 8", class: "vector-chevron" });
      if (reducedMotion.matches) {
        const t = (i + 0.5) / count;
        chevron.setAttribute("transform", `translate(${start.x + (end.x - start.x) * t} ${start.y + (end.y - start.y) * t}) rotate(${angle})`);
      } else {
        const begin = `${(-duration * i / count).toFixed(2)}s`;
        chevron.setAttribute("opacity", "0");
        chevron.append(
          vector("animateMotion", { path, dur: `${duration}s`, begin, repeatCount: "indefinite", rotate: "auto" }),
          vector("animate", { attributeName: "opacity", values: "0;1;1;0", keyTimes: "0;0.12;0.82;1", dur: `${duration}s`, begin, repeatCount: "indefinite" }),
        );
      }
      group.append(chevron);
    }
    group.append(vector("path", { d: "M-10-11L8 0-10 11-5 0Z", class: "vector-head", transform: `translate(${end.x} ${end.y}) rotate(${angle})` }));
    const mid = { x: (from.x + to.x) / 2 - n.x * 3, y: (from.y + to.y) / 2 - n.y * 3 };
    const readable = angle > 90 || angle < -90 ? angle + 180 : angle;
    labels.push(vector("text", {
      x: 0, y: 0, transform: `translate(${mid.x} ${mid.y}) rotate(${readable})`, class: "vector-label", style: `color:${color(assault.alliance)}`,
      "text-anchor": "middle", "dominant-baseline": "middle",
    }, shorten(title.toUpperCase(), 24)));
    return group;
  });
  $("vector-labels").replaceChildren(...labels);
  return groups;
}

function renderMap() {
  tagLayout = layoutTags();
  const title = $("map-title");
  const bounds = mapBounds();
  const heading = campaign.campaignName.toUpperCase();
  title.replaceChildren(vector("text", { x: bounds.left + 40, y: bounds.top + 50, class: "map-title-text" }, /^THE\b/.test(heading) ? heading : `THE ${heading}`));
  $("lanes").replaceChildren(...campaign.warpLanes.map(([a, b]) => {
    const first = pos(planetById(campaign, a));
    const second = pos(planetById(campaign, b));
    const blocked = planetById(campaign, a).destroyed || planetById(campaign, b).destroyed;
    return vector("line", { x1: first.x, y1: first.y, x2: second.x, y2: second.y, class: `warp-lane${blocked ? " blocked" : ""}`, "data-a": a, "data-b": b });
  }));
  $("vectors").replaceChildren(...renderVectors());
  const connectors = [];
  const nodes = [];
  const tags = [];
  const fleets = [];
  for (const planet of campaign.planets) {
    const p = pos(planet);
    const rect = tagLayout.get(planet.id);
    const anchor = { x: Math.max(rect.x, Math.min(p.x, rect.x + rect.w)), y: Math.max(rect.y + TAG.infra, Math.min(p.y, rect.y + rect.h)) };
    const angle = Math.atan2(anchor.y - p.y, anchor.x - p.x);
    connectors.push(vector("line", { x1: p.x + Math.cos(angle) * 32, y1: p.y + Math.sin(angle) * 32, x2: anchor.x, y2: anchor.y, class: "connector" }));
    nodes.push(renderNode(planet, p, angle));
    tags.push(renderTag(planet, rect));
    const awayAngle = angle + Math.PI;
    planet.fleets.forEach((fleet, index) => {
      const spread = (index - (planet.fleets.length - 1) / 2) * 0.62;
      const x = p.x + Math.cos(awayAngle + spread) * 66;
      const y = p.y + Math.sin(awayAngle + spread) * 66;
      const marker = vector("g", {
        transform: `translate(${x} ${y})`, class: `fleet-marker${warmaster && !planet.destroyed ? " draggable" : ""}`, style: `color:${color(fleet.alliance)}`,
        "data-source": planet.id, "data-fleet": index, "data-x": x, "data-y": y, tabindex: "0", role: "button",
        "aria-label": `${fleetTitle(fleet)}, ${fleet.faction} (${fleet.alliance}) in orbit of ${planet.name}${warmaster ? ". Drag to a linked world to transfer." : ""}`,
      });
      marker.append(
        vector("title", {}, `${fleetTitle(fleet)} — ${fleet.faction} / ${fleet.alliance}${warmaster && !planet.destroyed ? "\nDrag along a warp lane to transfer" : ""}`),
        vector("polygon", { points: "0,-15 13,-7.5 13,7.5 0,15 -13,7.5 -13,-7.5", class: "fleet-hull" }),
        emblemGroup(fleetEmblem(fleet), 17),
      );
      marker.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectPlanet(planet.id); $("dossier").focus(); } });
      fleets.push(marker);
    });
  }
  $("connectors").replaceChildren(...connectors);
  $("systems").replaceChildren(...nodes);
  $("tags").replaceChildren(...tags);
  $("fleet-markers").replaceChildren(...fleets);
}

function renderNode(planet, p, tagAngle) {
  const selected = planet.id === selectedId;
  const lead = dominantAlliance(planet);
  const node = vector("g", {
    transform: `translate(${p.x} ${p.y})`, class: `planet-node${selected ? " selected" : ""}${planet.destroyed ? " destroyed" : ""}`,
    "data-planet": planet.id, tabindex: "0", role: "button", "aria-pressed": String(selected),
    "aria-label": `${planet.name}. ${planet.terrain}. Power Levels: ${ALLIANCES.map((alliance) => `${alliance} ${planet.powerLevels[alliance]}`).join(", ")}${planet.destroyed ? ". Destroyed by Exterminatus" : ""}.`,
  });
  node.append(vector("title", {}, `${planet.name}\n${planet.terrain}`));
  const start = tagAngle + Math.PI - 1.05;
  const end = tagAngle + Math.PI + 1.05;
  const arc = (r) => `M${Math.cos(start) * r} ${Math.sin(start) * r}A${r} ${r} 0 0 1 ${Math.cos(end) * r} ${Math.sin(end) * r}`;
  node.append(vector("path", { d: arc(44), class: "bracket" }), vector("circle", { r: 36, class: "hit-area" }), vector("circle", { r: 38, class: "selection-ring" }));
  if (planet.destroyed) {
    node.append(
      vector("circle", { r: 30, class: "hazard-ring" }),
      vector("path", { d: "M-20-15L-4-24 3-9-7 0-22-3ZM8-22L23-7 13 3 3-4ZM-22 7L-7 5 2 20-17 17ZM7 6L22 8 15 22 3 17Z", class: "hazard" }),
      vector("path", { d: "M-30-30L30 30M30-30L-30 30", class: "hazard-cross" }),
    );
  } else {
    node.append(vector("circle", { r: 27, class: "ring" }), vector("circle", { r: 19, class: "ring inner" }), vector("circle", { r: 11, class: "core", style: lead ? `fill:${color(lead)}` : "" }));
  }
  if (recentExterminatus?.id === planet.id && Date.now() - recentExterminatus.time < 2000) node.append(vector("circle", { r: 30, class: "shockwave" }));
  node.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectPlanet(planet.id); $("dossier").focus(); }
  });
  return node;
}

function mapBounds() {
  const points = campaign.planets.map(pos);
  const rects = [...tagLayout.values()];
  const left = Math.min(...points.map((p) => p.x - 90), ...rects.map((r) => r.x)) - 30;
  const right = Math.max(...points.map((p) => p.x + 90), ...rects.map((r) => r.x + r.w)) + 30;
  const top = Math.min(...points.map((p) => p.y - 90), ...rects.map((r) => r.y)) - 110;
  const bottom = Math.max(...points.map((p) => p.y + 90), ...rects.map((r) => r.y + r.h)) + 30;
  return { left, right, top, bottom };
}

// ---------- Dossier ----------
function globe(planet) {
  const theme = terrainTheme(planet);
  const svg = vector("svg", { viewBox: "-60 -60 120 120", class: "globe", "aria-hidden": "true" });
  const gradientId = `globe-${planet.id}`;
  const defs = vector("defs");
  const gradient = vector("radialGradient", { id: gradientId, cx: "35%", cy: "32%", r: "75%" });
  gradient.append(vector("stop", { offset: "0%", "stop-color": theme.accent }), vector("stop", { offset: "45%", "stop-color": theme.base }), vector("stop", { offset: "100%", "stop-color": theme.dark }));
  defs.append(gradient);
  svg.append(defs, vector("circle", { r: 54, class: "globe-orbit" }));
  if (planet.destroyed) {
    svg.append(vector("path", { d: "M-30-24L-5-38 8-12-10 0-38-8ZM18-31L38-8 20 6 10-5ZM-32 10L-8 8 6 36-26 26ZM14 12L36 16 24 36 8 26Z", class: "hazard" }));
  } else {
    svg.append(vector("circle", { r: 40, fill: `url(#${gradientId})`, opacity: ".9" }));
    for (let i = -2; i <= 2; i++) svg.append(vector("ellipse", { rx: 40, ry: Math.abs(i) * 9 + 3, cy: i * 12, class: "globe-line" }));
    svg.append(vector("ellipse", { rx: 16, ry: 40, class: "globe-line" }), vector("circle", { r: 40, class: "globe-rim", style: `stroke:${theme.glow}` }));
  }
  return svg;
}

function gaugePanel(planet) {
  const editable = warmaster && !planet.destroyed;
  return element("div", { class: "gauge-panel", role: "group", "aria-label": "Alliance Power Levels" }, ALLIANCES.map((alliance) => {
    const value = planet.powerLevels[alliance];
    const set = (level) => mutate(() => setPowerLevel(campaign, planet.id, alliance, level), `${planet.name}: ${alliance} Power Level set to ${Math.min(MAX_POWER, Math.max(MIN_POWER, level))}.`);
    const segments = [MAX_POWER, 3, 2, 1].map((level) => editable
      ? element("button", { type: "button", class: `segment${level <= value ? " lit" : ""}${level === value ? " peak" : ""}`, "aria-label": `Set ${alliance} Power Level to ${level}`, "aria-pressed": String(level === value), text: level, onclick: () => set(level) })
      : element("span", { class: `segment${level <= value ? " lit" : ""}${level === value ? " peak" : ""}`, text: level }));
    return element("div", { class: "gauge-column", style: allianceStyle(alliance) }, [
      emblemIcon(ALLIANCE_EMBLEMS[alliance], 22),
      element("span", { class: "gauge-name", text: alliance.toUpperCase() }),
      element("div", { class: "segments" }, segments),
      element("strong", { class: "gauge-readout", text: `PL ${value}` }),
      editable ? element("div", { class: "stepper" }, [
        element("button", { type: "button", text: "−", "aria-label": `Decrease ${alliance} Power Level`, disabled: value <= MIN_POWER, onclick: () => set(value - 1) }),
        element("button", { type: "button", text: "+", "aria-label": `Increase ${alliance} Power Level`, disabled: value >= MAX_POWER, onclick: () => set(value + 1) }),
      ]) : null,
    ]);
  }));
}

function options(values, selected, label = (value) => value) {
  return values.map((value) => element("option", { value, text: label(value), selected: value === selected }));
}

function slotLabel(category) {
  return { Empty: "Empty", Active: "Active Facility", Special: "Special Site" }[category] || category;
}

function infrastructureSection(planet) {
  const editable = warmaster && !planet.destroyed;
  const slots = planet.infrastructure.slots;
  const section = element("section", { class: "dossier-section" }, [
    element("div", { class: "section-title" }, [element("h2", { text: "INFRASTRUCTURE SLOTS" }), element("small", { text: `${occupiedSlots(planet)} / ${slots.length} OCCUPIED` })]),
  ]);
  const grid = element("div", { class: "slot-grid" });
  slots.forEach((raw, index) => {
    const slot = slotInfo(raw);
    const owner = slot.alliance ? slot.alliance.toUpperCase() : "UNASSIGNED";
    const badge = element("div", { class: `slot-badge${slot.empty ? " empty" : ""}${slot.destroyed ? " wrecked" : ""}`, style: slot.empty ? "" : `--alliance:${color(slot.alliance)}` }, [
      emblemIcon(INFRASTRUCTURE_EMBLEMS[slot.category], 26, "slot-icon"),
      element("div", { class: "slot-text" }, [
        element("span", { class: "slot-category", text: `SLOT ${pad(index + 1)} · ${slotLabel(slot.category).toUpperCase()}` }),
        element("strong", { text: slot.empty ? "Unclaimed" : slot.type }),
        slot.empty ? null : element("span", { class: "alliance-pill", style: `--alliance:${color(slot.alliance)}` }, [
          slot.alliance ? emblemIcon(ALLIANCE_EMBLEMS[slot.alliance], 12) : null,
          document.createTextNode(` ${owner}${slot.destroyed ? " · DESTROYED" : ""}`),
        ]),
      ]),
    ]);
    if (editable) {
      const update = (changes, message) => mutate(() => setSlot(campaign, planet.id, index, changes), message);
      const categories = slot.category === "Special" ? [...SLOT_CATEGORIES, "Special"] : SLOT_CATEGORIES;
      const type = element("select", { "aria-label": `Type of slot ${index + 1}`, onchange: (event) => update({ category: event.target.value }, `Slot ${index + 1} set to ${slotLabel(event.target.value)}.`) },
        options(categories, slot.category, slotLabel));
      const controls = [type];
      if (!slot.empty) {
        controls.push(
          element("select", { "aria-label": `Alliance controlling slot ${index + 1}`, onchange: (event) => update({ alliance: event.target.value }, `Slot ${index + 1} control: ${event.target.value || "unassigned"}.`) },
            options(["", ...ALLIANCES], slot.alliance || "", (value) => value || "Unassigned")),
          element("label", { class: "check" }, [element("input", { type: "checkbox", checked: slot.destroyed, onchange: (event) => update({ destroyed: event.target.checked }, event.target.checked ? "Infrastructure marked DESTROYED." : "Infrastructure repaired.") }), document.createTextNode(" DESTROYED")]),
          element("button", { type: "button", class: "icon-button", text: "✕", title: "Clear slot", "aria-label": `Clear slot ${index + 1}`, onclick: () => update({ category: "Empty" }, "Slot cleared.") }),
        );
      }
      badge.append(element("div", { class: "slot-editor" }, controls));
    }
    grid.append(badge);
  });
  if (!slots.length) grid.append(element("p", { class: "empty-message", text: "No infrastructure slots on this world." }));
  section.append(grid);
  if (editable) {
    const hasEmpty = slots.includes("empty");
    section.append(element("div", { class: "capacity-row" }, [
      element("span", { text: "SLOT CAPACITY" }),
      element("button", { type: "button", text: "−", "aria-label": "Remove an empty slot", disabled: !hasEmpty, onclick: () => mutate(() => setInfrastructureCapacity(campaign, planet.id, slots.length - 1), "Infrastructure capacity reduced.") }),
      element("strong", { text: String(slots.length) }),
      element("button", { type: "button", text: "+", "aria-label": "Add an infrastructure slot", disabled: slots.length >= MAX_INFRASTRUCTURE, onclick: () => mutate(() => setInfrastructureCapacity(campaign, planet.id, slots.length + 1), "Infrastructure slot added.") }),
    ]));
  }
  return section;
}

function fleetSection(planet) {
  const editable = warmaster && !planet.destroyed;
  const section = element("section", { class: "dossier-section" }, [
    element("div", { class: "section-title" }, [element("h2", { text: "GARRISONED FLEETS" }), element("small", { text: `${planet.fleets.length} SIGNATURE${planet.fleets.length === 1 ? "" : "S"}` })]),
  ]);
  if (!planet.fleets.length) section.append(element("p", { class: "empty-message", text: "No fleet signatures in orbit." }));
  const targets = neighbors(campaign, planet.id).filter((id) => canTransfer(campaign, planet.id, id)).map((id) => planetById(campaign, id));
  planet.fleets.forEach((fleet, index) => {
    const title = fleetTitle(fleet);
    const card = element("div", { class: "fleet-card", style: allianceStyle(fleet.alliance) }, [
      emblemIcon(fleetEmblem(fleet), 34, "fleet-emblem"),
      element("div", { class: "fleet-text" }, [
        element("strong", { class: "fleet-name", text: title }),
        element("span", { class: "fleet-faction", text: `${fleet.faction.toUpperCase()} · ${(EMBLEMS[fleetEmblem(fleet)]?.label || "Insignia").toUpperCase()}` }),
        element("span", { class: "alliance-pill", style: allianceStyle(fleet.alliance) }, [emblemIcon(ALLIANCE_EMBLEMS[fleet.alliance], 12), document.createTextNode(` ${fleet.alliance.toUpperCase()}`)]),
        element("small", { text: planet.destroyed ? "STRANDED / WORLD DESTROYED" : "IN ORBIT / AWAITING ORDERS" }),
      ]),
    ]);
    if (warmaster) {
      const controls = element("div", { class: "fleet-transfer" });
      if (editable) {
        const target = element("select", { "aria-label": `Destination for ${title}`, disabled: !targets.length }, targets.length ? targets.map((world) => element("option", { value: world.id, text: `→ ${world.name}` })) : [element("option", { text: "No open warp lanes" })]);
        controls.append(target, element("button", { type: "button", text: "TRANSFER", disabled: !targets.length, onclick: () => mutate(() => moveFleet(campaign, planet.id, index, target.value), `${title} traversed the warp lane to ${planetById(campaign, target.value).name}.`) }));
      }
      controls.append(element("button", { type: "button", class: "icon-button", text: "✕", title: "Decommission fleet", "aria-label": `Decommission ${title}`, onclick: async () => {
        if (await confirmAction("Decommission fleet", `Remove ${title} (${fleet.faction}) from the campaign record?`, "DECOMMISSION")) mutate(() => decommissionFleet(campaign, planet.id, index), `${title} decommissioned.`);
      } }));
      card.append(controls);
    }
    section.append(card);
  });
  if (editable) {
    const faction = element("select", { "aria-label": "New fleet faction" }, ALLIANCES.flatMap((alliance) => campaign.alliances[alliance].factions.map((name) => element("option", { value: name, text: `${name} (${alliance})` }))));
    const name = element("input", { type: "text", maxlength: "80", placeholder: "Fleet designation (optional)", "aria-label": "New fleet name" });
    section.append(element("form", { class: "commission-form", onsubmit: (event) => {
      event.preventDefault();
      const label = name.value.trim() || `${faction.value} Battlegroup`;
      mutate(() => commissionFleet(campaign, planet.id, faction.value, name.value), `${label} commissioned in orbit of ${planet.name}.`);
    } }, [element("label", { text: "COMMISSION FLEET" }), faction, name, element("button", { type: "submit", class: "primary-button", text: "+ COMMISSION" })]));
  }
  return section;
}

function assaultSection(planet) {
  const editable = warmaster && !planet.destroyed;
  const entries = (campaign.offensiveVectors || []).map((assault, index) => ({ assault, index })).filter(({ assault }) => assault.from === planet.id || assault.to === planet.id);
  const live = new Set(activeVectors(campaign));
  const section = element("section", { class: "dossier-section" }, [
    element("div", { class: "section-title" }, [element("h2", { text: "OFFENSIVE VECTORS" }), element("small", { text: `${entries.length} ACTIVE ORDER${entries.length === 1 ? "" : "S"}` })]),
  ]);
  if (!entries.length) section.append(element("p", { class: "empty-message", text: "No assaults launched from or against this world." }));
  for (const { assault, index } of entries) {
    const outgoing = assault.from === planet.id;
    const other = planetById(campaign, outgoing ? assault.to : assault.from);
    const title = assaultTitle(campaign, assault);
    const card = element("div", { class: `assault-card${live.has(assault) ? "" : " suspended"}`, style: allianceStyle(assault.alliance) }, [
      element("span", { class: "assault-arrow", "aria-hidden": "true", text: outgoing ? "⟶" : "⟵" }),
      element("div", { class: "assault-text" }, [
        element("strong", { text: title }),
        element("span", { text: `${outgoing ? "OUTBOUND → " : "INBOUND ← "}${planetNames(other).world.toUpperCase()}` }),
        element("span", { class: "alliance-pill", style: allianceStyle(assault.alliance) }, [emblemIcon(ALLIANCE_EMBLEMS[assault.alliance], 12), document.createTextNode(` ${assault.alliance.toUpperCase()}`)]),
        live.has(assault) ? null : element("small", { text: "SUSPENDED / WORLD DESTROYED" }),
      ]),
    ]);
    if (warmaster) {
      card.append(element("button", { type: "button", class: "icon-button", text: "✕", title: "Recall assault", "aria-label": `Recall ${title}`, onclick: () => mutate(() => recallAssault(campaign, index), `${title} recalled.`) }));
    }
    section.append(card);
  }
  if (editable) {
    const targets = assaultTargets(campaign, planet.id).map((id) => planetById(campaign, id));
    const lead = dominantAlliance(planet) || planet.fleets[0]?.alliance || ALLIANCES[0];
    const alliance = element("select", { "aria-label": "Attacking alliance" }, ALLIANCES.map((name) => element("option", { value: name, text: name, selected: name === lead })));
    const target = element("select", { "aria-label": "Assault target", disabled: !targets.length }, targets.length
      ? targets.map((world) => element("option", { value: world.id, text: `→ ${world.name}` }))
      : [element("option", { text: "No open warp lanes" })]);
    const label = element("input", { type: "text", maxlength: "80", placeholder: "Operation designation (optional)", "aria-label": "Assault designation" });
    section.append(element("form", { class: "assault-form", onsubmit: (event) => {
      event.preventDefault();
      if (!targets.length) return;
      const world = planetById(campaign, target.value);
      if (!showVectors) { showVectors = true; writePreference("vespator.vectors", "on"); }
      mutate(() => launchAssault(campaign, planet.id, target.value, alliance.value, label.value), `${alliance.value} assault launched: ${planet.name} → ${world.name}.`);
    } }, [
      element("label", { text: "LAUNCH ASSAULT" }), alliance, target, label,
      element("button", { type: "submit", class: "primary-button assault-button", text: "⚔ LAUNCH ASSAULT", disabled: !targets.length }),
    ]));
  }
  return section;
}

function renderDossier() {
  const planet = currentPlanet();
  const { world, system } = planetNames(planet);
  const lead = dominantAlliance(planet);
  const theme = terrainTheme(planet);
  const icons = planet.terrainIcons || [];
  const content = element("div", { class: `dossier-content${planet.destroyed ? " destroyed" : ""}`, style: lead ? allianceStyle(lead) : "" });
  content.append(element("section", { class: "designation" }, [
    element("span", { class: "dossier-kicker", text: `SYSTEM DESIGNATION // ${designation(planet)}` }),
    element("h3", { class: "planet-title", text: world }),
    element("p", { class: "dossier-id", text: `${system.toUpperCase()} SYSTEM · ${planet.id.toUpperCase()}` }),
  ]));
  content.append(element("section", { class: "overview" }, [
    globe(planet),
    element("dl", { class: "facts" }, [
      element("dt", { text: "DOMINANT TERRAIN CLASS" }), element("dd", { text: planet.terrain }),
      element("dt", { text: "SURFACE SIGNATURE" }), element("dd", { text: theme.label }),
      element("dt", { text: "CONTROL SIGNAL" }), element("dd", { class: "signal", text: planet.destroyed ? "☢ WORLD DESTROYED" : lead ? `${lead.toUpperCase()} DOMINANT` : "CONTESTED" }),
    ]),
  ]));
  content.append(element("section", { class: "dossier-section" }, [
    element("div", { class: "section-title" }, [element("h2", { text: "TERRAIN PROFILE" }), element("small", { text: `${planet.terrainTraits.length} TWIST${planet.terrainTraits.length === 1 ? "" : "S"} ACTIVE` })]),
    element("p", { class: "terrain-class" }, [element("span", { text: "CLASSIFICATION //" }), element("strong", { text: ` ${planet.terrain.toUpperCase()}` })]),
    terrainCategory(planet) ? element("p", { class: "terrain-class" }, [element("span", { text: "CRUSADE TERRAIN //" }), element("strong", { class: "terrain-category", text: ` ${terrainCategory(planet).toUpperCase()}` })]) : null,
    icons.length ? element("div", { class: "terrain-glyphs", role: "list", "aria-label": "Terrain glyphs" }, icons.map((icon) => {
      const glyph = TERRAIN_GLYPHS[glyphKey(icon)];
      return element("span", { class: "terrain-glyph", role: "listitem", title: `${glyph.label} (${icon})`, style: `--glyph:${theme.glow}` }, [
        emblemIcon(glyphKey(icon), 30, "glyph-icon"), element("small", { text: glyph.label.toUpperCase() }),
      ]);
    })) : null,
    element("h3", { class: "subheading", text: "ACTIVE TERRAIN RULES / TWISTS" }),
    element("ul", { class: "trait-list" }, planet.terrainTraits.length ? planet.terrainTraits.map((trait) => element("li", { text: trait })) : [element("li", { class: "muted", text: "No terrain twists recorded." })]),
  ]));
  content.append(element("section", { class: "dossier-section" }, [
    element("div", { class: "section-title" }, [element("h2", { text: "ALLIANCE POWER LEVELS" }), element("small", { text: `RANGE ${MIN_POWER}–${MAX_POWER}` })]),
    gaugePanel(planet),
  ]));
  content.append(infrastructureSection(planet), fleetSection(planet), assaultSection(planet));
  content.append(element("section", { class: "dossier-section" }, [
    element("div", { class: "section-title" }, [element("h2", { text: "WARP LANES" }), element("small", { text: `${neighbors(campaign, planet.id).length} LINKS` })]),
    element("div", { class: "lane-links" }, neighbors(campaign, planet.id).map((id) => {
      const other = planetById(campaign, id);
      return element("button", { type: "button", class: `lane-chip${other.destroyed || planet.destroyed ? " blocked" : ""}`, text: `⇄ ${planetNames(other).world}`, onclick: () => selectPlanet(id, true) });
    })),
  ]));
  if (warmaster) {
    content.append(element("section", { class: "admin-section" }, [
      element("h2", { text: "WARMASTER COMMAND" }),
      element("button", { type: "button", class: "danger-button", text: planet.destroyed ? "↺ RESTORE WORLD / REVERSE PROTOCOL" : "☢ INITIATE EXTERMINATUS", onclick: async () => {
        const destroying = !planet.destroyed;
        const ok = await confirmAction(destroying ? "Exterminatus protocol" : "Restore world",
          destroying ? `Authorize Exterminatus on ${planet.name}? Warp lanes through it close, transfers are blocked, and its fleets are stranded. This can be reversed.` : `Restore ${planet.name}? Retained fleets and infrastructure become operational again.`,
          destroying ? "EXTERMINATE" : "RESTORE");
        if (!ok) return;
        if (destroying) recentExterminatus = { id: planet.id, time: Date.now() };
        mutate(() => setDestroyed(campaign, planet.id, destroying), destroying ? `EXTERMINATUS ENACTED: ${planet.name} has been destroyed.` : `${planet.name} restored to the theatre.`);
        if (destroying) setTimeout(() => { if (campaign) renderMap(); }, 2100);
      } }),
      element("p", { class: "warning", text: "Destroyed worlds block fleet movement and edits; records are retained. Export state to persist changes." }),
    ]));
  }
  $("dossier").replaceChildren(element("div", { class: "panel-heading" }, [element("h2", { text: "PLANETARY DOSSIER" }), element("span", { text: "◉ LINKED" })]), content);
}

// ---------- Pan / zoom / drag ----------
function applyView() {
  map.setAttribute("viewBox", `${view.x} ${view.y} ${view.width} ${view.height}`);
  $("coordinates").textContent = `GRID ${Math.round(view.x / SCALE)}, ${Math.round(view.y / SCALE)} / ZOOM ${Math.round(fitWidth / view.width * 100)}%`;
}

function fitMap() {
  if (!campaign) return;
  const { left, right, top, bottom } = mapBounds();
  const rect = map.getBoundingClientRect();
  const aspect = (rect.width || 800) / (rect.height || 600);
  const height = Math.max(bottom - top, (right - left) / aspect);
  view = { x: (left + right) / 2 - height * aspect / 2, y: (top + bottom) / 2 - height / 2, width: height * aspect, height };
  fitWidth = view.width;
  fittedView = { ...view };
  applyView();
}

function pointAt(clientX, clientY) {
  return new DOMPoint(clientX, clientY).matrixTransform(map.getScreenCTM().inverse());
}

function zoom(factor, anchor) {
  const width = Math.min(fitWidth * 6, Math.max(fitWidth / 8, view.width * factor));
  const ratio = width / view.width;
  const point = anchor || { x: view.x + view.width / 2, y: view.y + view.height / 2 };
  view = { x: point.x - (point.x - view.x) * ratio, y: point.y - (point.y - view.y) * ratio, width, height: view.height * ratio };
  applyView();
}

function clearGesture() {
  gesture = null;
  pointers.clear();
  map.classList.remove("panning", "dragging-fleet");
  map.querySelectorAll(".drop-target, .drop-valid, .drop-invalid, .transfer-route").forEach((node) => node.classList.remove("drop-target", "drop-valid", "drop-invalid", "transfer-route"));
}

map.addEventListener("wheel", (event) => {
  event.preventDefault();
  zoom(Math.exp(Math.max(-100, Math.min(100, event.deltaY)) * 0.002), pointAt(event.clientX, event.clientY));
}, { passive: false });

map.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || !campaign) return;
  suppressClick = false;
  const marker = event.target.closest(".fleet-marker");
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 2 && gesture?.kind !== "fleet") {
    const [a, b] = [...pointers.values()];
    gesture = { kind: "pinch", distance: Math.hypot(a.x - b.x, a.y - b.y), midpoint: pointAt((a.x + b.x) / 2, (a.y + b.y) / 2), view: { ...view } };
    map.setPointerCapture(event.pointerId);
    return;
  }
  if (gesture) return;
  if (marker && warmaster && !planetById(campaign, marker.dataset.source).destroyed) {
    const source = marker.dataset.source;
    gesture = { kind: "fleet", marker, source, index: Number(marker.dataset.fleet), start: pointAt(event.clientX, event.clientY), clientX: event.clientX, clientY: event.clientY, moved: false };
    marker.classList.add("dragging");
    map.classList.add("dragging-fleet");
    map.querySelectorAll(".warp-lane").forEach((lane) => { if ((lane.dataset.a === source || lane.dataset.b === source) && !lane.classList.contains("blocked")) lane.classList.add("transfer-route"); });
    map.querySelectorAll(".planet-node").forEach((node) => { if (canTransfer(campaign, source, node.dataset.planet)) node.classList.add("drop-valid"); });
  } else {
    gesture = {
      kind: "pan", x: event.clientX, y: event.clientY, view: { ...view }, moved: false,
      gauge: event.target.closest(".gauge-cell"), selected: event.target.closest("[data-planet]")?.dataset.planet || marker?.dataset.source,
    };
  }
  map.setPointerCapture(event.pointerId);
});

map.addEventListener("pointermove", (event) => {
  if (!gesture || !pointers.has(event.pointerId)) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (gesture.kind === "pinch") {
    if (pointers.size < 2) return;
    const [a, b] = [...pointers.values()];
    view = { ...gesture.view };
    zoom(gesture.distance / Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), gesture.midpoint);
    suppressClick = true;
  } else if (gesture.kind === "pan") {
    const rect = map.getBoundingClientRect();
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    gesture.moved ||= Math.hypot(dx, dy) > 4;
    if (gesture.moved) {
      view.x = gesture.view.x - dx * gesture.view.width / rect.width;
      view.y = gesture.view.y - dy * gesture.view.height / rect.height;
      map.classList.add("panning");
      applyView();
    }
  } else if (gesture.kind === "fleet") {
    gesture.moved ||= Math.hypot(event.clientX - gesture.clientX, event.clientY - gesture.clientY) > 4;
    if (!gesture.moved) return;
    const point = pointAt(event.clientX, event.clientY);
    const x = Number(gesture.marker.dataset.x) + point.x - gesture.start.x;
    const y = Number(gesture.marker.dataset.y) + point.y - gesture.start.y;
    gesture.marker.setAttribute("transform", `translate(${x} ${y})`);
    const target = campaign.planets.find((planet) => planet.id !== gesture.source && Math.hypot(pos(planet).x - x, pos(planet).y - y) < 60);
    gesture.target = target?.id;
    map.querySelectorAll(".planet-node").forEach((node) => {
      const hovered = node.dataset.planet === target?.id;
      node.classList.toggle("drop-target", hovered && canTransfer(campaign, gesture.source, target.id));
      node.classList.toggle("drop-invalid", hovered && !canTransfer(campaign, gesture.source, target.id));
    });
  }
});

function endPointer(event, cancelled = false) {
  if (!pointers.has(event.pointerId)) return;
  const finished = gesture;
  clearGesture();
  if (map.hasPointerCapture(event.pointerId)) map.releasePointerCapture(event.pointerId);
  if (!finished || cancelled) { if (finished?.kind === "fleet") renderMap(); return; }
  if (finished.kind === "pan" && !finished.moved) {
    const cell = finished.gauge;
    if (cell && warmaster && !planetById(campaign, cell.dataset.planet).destroyed) {
      selectedId = cell.dataset.planet;
      mutate(() => setPowerLevel(campaign, cell.dataset.planet, cell.dataset.alliance, Number(cell.dataset.level)), `${planetById(campaign, cell.dataset.planet).name}: ${cell.dataset.alliance} Power Level set to ${cell.dataset.level}.`);
    } else if (finished.selected) selectPlanet(finished.selected);
  } else if (finished.kind === "fleet") {
    if (!finished.moved) selectPlanet(finished.source);
    else if (finished.target && canTransfer(campaign, finished.source, finished.target)) {
      const title = fleetTitle(planetById(campaign, finished.source).fleets[finished.index]);
      mutate(() => moveFleet(campaign, finished.source, finished.index, finished.target), `${title} transferred to ${planetById(campaign, finished.target).name} via warp lane.`);
    } else {
      renderMap();
      report(finished.target ? "Transfer denied: no open warp lane links those systems." : "Transfer cancelled: drop the fleet on a directly linked system.", true);
    }
  }
}
map.addEventListener("pointerup", (event) => endPointer(event));
map.addEventListener("pointercancel", (event) => endPointer(event, true));

new ResizeObserver(() => {
  const rect = map.getBoundingClientRect();
  if (!rect.height || !campaign || threeActive) return;
  if (fittedView && ["x", "y", "width", "height"].every((key) => view[key] === fittedView[key])) { fitMap(); return; }
  const center = view.x + view.width / 2;
  view.width = view.height * rect.width / rect.height;
  view.x = center - view.width / 2;
  applyView();
}).observe($("map-container"));

// ---------- 3D projection ----------
async function toggleProjection() {
  if (!campaign || threeLoading) return;
  const button = $("view-toggle");
  threeLoading = true;
  button.disabled = true;
  try {
    if (!threeView) {
      $("loading").hidden = false;
      $("loading").textContent = "SPINNING UP COGITATOR 3D PROJECTION…";
      const { createCogitatorView } = await import("./view3d.js");
      $("three-container").hidden = false;
      try {
        threeView = createCogitatorView($("three-container"), campaign, selectedId, { onSelect: (id) => selectPlanet(id), vectors: showVectors });
      } catch (error) {
        $("three-container").hidden = true;
        throw error;
      } finally {
        $("loading").hidden = true;
      }
    }
    threeActive = !threeActive;
    $("three-container").hidden = !threeActive;
    map.classList.toggle("offscreen", threeActive);
    threeView.setActive(threeActive);
    if (threeActive) threeView.update(campaign, selectedId);
    button.setAttribute("aria-pressed", String(threeActive));
    button.querySelector(".mode-2d").classList.toggle("active", !threeActive);
    button.querySelector(".mode-3d").classList.toggle("active", threeActive);
    $("projection-label").textContent = threeActive ? "COGITATOR 3D" : "TACTICAL 2D";
    document.body.classList.toggle("three-active", threeActive);
    updateHint();
    report(threeActive ? "Cogitator 3D projection engaged. Dossier commands remain available; drag fleets in Tactical 2D." : "Tactical 2D projection engaged.");
  } catch (error) {
    report(`3D projection unavailable: ${error.message}`, true);
  } finally {
    threeLoading = false;
    button.disabled = false;
  }
}

$("three-container").addEventListener("projectionerror", (event) => {
  if (threeActive) toggleProjection();
  report(event.detail, true);
});
$("view-toggle").addEventListener("click", toggleProjection);
$("zoom-in").addEventListener("click", () => threeActive ? threeView.zoom(0.8) : zoom(0.8));
$("zoom-out").addEventListener("click", () => threeActive ? threeView.zoom(1.25) : zoom(1.25));
$("fit-map").addEventListener("click", () => threeActive ? threeView.fit() : fitMap());

// ---------- Commands ----------
$("search").addEventListener("input", () => { if (campaign) renderIndex(); });

$("override").addEventListener("click", () => {
  if (!campaign) return;
  if (warmaster) {
    warmaster = false;
    clearGesture();
    render();
    report(dirty ? "Command access locked. Unexported changes are retained in this tab; unlock to export." : "Command access locked.");
  } else {
    $("passkey").value = "";
    $("passkey-error").textContent = "";
    $("passkey-dialog").showModal();
    $("passkey").focus();
  }
});
$("cancel-passkey").addEventListener("click", () => $("passkey-dialog").close());
$("passkey-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if ($("passkey").value !== settings.warmasterPasskey) { $("passkey-error").textContent = "Authorization denied. Invalid command passkey."; return; }
  warmaster = true;
  $("passkey").value = "";
  $("passkey-dialog").close();
  render();
  report("Warmaster authorized. Edits are local until you EXPORT COGITATOR STATE.");
});

$("export").addEventListener("click", () => {
  if (!warmaster) return;
  try {
    const url = URL.createObjectURL(new Blob([serializeCampaign(campaign)], { type: "application/json" }));
    const link = element("a", { href: url, download: "campaign_data.json" });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    dirty = false;
    render();
    $("unsaved").textContent = "Exported. Replace MapWebPage/campaign_data.json with the download and commit it to publish.";
    report("campaign_data.json exported. Commit it so the site and Discord bot pick up the new state.");
  } catch (error) {
    report(`Export failed: ${error.message}`, true);
  }
});

$("import-button").addEventListener("click", () => $("import-file").click());
$("import-file").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error("Campaign files must be smaller than 5 MB.");
    const incoming = JSON.parse(await file.text());
    const synced = normalizeCampaign(incoming);
    if (dirty && !(await confirmAction("Replace campaign", "Discard unexported local changes and load the imported campaign?", "REPLACE"))) return;
    campaign = incoming;
    selectedId = campaign.planets[0].id;
    dirty = false;
    clearGesture();
    renderLegend();
    render();
    fitMap();
    threeView?.fit();
    report(`Loaded ${file.name} (${campaign.planets.length} systems). Import is local only.${synced ? ` Official terrain twists applied to ${synced} world${synced === 1 ? "" : "s"}.` : ""}`);
  } catch (error) {
    report(`Import rejected: ${error.message}`, true);
  } finally {
    event.target.value = "";
  }
});

window.addEventListener("beforeunload", (event) => {
  if (dirty) { event.preventDefault(); event.returnValue = ""; }
});

let lastSynced = 0;

async function fetchCampaign() {
  // no-store skips the HTTP cache; the query string also defeats CDN/proxy caches (e.g. GitHub Pages).
  const response = await fetch(`./campaign_data.json?t=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Campaign feed returned HTTP ${response.status}.`);
  const data = await response.json();
  lastSynced = normalizeCampaign(data);
  return data;
}

const twistNote = () => lastSynced ? ` Official terrain twists applied to ${lastSynced} world${lastSynced === 1 ? "" : "s"}; export to persist.` : "";

function setVectors(visible) {
  showVectors = visible;
  writePreference("vespator.vectors", visible ? "on" : "off");
  renderMap();
  updateVectorToggle();
  threeView?.setVectors(visible);
  const count = activeVectors(campaign).length;
  report(visible ? `Offensive vectors displayed: ${count} active assault${count === 1 ? "" : "s"}.` : "Offensive vectors hidden.");
}

$("vector-toggle").addEventListener("click", () => { if (campaign) setVectors(!showVectors); });

$("reload-feed").addEventListener("click", async () => {
  if (!campaign) return;
  if (dirty && !(await confirmAction("Re-sync campaign feed", "Discard unexported local changes and reload campaign_data.json from the server?", "RE-SYNC"))) return;
  try {
    const incoming = await fetchCampaign();
    campaign = incoming;
    if (!planetById(campaign, selectedId)) selectedId = campaign.planets[0].id;
    dirty = false;
    clearGesture();
    renderLegend();
    render();
    fitMap();
    threeView?.fit();
    report(`Feed re-synced: ${campaign.planets.length} systems, ${campaign.warpLanes.length} warp lanes, ${activeVectors(campaign).length} assaults.${twistNote()}`);
  } catch (error) {
    report(`Re-sync failed: ${error.message}`, true);
  }
});

async function initialize() {
  try {
    campaign = await fetchCampaign();
    selectedId = campaign.planets[0].id;
    renderLegend();
    render();
    fitMap();
    $("loading").hidden = true;
    report(`Noospheric link established: ${campaign.planets.length} systems, ${campaign.warpLanes.length} warp lanes, ${activeVectors(campaign).length} assaults. Player observation mode.${twistNote()}`);
  } catch (error) {
    $("loading").textContent = `FEED FAILURE: ${error.message} Serve this folder over HTTP, check campaign_data.json, and reload.`;
    $("override").disabled = true;
    $("import-button").disabled = true;
    $("reload-feed").disabled = true;
    $("view-toggle").disabled = true;
    $("vector-toggle").disabled = true;
    report(error.message, true);
  }
}

initialize();
