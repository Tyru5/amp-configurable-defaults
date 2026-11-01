import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const session = 'amp-messages-test';
const url = process.argv[2] || 'http://localhost:8765/tests/fixture.html';
function browser(...args) {
  return execFileSync('agent-browser', ['--session', session, ...args], { encoding: 'utf8' }).trim();
}
function evaluate(code) {
  return JSON.parse(browser('--json', 'eval', code)).data.result;
}
function check(code, label) {
  assert.ok(evaluate(code), label);
  console.log(`PASS ${label}`);
}
const dock = '[data-amp-thread-messages-ui="dock"]';
const toggle = '[data-amp-thread-messages-ui="toggle"]';
const panel = '[data-amp-thread-messages-ui="panel"]';
const list = '[data-amp-thread-messages-list]';
const back = '[data-amp-thread-messages-back]';
const view = `document.querySelector('${dock}').dataset.view`;
// The slide between list and message animates; wait until the view has settled in place.
const settled = name => `${view} === '${name}' && Math.abs(document.querySelector('[data-amp-thread-messages-view="${name}"]').getBoundingClientRect().left - document.querySelector('${panel}').getBoundingClientRect().left) < 1`;
const setup = String.raw`(() => {
  const parent = 'T-01a190c3-2e10-74ac-8a09-c7b0bcdbf598';
  const child = 'T-01a19424-b624-7647-883f-6a0ccb73b0dc';
  const incoming = { role: 'user', messageId: 'received', meta: { fromExecutorThreadID: parent }, content: [
    { type: 'text', text: 'Please test the worktree instances with the real bridge. Report failures and attach evidence. <script>window.untrustedMessageRan = true</script>' },
    { type: 'text', text: 'PRIVATE HIDDEN METADATA', hidden: true },
  ] };
  const send = (id, thread) => ({ role: 'assistant', messageId: id, state: { type: 'complete' }, content: [
    { type: 'tool_use', id, name: 'send_thread_message', input: { thread,
      message: 'Restart now keeps the signed-in window open. The bridge shuts down cleanly.\n\nRegression checks pass. Windows and Linux remain untested.', media_paths: ['evidence.png'] } },
  ] });
  const result = (id, run) => ({ role: 'user', messageId: id + '-result', content: [{ type: 'tool_result', toolUseID: id, run }] });
  window.messageFixture = { parent, child, result };
  fixtureThreadData['fixture-a'].transcriptPage.messages = [incoming,
    { role: 'user', messageId: 'human', content: [{ type: 'text', text: 'This human message mentions send_thread_message and ' + child }] },
    { ...incoming, messageId: 'nested', parentToolUseId: 'subagent' },
    { ...incoming, messageId: 'puck', meta: { fromExecutorThreadID: parent, fromPuck: true } },
    send('failed', child), send('sent', 'https://ampcode.com/threads/' + parent), send('pending', parent),
    result('sent', { status: 'done', result: { threadID: parent } }),
    result('failed', { status: 'error', error: 'File too large to upload. The message was not sent.' }),
  ];
  for (const message of fixtureThreadData['fixture-a'].transcriptPage.messages) {
    const row = document.createElement('div');
    row.dataset.transcriptMessageLookupId = message.messageId;
    row.textContent = 'Native transcript entry: ' + message.messageId;
    document.querySelector('#fixture-transcript').append(row);
  }
})()`;

try {
  browser('open', url);
  browser('set', 'viewport', '1280', '800', '2');
  browser('eval', 'localStorage.clear(); location.reload()');
  browser('wait', toggle);
  browser('eval', setup);
  const before = evaluate('fixtureThreadRequests.length');
  check(`document.querySelector('${panel}').hidden && ${view} === 'collapsed' && !document.querySelector('.app-title-bar [data-amp-thread-messages-ui]')`, 'starts as a collapsed tab without fetching message content');
  check(`(() => { const d = document.querySelector('${dock}').getBoundingClientRect(), p = document.querySelector('.thread-layout-panes').getBoundingClientRect();
    return Math.abs(d.left - p.left - 12) < 1 && Math.abs(p.bottom - d.bottom - 12) < 1 && d.width < 200 && d.height < 56; })()`, 'the tab is docked in the workspace bottom-left corner');
  browser('click', toggle);
  browser('wait', '--fn', `document.querySelectorAll('${list} > button').length === 4`);
  check(`fixtureThreadRequests.length === ${before + 1} && ${view} === 'list'`, 'opening reads only the current thread page and shows the conversation list');
  check(`document.querySelector('${toggle}').textContent.includes('4') && document.querySelector('[data-amp-thread-messages-view="message"]').inert`, 'the tab counts loaded messages and the message view is inert behind the list');
  if (process.env.CAPTURE_DIR) browser('screenshot', process.env.CAPTURE_DIR + '/thread-messages-list.png');
  browser('click', `${list} > button:first-child`);
  browser('wait', '--fn', `${settled('message')} && document.activeElement.matches('${back}')`);
  check(`document.querySelector('[data-amp-thread-messages-view="list"]').inert && !document.querySelector('${panel} section').inert`, 'choosing an entry transitions to its message and moves focus to the back control');
  check(`document.querySelector('${panel} section').textContent.includes('Incoming · Received') && !document.querySelector('${panel}').textContent.includes('PRIVATE HIDDEN METADATA')`, 'incoming source metadata excludes human, Puck, nested, and hidden content');
  check(`document.querySelector('${panel} a').href === 'https://ampcode.com/threads/' + messageFixture.parent`, 'incoming link identifies the parent thread');
  check(`!document.querySelector('[data-amp-thread-messages-body] script') && !window.untrustedMessageRan && document.querySelector('[data-amp-thread-messages-body]').textContent.includes('<script>')`, 'message text is rendered without interpreting HTML');
  if (process.env.CAPTURE_DIR) browser('screenshot', process.env.CAPTURE_DIR + '/thread-messages-incoming.png');
  browser('click', back);
  browser('wait', '--fn', settled('list'));
  check(`document.activeElement.matches('${list} > button:first-child') && document.activeElement.getAttribute('aria-pressed') === 'true'`, 'back returns to the list with the read entry focused and marked');
  browser('click', `${list} > button:nth-child(2)`);
  browser('wait', '--fn', settled('message'));
  check(`document.querySelector('${panel} section').textContent.includes('Outgoing · Failed') && document.querySelector('[data-amp-thread-messages-error]').textContent.includes('not sent')`, 'a complete assistant call with a failed result is not marked sent');
  if (process.env.CAPTURE_DIR) browser('screenshot', process.env.CAPTURE_DIR + '/thread-messages-failed.png');
  browser('click', back);
  browser('wait', '--fn', settled('list'));
  browser('click', `${list} > button:nth-child(3)`);
  browser('wait', '--fn', settled('message'));
  check(`document.querySelector('${panel} section').textContent.includes('Outgoing · Sent') && document.querySelector('[data-amp-thread-messages-error]').hidden && document.querySelector('${panel} section').textContent.includes('1 attachment')`, 'identical message text remains separate and success follows its own tool ID');
  browser('click', back);
  browser('wait', '--fn', settled('list'));
  browser('click', `${list} > button:nth-child(4)`);
  browser('wait', '--fn', settled('message'));
  check(`document.querySelector('${panel} section').textContent.includes('Outgoing · Pending')`, 'missing delivery result remains pending');
  browser('eval', `fixtureThreadData['fixture-a'].transcriptPage.messages = [messageFixture.result('pending', {status:'done'})]`);
  browser('wait', '--fn', `document.querySelector('${panel} section').textContent.includes('Outgoing · Sent')`);
  check(`document.querySelectorAll('${list} > button').length === 4`, 'late results update cached calls after they leave the data page');
  browser('press', 'Escape');
  check(`document.querySelector('${panel}').hidden && ${view} === 'collapsed' && document.activeElement.matches('${toggle}')`, 'Escape collapses the dock and restores keyboard focus');
  browser('eval', `chrome.storage.local.set({right:false})`);
  browser('click', toggle);
  browser('wait', '--fn', settled('message'));
  check(`(() => { const d = document.querySelector('${dock}').getBoundingClientRect(), p = document.querySelector('.thread-layout-panes').getBoundingClientRect();
    return Math.abs(d.left - p.left - 12) < 1 && Math.abs(p.bottom - d.bottom - 12) < 1 && d.right <= p.right; })()`, 'reopening resumes the message being read and the dock stays bottom-left with either sidebar side');
  browser('click', back);
  browser('wait', '--fn', settled('list'));
  browser('click', `${list} > button:first-child`);
  browser('wait', '--fn', settled('message'));
  browser('find', 'role', 'button', 'click', '--name', 'View original', '--exact');
  check(`document.activeElement.dataset.transcriptMessageLookupId === 'received' && document.querySelector('${panel}').hidden`, 'View original focuses the native entry without hiding or moving its content');
  browser('eval', `chrome.storage.local.set({threadMessagesPanel:false})`);
  browser('wait', '--fn', `!document.querySelector('${dock}')`);
  check(`document.querySelectorAll('[data-transcript-message-lookup-id]').length === 9`, 'opt-out removes only the extension dock');
  browser('eval', `chrome.storage.local.set({threadMessagesPanel:true})`);
  browser('wait', toggle);
  check(`document.querySelector('${panel}').hidden`, 're-enabling starts collapsed');
  browser('eval', `document.querySelector('[data-thread-id]').dataset.threadId = 'fixture-b'`);
  browser('wait', '--fn', `${view} === 'collapsed'`);
  browser('click', toggle);
  browser('wait', '--fn', `document.querySelector('${panel}').textContent.includes('No thread messages')`);
  check(`!document.querySelector('${panel}').textContent.includes('Regression checks') && ${view} === 'list' && document.querySelector('[data-amp-thread-messages-count]').hidden`, 'navigation clears cached thread message content and the count');
  if (process.env.CAPTURE_DIR) browser('screenshot', process.env.CAPTURE_DIR + '/thread-messages-empty.png');
  browser('eval', `document.querySelector('[data-thread-id]').dataset.threadId = 'fixture-missing'`);
  browser('wait', '--fn', `${view} === 'collapsed'`);
  browser('click', toggle);
  browser('wait', '--fn', `document.querySelector('${panel}').textContent.includes('Could not refresh')`);
  check(`document.querySelector('${panel} section').hidden`, 'failed page load does not show stale messages');
  browser('set', 'viewport', '767', '800', '2');
  browser('wait', '--fn', `!document.querySelector('${dock}')`);
  browser('set', 'viewport', '768', '800', '2');
  browser('wait', toggle);
  check(`document.querySelector('${panel}').hidden`, 'mobile remains native and the desktop boundary restores a collapsed tab');
  check(`Object.keys(JSON.parse(localStorage.getItem('extension-settings'))).every(key => ['right','threadMessagesPanel'].includes(key))`, 'only preferences are persisted, never thread content');
  browser('eval', `(() => {
    document.querySelector('[data-thread-id]').dataset.threadId = 'fixture-a';
    fixtureThreadData['fixture-a'].transcriptPage.messages = [];
    window.pollRequests = [];
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      pollRequests.push(performance.now());
      await new Promise(resolve => setTimeout(resolve, 100));
      return originalFetch(...args);
    };
  })()`);
  browser('wait', toggle);
  browser('click', toggle);
  assert.ok(evaluate(`new Promise(resolve => setTimeout(() => resolve(pollRequests.length >= 3), 13000))`),
    'an idle open dock refreshes every five seconds despite response latency');
  console.log('PASS an idle open dock refreshes every five seconds despite response latency');
  console.log('All thread message checks passed.');
} finally {
  browser('close');
}
