import { getAccessToken } from './auth.js';
import { BASE_URL } from './config.js';

/** ScribeToAny REST API (/api/v1), the same endpoints the CLI uses. */

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const SIGNED_OUT = 'SIGNED_OUT';

async function request(path, init = {}, retry = true) {
  const token = await getAccessToken();
  if (!token) throw new ApiError(401, SIGNED_OUT, 'Sign in to ScribeToAny.');
  let res;
  try {
    res = await fetch(new URL(`/api/v1${path}`, BASE_URL), {
      ...init,
      credentials: 'omit',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
  } catch {
    throw new ApiError(0, 'NETWORK', "Can't reach scribetoany.com.");
  }
  if (res.status === 401 && retry) {
    // The token may have been revoked or rotated elsewhere: refresh once.
    const fresh = await getAccessToken({ forceRefresh: true });
    if (!fresh) throw new ApiError(401, SIGNED_OUT, 'Sign in to ScribeToAny.');
    return request(path, init, false);
  }
  if (!res.ok) {
    let body = null;
    try {
      body = await res.json();
    } catch {}
    throw new ApiError(
      res.status,
      body?.error?.code ?? 'ERROR',
      body?.error?.message ?? `Request failed (${res.status}).`
    );
  }
  return res;
}

const json = async (path, init) => (await request(path, init)).json();

export const getAccount = () => json('/me');
export const getUsage = () => json('/usage');
export const listTranscriptions = (limit = 5) =>
  json(`/transcriptions?limit=${limit}`);
export const getTranscription = (id) =>
  json(`/transcriptions/${encodeURIComponent(id)}`);

/** Start a link transcription; returns { id, status }. */
export const transcribeLink = (url, { language = 'auto', diarize = false }) =>
  json('/transcriptions', {
    method: 'POST',
    body: JSON.stringify({ url, language, diarize }),
  });

/** The finished transcript as text: txt (with timestamps), srt or vtt. */
export async function getTranscript(id, format) {
  const res = await request(
    `/transcriptions/${encodeURIComponent(id)}/transcript?format=${format}`
  );
  return res.text();
}
