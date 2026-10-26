/**
 * Which pages the extension can transcribe. Mirrors the server's link import
 * (scribetoany.com): X, Twitch, Loom, Google Drive and Dropbox share links and
 * direct media files work; YouTube, TikTok and Instagram block downloads from
 * servers, so those videos have to be downloaded and uploaded instead.
 */

const MEDIA_EXTENSIONS =
  /\.(mp3|m4a|wav|aac|ogg|oga|opus|flac|wma|mp4|m4v|mov|webm|mkv|avi|mpeg|mpg|3gp)$/i;

const hostIs = (host, domains) =>
  domains.some((d) => host === d || host.endsWith(`.${d}`));

const SUPPORTED = [
  {
    name: 'X',
    domains: ['x.com', 'twitter.com'],
    path: /\/status\/\d+/,
  },
  {
    name: 'Twitch',
    domains: ['twitch.tv'],
    path: /^\/(videos\/\d+|[^/]+\/(clip|video)\/|[^/]+\/v\/)/,
    host: (h) => h === 'clips.twitch.tv',
  },
  { name: 'Loom', domains: ['loom.com'], path: /^\/(share|embed)\// },
  {
    name: 'Google Drive',
    domains: ['drive.google.com'],
    path: /^\/file\/d\/|^\/open/,
  },
  { name: 'Dropbox', domains: ['dropbox.com'], path: /^\/(s|scl\/fi)\// },
];

const BLOCKED = [
  { name: 'YouTube', domains: ['youtube.com', 'youtu.be'] },
  { name: 'TikTok', domains: ['tiktok.com'] },
  { name: 'Instagram', domains: ['instagram.com'] },
];

/**
 * { kind: 'supported', platform } | { kind: 'blocked', platform } |
 * { kind: 'media' } | { kind: 'none' }
 */
export function classifyLink(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return { kind: 'none' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { kind: 'none' };
  }
  const host = url.hostname.toLowerCase();
  for (const p of BLOCKED) {
    if (hostIs(host, p.domains)) return { kind: 'blocked', platform: p.name };
  }
  for (const p of SUPPORTED) {
    if (p.host?.(host) || (hostIs(host, p.domains) && p.path.test(url.pathname))) {
      return { kind: 'supported', platform: p.name };
    }
  }
  if (MEDIA_EXTENSIONS.test(url.pathname)) return { kind: 'media' };
  return { kind: 'none' };
}

export const canTranscribe = (value) => {
  const { kind } = classifyLink(value);
  return kind === 'supported' || kind === 'media';
};
