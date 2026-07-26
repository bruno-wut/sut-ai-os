const BASIC_AUTH_REALM = 'Sri U-Thong Staging';
const STAGING_ROBOTS_HEADER = "noindex, nofollow, noarchive, nosnippet";

export interface StagingPreviewEnv {
  STAGING_PREVIEW_ENABLED?: string;
  STAGING_PREVIEW_HOSTNAME?: string;
  STAGING_PREVIEW_PASSWORD?: string;
  STAGING_PREVIEW_USERNAME?: string;
}

function isEnabled(value?: string) {
  return value === "1" || value === "true";
}

function normalizeHostname(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}

function encodeBase64(value: string) {
  if (typeof btoa === "function") {
    return btoa(value);
  }

  return Buffer.from(value, "utf8").toString("base64");
}

export function shouldProtectStagingHost(request: Request, env: StagingPreviewEnv) {
  if (!isEnabled(env.STAGING_PREVIEW_ENABLED)) {
    return false;
  }

  const configuredHostname = normalizeHostname(env.STAGING_PREVIEW_HOSTNAME);

  if (!configuredHostname) {
    return false;
  }

  return normalizeHostname(new URL(request.url).hostname) === configuredHostname;
}

function timingSafeEqualString(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  if (aBytes.byteLength !== bBytes.byteLength) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < aBytes.byteLength; i += 1) {
    mismatch |= aBytes[i]! ^ bBytes[i]!;
  }
  return mismatch === 0;
}

export function isAuthorizedStagingRequest(request: Request, env: StagingPreviewEnv) {
  const username = env.STAGING_PREVIEW_USERNAME?.trim();
  const password = env.STAGING_PREVIEW_PASSWORD?.trim();

  if (!username || !password) {
    return false;
  }

  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    return false;
  }

  const expectedHeader = `Basic ${encodeBase64(`${username}:${password}`)}`;
  return timingSafeEqualString(authHeader, expectedHeader);
}

export function buildStagingAuthChallenge() {
  return new Response("Authentication required.", {
    status: 401,
    headers: {
      "cache-control": "no-store",
      "www-authenticate": `Basic realm="${BASIC_AUTH_REALM}"`,
      "x-robots-tag": STAGING_ROBOTS_HEADER,
    },
  });
}

export function applyStagingRobotsHeader(response: Response) {
  response.headers.set("x-robots-tag", STAGING_ROBOTS_HEADER);
  return response;
}
