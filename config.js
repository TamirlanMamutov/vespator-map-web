export const settings = Object.freeze({
  // Convenience lock only: static assets and all local edits are public to visitors.
  warmasterPasskey: "VESPATOR-42",
  // Map units are multiplied by this factor so dossier tags fit between systems.
  mapScale: 1.2,
  // Cogitator Cloud Uplink defaults (pre-fill only; the token is never stored in source).
  uplinkRepo: "TamirlanMamutov/vespator-map-web",
  uplinkBranch: "main",
  uplinkPath: "campaign_data.json",
  // Players re-read the published feed this often (seconds). 0 disables auto-sync.
  feedPollSeconds: 60,
});
