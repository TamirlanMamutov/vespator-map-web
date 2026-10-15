// Battle report schema helpers (DOM-free). Every editor field maps 1:1 to battle_reports.json.

export const ALLIANCES = ["Imperium", "Xenos", "Chaos"];
export const RANKS = ["Battle-Ready", "Bloodied", "Battle-Hardened", "Heroic", "Legendary"];
const RANK_XP = [0, 6, 16, 31, 51];

const str = (value) => (value === undefined || value === null ? "" : String(value));
const int = (value) => {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : 0;
};
const array = (value) => Array.isArray(value) ? value : [];
export const tags = (value) => (Array.isArray(value) ? value : str(value).split(/[;\n]/))
  .map((tag) => str(tag && typeof tag === "object" ? tag.name || tag.value : tag).trim()).filter(Boolean);
export const unitName = (unit) => [unit.customName, unit.baseName].filter(Boolean).join(" — ") || "Unnamed unit";
export const rosterPoints = (player) => array(player.roster).reduce((sum, unit) => sum + int(unit.points), 0);

export function blankUnit(roster = []) {
  let number = 1;
  while (roster.some((unit) => unit.id === `unit-${number}`)) number++;
  return { id: `unit-${number}`, customName: "", baseName: "", points: 0, role: "", isWarlord: false,
    xp: 0, rank: RANKS[0], honors: [], scars: [], crusadePoints: 0, powerLevel: 0 };
}

export function normalizeUnit(raw = {}, index = 0) {
  return {
    id: str(raw.id).trim() || `unit-${index + 1}`,
    customName: str(raw.customName).trim(), baseName: str(raw.baseName).trim(),
    points: int(raw.points), role: str(raw.role).trim(), isWarlord: Boolean(raw.isWarlord),
    xp: int(raw.xp), rank: str(raw.rank).trim() || RANKS[0],
    honors: tags(raw.honors), scars: tags(raw.scars),
    crusadePoints: int(raw.crusadePoints), powerLevel: int(raw.powerLevel),
  };
}

export function unitProgress(player, unit) {
  const marked = player.markedForGreatness;
  const earnedXp = array(player.agendas).reduce((sum, agenda) =>
    sum + (agenda.completed && agenda.unitId === unit.id ? int(agenda.xp) : 0), 0)
    + (marked?.unitId === unit.id ? 3 : 0);
  const promotions = array(player.rankPromotions).filter((promotion) => promotion.unitId === unit.id);
  return {
    xp: int(unit.xp) + earnedXp, earnedXp,
    rank: promotions.reduce((rank, promotion) =>
      RANKS.indexOf(promotion.newRank) > RANKS.indexOf(rank) ? promotion.newRank : rank, unit.rank),
    honors: [...new Set([...tags(unit.honors), ...promotions.flatMap((promotion) => tags(promotion.reward))])],
    scars: [...new Set([...tags(unit.scars), ...array(player.outOfActionTests)
      .filter((test) => test.unitId === unit.id && !test.passed).flatMap((test) => tags(test.scar))])],
  };
}

export function eligibleRanks(player, unit) {
  const xp = unitProgress(player, unit).xp;
  return RANKS.filter((rank, index) => index > RANKS.indexOf(unit.rank) && xp >= RANK_XP[index]);
}

export function unlinkUnit(player, id) {
  const unit = player.roster.find((item) => item.id === id);
  if (!unit) throw new Error("Roster unit not found.");
  for (const record of [...player.agendas, ...player.outOfActionTests, player.markedForGreatness, ...player.rankPromotions]) {
    if (record.unitId === id) {
      if (record === player.markedForGreatness) record.xp = 3;
      record.unit = unitName(unit);
      delete record.unitId;
    }
  }
  player.roster = player.roster.filter((item) => item.id !== id);
}

export function blankPlayer() {
  return {
    handle: "", discordId: "", commander: "", faction: "", alliance: "Imperium", warlord: "",
    score: 0, isWinner: false, startCP: 0, endCP: 0, detachment: "", pointsTotal: 0, roster: [],
    rp: { start: 0, gained: 1, spent: 0, total: 1, spentOn: "" },
    specialResource: null,
    agendas: [],
    outOfActionTests: [],
    markedForGreatness: { unitId: "", unit: "", xp: 3, reason: "" },
    rankPromotions: [],
  };
}

export function nextId(reports) {
  const highest = reports.reduce((max, report) => Math.max(max, int(/(\d+)$/.exec(report.id || "")?.[1])), 0);
  return `BR-${String(highest + 1).padStart(3, "0")}`;
}

export function blankReport(reports = []) {
  const battleNumber = reports.reduce((max, report) => Math.max(max, int(report.battleNumber)), 0) + 1;
  return {
    id: nextId(reports), battleNumber, title: "", date: new Date().toISOString().slice(0, 10),
    location: "", mission: "", battleSize: "500pt",
    players: [blankPlayer(), { ...blankPlayer(), alliance: "Xenos" }],
    narrativeContext: "", highlights: [], narrativeAftermath: "",
    headerImageUrl: "", aftermathImageUrl: "",
  };
}

// Canonical key order and types; optional blocks (discordId, specialResource, scar) are omitted when empty.
export function normalizePlayer(raw = {}) {
  const rp = raw.rp || {};
  const discordId = str(raw.discordId).trim();
  const player = {
    handle: str(raw.handle).trim(),
    ...(discordId ? { discordId } : {}),
    commander: str(raw.commander).trim(),
    faction: str(raw.faction).trim(),
    alliance: str(raw.alliance).trim(),
    warlord: str(raw.warlord).trim(),
    score: int(raw.score),
    isWinner: Boolean(raw.isWinner),
    startCP: int(raw.startCP),
    endCP: int(raw.endCP),
    detachment: str(raw.detachment).trim(),
    roster: array(raw.roster).map(normalizeUnit),
    rp: { start: int(rp.start), gained: int(rp.gained), spent: int(rp.spent), total: int(rp.total), spentOn: str(rp.spentOn).trim() },
  };
  player.pointsTotal = rosterPoints(player);
  const reference = (record) => {
    const id = str(record.unitId).trim();
    const unit = player.roster.find((item) => item.id === id);
    return { ...(id ? { unitId: id } : {}), unit: unit ? unitName(unit) : str(record.unit).trim() };
  };
  const special = raw.specialResource;
  if (special && str(special.name).trim()) {
    player.specialResource = { name: str(special.name).trim(), start: int(special.start), end: int(special.end), note: str(special.note).trim() };
  }
  player.agendas = array(raw.agendas).filter((a) => str(a?.name).trim())
    .map((a) => ({ name: str(a.name).trim(), completed: Boolean(a.completed), xp: int(a.xp),
      ...(a.unitId || a.unit ? reference(a) : {}) }));
  player.outOfActionTests = array(raw.outOfActionTests).filter((t) => t && (t.unitId || str(t.unit).trim())).map((t) => {
    const test = { ...reference(t), passed: Boolean(t.passed) };
    if (!test.passed && str(t.scar).trim()) test.scar = str(t.scar).trim();
    return test;
  });
  const marked = raw.markedForGreatness || {};
  player.markedForGreatness = { ...reference(marked), xp: marked.unitId ? 3 : int(marked.xp), reason: str(marked.reason).trim() };
  player.rankPromotions = array(raw.rankPromotions).filter((p) => p && (p.unitId || str(p.unit).trim()))
    .map((p) => ({ ...reference(p), newRank: str(p.newRank).trim(), reward: str(p.reward).trim() }));
  return player;
}

export function normalizeReport(raw = {}) {
  return {
    id: str(raw.id).trim().toUpperCase(),
    battleNumber: int(raw.battleNumber),
    title: str(raw.title).trim(),
    date: str(raw.date).trim(),
    location: str(raw.location).trim(),
    mission: str(raw.mission).trim(),
    battleSize: str(raw.battleSize).trim(),
    players: (raw.players || []).map(normalizePlayer),
    narrativeContext: str(raw.narrativeContext).trim(),
    highlights: (raw.highlights || []).map((h) => str(h).trim()).filter(Boolean),
    narrativeAftermath: str(raw.narrativeAftermath).trim(),
    headerImageUrl: str(raw.headerImageUrl).trim(),
    aftermathImageUrl: str(raw.aftermathImageUrl).trim(),
  };
}

export const isWebImageUrl = (value) => /^https?:\/\/[^\s"'<>]+$/i.test(str(value).trim());
// Offline pict-feeds: raster base64 data URLs only (no SVG), capped so the JSON stays sane.
export const isLocalImage = (value) => {
  const text = str(value).trim();
  return text.length <= 2_000_000 && /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/i.test(text);
};
export const isImageUrl = (value) => isWebImageUrl(value) || isLocalImage(value);

export function validateReport(report, reports = [], originalId = null) {
  const errors = [];
  if (!/^[A-Z0-9][A-Z0-9_-]{0,31}$/.test(report.id)) errors.push("ID must be letters/digits/dashes, e.g. BR-003.");
  if (reports.some((r) => r.id === report.id && r.id !== originalId)) errors.push(`ID ${report.id} already exists.`);
  if (!report.title) errors.push("Title is required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(report.date)) errors.push("Date must be YYYY-MM-DD.");
  if (report.players.length < 1) errors.push("At least one player is required.");
  report.players.forEach((p, index) => {
    if (!p.faction) errors.push(`Player ${index + 1}: faction is required.`);
    if (p.discordId && !/^\d{5,25}$/.test(p.discordId)) errors.push(`Player ${index + 1}: Discord ID must be numeric.`);
    const ids = new Set();
    for (const unit of p.roster || []) {
      if (unit.id === "__custom__") errors.push(`Player ${index + 1}: unit ID __custom__ is reserved for fallback references.`);
      if (ids.has(unit.id)) errors.push(`Player ${index + 1}: duplicate unit ID ${unit.id}.`);
      ids.add(unit.id);
      if (!unit.baseName && !unit.customName) errors.push(`Player ${index + 1}: every roster unit needs a name.`);
      for (const key of ["points", "xp", "crusadePoints", "powerLevel"]) {
        if (unit[key] < 0) errors.push(`Player ${index + 1}: ${unitName(unit)} ${key} cannot be negative.`);
      }
      if (!RANKS.includes(unit.rank)) errors.push(`Player ${index + 1}: invalid rank for ${unitName(unit)}.`);
    }
    for (const record of [...p.agendas, ...p.outOfActionTests, p.markedForGreatness, ...p.rankPromotions]) {
      if (record.unitId && !ids.has(record.unitId)) errors.push(`Player ${index + 1}: ${record.unit || record.unitId} is not in the roster. Select Custom / Other Unit or a registered unit.`);
    }
    if (p.agendas.some((agenda) => agenda.xp < 0)) errors.push(`Player ${index + 1}: agenda XP cannot be negative.`);
    for (const promotion of p.rankPromotions) {
      const unit = p.roster?.find((item) => item.id === promotion.unitId);
      if (unit && !eligibleRanks(p, unit).includes(promotion.newRank)) {
        errors.push(`Player ${index + 1}: ${unitName(unit)} is not eligible for ${promotion.newRank}. Check starting rank and earned XP.`);
      }
    }
  });
  for (const key of ["headerImageUrl", "aftermathImageUrl"]) {
    if (report[key] && !isImageUrl(report[key])) errors.push(`${key} must be an http(s) URL or an uploaded pict-feed.`);
  }
  return errors;
}

export function parseReports(text) {
  const data = JSON.parse(text);
  const list = Array.isArray(data) ? data : data?.reports;
  if (!Array.isArray(list)) throw new Error("battle_reports.json must contain an array of reports.");
  return list.filter((r) => r && typeof r === "object" && r.id).map(normalizeReport);
}

export const serializeReports = (reports) => `${JSON.stringify(reports.map(normalizeReport), null, 2)}\n`;

export const sortKey = (r) => `${r.date || ""}|${String(int(r.battleNumber)).padStart(6, "0")}|${r.id}`;

export function sortReports(reports, newestFirst = true) {
  const sorted = [...reports].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  return newestFirst ? sorted.reverse() : sorted;
}

export function playerXp(player) {
  const agendaXp = (player.agendas || []).reduce((sum, a) => sum + (a.completed ? int(a.xp) : 0), 0);
  return agendaXp + (player.markedForGreatness?.unitId ? 3 : int(player.markedForGreatness?.xp));
}

export const rpExpected = (rp = {}) => int(rp.start) + int(rp.gained) - int(rp.spent);

const objects = (value) => Array.isArray(value) ? value.flatMap(objects)
  : value && typeof value === "object" ? [value] : [];
const attributes = (value) => ({ ...value, ...value?.$, ...value?.["@attributes"] });
const scalar = (value) => Array.isArray(value) ? scalar(value[0])
  : value && typeof value === "object" ? str(value.name || value._ || value.value) : str(value);
const pick = (object, ...keys) => keys.map((key) => object[key]).find((value) => value !== undefined && value !== null);
const entries = (value, singular) => objects(value).flatMap((item) =>
  item[singular] ? objects(item[singular]) : [item]).map(attributes);

function importNumber(value, label) {
  if (value === undefined || value === null || value === "") return 0;
  const match = /^\s*(\d+)(?:\s*(?:pts?|points?|pl|xp))?\s*$/i.exec(String(value));
  if (!match) throw new Error(`${label} must be a non-negative whole number (received "${value}").`);
  return Number(match[1]);
}

function costOf(raw, pattern) {
  const costs = raw.costs;
  if (costs && !Array.isArray(costs) && !costs.cost) {
    const key = Object.keys(costs).find((name) => pattern.test(name));
    if (key) return costs[key];
  }
  return entries(costs, "cost").find((cost) => pattern.test(cost.name || cost.type || ""))?.value;
}

function selectionCost(raw, pattern) {
  const own = costOf(raw, pattern);
  const nested = entries(raw.selections, "selection").map((selection) => selectionCost(selection, pattern))
    .filter((cost) => cost !== undefined);
  if (own === undefined && !nested.length) return undefined;
  return importNumber(own, "Selection cost") + nested.reduce((sum, cost) => sum + cost, 0);
}

function importedUnit(source, index) {
  const raw = attributes(source);
  const stats = attributes(raw.crusade || raw.crusadeStats || {});
  const categories = entries(raw.categories, "category");
  const keywords = tags(raw.keywords).flatMap((item) => item.split(/,\s*/));
  const names = [...categories.map((category) => category.name), ...keywords].filter(Boolean);
  const upgrades = [];
  const collect = (selection) => {
    upgrades.push(selection);
    entries(selection.selections, "selection").forEach(collect);
  };
  entries(raw.selections, "selection").forEach(collect);
  const value = (...keys) => pick(stats, ...keys) ?? pick(raw, ...keys);
  const baseName = scalar(pick(raw, "baseName", "datasheet", "datasheetName", "unitName", "name"));
  if (!baseName && !raw.customName) throw new Error(`Imported unit ${index + 1} has no name.`);
  const rank = scalar(value("rank")) || RANKS[0];
  const honors = ["honors", "battleHonors", "enhancements", "relics"].flatMap((key) =>
    tags(value(key)).map((item) => item));
  upgrades.filter((upgrade) => /enhancement|relic/i.test(upgrade.typeName || upgrade.name || ""))
    .forEach((upgrade) => honors.push(upgrade.name));
  const cost = (pattern) => raw.type ? selectionCost(raw, pattern) : costOf(raw, pattern);
  const points = pick(raw, "points", "pts", "pointsCost") ?? cost(/^(pts?\.?|points)$/i);
  return {
    unit: normalizeUnit({
      id: raw.id || raw.uuid, baseName, customName: scalar(pick(raw, "customName", "customUnitName", "characterName")),
      role: scalar(pick(raw, "role", "battlefieldRole")) || categories.find((category) => category.primary === true || category.primary === "true")?.name
        || names.filter((name) => /character|battleline|monster|vehicle|warlord/i.test(name)).join(", "),
      isWarlord: raw.isWarlord === true || raw.isWarlord === "true"
        || [...names, ...upgrades.map((upgrade) => upgrade.name)].some((name) => /^warlord$/i.test(name)),
      points: importNumber(points, `${baseName} points`),
      powerLevel: importNumber(value("powerLevel", "pl") ?? cost(/^(pl|power level)$/i), `${baseName} PL`),
      xp: importNumber(value("xp", "currentXP", "currentXp", "experience", "startingXP", "startingXp"), `${baseName} XP`),
      crusadePoints: importNumber(value("crusadePoints", "crusadePoint"), `${baseName} Crusade points`),
      rank: rank === "Blooded" ? "Bloodied" : rank,
      honors, scars: tags(value("scars", "battleScars")),
    }, index),
    missingPoints: points === undefined,
  };
}

function parseRosterJson(data) {
  let root = Array.isArray(data) ? data : data.army || data;
  if (data.roster && (!Array.isArray(data.roster) || data.roster[0]?.forces)) root = data.roster;
  if (Array.isArray(root) && root.length === 1 && (root[0].forces || root[0].units)) root = root[0];
  root = Array.isArray(root) ? root : attributes(root);
  const forces = entries(root.forces, "force");
  const selections = [];
  const visit = (selection) => {
    const raw = attributes(selection);
    const unitProfile = entries(raw.profiles, "profile").some((profile) => /^unit$/i.test(profile.typeName || ""));
    if (/^(unit|model)$/i.test(raw.type || "") || unitProfile) selections.push(raw);
    else entries(raw.selections, "selection").forEach(visit);
  };
  forces.forEach((force) => entries(force.selections, "selection").forEach(visit));
  if (!forces.length) entries(root.selections, "selection").forEach(visit);
  const direct = Array.isArray(root) ? root : root.units || root.armyData || root.roster || (selections.length ? selections : null);
  let units = [];
  if (Array.isArray(direct)) units = direct;
  else if (direct && typeof direct === "object") {
    const ordered = array(root.order).filter((id) => Object.hasOwn(direct, id));
    units = [...ordered, ...Object.keys(direct).filter((id) => !ordered.includes(id))].map((id) => direct[id]);
  }
  const parsed = units.map(importedUnit);
  const factions = [...new Set(forces.map((force) => force.catalogueName).filter(Boolean))];
  const unitFactions = [...new Set(units.flatMap((unit) => tags(unit.factionKeywords || unit.faction)))];
  return {
    faction: scalar(pick(root, "faction", "armyFaction", "factionName")) || factions.join(" / ") || unitFactions.join(" / "),
    detachment: scalar(pick(root, "detachment", "detachmentName")) || forces.map((force) => force.name).filter(Boolean).join(" / "),
    declaredPoints: pick(root, "pointsTotal", "totalPoints", "points") ?? costOf(root, /^(pts?\.?|points)$/i),
    roster: parsed.map((item) => item.unit),
    warnings: parsed.filter((item) => item.missingPoints).map((item) => `${unitName(item.unit)}: points unavailable; enter them manually.`),
  };
}

function parseRosterText(text) {
  const result = { faction: "", detachment: "", declaredPoints: undefined, roster: [], warnings: [] };
  let current = null;
  let role = "";
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    const metadata = /^(?:army\s+)?(faction(?: keyword)?|detachment|total army points|points total)\s*:\s*(.+)$/i.exec(trimmed);
    if (metadata) {
      if (/faction/i.test(metadata[1])) result.faction = metadata[2];
      else if (/detachment/i.test(metadata[1])) result.detachment = metadata[2];
      else result.declaredPoints = metadata[2];
      continue;
    }
    if (/^(characters?|battleline|other datasheets|monsters?|vehicles?|dedicated transports?)$/i.test(trimmed)) {
      role = trimmed; continue;
    }
    const header = /^\+{2,3}\s*(.*?)\s*(?:\[\s*(.*?)\s*\]|\((\d+)\s*points?\))?\s*\+{2,3}$/i.exec(trimmed);
    if (header) {
      const faction = /\(([^()]+)\)/.exec(header[1]);
      if (faction) { result.faction ||= faction[1]; result.detachment ||= header[1].replace(faction[0], "").trim(); }
      continue;
    }
    const unit = /^([^+•\\].*?)\s*(?:\((\d+)\s*(points?|pts?|pl)\)|\[\s*([^\]]+)\])\s*:?\s*$/i.exec(trimmed.replace(/^[-*]\s+/, ""));
    if (unit) {
      const points = unit[2] && !/^pl$/i.test(unit[3]) ? unit[2] : /(\d+)\s*(?:pts?|points?)/i.exec(unit[4] || "")?.[1];
      const pl = unit[2] && /^pl$/i.test(unit[3]) ? unit[2] : /(\d+)\s*pl/i.exec(unit[4] || "")?.[1];
      if (!points && !pl) continue;
      const parts = unit[1].split(/\s+[—–]\s+/);
      current = normalizeUnit({ customName: parts.length > 1 ? parts.shift() : "", baseName: parts.join(" — "),
        points: importNumber(points, "Unit points"), powerLevel: importNumber(pl, "Unit PL"), role }, result.roster.length);
      result.roster.push(current);
      if (!points) result.warnings.push(`${unitName(current)}: PL only; enter points manually.`);
      continue;
    }
    if (!current) continue;
    const detail = trimmed.replace(/^[•.*\\-]+\s*/, "");
    if (/^warlord$/i.test(detail)) current.isWarlord = true;
    const stat = /^(custom name|unit name|role|xp|current xp|starting xp|rank|crusade points|enhancement|relic|honors?|battle honors?|scars?|battle scars?)\s*:\s*(.+)$/i.exec(detail);
    if (!stat) continue;
    const key = stat[1].toLowerCase();
    if (/^(custom name|unit name)$/.test(key)) current.customName = stat[2];
    else if (key === "role") current.role = stat[2];
    else if (/xp$/.test(key)) current.xp = importNumber(stat[2], "Unit XP");
    else if (key === "crusade points") current.crusadePoints = importNumber(stat[2], "Crusade points");
    else if (key === "rank") current.rank = stat[2] === "Blooded" ? "Bloodied" : stat[2];
    else if (/scar/.test(key)) current.scars.push(...tags(stat[2]));
    else current.honors.push(...tags(stat[2]));
  }
  return result;
}

const rosterText = (text) => str(text).trim().replace(/^```[^\n]*\n/, "").replace(/\n```\s*$/, "").trim();

export async function ingestRoster(text, fetchImpl = globalThis.fetch) {
  const clean = rosterText(text);
  let code = /^(?:(?:yellowscribe\s+)?code\s*[:=]\s*)?([a-f0-9]{8})$/i.exec(clean)?.[1];
  if (!code && clean.startsWith("{")) {
    let data;
    try { data = JSON.parse(clean); } catch (error) { throw new Error(`Invalid roster JSON: ${error.message}`); }
    if (data && Object.keys(data).length === 1 && data.code) code = str(data.code);
  }
  if (!code) return parseRoster(clean);
  if (!/^[a-f0-9]{8}$/i.test(code)) throw new Error("YellowScribe codes must be eight hexadecimal characters.");
  let response;
  try {
    response = await fetchImpl(`https://yellowscribe.link/get_army_by_id?id=${code.toLowerCase()}`, {
      cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer",
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    throw new Error(`YellowScribe lookup failed (${error.message}). The service may be unreachable or block browser access (CORS). Paste the decoded army JSON/text instead.`);
  }
  if (!response.ok) throw new Error(`YellowScribe lookup returned HTTP ${response.status}. Codes may expire after about ten minutes; generate a fresh code or paste the decoded export.`);
  return parseRoster(await response.text());
}

export function parseRoster(text) {
  const clean = rosterText(text);
  if (!clean) throw new Error("Paste a YellowScribe JSON export, converted BattleScribe roster, or army text first.");
  if (/^(?:[a-f0-9]{8}|(?:yellowscribe\s+)?code\s*:\s*\S+)$/i.test(clean)) {
    throw new Error("A YellowScribe share code is a server-side lookup, not roster data. Paste the decoded army JSON or text export; codes cannot be decoded offline.");
  }
  let result;
  if (/^(?:\{|\[)/.test(clean)) {
    let json;
    try { json = JSON.parse(clean); } catch (error) { throw new Error(`Invalid roster JSON: ${error.message}`); }
    if (!json || typeof json !== "object") throw new Error("Roster JSON must contain an army structure.");
    result = parseRosterJson(json);
  } else result = parseRosterText(clean);
  if (!result.roster.length) throw new Error("No units found. Use units/armyData JSON, converted BattleScribe forces, or text lines such as 'Canoptek Wraiths (250 Points)'. Raw .rosz ZIP files must be converted first.");
  for (const unit of result.roster) {
    if (!RANKS.includes(unit.rank)) throw new Error(`${unitName(unit)} has an unsupported rank: ${unit.rank}.`);
  }
  result.pointsTotal = rosterPoints(result);
  if (result.declaredPoints !== undefined) {
    result.declaredPoints = importNumber(result.declaredPoints, "Army points total");
    if (result.declaredPoints !== result.pointsTotal) result.warnings.push(`Declared total ${result.declaredPoints} differs from unit tally ${result.pointsTotal}; check unit costs.`);
  }
  if (!result.faction) result.warnings.push("Faction unavailable; enter it manually.");
  if (!result.detachment) result.warnings.push("Detachment unavailable; enter it manually.");
  return result;
}

export function appendRoster(player, parsed) {
  if (parsed.faction) player.faction = parsed.faction;
  if (parsed.detachment) player.detachment = parsed.detachment;
  for (const source of parsed.roster) {
    player.roster.push({ ...structuredClone(source), id: blankUnit(player.roster).id });
  }
  player.pointsTotal = rosterPoints(player);
  const warlord = player.roster.find((unit) => unit.isWarlord);
  if (warlord) player.warlord = unitName(warlord);
}

export function matchesQuery(report, query) {
  const needle = str(query).trim().toLowerCase();
  if (!needle) return true;
  const haystack = [report.id, report.title, report.location, report.mission, report.date,
    ...report.players.flatMap((p) => [p.faction, p.commander, p.handle, p.warlord, p.alliance])].join(" ").toLowerCase();
  return needle.split(/\s+/).every((term) => haystack.includes(term));
}
