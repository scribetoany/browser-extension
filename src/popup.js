import {
  ApiError,
  SIGNED_OUT,
  getAccount,
  getTranscript,
  getTranscription,
  getUsage,
  listTranscriptions,
} from './lib/api.js';
import { isSignedIn } from './lib/auth.js';
import { BASE_URL, ext, siteUrl } from './lib/config.js';
import { isFinished, loadJobs, updateJob } from './lib/jobs.js';
import { classifyLink } from './lib/links.js';

const LANGUAGES = [
  ['auto', 'Detect language'],
  ['en', 'English'],
  ['zh', 'Chinese'],
  ['es', 'Spanish'],
  ['fr', 'French'],
  ['de', 'German'],
  ['ja', 'Japanese'],
  ['ko', 'Korean'],
  ['pt', 'Portuguese'],
  ['ru', 'Russian'],
  ['it', 'Italian'],
  ['ar', 'Arabic'],
  ['hi', 'Hindi'],
  ['id', 'Indonesian'],
  ['vi', 'Vietnamese'],
  ['th', 'Thai'],
  ['tr', 'Turkish'],
  ['nl', 'Dutch'],
  ['pl', 'Polish'],
  ['uk', 'Ukrainian'],
];

const STATUS_LABEL = {
  queued: 'Queued',
  transcribing: 'Transcribing',
  done: 'Done',
  failed: 'Failed',
};

const app = document.getElementById('app');
const errorBox = document.getElementById('error');
const signOutButton = document.getElementById('sign-out');
let pollTimer = null;

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const child of [children].flat()) {
    node.append(child instanceof Node ? child : document.createTextNode(child));
  }
  return node;
}

function showError(message) {
  errorBox.textContent = message ?? '';
  errorBox.hidden = !message;
}

function handleError(error) {
  if (error instanceof ApiError && error.code === SIGNED_OUT) {
    renderSignedOut();
    return;
  }
  showError(error?.message ?? 'Something went wrong.');
}

const send = (message) => ext.runtime.sendMessage(message);

const fromTemplate = (id) =>
  document.getElementById(id).content.cloneNode(true);

/** Firefox asks the user to grant host access; Chrome grants it at install. */
async function ensureHostPermission() {
  const origins = [`${BASE_URL}/*`];
  if (await ext.permissions.contains({ origins })) return true;
  return ext.permissions.request({ origins });
}

function renderSignedOut() {
  clearInterval(pollTimer);
  signOutButton.hidden = true;
  app.replaceChildren(fromTemplate('signed-out'));
  const button = document.getElementById('sign-in');
  button.addEventListener('click', async () => {
    showError(null);
    // Must run in this click handler (a user gesture).
    if (!(await ensureHostPermission())) {
      showError('ScribeToAny needs access to scribetoany.com to sign in.');
      return;
    }
    button.disabled = true;
    button.textContent = 'Waiting for the sign-in window…';
    const result = await send({ type: 'signIn' });
    if (result?.ok) {
      renderSignedIn();
    } else {
      button.disabled = false;
      button.textContent = 'Sign in to ScribeToAny';
      showError(result?.error);
    }
  });
}

async function currentTab() {
  const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function renderPage(section, tab) {
  const link = classifyLink(tab?.url ?? '');
  if (link.kind === 'blocked') {
    section.replaceChildren(
      el('p', {}, [
        `${link.platform} blocks downloads from servers, so ScribeToAny can't fetch this video. Download it and upload the file instead.`,
      ]),
      el('a', {
        href: siteUrl('/dashboard'),
        target: '_blank',
        textContent: 'Upload a file',
      })
    );
    return;
  }
  if (link.kind === 'none') {
    section.replaceChildren(
      el('p', { className: 'muted' }, [
        'Open a video on X, Twitch, Loom, Google Drive or Dropbox, or right-click a link to one, to transcribe it.',
      ]),
      el('a', {
        href: siteUrl('/dashboard'),
        target: '_blank',
        textContent: 'Upload a file instead',
      })
    );
    return;
  }

  const select = el(
    'select',
    { id: 'language', title: 'Spoken language' },
    LANGUAGES.map(([value, label]) => el('option', { value }, [label]))
  );
  const speakers = el('input', { type: 'checkbox', id: 'speakers' });
  const button = el('button', { className: 'primary' }, [
    'Transcribe this video',
  ]);
  button.addEventListener('click', async () => {
    showError(null);
    button.disabled = true;
    button.textContent = 'Starting…';
    const result = await send({
      type: 'transcribe',
      url: tab.url,
      options: { language: select.value, diarize: speakers.checked },
    });
    button.disabled = false;
    button.textContent = 'Transcribe this video';
    if (!result?.ok) {
      if (result?.code === SIGNED_OUT) renderSignedOut();
      else showError(result?.error);
      return;
    }
    renderActive();
  });

  section.replaceChildren(
    el('div', { className: 'page-title', title: tab.title ?? '' }, [
      tab.title || tab.url,
    ]),
    el('p', { className: 'muted small' }, [
      link.kind === 'media' ? 'Audio or video file' : link.platform,
    ]),
    el('div', { className: 'row' }, [select]),
    el('label', { className: 'check' }, [speakers, 'Label speakers']),
    button
  );
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = el('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const baseName = (name) =>
  (name || 'transcript').replace(/\.[a-z0-9]{2,4}$/i, '').slice(0, 80);

/** The newest transcription started from the extension, with live status. */
async function renderActive() {
  const section = document.getElementById('active');
  if (!section) return;
  const [job] = await loadJobs();
  if (!job) {
    section.hidden = true;
    return;
  }
  section.hidden = false;

  let current = job;
  try {
    current = { ...job, ...(await getTranscription(job.id)) };
    if (current.status !== job.status) {
      await updateJob(job.id, {
        status: current.status,
        name: current.name,
        url: current.url,
        error: current.error,
      });
    }
  } catch (error) {
    if (error instanceof ApiError && error.code === SIGNED_OUT) {
      renderSignedOut();
      return;
    }
  }

  const name = current.name || current.sourceUrl;
  if (!isFinished(current.status)) {
    section.replaceChildren(
      el('div', { className: 'page-title', title: name }, [name]),
      el('p', { className: 'muted' }, [
        el('span', { className: 'spinner' }),
        `${STATUS_LABEL[current.status] ?? current.status}… you can close this popup; you'll get a notification.`,
      ])
    );
    clearInterval(pollTimer);
    pollTimer = setInterval(renderActive, 4000);
    return;
  }
  clearInterval(pollTimer);

  if (current.status === 'failed') {
    section.replaceChildren(
      el('div', { className: 'page-title', title: name }, [name]),
      el('p', { className: 'error' }, [
        current.error || 'The transcription failed.',
      ])
    );
    return;
  }

  const action = (label, run) => {
    const b = el('button', { className: 'secondary' }, [label]);
    b.addEventListener('click', async () => {
      showError(null);
      try {
        await run(b);
      } catch (error) {
        handleError(error);
      }
    });
    return b;
  };
  section.replaceChildren(
    el('div', { className: 'page-title', title: name }, [name]),
    current.planLimit
      ? el('p', { className: 'small muted' }, [current.planLimit.message])
      : el('p', { className: 'status done' }, ['Transcript ready']),
    el('div', { className: 'actions' }, [
      action('Open', () => ext.tabs.create({ url: current.url })),
      action('Copy text', async (b) => {
        await navigator.clipboard.writeText(
          await getTranscript(current.id, 'txt')
        );
        b.textContent = 'Copied';
      }),
      action('SRT', async () =>
        download(
          `${baseName(current.name)}.srt`,
          await getTranscript(current.id, 'srt'),
          'application/x-subrip'
        )
      ),
      action('TXT', async () =>
        download(
          `${baseName(current.name)}.txt`,
          await getTranscript(current.id, 'txt'),
          'text/plain'
        )
      ),
    ])
  );
}

async function renderRecent() {
  const list = document.getElementById('recent');
  const { transcriptions } = await listTranscriptions(5);
  if (!transcriptions.length) {
    list.replaceChildren(el('li', { className: 'muted small' }, ['None yet.']));
    return;
  }
  list.replaceChildren(
    ...transcriptions.map((t) =>
      el('li', {}, [
        el('a', { href: t.url, target: '_blank', title: t.name }, [t.name]),
        el('span', { className: `status ${t.status}` }, [
          STATUS_LABEL[t.status] ?? t.status,
        ]),
      ])
    )
  );
}

function usageText(usage) {
  if (usage.minutesPerMonth == null) return `${usage.plan} plan`;
  const left = Math.max(
    0,
    Math.round(usage.minutesPerMonth - usage.minutesUsedThisMonth)
  );
  const pack = usage.extraPackMinutes
    ? ` + ${Math.round(usage.extraPackMinutes)} pack minutes`
    : '';
  return `${left} of ${usage.minutesPerMonth} minutes left this month${pack}`;
}

async function renderSignedIn() {
  showError(null);
  signOutButton.hidden = false;
  app.replaceChildren(fromTemplate('signed-in'));
  document.getElementById('dashboard').href = siteUrl('/dashboard');
  renderPage(document.getElementById('page'), await currentTab());
  try {
    const [account, usage] = await Promise.all([getAccount(), getUsage()]);
    document.getElementById('account').textContent = [
      account.email,
      usageText(usage),
    ]
      .filter(Boolean)
      .join(' · ');
    await Promise.all([renderActive(), renderRecent()]);
  } catch (error) {
    handleError(error);
  }
}

signOutButton.addEventListener('click', async () => {
  await send({ type: 'signOut' });
  renderSignedOut();
});

(async () => {
  if (await isSignedIn()) await renderSignedIn();
  else renderSignedOut();
})();
