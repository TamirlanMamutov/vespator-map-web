import test from "node:test";
import assert from "node:assert/strict";
import {
  UPLINK_KEY, UPLINK_TOKEN_KEY, UplinkError, parseRepo, normalizeUplink, uplinkReady, maskToken,
  loadUplink, saveUplink, forgetToken, encodeBase64, decodeBase64, contentsUrl,
  readRemoteFile, readRemoteText, writeRemoteFile, verifyUplink,
} from "../uplink.js";

const TOKEN = "github_pat_" + "A".repeat(30);
const CONFIG = { repo: "TamirlanMamutov/vespator-map-web", branch: "main", path: "campaign_data.json", token: TOKEN };

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}

function response(status, body, headers = {}) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return {
    status, ok: status >= 200 && status < 300,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    json: async () => JSON.parse(text),
    text: async () => text,
  };
}

function mockFetch(handler) {
  const calls = [];
  const impl = async (url, init = {}) => { calls.push({ url, init }); return handler(url, init, calls.length); };
  impl.calls = calls;
  return impl;
}

test("parseRepo accepts owner/repo, URLs and .git remotes", () => {
  assert.equal(parseRepo("owner/repo").full, "owner/repo");
  assert.equal(parseRepo(" https://github.com/Owner/my.repo ").full, "Owner/my.repo");
  assert.equal(parseRepo("https://github.com/owner/repo.git").full, "owner/repo");
  for (const bad of ["", "owner", "owner/repo/extra", "../etc/passwd", "own er/repo"]) {
    assert.throws(() => parseRepo(bad), UplinkError, bad);
  }
});

test("normalizeUplink validates branch, path and token", () => {
  const clean = normalizeUplink({ ...CONFIG, branch: " main " });
  assert.equal(clean.branch, "main");
  assert.ok(uplinkReady(clean));
  assert.ok(!uplinkReady({ ...clean, token: "" }));
  assert.throws(() => normalizeUplink({ ...CONFIG, branch: "bad..branch" }), UplinkError);
  assert.throws(() => normalizeUplink({ ...CONFIG, path: "../x.json" }), UplinkError);
  assert.throws(() => normalizeUplink({ ...CONFIG, token: "short" }), UplinkError);
  assert.ok(!maskToken(TOKEN).includes(TOKEN.slice(0, 20)));
});

test("base64 round-trips UTF-8 world names", () => {
  const text = JSON.stringify({ name: "Myrkviðr", glyph: "☠", big: "x".repeat(100000) });
  const encoded = encodeBase64(text);
  assert.equal(decodeBase64(encoded), text);
  assert.equal(decodeBase64(encoded.replace(/(.{60})/g, "$1\n")), text);
  assert.equal(Buffer.from(encodeBase64("Myrkviðr"), "base64").toString("utf8"), "Myrkviðr");
});

test("contentsUrl encodes the path and only adds ref for reads", () => {
  assert.equal(contentsUrl(CONFIG), "https://api.github.com/repos/TamirlanMamutov/vespator-map-web/contents/campaign_data.json?ref=main");
  assert.equal(contentsUrl({ ...CONFIG, branch: "feature/x" }), "https://api.github.com/repos/TamirlanMamutov/vespator-map-web/contents/campaign_data.json?ref=feature%2Fx");
  assert.equal(contentsUrl(CONFIG, false), "https://api.github.com/repos/TamirlanMamutov/vespator-map-web/contents/campaign_data.json");
});

test("readRemoteFile returns sha and decoded text, or null when missing", async () => {
  const payload = '{"name":"Myrkviðr"}';
  const fetchImpl = mockFetch(() => response(200, { type: "file", sha: "abc123", size: 20, encoding: "base64", content: Buffer.from(payload).toString("base64").replace(/(.{8})/g, "$1\n") }));
  const file = await readRemoteFile(CONFIG, fetchImpl);
  assert.deepEqual(file, { sha: "abc123", text: payload, size: 20 });
  const { init } = fetchImpl.calls[0];
  assert.equal(init.headers.Authorization, `Bearer ${TOKEN}`);
  assert.equal(init.headers["X-GitHub-Api-Version"], "2022-11-28");
  assert.equal(init.cache, "no-store");
  assert.equal(await readRemoteFile(CONFIG, mockFetch(() => response(404, { message: "Not Found" }))), null);
});

test("readRemoteFile falls back to the raw media type for large files", async () => {
  const fetchImpl = mockFetch((url, init) => init.headers.Accept === "application/vnd.github.raw+json"
    ? response(200, "{\"big\":true}")
    : response(200, { type: "file", sha: "big1", size: 2_000_000, encoding: "none", content: "" }));
  const file = await readRemoteFile(CONFIG, fetchImpl);
  assert.equal(file.text, "{\"big\":true}");
  assert.equal(fetchImpl.calls.length, 2);
  assert.equal(await readRemoteText(CONFIG, mockFetch(() => response(200, "raw"))), "raw");
});

test("writeRemoteFile PUTs base64 content with sha and branch", async () => {
  const fetchImpl = mockFetch(() => response(200, { content: { sha: "new1" }, commit: { sha: "c0ffee1234", html_url: "https://github.com/x/y/commit/c0ffee1234" } }));
  const result = await writeRemoteFile(CONFIG, { text: "{\"w\":\"Myrkviðr\"}\n", sha: "abc123", message: "Cogitator update" }, fetchImpl);
  assert.deepEqual(result, { contentSha: "new1", commitSha: "c0ffee1234", commitUrl: "https://github.com/x/y/commit/c0ffee1234" });
  const { url, init } = fetchImpl.calls[0];
  assert.equal(url, contentsUrl(CONFIG, false));
  assert.equal(init.method, "PUT");
  const body = JSON.parse(init.body);
  assert.equal(body.sha, "abc123");
  assert.equal(body.branch, "main");
  assert.equal(body.message, "Cogitator update");
  assert.equal(Buffer.from(body.content, "base64").toString("utf8"), "{\"w\":\"Myrkviðr\"}\n");
  assert.ok(!init.body.includes(TOKEN), "token must never be in the request body");

  const create = mockFetch(() => response(201, { content: { sha: "n" }, commit: { sha: "d" } }));
  await writeRemoteFile(CONFIG, { text: "{}", message: "create" }, create);
  assert.ok(!("sha" in JSON.parse(create.calls[0].init.body)));
});

test("API failures map to descriptive UplinkErrors", async () => {
  const cases = [
    [401, {}, /Token rejected/],
    [403, {}, /Contents: Read and write/],
    [403, { "x-ratelimit-remaining": "0" }, /rate limit/],
    [409, {}, /Conflict/],
    [422, {}, /Commit rejected/],
    [500, {}, /error 500/],
  ];
  for (const [status, headers, pattern] of cases) {
    await assert.rejects(writeRemoteFile(CONFIG, { text: "{}", sha: "a", message: "m" }, mockFetch(() => response(status, { message: "nope" }, headers))),
      (error) => error instanceof UplinkError && error.status === status && pattern.test(error.message), String(status));
  }
  await assert.rejects(readRemoteFile(CONFIG, mockFetch(() => { throw new TypeError("Failed to fetch"); })), /No astropathic contact/);
  await assert.rejects(readRemoteFile(CONFIG, mockFetch(() => { throw new DOMException("timed out", "TimeoutError"); })), /No reply from api\.github\.com/);
  const signalled = mockFetch(() => response(404, {}));
  await readRemoteFile(CONFIG, signalled);
  assert.ok(signalled.calls[0].init.signal, "requests carry a timeout signal");
  await assert.rejects(readRemoteFile({ ...CONFIG, token: "" }, mockFetch(() => response(200, {}))), /No GitHub token/);
});

test("verifyUplink reports push access and file presence", async () => {
  const fetchImpl = mockFetch((url) => url.includes("/contents/")
    ? response(200, { type: "file", sha: "f1", size: 2, encoding: "base64", content: Buffer.from("{}").toString("base64") })
    : response(200, { private: true, default_branch: "main", permissions: { push: false } }));
  assert.deepEqual(await verifyUplink(CONFIG, fetchImpl), { private: true, canPush: false, defaultBranch: "main", fileExists: true, sha: "f1" });
});

test("uplink settings persist per device; token honours the remember flag", () => {
  const local = new MemoryStorage();
  const session = new MemoryStorage();
  const defaults = { repo: "TamirlanMamutov/vespator-map-web", branch: "main", path: "campaign_data.json" };
  assert.deepEqual(loadUplink(local, session, defaults), { ...defaults, token: "", remember: true });

  saveUplink(CONFIG, { remember: true }, local, session);
  assert.equal(JSON.parse(local.getItem(UPLINK_KEY)).token, TOKEN);
  assert.equal(session.getItem(UPLINK_TOKEN_KEY), null);
  assert.equal(loadUplink(local, session, defaults).token, TOKEN);

  saveUplink(CONFIG, { remember: false }, local, session);
  assert.ok(!("token" in JSON.parse(local.getItem(UPLINK_KEY))));
  assert.equal(session.getItem(UPLINK_TOKEN_KEY), TOKEN);
  const loaded = loadUplink(local, session, defaults);
  assert.equal(loaded.token, TOKEN);
  assert.equal(loaded.remember, false);
  assert.equal(loadUplink(local, new MemoryStorage(), defaults).token, "", "session token ends with the tab");

  saveUplink(CONFIG, { remember: true }, local, session);
  forgetToken(local, session);
  assert.equal(loadUplink(local, session, defaults).token, "");
  assert.equal(JSON.parse(local.getItem(UPLINK_KEY)).repo, CONFIG.repo);

  local.setItem(UPLINK_KEY, "{corrupt");
  assert.equal(loadUplink(local, session, defaults).repo, defaults.repo);
  assert.equal(loadUplink(null, null, defaults).token, "");
});
