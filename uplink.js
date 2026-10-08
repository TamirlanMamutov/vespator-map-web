// Cogitator Cloud Uplink: reads and commits campaign_data.json through the GitHub Contents API.
// DOM-free so it runs under Node tests (inject fetch and Storage objects).

export const UPLINK_KEY = "vespator_cogitator_uplink";
export const UPLINK_TOKEN_KEY = "vespator_cogitator_uplink_token";
export const API_ROOT = "https://api.github.com";
export const API_VERSION = "2022-11-28";
export const DEFAULT_BRANCH = "main";
export const DEFAULT_PATH = "campaign_data.json";

export class UplinkError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "UplinkError";
    this.status = status;
  }
}

// Accepts "owner/repo", "github.com/owner/repo" or a full https/.git URL (handy when pasting on mobile).
export function parseRepo(value) {
  const cleaned = String(value ?? "").trim()
    .replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/\/+$/, "");
  const match = /^([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100})$/.exec(cleaned);
  if (!match || match[2] === "." || match[2] === "..") throw new UplinkError("Repository must look like owner/repo.");
  return { owner: match[1], repo: match[2], full: `${match[1]}/${match[2]}` };
}

export function validBranch(value) {
  const branch = String(value ?? "").trim();
  return /^[A-Za-z0-9._/-]{1,200}$/.test(branch) && !branch.includes("..") && !branch.startsWith("/") && !branch.endsWith("/") && !branch.endsWith(".lock");
}

export function validPath(value) {
  const path = String(value ?? "").trim();
  return /^[A-Za-z0-9._/-]{1,200}\.json$/.test(path) && !path.split("/").some((part) => part === "" || part === "." || part === "..");
}

export function validToken(value) {
  return /^[A-Za-z0-9_]{20,255}$/.test(String(value ?? ""));
}

// Returns a clean config; the token is optional here so repo/branch can be saved before a token is pasted.
export function normalizeUplink({ repo, branch = DEFAULT_BRANCH, path = DEFAULT_PATH, token = "" } = {}) {
  const parsed = parseRepo(repo);
  const cleanBranch = String(branch || DEFAULT_BRANCH).trim();
  if (!validBranch(cleanBranch)) throw new UplinkError("Branch name is not valid.");
  const cleanPath = String(path || DEFAULT_PATH).trim().replace(/^\/+/, "");
  if (!validPath(cleanPath)) throw new UplinkError("Feed path must be a repository-relative .json file.");
  const cleanToken = String(token ?? "").trim();
  if (cleanToken && !validToken(cleanToken)) throw new UplinkError("That does not look like a GitHub token (expected github_pat_… or ghp_…).");
  return { repo: parsed.full, branch: cleanBranch, path: cleanPath, token: cleanToken };
}

export const uplinkReady = (config) => Boolean(config?.repo && config?.token);

export function maskToken(token) {
  return token ? `${token.slice(0, token.startsWith("github_pat_") ? 11 : 4)}…${token.slice(-4)}` : "";
}

// ---------- Device storage ----------
// Repository/branch always go to localStorage. The token goes to localStorage when "remember" is on,
// otherwise to sessionStorage so it disappears when the tab closes.
function safeGet(storage, key) {
  try { return storage?.getItem(key) ?? null; } catch { return null; }
}
function safeSet(storage, key, value) {
  try { storage?.setItem(key, value); return true; } catch { return false; }
}
function safeRemove(storage, key) {
  try { storage?.removeItem(key); } catch { /* storage unavailable */ }
}

export function loadUplink(local, session, defaults = {}) {
  let saved = {};
  try { saved = JSON.parse(safeGet(local, UPLINK_KEY) || "{}") || {}; } catch { saved = {}; }
  const sessionToken = safeGet(session, UPLINK_TOKEN_KEY);
  const localToken = typeof saved.token === "string" ? saved.token : "";
  const candidate = {
    repo: saved.repo || defaults.repo || "",
    branch: saved.branch || defaults.branch || DEFAULT_BRANCH,
    path: saved.path || defaults.path || DEFAULT_PATH,
    token: localToken || sessionToken || "",
  };
  const remember = Boolean(localToken) || !sessionToken;
  try {
    return { ...normalizeUplink(candidate), remember };
  } catch {
    return { repo: "", branch: candidate.branch, path: DEFAULT_PATH, token: "", remember };
  }
}

export function saveUplink(config, { remember = true } = {}, local, session) {
  const clean = normalizeUplink(config);
  const record = { repo: clean.repo, branch: clean.branch, path: clean.path };
  if (remember && clean.token) record.token = clean.token;
  if (!safeSet(local, UPLINK_KEY, JSON.stringify(record))) throw new UplinkError("This browser blocked local storage; the uplink cannot be saved.");
  if (!remember && clean.token) safeSet(session, UPLINK_TOKEN_KEY, clean.token);
  else safeRemove(session, UPLINK_TOKEN_KEY);
  return { ...clean, remember };
}

export function forgetToken(local, session) {
  safeRemove(session, UPLINK_TOKEN_KEY);
  try {
    const saved = JSON.parse(safeGet(local, UPLINK_KEY) || "{}") || {};
    delete saved.token;
    safeSet(local, UPLINK_KEY, JSON.stringify(saved));
  } catch {
    safeRemove(local, UPLINK_KEY);
  }
}

// ---------- Base64 (UTF-8 safe: world names such as "Myrkviðr" are not Latin-1) ----------
export function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

export function decodeBase64(value) {
  const binary = atob(String(value).replace(/\s+/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// ---------- GitHub Contents API ----------
export function contentsUrl(config, withRef = true) {
  const { owner, repo } = parseRepo(config.repo);
  const path = config.path.split("/").map(encodeURIComponent).join("/");
  const ref = withRef ? `?ref=${encodeURIComponent(config.branch)}` : "";
  return `${API_ROOT}/repos/${owner}/${repo}/contents/${path}${ref}`;
}

function headers(config, accept = "application/vnd.github+json") {
  if (!config?.token) throw new UplinkError("No GitHub token configured for the Cloud Uplink.");
  return { Accept: accept, Authorization: `Bearer ${config.token}`, "X-GitHub-Api-Version": API_VERSION };
}

async function describeFailure(response) {
  let detail = "";
  try { detail = (await response.json())?.message || ""; } catch { /* body was not JSON */ }
  const suffix = detail ? ` GitHub says: "${detail}".` : "";
  switch (response.status) {
    case 401: return new UplinkError(`Token rejected (401): it is expired, revoked or mistyped.${suffix}`, 401);
    case 403:
    case 429:
      if (response.headers?.get?.("x-ratelimit-remaining") === "0" || /rate limit/i.test(detail)) {
        return new UplinkError(`GitHub API rate limit reached (${response.status}). Wait a few minutes and retry.${suffix}`, response.status);
      }
      return new UplinkError(`Access forbidden (${response.status}): the token needs "Contents: Read and write" on this repository.${suffix}`, response.status);
    case 404: return new UplinkError(`Not found (404): check the repository, branch and file — or the token cannot see this private repository.${suffix}`, 404);
    case 409: return new UplinkError(`Conflict (409): campaign_data.json changed on GitHub during transmission. Resync and transmit again.${suffix}`, 409);
    case 422: return new UplinkError(`Commit rejected (422).${suffix || " The branch may not exist or the file signature is stale."}`, 422);
    default: return new UplinkError(`GitHub API error ${response.status}.${suffix}`, response.status);
  }
}

export const REQUEST_TIMEOUT_MS = 30000;

async function request(fetchImpl, url, init) {
  let response;
  const signal = typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined;
  try {
    response = await fetchImpl(url, { cache: "no-store", ...(signal ? { signal } : {}), ...init });
  } catch (error) {
    if (error?.name === "TimeoutError") throw new UplinkError(`No reply from api.github.com within ${REQUEST_TIMEOUT_MS / 1000} seconds. Check the connection and retry.`);
    throw new UplinkError(`No astropathic contact with api.github.com (${error.message || "network failure"}). Check the connection.`);
  }
  return response;
}

// Current file on the branch: { sha, text } (text is null for files the API will not inline), or null if missing.
export async function readRemoteFile(config, fetchImpl = fetch) {
  const response = await request(fetchImpl, contentsUrl(config), { headers: headers(config) });
  if (response.status === 404) return null;
  if (!response.ok) throw await describeFailure(response);
  const body = await response.json();
  if (Array.isArray(body) || body.type !== "file") throw new UplinkError(`${config.path} on GitHub is not a file.`);
  let text = null;
  if (body.encoding === "base64" && typeof body.content === "string" && body.content) text = decodeBase64(body.content);
  else if (body.size > 0) text = await readRemoteText(config, fetchImpl);
  return { sha: body.sha, text, size: body.size };
}

// Raw file text straight from the branch (no Pages build lag).
export async function readRemoteText(config, fetchImpl = fetch) {
  const response = await request(fetchImpl, contentsUrl(config), { headers: headers(config, "application/vnd.github.raw+json") });
  if (!response.ok) throw await describeFailure(response);
  return response.text();
}

export async function writeRemoteFile(config, { text, sha, message }, fetchImpl = fetch) {
  const body = { message, content: encodeBase64(text), branch: config.branch };
  if (sha) body.sha = sha;
  const response = await request(fetchImpl, contentsUrl(config, false), {
    method: "PUT",
    headers: { ...headers(config), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await describeFailure(response);
  const result = await response.json();
  return { contentSha: result.content?.sha ?? null, commitSha: result.commit?.sha ?? null, commitUrl: result.commit?.html_url ?? null };
}

// Checks the token can see the repository and reports whether it may push.
export async function verifyUplink(config, fetchImpl = fetch) {
  const { owner, repo } = parseRepo(config.repo);
  const response = await request(fetchImpl, `${API_ROOT}/repos/${owner}/${repo}`, { headers: headers(config) });
  if (!response.ok) throw await describeFailure(response);
  const info = await response.json();
  const file = await readRemoteFile(config, fetchImpl);
  return {
    private: Boolean(info.private),
    canPush: info.permissions ? Boolean(info.permissions.push) : null,
    defaultBranch: info.default_branch || null,
    fileExists: Boolean(file),
    sha: file?.sha ?? null,
  };
}
