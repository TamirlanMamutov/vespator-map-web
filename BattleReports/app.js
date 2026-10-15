import { settings } from "./config.js?v=1.2";
import * as R from "./reports.js?v=1.2";
import * as AI from "./ai_helper.js?v=1.2";
import * as U from "./uplink.js?v=1.2";
import * as IMG from "./images.js?v=1.2";

const DRAFT_KEY = "vespator_reports_draft";
const SESSION_UNLOCK_KEY = "vespator_reports_warmaster";
const $ = (id) => document.getElementById(id);

const state = {
  reports: [],
  feedSha: null, // git blob sha of the archive version this browser last synced with
  dirty: false,
  changes: new Set(),
  warmaster: false,
  query: "",
  newestFirst: true,
  editing: null, // { draft, originalId, changed }
  uplink: U.loadUplink(localStorage, sessionStorage, { repo: settings.uplinkRepo, branch: settings.uplinkBranch, path: settings.uplinkPath }),
};

// ---------- DOM helper (never uses innerHTML: all report text is untrusted) ----------
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  const props = {};
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "text") el.textContent = value;
    else if (key === "value" || key === "checked") props[key] = value;
    else if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2), value);
    else if (value === true) el.setAttribute(key, "");
    else el.setAttribute(key, value);
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  Object.assign(el, props);
  return el;
}

const slug = (value) => String(value || "unaligned").toLowerCase().replace(/[^a-z0-9]+/g, "-");

function setStatus(text, kind = "info", link = null) {
  const line = $("status");
  line.className = `status-line ${kind}`;
  line.replaceChildren(h("span", { class: "prompt", text: ">" }), " ", text,
    ...(link ? [" ", h("a", { href: link.href, target: "_blank", rel: "noopener", text: link.text })] : []));
}

// ---------- persistence ----------
function saveDraft() {
  state.dirty = true;
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ reports: state.reports, baseSha: state.feedSha, changes: [...state.changes], savedAt: new Date().toISOString() }));
  } catch { /* storage full or blocked: edits stay in memory */ }
  renderToolbar();
}

function readDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch { return null; }
}

function clearDraft() {
  state.dirty = false;
  state.changes.clear();
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  renderToolbar();
}

async function loadFeed() {
  setStatus("Establishing vox-link with the battle archive…");
  try {
    const response = await fetch(`${settings.feedUrl}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    state.reports = R.parseReports(text);
    state.feedSha = await U.gitBlobSha(text).catch(() => null);
    setStatus(`${state.reports.length} battle report(s) decrypted from the archive.`);
  } catch (error) {
    setStatus(`Archive feed unreachable (${error.message}). Serve this folder over HTTP${state.warmaster ? " or import a JSON file" : ""}.`, "error");
  }
  render();
}

// ---------- public archive ----------
function render() {
  renderToolbar();
  renderIndex();
  const main = $("archive");
  const list = R.sortReports(state.reports, state.newestFirst).filter((r) => R.matchesQuery(r, state.query));
  main.replaceChildren(...(list.length ? list.map(reportCard) : [h("p", { class: "empty", text: state.reports.length ? "No records match this query." : "+++ The archive is silent. No battles recorded. +++" })]));
}

function renderIndex() {
  const nav = $("chronicle-index");
  const list = R.sortReports(state.reports, state.newestFirst).filter((r) => R.matchesQuery(r, state.query));
  nav.replaceChildren(...list.map((r) => {
    const winner = r.players.find((p) => p.isWinner);
    return h("a", { href: `#${r.id}`, class: `chip alliance-${slug(winner?.alliance)}`, title: r.title },
      h("b", { text: r.id }), ` ${r.date}`);
  }));
}

function renderToolbar() {
  $("mode-badge").textContent = state.warmaster ? "WARMASTER // EDIT & DISPATCH" : "PUBLIC ARCHIVE // READ-ONLY";
  $("mode-badge").classList.toggle("admin", state.warmaster);
  $("warmaster-actions").hidden = !state.warmaster;
  $("override").textContent = state.warmaster ? "⏏ LOCK" : "◇ WARMASTER ACCESS";
  $("transmit").classList.toggle("pending", state.dirty);
  $("transmit").textContent = state.dirty ? `⇪ TRANSMIT (${state.changes.size || "•"})` : "⇪ TRANSMIT";
  $("sort-toggle").textContent = state.newestFirst ? "▼ NEWEST FIRST" : "▲ OLDEST FIRST";
  $("uplink-button").title = U.uplinkReady(state.uplink) ? `Uplink: ${state.uplink.repo}@${state.uplink.branch}/${state.uplink.path}` : "Uplink not configured";
}

const metaItem = (label, value) => h("div", {}, h("dt", { text: label }), h("dd", { text: value || "—" }));

function figure(url, caption, cls) {
  if (!R.isImageUrl(url)) return null;
  return h("figure", { class: cls },
    h("a", { href: url, target: "_blank", rel: "noopener noreferrer" },
      h("img", { src: url, alt: caption, loading: "lazy", referrerpolicy: "no-referrer", onerror: (e) => e.target.closest("figure").classList.add("lost") })),
    h("figcaption", { text: caption }));
}

function playerHeader(player, draw) {
  return h("div", { class: `player alliance-${slug(player.alliance)}${player.isWinner ? " winner" : ""}` },
    h("div", { class: "player-top" },
      h("span", { class: `badge alliance-${slug(player.alliance)}`, text: (player.alliance || "Unaligned").toUpperCase() }),
      h("span", { class: `stamp${player.isWinner ? "" : " loss"}`, text: player.isWinner ? "✠ VICTORY" : draw ? "DRAW" : "DEFEAT" })),
    h("strong", { class: "faction", text: player.faction }),
    h("div", { class: "commander" }, player.commander, " ", h("span", { class: "handle", text: player.handle })),
    h("div", { class: "warlord" }, h("span", { class: "muted", text: "WARLORD: " }), player.warlord || "—"),
    h("div", { class: "score" }, h("span", { text: player.score }), h("small", { text: " VP" })));
}

function rosterDetails(player) {
  const xp = R.playerXp(player);
  const rp = player.rp;
  const expected = R.rpExpected(rp);
  const xpRows = [
    ...player.agendas.filter((a) => a.completed && a.xp).map((a) => [`Agenda: ${a.name}`, a.xp]),
    ...(player.markedForGreatness.unit ? [[`Marked for Greatness: ${player.markedForGreatness.unit}`, player.markedForGreatness.xp]] : []),
  ];
  return h("details", { class: `roster alliance-${slug(player.alliance)}` },
    h("summary", {}, h("span", { text: `${player.faction} — ${player.commander || player.handle}` }), h("span", { class: "xp-chip", text: `+${xp} XP` })),
    h("div", { class: "roster-grid" },
      player.roster.length ? h("section", { class: "active-roster" },
        h("h4", { text: `ORDER OF BATTLE // ${R.rosterPoints(player)} POINTS` }),
        player.detachment ? h("p", { text: `Detachment: ${player.detachment}` }) : null,
        player.roster.map((unit) => {
          const progress = R.unitProgress(player, unit);
          return h("div", { class: "unit-card" },
            h("b", { text: R.unitName(unit) }),
            unit.isWarlord ? h("span", { class: "unit-badge", text: "WARLORD" }) : null,
            h("p", { text: `${unit.role || "Unassigned"} // ${unit.points} pts // ${progress.xp} XP // ${progress.rank}` }),
            progress.honors.length ? h("p", { text: `Honors: ${progress.honors.join("; ")}` }) : null,
            progress.scars.length ? h("p", { class: "scar", text: `Scars: ${progress.scars.join("; ")}` }) : null);
        })) : null,
      h("section", {},
        h("h4", { text: "RESOURCES" }),
        h("p", {}, h("b", { text: "CP: " }), `${player.startCP} → ${player.endCP}`),
        h("p", {}, h("b", { text: "RP: " }), `${rp.start} +${rp.gained} −${rp.spent} = `, h("b", { text: rp.total }),
          expected !== rp.total ? h("span", { class: "muted", title: "start + gained − spent", text: ` (calc ${expected})` }) : null),
        rp.spentOn ? h("p", { class: "muted", text: `Spent on: ${rp.spentOn}` }) : null,
        player.specialResource ? h("p", {}, h("b", { text: `${player.specialResource.name}: ` }), `${player.specialResource.start} → ${player.specialResource.end}`,
          player.specialResource.note ? h("span", { class: "muted", text: ` — ${player.specialResource.note}` }) : null) : null),
      h("section", {},
        h("h4", { text: "AGENDAS" }),
        player.agendas.length ? h("ul", { class: "ticks" }, player.agendas.map((a) =>
          h("li", { class: a.completed ? "ok" : "fail" }, a.name, a.unit ? ` — ${a.unit}` : "", a.completed && a.xp ? h("span", { class: "xp", text: ` +${a.xp} XP` }) : null))) : h("p", { class: "muted", text: "None recorded." })),
      h("section", {},
        h("h4", { text: "OUT OF ACTION TESTS" }),
        player.outOfActionTests.length ? h("ul", { class: "ticks" }, player.outOfActionTests.map((t) =>
          h("li", { class: t.passed ? "ok" : "fail" }, t.unit, t.passed ? h("span", { class: "muted", text: " — passed" }) : h("span", { class: "scar", text: t.scar ? ` — BATTLE SCAR: ${t.scar}` : " — failed" })))) : h("p", { class: "muted", text: "No tests required." })),
      h("section", {},
        h("h4", { text: "MARKED FOR GREATNESS" }),
        player.markedForGreatness.unit ? h("p", {}, "★ ", h("b", { text: player.markedForGreatness.unit }), ` (+${player.markedForGreatness.xp} XP)`,
          player.markedForGreatness.reason ? h("span", { class: "reason", text: player.markedForGreatness.reason }) : null) : h("p", { class: "muted", text: "—" })),
      h("section", {},
        h("h4", { text: "PROMOTIONS" }),
        player.rankPromotions.length ? h("ul", { class: "promotions" }, player.rankPromotions.map((p) =>
          h("li", {}, "⇑ ", p.unit, " → ", h("b", { text: p.newRank }), p.reward ? h("span", { class: "reason", text: p.reward }) : null))) : h("p", { class: "muted", text: "No promotions." })),
      h("section", {},
        h("h4", { text: "XP BREAKDOWN" }),
        h("table", { class: "xp-table" },
          h("tbody", {}, xpRows.map(([label, value]) => h("tr", {}, h("td", { text: label }), h("td", { text: `+${value}` }))),
            h("tr", { class: "total" }, h("td", { text: "TOTAL" }), h("td", { text: `+${xp}` })))))));
}

function reportCard(report) {
  const draw = report.players.length > 0 && !report.players.some((p) => p.isWinner);
  const versus = [];
  report.players.forEach((player, index) => {
    if (index) versus.push(h("div", { class: "vs", "aria-hidden": "true", text: "VS" }));
    versus.push(playerHeader(player, draw));
  });
  return h("article", { class: "report-card", id: report.id },
    figure(report.headerImageUrl, `Pict-capture: ${report.title}`, "banner"),
    h("header", { class: "card-head" },
      h("div", { class: "card-title" },
        h("span", { class: "eyebrow", text: `${report.id} // BATTLE №${report.battleNumber}` }),
        h("h2", { text: report.title })),
      state.warmaster ? h("div", { class: "card-tools" },
        h("button", { type: "button", class: "outline-button", text: "✎ EDIT", onclick: () => openEditor(report) }),
        h("button", { type: "button", class: "danger-button", text: "✕ DELETE", onclick: () => deleteReport(report) })) : null),
    h("dl", { class: "meta" }, metaItem("DATE", report.date), metaItem("PLANET", report.location), metaItem("MISSION", report.mission), metaItem("SIZE", report.battleSize)),
    h("section", { class: `versus count-${report.players.length}` }, versus),
    h("section", { class: "narrative" },
      report.narrativeContext ? [h("h3", { text: "✎ CONTEXT" }), h("blockquote", { text: report.narrativeContext })] : null,
      report.highlights.length ? [h("h3", { text: "⚔ BATTLE HIGHLIGHTS" }), h("ol", { class: "highlights" }, report.highlights.map((text) => h("li", { text })))] : null,
      report.narrativeAftermath ? [h("h3", { text: "☠ AFTERMATH" }), h("blockquote", { text: report.narrativeAftermath })] : null,
      figure(report.aftermathImageUrl, `Aftermath: ${report.location || report.title}`, "aftermath")),
    report.players.length ? h("section", { class: "rosters" }, h("h3", { text: "⛭ CRUSADE ROSTERS" }), report.players.map(rosterDetails)) : null);
}

// ---------- Warmaster access ----------
function unlock() {
  state.warmaster = true;
  try { sessionStorage.setItem(SESSION_UNLOCK_KEY, "1"); } catch { /* ignore */ }
  const draft = readDraft();
  if (draft?.reports && R.serializeReports(draft.reports) !== R.serializeReports(state.reports)) {
    if (confirm(`An unpublished local draft from ${draft.savedAt || "an earlier session"} was found. Restore it?\n\nCancel discards the draft.`)) {
      state.reports = draft.reports.map(R.normalizeReport);
      state.feedSha = draft.baseSha ?? state.feedSha;
      (draft.changes || []).forEach((id) => state.changes.add(id));
      state.dirty = true;
      setStatus("Local draft restored. TRANSMIT to publish it.", "warn");
    } else clearDraft();
  } else if (draft) clearDraft();
  render();
}

function lock() {
  if (state.dirty && !confirm("Unpublished edits remain in this browser's draft. Lock anyway? (The draft is kept.)")) return;
  state.warmaster = false;
  try { sessionStorage.removeItem(SESSION_UNLOCK_KEY); } catch { /* ignore */ }
  render();
}

function deleteReport(report) {
  if (!confirm(`Purge ${report.id} "${report.title}" from the archive? (Takes effect on GitHub after TRANSMIT.)`)) return;
  state.reports = state.reports.filter((r) => r !== report);
  state.changes.add(`-${report.id}`);
  saveDraft();
  render();
  setStatus(`${report.id} purged locally. TRANSMIT to publish.`, "warn");
}

// ---------- editor ----------
function editable(report) {
  const blank = R.blankPlayer();
  const draft = structuredClone(report);
  draft.players = draft.players.map((p) => ({
    ...blank, ...p, discordId: p.discordId || "",
    rp: { ...blank.rp, ...p.rp },
    specialResource: p.specialResource ? { ...p.specialResource } : null,
    markedForGreatness: { ...blank.markedForGreatness, ...p.markedForGreatness },
  }));
  return draft;
}

function openEditor(report = null) {
  state.editing = { draft: editable(report ?? R.blankReport(state.reports)), originalId: report?.id ?? null,
    changed: false, media: {}, uploads: 0, imports: 0, rosterPanels: new WeakMap() };
  $("editor-title").textContent = report ? `EDIT ${report.id}` : "NEW BATTLE REPORT";
  $("editor-errors").replaceChildren();
  $("ai-output").value = "";
  renderEditor();
  $("editor-dialog").showModal();
  $("editor-body").scrollTop = 0;
}

let hintUpdaters = [];
function changed() {
  state.editing.changed = true;
  state.editing.draft.players.forEach((player) => { player.pointsTotal = R.rosterPoints(player); });
  hintUpdaters.forEach((update) => update());
}

function field(label, obj, key, { type = "text", rows, options, wide, placeholder, hint } = {}) {
  let input;
  if (rows) input = h("textarea", { rows, placeholder, value: obj[key] ?? "" });
  else if (options) {
    const values = options.includes(obj[key]) || !obj[key] ? options : [...options, obj[key]];
    input = h("select", {}, values.map((value) => h("option", { value, text: value })));
    input.value = obj[key] ?? options[0];
  } else if (type === "checkbox") input = h("input", { type, checked: Boolean(obj[key]) });
  else input = h("input", { type, placeholder, value: obj[key] ?? "", ...(type === "number" ? { step: 1 } : {}) });
  const update = () => {
    obj[key] = type === "checkbox" ? input.checked : type === "number" ? (input.value === "" ? 0 : Number(input.value)) : input.value;
    changed();
  };
  input.addEventListener(type === "checkbox" || options ? "change" : "input", update);
  return h("label", { class: `field${type === "checkbox" ? " check" : ""}${wide ? " wide" : ""}`, title: hint }, h("span", { text: label }), input);
}

function listEditor(title, items, makeItem, renderItem, { addLabel = "+ ADD" } = {}) {
  return h("div", { class: "list-editor" },
    h("div", { class: "list-head" }, h("span", { class: "eyebrow", text: title }),
      h("button", { type: "button", class: "mini", text: addLabel, onclick: () => { items.push(makeItem()); changed(); renderEditor(); } })),
    items.map((item, index) => h("div", { class: "list-row" }, renderItem(item, index),
      h("button", { type: "button", class: "mini danger", title: "Remove", "aria-label": `Remove ${title} ${index + 1}`, text: "✕", onclick: () => { items.splice(index, 1); changed(); renderEditor(); } }))));
}

const IMAGE_SLOTS = { headerImageUrl: "header", aftermathImageUrl: "aftermath" };
const mediaViews = {};

function setMedia(editing, key, media) {
  const previous = editing.media[key];
  if (previous?.preview?.startsWith("blob:") && previous.preview !== media?.preview) URL.revokeObjectURL(previous.preview);
  editing.media[key] = media;
  if (state.editing === editing) mediaViews[key]?.();
}

function releaseMedia(editing) {
  for (const media of Object.values(editing?.media || {})) if (media?.preview?.startsWith("blob:")) URL.revokeObjectURL(media.preview);
}

async function ingestImage(key, file) {
  const editing = state.editing;
  if (!editing) return;
  if (!IMG.isImageFile(file)) {
    setMedia(editing, key, { status: "error", note: "[ REJECTED ]", detail: "That is not an image file." });
    return;
  }
  const slot = IMAGE_SLOTS[key];
  const preview = URL.createObjectURL(file);
  const online = U.uplinkReady(state.uplink);
  setMedia(editing, key, { status: "busy", preview, note: online ? "[ ENCODING PICT-FEED… ]" : "[ COMPRESSING PICT-FEED… ]", detail: `${file.name || "clipboard image"} · ${IMG.formatBytes(file.size)}` });
  editing.uploads += 1;
  try {
    if (online) {
      const prepared = await IMG.prepareForUpload(file);
      setMedia(editing, key, { status: "busy", preview, note: "[ TRANSMITTING PICT-FEED TO ARCHIVES... ]", detail: `${IMG.formatBytes(prepared.blob.size)}${prepared.recompressed ? " (recompressed)" : ""} → ${state.uplink.repo}` });
      const reportId = editing.draft.id || "REPORT";
      const result = await U.uploadAsset(state.uplink, {
        path: U.assetPath(state.uplink, reportId, slot, prepared.ext),
        bytes: new Uint8Array(await prepared.blob.arrayBuffer()),
        message: `Battle archive: ${slot} pict-feed for ${reportId}`,
      });
      editing.draft[key] = result.url;
      editing.changed = true;
      setMedia(editing, key, { status: "ok", preview, url: result.url, note: "[ PICT-FEED SECURED ]", detail: result.path, link: result.commitUrl });
    } else {
      const dataUrl = await IMG.toCompressedDataUrl(file);
      editing.draft[key] = dataUrl;
      editing.changed = true;
      setMedia(editing, key, { status: "local", preview: dataUrl, url: dataUrl, note: "[ PICT-FEED SECURED — LOCAL CACHE ]",
        detail: `Offline ${IMG.formatBytes(dataUrl.length * 0.75)} data image. Configure ☁ UPLINK: TRANSMIT then moves it to GitHub so Discord can embed it.` });
    }
  } catch (error) {
    setMedia(editing, key, { status: "error", preview, note: "[ TRANSMISSION FAILED ]", detail: error.message });
  } finally {
    editing.uploads -= 1;
  }
}

function imageField(label, key) {
  const editing = state.editing;
  const draft = editing.draft;
  const img = h("img", { alt: `${label} preview`, hidden: true, referrerpolicy: "no-referrer" });
  const note = h("span", { class: "thumb-note" });
  const input = h("input", { type: "url", placeholder: "https://… or drop an image below", value: String(draft[key] || "").startsWith("data:") ? "" : draft[key] || "" });
  const localTag = h("span", { class: "hint local-tag", hidden: true, text: "LOCAL DATA IMAGE ATTACHED", title: "Stored inline in the JSON until it is uploaded" });
  const clear = h("button", { type: "button", class: "mini danger", text: "✕", title: "Clear image", "aria-label": `Clear ${label}` });
  const picker = h("input", { type: "file", accept: "image/*", hidden: true });
  const stream = h("div", { class: "datastream", hidden: true }, h("span", { class: "ds-text" }), h("div", { class: "ds-bar" }, h("i")));
  const detail = h("span", { class: "ds-detail" });
  const zone = h("div", {
    class: "drop-zone", tabindex: "0", role: "button",
    "aria-label": `${label}: drag and drop, paste with Ctrl+V, or click to choose an image file`,
  }, h("span", { class: "drop-label", text: "[ DRAG & DROP PICT-FEED OR CLICK TO UPLOAD ]" }),
  h("span", { class: "drop-sub" }), stream, detail);

  const show = () => {
    const media = editing.media[key];
    const value = String(draft[key] || "").trim();
    const isLocal = value.startsWith("data:");
    if (document.activeElement !== input) input.value = isLocal ? "" : value;
    localTag.hidden = !isLocal;
    clear.hidden = !value;
    zone.classList.toggle("busy", media?.status === "busy");
    zone.dataset.state = media?.status || "";
    zone.querySelector(".drop-sub").textContent = U.uplinkReady(state.uplink)
      ? `UPLINK → ${state.uplink.repo}/${U.assetDir(state.uplink)} · Ctrl+V to paste`
      : "OFFLINE: stored as a compressed local image · Ctrl+V to paste";
    stream.hidden = !media;
    stream.className = `datastream ${media?.status || ""}`;
    stream.querySelector(".ds-text").textContent = media?.note || "";
    detail.replaceChildren(media?.detail || "", ...(media?.link ? [" · ", h("a", { href: media.link, target: "_blank", rel: "noopener", text: "commit" })] : []));
    // Fresh uploads preview from the local file: instant, and independent of CDN propagation.
    const usePreview = media?.preview && (media.status === "busy" || (["ok", "local"].includes(media.status) && media.url === value));
    const src = usePreview ? media.preview : value;
    const loaded = () => { img.hidden = false; note.textContent = `${img.naturalWidth}×${img.naturalHeight}`; };
    img.hidden = true;
    img.onload = loaded;
    img.onerror = () => { note.textContent = "SIGNAL LOST — image did not load"; };
    if (!src) { img.removeAttribute("src"); note.textContent = "NO PICT-FEED"; return; }
    if (!R.isImageUrl(src) && !src.startsWith("blob:")) { img.removeAttribute("src"); note.textContent = "INVALID URL — http(s) only"; return; }
    note.textContent = "ACQUIRING SIGNAL…";
    if (img.getAttribute("src") !== src) img.src = src;
    else if (img.complete && img.naturalWidth) loaded();
  };
  mediaViews[key] = show;

  input.addEventListener("input", () => {
    draft[key] = input.value.trim();
    setMedia(editing, key, null);
    changed();
    show();
  });
  clear.addEventListener("click", () => { draft[key] = ""; input.value = ""; setMedia(editing, key, null); changed(); show(); });
  picker.addEventListener("change", () => { const file = picker.files[0]; picker.value = ""; if (file) ingestImage(key, file); });
  const browse = () => { if (!zone.classList.contains("busy")) picker.click(); };
  zone.addEventListener("click", (event) => { if (!event.target.closest("a")) browse(); });
  zone.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); browse(); } });
  for (const type of ["dragenter", "dragover"]) zone.addEventListener(type, (event) => { event.preventDefault(); zone.classList.add("dragover"); });
  zone.addEventListener("dragleave", (event) => { if (!zone.contains(event.relatedTarget)) zone.classList.remove("dragover"); });
  const accept = (transfer, event) => {
    if (zone.classList.contains("busy")) return;
    const file = IMG.imageFromTransfer(transfer);
    if (file) { event.preventDefault(); ingestImage(key, file); return; }
    const url = IMG.urlFromTransfer(transfer);
    if (url) {
      event.preventDefault();
      draft[key] = url;
      setMedia(editing, key, null);
      changed();
      show();
      return;
    }
    const other = transfer?.files?.[0];
    if (other) { event.preventDefault(); ingestImage(key, other); }
  };
  zone.addEventListener("drop", (event) => { event.preventDefault(); zone.classList.remove("dragover"); accept(event.dataTransfer, event); });
  zone.addEventListener("paste", (event) => accept(event.clipboardData, event));
  show();
  return h("div", { class: "image-field" },
    h("div", { class: "image-inputs" },
      h("label", { class: "field wide" }, h("span", {}, label, " ", localTag), h("div", { class: "url-row" }, input, clear)),
      zone, picker),
    h("div", { class: "thumb" }, img, note));
}

function unitTarget(player, record, { promotion = false } = {}) {
  let custom = !record.unitId && Boolean(record.unit);
  const select = h("select", { "aria-label": "Target unit" });
  const other = field("Custom / Other unit name", record, "unit", { wide: true });
  const update = () => {
    const registered = player.roster.filter((unit) => !promotion || R.eligibleRanks(player, unit).length || record.unitId === unit.id);
    select.replaceChildren(...[
      h("option", { value: "", text: "[ Select unit ]" }),
      ...registered.map((unit) => h("option", { value: unit.id, text: R.unitName(unit) })),
      record.unitId && !player.roster.some((unit) => unit.id === record.unitId)
        ? h("option", { value: record.unitId, text: `[ Missing roster unit: ${record.unit || record.unitId} ]` }) : null,
      h("option", { value: "__custom__", text: "[ Custom / Other Unit ]" }),
    ].filter(Boolean));
    select.value = record.unitId || (custom ? "__custom__" : "");
    other.hidden = !custom;
    const unit = player.roster.find((item) => item.id === record.unitId);
    if (unit) record.unit = R.unitName(unit);
  };
  select.addEventListener("change", () => {
    custom = select.value === "__custom__";
    record.unitId = custom ? "" : select.value;
    const unit = player.roster.find((item) => item.id === record.unitId);
    record.unit = unit ? R.unitName(unit) : custom ? record.unit || "" : "";
    if (unit && promotion) record.newRank = R.eligibleRanks(player, unit)[0] || record.newRank;
    if (record === player.markedForGreatness && unit) record.xp = 3;
    changed();
  });
  hintUpdaters.push(update);
  update();
  return h("div", { class: "unit-target field wide" },
    h("label", { class: "field" }, h("span", { text: promotion ? "Eligible unit" : "Target unit" }), select), other);
}

function promotionRank(player, promotion) {
  const select = h("select", { "aria-label": "New rank" });
  const update = () => {
    const unit = player.roster.find((item) => item.id === promotion.unitId);
    const ranks = unit ? R.eligibleRanks(player, unit) : R.RANKS;
    select.replaceChildren(...[...new Set([promotion.newRank, ...ranks])].filter(Boolean).map((rank) =>
      h("option", { value: rank, text: `${rank}${unit && !ranks.includes(rank) ? " (not eligible)" : ""}`,
        disabled: Boolean(unit && !ranks.includes(rank)) })));
    select.value = promotion.newRank;
  };
  select.addEventListener("change", () => { promotion.newRank = select.value; changed(); });
  hintUpdaters.push(update);
  update();
  return h("label", { class: "field" }, h("span", { text: "New rank" }), select);
}

function tagField(label, unit, key) {
  const input = h("textarea", { rows: 2, value: R.tags(unit[key]).join("; "), placeholder: "Separate entries with semicolons or new lines" });
  input.addEventListener("input", () => { unit[key] = R.tags(input.value); changed(); });
  return h("label", { class: "field wide" }, h("span", { text: label }), input);
}

function rosterEditor(player) {
  const panels = state.editing.rosterPanels;
  if (!panels.has(player)) panels.set(player, { open: true, text: "", message: "", error: false });
  const panel = panels.get(player);
  const total = h("span", { class: "xp-chip" });
  hintUpdaters.push(() => { total.textContent = `${R.rosterPoints(player)} POINTS`; });
  const importText = h("textarea", { rows: 5, value: panel.text,
    placeholder: "Paste YellowScribe JSON / armyData, an 8-character share code, converted BattleScribe JSON, or unit lines: Canoptek Wraiths (250 Points)",
    oninput: (event) => { panel.text = event.target.value; } });
  const message = h("p", { class: `result ${panel.error ? "error" : "ok"}`, role: "status", "aria-live": "polite", text: panel.message });
  const cards = player.roster.map((unit) => {
    const title = h("b");
    const badge = h("span", { class: "unit-badge", text: "WARLORD" });
    const progress = h("p", { class: "unit-progress", "aria-live": "polite" });
    hintUpdaters.push(() => {
      title.textContent = R.unitName(unit);
      badge.hidden = !unit.isWarlord;
      const end = R.unitProgress(player, unit);
      progress.textContent = `POST-GAME: ${end.xp} XP (+${end.earnedXp}) // ${end.rank}`
        + ` // HONORS: ${end.honors.join("; ") || "None"} // SCARS: ${end.scars.join("; ") || "None"}`;
    });
    return h("section", { class: "unit-card", "data-unit-id": unit.id },
      h("div", { class: "list-head" }, title, badge,
        h("button", { type: "button", class: "mini danger", text: "✕", "aria-label": `Remove unit ${R.unitName(unit)}`,
          onclick: () => {
            if (!confirm(`Remove ${R.unitName(unit)}? Linked post-game records will be kept as Custom / Other references.`)) return;
            R.unlinkUnit(player, unit.id); changed(); renderEditor();
          } })),
      h("div", { class: "grid" },
        field("Custom Unit Name", unit, "customName"),
        field("Datasheet / Model Type", unit, "baseName"),
        field("Role / Battlefield Role", unit, "role"),
        field("Is Warlord", unit, "isWarlord", { type: "checkbox" }),
        field("Points Value", unit, "points", { type: "number" }),
        field("Power Level (optional)", unit, "powerLevel", { type: "number" }),
        field("Starting XP", unit, "xp", { type: "number" }),
        field("Starting Rank", unit, "rank", { options: R.RANKS }),
        field("Starting Crusade Points", unit, "crusadePoints", { type: "number" }),
        tagField("Existing Honors / Enhancements / Relics", unit, "honors"),
        tagField("Existing Scars", unit, "scars")),
      progress);
  });
  return h("details", { class: "roster-editor", open: panel.open, ontoggle: (event) => { panel.open = event.target.open; } },
    h("summary", {}, "ORDER OF BATTLE / ACTIVE ROSTER ", total),
    h("section", { class: "roster-import" },
      h("h4", { text: "[ 📋 IMPORT YELLOWSCRIBE / ROSTER DATA ]" }),
      h("label", { class: "field" }, h("span", { text: "Roster JSON / clipboard text / code block" }), importText),
      h("p", { class: "muted small", text: "Import appends units with fresh IDs. JSON/text is parsed locally; share codes are looked up at yellowscribe.link (network/CORS permitting). Starting stats stay separate from live post-game results." }),
      h("button", { type: "button", class: "primary-button", text: "[ AUTO-PARSE ROSTER ]", disabled: panel.busy, onclick: async (event) => {
        if (panel.busy) return;
        const editing = state.editing;
        const button = event.currentTarget;
        panel.busy = true;
        editing.imports += 1;
        button.disabled = true;
        panel.error = false;
        panel.message = "Parsing roster / resolving share code…";
        message.className = "result";
        message.textContent = panel.message;
        try {
          const parsed = await R.ingestRoster(panel.text);
          if (state.editing !== editing || !editing.draft.players.includes(player)) return;
          R.appendRoster(player, parsed);
          panel.text = "";
          panel.error = false;
          panel.message = `Imported ${parsed.roster.length} unit(s), ${parsed.pointsTotal} points. ${parsed.warnings.join(" ")}`;
          changed();
        } catch (error) {
          panel.error = true; panel.message = error.message;
          message.className = "result error"; message.textContent = error.message;
        } finally {
          panel.busy = false;
          editing.imports -= 1;
          button.disabled = false;
          if (state.editing === editing) {
            if (!editing.imports) $("editor-errors").querySelector("[data-roster-pending]")?.remove();
            renderEditor();
          }
        }
      } }), message),
    h("div", { class: "unit-cards" }, cards),
    h("button", { type: "button", class: "outline-button", text: "[ + ADD UNIT MANUALLY ]",
      onclick: () => { player.roster.push(R.blankUnit(player.roster)); changed(); renderEditor(); } }));
}

function playerEditor(player, index, players) {
  const xpHint = h("span", { class: "hint" });
  const rpHint = h("span", { class: "hint" });
  const markedXp = field("XP award", player.markedForGreatness, "xp", { type: "number" });
  hintUpdaters.push(() => {
    const input = markedXp.querySelector("input");
    input.disabled = Boolean(player.markedForGreatness.unitId);
    if (input.disabled) { player.markedForGreatness.xp = 3; input.value = 3; }
  });
  hintUpdaters.push(() => {
    xpHint.textContent = `Battle XP: +${R.playerXp(player)}`;
    const expected = R.rpExpected(player.rp);
    rpHint.textContent = `start + gained − spent = ${expected}${expected !== Number(player.rp.total) ? " (≠ total)" : ""}`;
  });
  return h("fieldset", { class: `player-editor alliance-${slug(player.alliance)}` },
    h("legend", {}, `PLAYER ${index + 1}`, " ", xpHint,
      players.length > 1 ? h("button", { type: "button", class: "mini danger", text: "✕ REMOVE PLAYER", onclick: () => { if (confirm("Remove this player?")) { players.splice(index, 1); changed(); renderEditor(); } } }) : null),
    h("div", { class: "grid" },
      field("Discord handle", player, "handle", { placeholder: "@handle" }),
      field("Discord user ID (optional)", player, "discordId", { placeholder: "for <@id> mentions", hint: "Numeric ID; enables a real ping in the Discord report" }),
      field("Commander (player)", player, "commander"),
      field("Faction", player, "faction"),
      field("Detachment", player, "detachment"),
      field("Alliance", player, "alliance", { options: R.ALLIANCES }),
      field("Warlord", player, "warlord", { wide: true }),
      field("Score (VP)", player, "score", { type: "number" }),
      field("Victor", player, "isWinner", { type: "checkbox" }),
      field("Start CP", player, "startCP", { type: "number" }),
      field("End CP", player, "endCP", { type: "number" })),
    rosterEditor(player),
    h("div", { class: "sub-head" }, h("span", { class: "eyebrow", text: "REQUISITION POINTS" }), rpHint),
    h("div", { class: "grid" },
      field("RP start", player.rp, "start", { type: "number" }),
      field("RP gained", player.rp, "gained", { type: "number" }),
      field("RP spent", player.rp, "spent", { type: "number" }),
      field("RP total", player.rp, "total", { type: "number" }),
      field("RP spent on", player.rp, "spentOn", { wide: true })),
    h("div", { class: "sub-head" }, h("span", { class: "eyebrow", text: "FACTION RESOURCE" }),
      h("label", { class: "field check inline" }, h("input", { type: "checkbox", checked: Boolean(player.specialResource), onchange: (e) => {
        player.specialResource = e.target.checked ? { name: "", start: 0, end: 0, note: "" } : null; changed(); renderEditor();
      } }), h("span", { text: "tracked (e.g. Awakening Points)" }))),
    player.specialResource ? h("div", { class: "grid" },
      field("Name", player.specialResource, "name"),
      field("Start", player.specialResource, "start", { type: "number" }),
      field("End", player.specialResource, "end", { type: "number" }),
      field("Note", player.specialResource, "note", { wide: true })) : null,
    h("div", { class: "sub-head" }, h("span", { class: "eyebrow", text: "POST-GAME CRUSADE // UNIT-LINKED BOOKKEEPING" })),
    listEditor("AGENDAS / AGENDA XP", player.agendas, () => ({ name: "", unitId: "", unit: "", completed: false, xp: 0 }), (agenda) => h("div", { class: "grid row" },
      unitTarget(player, agenda), field("Agenda", agenda, "name", { wide: true }), field("Completed", agenda, "completed", { type: "checkbox" }), field("XP", agenda, "xp", { type: "number" }))),
    listEditor("OUT OF ACTION TESTS", player.outOfActionTests, () => ({ unit: "", passed: true, scar: "" }), (test) => h("div", { class: "grid row" },
      unitTarget(player, test), field("Passed", test, "passed", { type: "checkbox" }), field("Battle scar (if failed)", test, "scar"))),
    h("div", { class: "sub-head" }, h("span", { class: "eyebrow", text: "MARKED FOR GREATNESS" })),
    h("div", { class: "grid" },
      unitTarget(player, player.markedForGreatness),
      h("p", { class: "hint", text: "Registered unit: +3 XP automatically. Custom / legacy awards retain their recorded XP." }),
      markedXp,
      field("Reason", player.markedForGreatness, "reason", { rows: 2, wide: true })),
    listEditor("RANK PROMOTIONS / BATTLE HONORS", player.rankPromotions, () => ({ unit: "", newRank: "Bloodied", reward: "" }), (promo) => h("div", { class: "grid row" },
      unitTarget(player, promo, { promotion: true }), promotionRank(player, promo),
      field("Crusade Relic / Trait / Battle Honor", promo, "reward", { wide: true }))));
}

function renderEditor() {
  const body = $("editor-body");
  const scroll = body.scrollTop;
  const draft = state.editing.draft;
  hintUpdaters = [];
  body.replaceChildren(
    h("fieldset", {}, h("legend", { text: "BATTLE METADATA" }),
      h("div", { class: "grid" },
        field("Report ID", draft, "id", { placeholder: "BR-003" }),
        field("Battle №", draft, "battleNumber", { type: "number" }),
        field("Date", draft, "date", { type: "date" }),
        field("Battle size", draft, "battleSize", { placeholder: "500pt" }),
        field("Title", draft, "title", { wide: true }),
        field("Planet / location", draft, "location", { wide: true }),
        field("Mission", draft, "mission", { wide: true }))),
    ...draft.players.map((player, index) => playerEditor(player, index, draft.players)),
    h("button", { type: "button", class: "outline-button add-player", text: "+ ADD PLAYER", onclick: () => { draft.players.push(R.blankPlayer()); changed(); renderEditor(); } }),
    h("fieldset", {}, h("legend", { text: "NARRATIVE LOG" }),
      field("Context (narrativeContext)", draft, "narrativeContext", { rows: 5, wide: true }),
      listEditor("BATTLE HIGHLIGHTS", draft.highlights, () => "", (_, index) => field(`Highlight ${index + 1}`, draft.highlights, index, { rows: 2, wide: true })),
      field("Aftermath (narrativeAftermath)", draft, "narrativeAftermath", { rows: 4, wide: true })),
    h("fieldset", {}, h("legend", { text: "ARTWORK (image embeds)" }),
      imageField("Header image URL", "headerImageUrl"),
      imageField("Aftermath image URL", "aftermathImageUrl")));
  hintUpdaters.forEach((update) => update());
  body.scrollTop = scroll;
}

function saveEditor(event) {
  event.preventDefault();
  const { draft, originalId, uploads, imports } = state.editing;
  if (imports > 0) {
    $("editor-errors").replaceChildren(h("li", { "data-roster-pending": true, text: "A roster import is still resolving — wait for its result before saving." }));
    return;
  }
  if (uploads > 0) {
    $("editor-errors").replaceChildren(h("li", { text: "A pict-feed is still transmitting — wait for [ PICT-FEED SECURED ] before saving." }));
    return;
  }
  const report = R.normalizeReport(draft);
  const errors = R.validateReport(report, state.reports, originalId);
  if (errors.length) {
    $("editor-errors").replaceChildren(...errors.map((text) => h("li", { text })));
    return;
  }
  const index = state.reports.findIndex((r) => r.id === originalId);
  if (index >= 0) state.reports[index] = report;
  else state.reports.push(report);
  state.changes.add(report.id);
  saveDraft();
  releaseMedia(state.editing);
  state.editing = null;
  $("editor-dialog").close();
  location.hash = report.id;
  render();
  setStatus(`${report.id} committed to the local archive. TRANSMIT to publish to GitHub.`, "warn");
}

function closeEditor() {
  if (state.editing?.changed && !confirm("Discard unsaved changes to this report?")) return false;
  if (state.editing?.imports > 0 && !confirm("A roster import is still resolving. Close and discard its result?")) return false;
  if (state.editing?.uploads > 0 && !confirm("A pict-feed is still transmitting. Close anyway? (The file may still land in the repository.)")) return false;
  releaseMedia(state.editing);
  state.editing = null;
  $("editor-dialog").close();
  return true;
}

// ---------- AI helper ----------
function setupAiPanel() {
  const fill = (select, entries) => select.replaceChildren(...entries.map(([value, label]) => h("option", { value, text: label })));
  fill($("ai-section"), Object.entries(AI.SECTIONS).map(([key, s]) => [key, s.label]));
  fill($("ai-tone"), Object.entries(AI.TONES).map(([key, t]) => [key, t.label]));
  fill($("ai-lang"), Object.entries(AI.LANGUAGES));
  const options = () => ({
    section: $("ai-section").value, tone: $("ai-tone").value, lang: $("ai-lang").value,
    bullets: AI.parseBullets($("ai-bullets").value),
  });
  const current = () => R.normalizeReport(state.editing.draft);
  $("ai-build").addEventListener("click", () => {
    $("ai-output").value = AI.buildNarrativePrompt(current(), options());
    $("ai-note").textContent = "Prompt ready: COPY it into your AI, paste the reply back here, then APPLY.";
  });
  $("ai-offline").addEventListener("click", () => {
    $("ai-output").value = AI.draftOffline(current(), options());
    $("ai-note").textContent = "Offline cogitator draft generated from your bullets. Edit, then APPLY.";
  });
  $("img-build").addEventListener("click", () => {
    $("ai-output").value = AI.buildImagePrompt(current(), { scene: $("img-scene").value, bullets: AI.parseBullets($("ai-bullets").value) });
    $("ai-note").textContent = "Art prompt ready. Generate the image, upload it (e.g. to Discord), then paste its URL into ARTWORK.";
  });
  $("ai-copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($("ai-output").value);
      $("ai-note").textContent = "Copied to clipboard.";
    } catch {
      $("ai-output").select();
      $("ai-note").textContent = "Clipboard blocked — text selected, press Ctrl+C.";
    }
  });
  $("ai-apply").addEventListener("click", () => {
    const { section } = options();
    const text = $("ai-output").value.trim();
    if (!text) return;
    const draft = state.editing.draft;
    if (section === "highlights") {
      const items = AI.parseBullets(text);
      if (draft.highlights.some(Boolean) && !confirm("Replace the existing highlights?")) return;
      draft.highlights.splice(0, draft.highlights.length, ...items);
    } else {
      if (draft[section] && !confirm("Replace the existing text in this section?")) return;
      draft[section] = text;
    }
    changed();
    renderEditor();
    $("ai-note").textContent = `Applied to ${AI.SECTIONS[section].label}.`;
  });
  $("ai-bullets-hl").addEventListener("click", () => {
    const items = AI.parseBullets($("ai-bullets").value);
    if (!items.length) return;
    state.editing.draft.highlights.push(...items);
    changed();
    renderEditor();
    $("ai-note").textContent = `${items.length} bullet(s) appended to highlights.`;
  });
}

// ---------- uplink ----------
function openUplink() {
  const u = state.uplink;
  $("up-repo").value = u.repo;
  $("up-branch").value = u.branch;
  $("up-path").value = u.path;
  $("up-token").value = u.token;
  $("up-remember").checked = u.remember !== false;
  $("up-token-state").textContent = u.token ? `Stored token: ${U.maskToken(u.token)}` : "No token stored.";
  $("up-result").textContent = "";
  updateRawUrl();
  $("uplink-dialog").showModal();
}

function formUplink() {
  return U.normalizeUplink({ repo: $("up-repo").value, branch: $("up-branch").value, path: $("up-path").value, token: $("up-token").value });
}

function updateRawUrl() {
  try { $("up-raw").textContent = U.rawUrl(formUplink()); } catch { $("up-raw").textContent = "—"; }
}

async function uplinkAction(button, action) {
  button.disabled = true;
  try { await action(); } catch (error) {
    $("up-result").textContent = `✕ ${error.message}`;
    $("up-result").className = "result error";
  } finally { button.disabled = false; }
}

function okResult(text) {
  $("up-result").textContent = text;
  $("up-result").className = "result ok";
}

async function pullRemote() {
  const config = state.uplink;
  if (!U.uplinkReady(config)) throw new U.UplinkError("Save a repository and token first.");
  if (state.dirty && !confirm("Pulling replaces your unpublished local edits. Continue?")) return;
  const remote = await U.readRemoteFile(config);
  if (!remote) throw new U.UplinkError(`${config.path} does not exist on ${config.branch} yet — TRANSMIT to create it.`);
  state.reports = R.parseReports(remote.text);
  state.feedSha = remote.sha;
  clearDraft();
  render();
  okResult(`✓ Pulled ${state.reports.length} report(s) from ${config.repo}@${config.branch}.`);
  setStatus(`Archive resynchronized from GitHub (${remote.sha.slice(0, 7)}).`);
}

// Offline (data URL) pict-feeds become repository assets before the JSON is committed.
async function promoteLocalImages() {
  let count = 0;
  for (const report of state.reports) {
    for (const [key, slot] of Object.entries(IMAGE_SLOTS)) {
      if (!R.isLocalImage(report[key])) continue;
      setStatus(`[ TRANSMITTING PICT-FEED TO ARCHIVES... ] ${report.id} ${slot}`);
      const { bytes, ext } = IMG.dataUrlToBytes(report[key]);
      const result = await U.uploadAsset(state.uplink, {
        path: U.assetPath(state.uplink, report.id, slot, ext),
        bytes,
        message: `Battle archive: ${slot} pict-feed for ${report.id}`,
      });
      report[key] = result.url;
      state.changes.add(report.id);
      saveDraft(); // a later failure must not re-upload this image
      count += 1;
    }
  }
  if (count) render();
  return count;
}

async function transmit() {
  if (!U.uplinkReady(state.uplink)) {
    openUplink();
    setStatus("Configure the uplink (repository + fine-grained token) before transmitting.", "error");
    return;
  }
  const button = $("transmit");
  button.disabled = true;
  setStatus("Transmitting to the GitHub archive…");
  try {
    const remote = await U.readRemoteFile(state.uplink);
    if (remote && state.feedSha && remote.sha !== state.feedSha
        && !confirm("The archive on GitHub changed since this browser last synced (another Warmaster or a manual commit).\n\nOverwrite it with your version?")) {
      setStatus("Transmission aborted. Use ☁ UPLINK → PULL to adopt the GitHub version.", "warn");
      return;
    }
    const promoted = await promoteLocalImages();
    const text = R.serializeReports(R.sortReports(state.reports, false));
    if (remote && remote.text === text) {
      state.feedSha = remote.sha;
      clearDraft();
      setStatus("GitHub already holds this exact archive — nothing to transmit.");
      return;
    }
    const changes = [...state.changes];
    const summary = changes.length ? changes.map((c) => (c.startsWith("-") ? `delete ${c.slice(1)}` : c)).join(", ") : "update";
    const result = await U.writeRemoteFile(state.uplink, { text, sha: remote?.sha, message: `Battle archive: ${summary}` });
    state.feedSha = result.contentSha;
    clearDraft();
    setStatus(`Transmission confirmed — commit ${String(result.commitSha || "").slice(0, 7)}${promoted ? ` (+${promoted} pict-feed${promoted > 1 ? "s" : ""} uploaded)` : ""}.`, "ok",
      result.commitUrl ? { href: result.commitUrl, text: "view commit" } : null);
  } catch (error) {
    setStatus(`Transmission failed: ${error.message}`, "error");
  } finally {
    button.disabled = false;
  }
}

// ---------- import / export ----------
function exportJson() {
  const blob = new Blob([R.serializeReports(R.sortReports(state.reports, false))], { type: "application/json" });
  const link = h("a", { href: URL.createObjectURL(blob), download: "battle_reports.json" });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function importJson(file) {
  try {
    const reports = R.parseReports(await file.text());
    if (!confirm(`Replace the archive with ${reports.length} report(s) from ${file.name}?`)) return;
    state.reports = reports;
    state.changes.add(`import ${file.name}`);
    saveDraft();
    render();
    setStatus(`Imported ${reports.length} report(s). TRANSMIT to publish.`, "warn");
  } catch (error) {
    setStatus(`Import failed: ${error.message}`, "error");
  }
}

// ---------- wiring ----------
function wire() {
  $("map-link").href = settings.mapUrl;
  $("search").addEventListener("input", (e) => { state.query = e.target.value; render(); });
  $("sort-toggle").addEventListener("click", () => { state.newestFirst = !state.newestFirst; render(); });
  $("override").addEventListener("click", () => {
    if (state.warmaster) return lock();
    $("passkey").value = "";
    $("passkey-error").textContent = "";
    $("passkey-dialog").showModal();
  });
  $("passkey-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if ($("passkey").value !== settings.warmasterPasskey) {
      $("passkey-error").textContent = "ACCESS DENIED — passkey rejected.";
      return;
    }
    $("passkey-dialog").close();
    unlock();
    if (!state.dirty) setStatus("Warmaster authority recognised. Edit & dispatch unlocked.", "ok");
  });
  $("cancel-passkey").addEventListener("click", () => $("passkey-dialog").close());

  $("new-report").addEventListener("click", () => openEditor());
  $("editor-form").addEventListener("submit", saveEditor);
  $("cancel-editor").addEventListener("click", closeEditor);
  $("editor-dialog").addEventListener("cancel", (event) => { event.preventDefault(); closeEditor(); });
  setupAiPanel();

  $("uplink-button").addEventListener("click", openUplink);
  $("transmit").addEventListener("click", transmit);
  $("export").addEventListener("click", exportJson);
  $("import").addEventListener("change", (e) => { if (e.target.files[0]) importJson(e.target.files[0]); e.target.value = ""; });
  for (const id of ["up-repo", "up-branch", "up-path"]) $(id).addEventListener("input", updateRawUrl);
  $("up-close").addEventListener("click", () => $("uplink-dialog").close());
  $("up-save").addEventListener("click", (e) => uplinkAction(e.target, async () => {
    state.uplink = U.saveUplink(formUplink(), { remember: $("up-remember").checked }, localStorage, sessionStorage);
    $("up-token-state").textContent = state.uplink.token ? `Stored token: ${U.maskToken(state.uplink.token)}${state.uplink.remember ? "" : " (this tab only)"}` : "No token stored.";
    renderToolbar();
    okResult("✓ Uplink settings saved on this device.");
  }));
  $("up-verify").addEventListener("click", (e) => uplinkAction(e.target, async () => {
    const config = formUplink();
    if (!config.token) throw new U.UplinkError("Paste a token to verify.");
    const info = await U.verifyUplink(config);
    okResult(`✓ Linked to ${config.repo} (${info.private ? "private" : "public"}). Push access: ${info.canPush === null ? "unknown (fine-grained token)" : info.canPush ? "YES" : "NO"}. `
      + (info.fileExists ? `Archive file found (${info.sha.slice(0, 7)}).` : "Archive file not found — first TRANSMIT will create it."));
  }));
  $("up-forget").addEventListener("click", () => {
    U.forgetToken(localStorage, sessionStorage);
    state.uplink = { ...state.uplink, token: "" };
    $("up-token").value = "";
    $("up-token-state").textContent = "Token erased from this device.";
    renderToolbar();
  });
  $("up-pull").addEventListener("click", (e) => uplinkAction(e.target, pullRemote));

  addEventListener("beforeunload", (event) => {
    if (state.dirty || state.editing?.changed) { event.preventDefault(); event.returnValue = ""; }
  });
  addEventListener("hashchange", () => document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ behavior: "smooth" }));
}

wire();
await loadFeed();
if (sessionStorage.getItem(SESSION_UNLOCK_KEY) === "1") unlock();
if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
