// AI Narrative Drafter / Image Helper (DOM-free). Builds prompts for an external LLM or image model
// from the Warmaster's bullet points; nothing is sent anywhere — prompts are copied manually.
// An offline template draft is available for when no AI is at hand.

export const SECTIONS = Object.freeze({
  narrativeContext: {
    label: "Context (pre-battle)",
    en: "the PRE-BATTLE CONTEXT: one paragraph of 60-120 words that sets up who is fighting, why, and what is at stake",
  },
  highlights: {
    label: "Battle highlights",
    en: "BATTLE HIGHLIGHTS: one vivid line (1-2 sentences) per bullet, returned as a plain list with one item per line and no numbering",
  },
  narrativeAftermath: {
    label: "Aftermath",
    en: "the AFTERMATH: one paragraph of 50-100 words about the consequences of the battle for the campaign and what comes next",
  },
});

export const TONES = Object.freeze({
  chronicle: { label: "Imperial chronicle", en: "a grimdark Imperial war chronicle — solemn, archaic, heavy with gothic imagery" },
  vox: { label: "Intercepted vox-log", en: "an intercepted vox-log — clipped transmissions, static, urgency, '+++' separators" },
  dossier: { label: "Inquisitorial dossier", en: "a cold Inquisitorial dossier — clinical, ominous, with redaction hints" },
  xenos: { label: "Xenos perspective", en: "the voice of the alien victor or loser — alien, contemptuous, eternal" },
});

export const LANGUAGES = Object.freeze({ ru: "Russian", en: "English" });

export function parseBullets(text) {
  return String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•+>–—]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
}

function sentence(text) {
  const clean = String(text).trim().replace(/\s+/g, " ");
  if (!clean) return "";
  const capital = clean.charAt(0).toLocaleUpperCase() + clean.slice(1);
  return /[.!?…»"]$/.test(capital) ? capital : `${capital}.`;
}

export function reportBrief(report) {
  const lines = [
    `Battle: ${report.title || "(untitled)"} (#${report.battleNumber ?? "?"}, ${report.date || "date unknown"})`,
    `Planet / location: ${report.location || "unknown"}; mission: ${report.mission || "unknown"}; size: ${report.battleSize || "?"}`,
  ];
  for (const p of report.players || []) {
    const result = p.isWinner ? "VICTOR" : "defeated";
    lines.push(`- ${p.faction || "?"} [${p.alliance || "?"}] led by ${p.warlord || "an unnamed warlord"} (player ${p.commander || p.handle || "?"}): ${p.score ?? 0} VP, ${result}`);
    const agendas = (p.agendas || []).map((a) => `${a.name}${a.completed ? " ✓" : " ✗"}`).join(", ");
    if (agendas) lines.push(`  agendas: ${agendas}`);
    const scars = (p.outOfActionTests || []).filter((t) => !t.passed).map((t) => `${t.unit}${t.scar ? ` (${t.scar})` : ""}`);
    if (scars.length) lines.push(`  casualties/scars: ${scars.join(", ")}`);
    if (p.markedForGreatness?.unit) lines.push(`  hero of the battle: ${p.markedForGreatness.unit}${p.markedForGreatness.reason ? ` — ${p.markedForGreatness.reason}` : ""}`);
  }
  return lines.join("\n");
}

export function buildNarrativePrompt(report, { section = "narrativeContext", bullets = [], tone = "chronicle", lang = "ru" } = {}) {
  const target = SECTIONS[section] || SECTIONS.narrativeContext;
  const voice = TONES[tone] || TONES.chronicle;
  const notes = bullets.length ? bullets.map((b) => `- ${b}`).join("\n") : "- (no notes: infer only from the battle facts)";
  return [
    "You are a lore-keeper of the Vespator Front, a Warhammer 40,000 Crusade campaign.",
    `Write ${target.en}.`,
    `Style: ${voice.en}.`,
    `Language: ${LANGUAGES[lang] || LANGUAGES.ru}. Keep unit, faction and character names exactly as given.`,
    "Rules: stay faithful to the facts and the result below; do not invent a different winner or new named characters;",
    "no markdown headings, no emojis, no preamble — return only the finished text.",
    "",
    "BATTLE FACTS:",
    reportBrief(report),
    "",
    "WARMASTER NOTES:",
    notes,
  ].join("\n");
}

export function buildImagePrompt(report, { scene = "header", bullets = [] } = {}) {
  const factions = (report.players || []).map((p) => p.faction).filter(Boolean);
  const victor = (report.players || []).find((p) => p.isWinner);
  const moment = bullets[0] || (scene === "header"
    ? `the opening clash of ${factions.join(" against ") || "two armies"}`
    : `the aftermath of the battle${victor ? `, ${victor.faction} triumphant` : ""}`);
  return [
    `Grimdark Warhammer 40,000 ${scene === "header" ? "battle scene" : "aftermath scene"}: ${moment}.`,
    factions.length ? `Forces: ${factions.join(" vs ")}.` : "",
    report.location ? `Setting: ${report.location}${report.mission ? `, during "${report.mission}"` : ""}.` : "",
    scene === "header"
      ? "Cinematic wide shot, dramatic lighting, smoke, tracer fire, towering scale, painterly concept art."
      : "Desolate battlefield, burning wreckage, ash-filled sky, quiet dread, painterly concept art.",
    "16:9, highly detailed, no text, no watermark, no logos.",
  ].filter(Boolean).join(" ");
}

const OFFLINE = {
  ru: {
    openers: ["Летописи Веспаторского фронта гласят:", "Из архивов Департаменто Муниторум:", "+++ Перехваченная передача +++", "Да будет записано в хрониках:"],
    stakes: (r) => (r.location ? `Судьба ${r.location} повисла на волоске.` : ""),
    closer: (r) => {
      const victor = (r.players || []).find((p) => p.isWinner);
      return victor ? `Поле боя осталось за силами ${victor.faction}, но война на Веспаторском фронте лишь разгорается.` : "Ни одна из сторон не добилась превосходства — война на Веспаторском фронте продолжается.";
    },
  },
  en: {
    openers: ["The chronicles of the Vespator Front record:", "From the archives of the Departmento Munitorum:", "+++ Intercepted transmission +++", "Let it be written in the annals:"],
    stakes: (r) => (r.location ? `The fate of ${r.location} hung by a thread.` : ""),
    closer: (r) => {
      const victor = (r.players || []).find((p) => p.isWinner);
      return victor ? `The field belonged to ${victor.faction}, yet the war on the Vespator Front only burns hotter.` : "Neither side prevailed — the war on the Vespator Front grinds on.";
    },
  },
};

// Template draft without any AI: returns a string (highlights: one item per line).
export function draftOffline(report, { section = "narrativeContext", bullets = [], lang = "ru" } = {}) {
  const words = OFFLINE[lang] || OFFLINE.ru;
  const sentences = bullets.map(sentence).filter(Boolean);
  if (section === "highlights") return sentences.join("\n");
  if (section === "narrativeAftermath") return [...sentences, words.closer(report)].join(" ");
  const opener = words.openers[Math.abs(Number(report.battleNumber) || 0) % words.openers.length];
  return [opener, ...sentences, words.stakes(report)].filter(Boolean).join(" ");
}
