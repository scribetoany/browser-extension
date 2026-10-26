import {
  ApiError,
  SIGNED_OUT,
  getTranscription,
  transcribeLink,
} from './lib/api.js';
import { AuthError, signIn, signOut } from './lib/auth.js';
import { ext, siteUrl } from './lib/config.js';
import { addJob, isFinished, loadJobs, updateJob } from './lib/jobs.js';
import { canTranscribe, classifyLink } from './lib/links.js';

/**
 * Background worker: the right-click menu, sign-in (the popup closes when the
 * sign-in window opens, so the flow runs here) and checking unfinished
 * transcriptions so the user gets a notification when one is done.
 */

const MENU_ID = 'transcribe';
const POLL_ALARM = 'poll';
const POLL_MINUTES = 0.5;

// Link patterns the right-click menu appears on (see lib/links.js).
const LINK_PATTERNS = [
  '*://*.x.com/*/status/*',
  '*://x.com/*/status/*',
  '*://*.twitter.com/*/status/*',
  '*://twitter.com/*/status/*',
  '*://*.twitch.tv/*',
  '*://twitch.tv/*',
  '*://*.loom.com/share/*',
  '*://loom.com/share/*',
  '*://drive.google.com/file/*',
  '*://*.dropbox.com/*',
  '*://dropbox.com/*',
];

ext.runtime.onInstalled.addListener(async () => {
  await ext.contextMenus.removeAll();
  ext.contextMenus.create({
    id: MENU_ID,
    title: 'Transcribe with ScribeToAny',
    contexts: ['link', 'video', 'audio'],
    targetUrlPatterns: LINK_PATTERNS,
  });
  ext.contextMenus.create({
    id: `${MENU_ID}-page`,
    title: 'Transcribe this video with ScribeToAny',
    contexts: ['page'],
    documentUrlPatterns: LINK_PATTERNS,
  });
});

function notify(id, title, message) {
  ext.notifications.create(id, {
    type: 'basic',
    iconUrl: ext.runtime.getURL('icons/icon-128.png'),
    title,
    message,
  });
}

/** Start a transcription and remember it for polling. */
async function startTranscription(url, options = {}) {
  const job = await transcribeLink(url, options);
  await addJob({ id: job.id, status: job.status, sourceUrl: url });
  ext.alarms.create(POLL_ALARM, { periodInMinutes: POLL_MINUTES });
  return job;
}

ext.contextMenus.onClicked.addListener(async (info) => {
  const url =
    info.menuItemId === `${MENU_ID}-page`
      ? info.pageUrl
      : info.linkUrl || info.srcUrl;
  if (!url || !canTranscribe(url)) {
    const { kind, platform } = classifyLink(url ?? '');
    notify(
      'unsupported',
      "Can't transcribe this link",
      kind === 'blocked'
        ? `${platform} doesn't allow downloads from servers. Download the video and upload it on scribetoany.com.`
        : 'Works with X, Twitch, Loom, Google Drive and Dropbox links, or a direct link to an audio or video file.'
    );
    return;
  }
  try {
    await startTranscription(url);
    notify(
      'started',
      'Transcription started',
      "You'll get a notification when the transcript is ready."
    );
  } catch (error) {
    notify(
      'failed-start',
      "Couldn't start the transcription",
      error instanceof ApiError && error.code === SIGNED_OUT
        ? 'Click the ScribeToAny icon in the toolbar to sign in first.'
        : error.message
    );
  }
});

async function pollJobs() {
  const pending = (await loadJobs()).filter((j) => !isFinished(j.status));
  if (!pending.length) {
    ext.alarms.clear(POLL_ALARM);
    return;
  }
  for (const job of pending) {
    let current;
    try {
      current = await getTranscription(job.id);
    } catch (error) {
      if (error instanceof ApiError && error.code === SIGNED_OUT) return;
      if (error instanceof ApiError && error.status === 404) {
        await updateJob(job.id, { status: 'failed', error: 'Not found' });
      }
      continue;
    }
    if (!isFinished(current.status)) continue;
    await updateJob(job.id, {
      status: current.status,
      name: current.name,
      url: current.url,
      error: current.error,
    });
    notify(
      `job:${job.id}`,
      current.status === 'done' ? 'Transcript ready' : 'Transcription failed',
      current.status === 'done'
        ? `${current.name} is ready. Click to open it.`
        : current.error || 'Open ScribeToAny for details.'
    );
  }
}

ext.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POLL_ALARM) pollJobs();
});

ext.notifications.onClicked.addListener(async (id) => {
  if (!id.startsWith('job:')) return;
  const job = (await loadJobs()).find((j) => j.id === id.slice(4));
  ext.tabs.create({ url: job?.url ?? siteUrl('/dashboard') });
  ext.notifications.clear(id);
});

// Messages from the popup.
ext.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const run = async () => {
    switch (message?.type) {
      case 'signIn':
        await signIn();
        // The popup closed when the sign-in window opened: bring it back.
        // openPopup needs Chrome 127+ and a focused window; ignore failures.
        try {
          await ext.action.openPopup?.();
        } catch {
          // no focused window, or not supported
        }
        return { ok: true };
      case 'signOut':
        await signOut();
        return { ok: true };
      case 'transcribe':
        return {
          ok: true,
          job: await startTranscription(message.url, message.options),
        };
      default:
        return { ok: false, error: 'Unknown message' };
    }
  };
  run()
    .then(sendResponse)
    .catch((error) =>
      sendResponse({
        ok: false,
        error:
          error instanceof AuthError || error instanceof ApiError
            ? error.message
            : 'Something went wrong. Please try again.',
        code: error instanceof ApiError ? error.code : null,
      })
    );
  return true;
});
