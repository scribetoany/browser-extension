# ScribeToAny browser extension

Transcribe videos on X, Twitch, Loom, Google Drive and Dropbox into text and SRT/VTT subtitles with [ScribeToAny](https://scribetoany.com), without leaving the page.

- **One click:** open a video, click the ScribeToAny icon, pick the language (or let it detect it) and transcribe.
- **Right-click:** "Transcribe with ScribeToAny" on a link to a supported video, or on an audio or video file.
- **Get notified:** the extension tells you when the transcript is ready. Copy the text, download SRT or TXT, or open it on scribetoany.com to edit, translate and export to other formats.

Works in Chrome, Edge and Firefox. Uses your ScribeToAny account and its plan; the free plan includes 100 minutes every month.

YouTube, TikTok and Instagram block downloads from servers, so videos from those sites have to be downloaded and uploaded on scribetoany.com instead.

## How it works

- **Sign-in:** OAuth 2.1 with PKCE through the browser's identity window. You approve "Browser extension" on scribetoany.com. Tokens are kept in the extension's local storage, and requests never send your website cookies.
- **API:** the same REST API as the [ScribeToAny CLI](https://github.com/scribetoany/cli) (`https://scribetoany.com/api/v1`).
- **What is sent:** only the link you choose to transcribe and your sign-in tokens, and only to scribetoany.com. The extension does not read pages or track browsing. See the [privacy policy](https://scribetoany.com/privacy).

## Permissions

| Permission | Why |
| --- | --- |
| `activeTab` | Read the address of the current tab when you open the popup |
| `contextMenus` | The right-click "Transcribe with ScribeToAny" item |
| `identity` | The sign-in window |
| `storage` | Your sign-in tokens and the list of transcriptions you started |
| `alarms`, `notifications` | Check unfinished transcriptions and tell you when they are done |
| `https://scribetoany.com/*` | Call the ScribeToAny API |

## Build

No dependencies and no bundler: the files in `src/` ship as written.

```bash
npm run build        # dist/chrome, dist/firefox and store zips
npm run build:local  # point at a dev server on http://localhost:3000
```

Load `dist/chrome` with "Load unpacked" on `chrome://extensions` (Developer mode), or `dist/firefox/manifest.json` from `about:debugging` in Firefox.

## License

MIT
