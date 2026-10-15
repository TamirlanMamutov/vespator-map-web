export const settings = Object.freeze({
  // Convenience lock only: static assets are public. Real authority is the GitHub token.
  warmasterPasskey: "VESPATOR-42",
  // Uplink defaults (pre-fill only; the token is never stored in source).
  // The app is served from vespator-map-web/BattleReports/; paths are repository-relative.
  // Uploaded artwork goes beside the data folder: BattleReports/assets/reports/.
  uplinkRepo: "TamirlanMamutov/vespator-map-web",
  uplinkBranch: "main",
  uplinkPath: "BattleReports/data/battle_reports.json",
  // Public feed loaded by the archive (relative to index.html).
  feedUrl: "data/battle_reports.json",
  // Link back to the theatre map in the HUD.
  mapUrl: "../index.html",
});
