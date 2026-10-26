# Store listing (Chrome Web Store, Edge Add-ons, Firefox Add-ons)

Packages: `npm run build` → `dist/scribetoany-chrome-<version>.zip` (Chrome and Edge) and `dist/scribetoany-firefox-<version>.zip` (Firefox).
Images: `store/screenshot-1.png`, `store/screenshot-2.png` (1280×800), `store/promo-tile-440x280.png`, icon `src/icons/icon-128.png`.

## Basics

- **Name:** ScribeToAny: Transcribe Video & Audio
- **Summary (≤132 chars, from the manifest):** Transcribe videos on X, Twitch, Loom, Google Drive and Dropbox into text and SRT/VTT subtitles with ScribeToAny.
- **Category:** Productivity (Chrome: "Productivity → Tools"; Edge: "Productivity"; Firefox: "Other" or "Productivity")
- **Language:** English
- **Website:** https://scribetoany.com/developers
- **Support:** https://scribetoany.com/contact (support@resend.scribetoany.com)
- **Privacy policy:** https://scribetoany.com/privacy
- **Source code:** https://github.com/scribetoany/browser-extension (MIT)
- **Price:** free (uses the user's ScribeToAny plan; the free plan has 100 minutes every month)

## Description

Transcribe the video you're watching into text and subtitles, without downloading anything.

ScribeToAny turns videos on X (Twitter), Twitch, Loom, Google Drive and Dropbox, and links to audio or video files, into accurate transcripts with timestamps. It detects about 98 languages automatically and can label speakers.

How it works
• Open a video and click the ScribeToAny icon, or right-click a link and choose "Transcribe with ScribeToAny".
• Pick the language, or let ScribeToAny detect it.
• Get a notification when the transcript is ready. Copy the text, download SRT or TXT, or open it on scribetoany.com to edit it, translate it into 134+ languages with the timings kept, and export to VTT, DOCX, PDF and more.

What you need
• A ScribeToAny account. Sign up for free in the sign-in window: 100 minutes every month, no card.
• Transcriptions count toward your plan, the same as on the website.

Good to know
• YouTube, TikTok and Instagram block downloads from servers. For those, download the video and upload the file on scribetoany.com.
• Google Drive and Dropbox files need a link that anyone can open.

Privacy
• The extension sends only the link you choose to transcribe, and only to scribetoany.com.
• It doesn't read the pages you visit or track your browsing.
• Uploaded media is deleted after transcription, and ScribeToAny never trains AI on your files.
• Open source: https://github.com/scribetoany/browser-extension

## Chrome Web Store: privacy practices tab

**Single purpose:** Transcribe the video or audio at a link the user chooses (the current tab or a right-clicked link) with the user's ScribeToAny account, and show the resulting transcript.

**Permission justifications:**
- `activeTab`: read the address and title of the current tab when the user opens the popup, to offer "Transcribe this video" for supported sites.
- `contextMenus`: add "Transcribe with ScribeToAny" to the right-click menu on supported links and media.
- `identity`: open the ScribeToAny sign-in window (OAuth 2.1 with PKCE) and receive the authorization code.
- `storage`: keep the sign-in tokens and the list of transcriptions the user started, on this device.
- `alarms`: check unfinished transcriptions every 30 seconds until they finish.
- `notifications`: tell the user when a transcription is done or failed.
- Host permission `https://scribetoany.com/*`: call the ScribeToAny API (sign-in, start a transcription, read its status and transcript).

**Remote code:** No. All code is in the package; the extension only calls the ScribeToAny REST API.

**Data usage (suggested ticks, confirm when filling the form):**
- Authentication information: yes (OAuth tokens for the user's ScribeToAny account, stored locally and sent only to scribetoany.com).
- Website content / web history: the URL of the page or link the user chooses to transcribe is sent to scribetoany.com, only when they click. Tick "Website content" if the form treats that as such; nothing is collected in the background.
- Certify: not sold to third parties; not used for unrelated purposes; not used for creditworthiness or lending.

## Firefox (AMO)

- Add-on ID: `browser-extension@scribetoany.com`, minimum Firefox 140 (needed for `data_collection_permissions`).
- Data collection declared in the manifest: `authenticationInfo`, `browsingActivity` (the chosen link).
- Source code: not minified or bundled, so no separate source upload should be needed.
- Firefox asks for access to scribetoany.com the first time you click "Sign in".

## Edge Add-ons

Upload the same Chrome zip. The extension registers whatever `identity.getRedirectURL()` returns in Edge, so no server change is needed; test sign-in once in Edge before submitting.

## After publishing

- Add the store links to https://scribetoany.com/developers.
- Check the listing page's link to scribetoany.com (rel) and record it in the backlink ledger.
