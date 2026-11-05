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
const toggle = '[data-amp-thread-messages-ui="toggle"]';
const panel = '[data-amp-thread-messages-ui="panel"]';
const list = '[data-amp-thread-messages-list]';
const back = '[data-amp-thread-messages-back]';
const track = '[data-amp-thread-messages-track]';
const view = `document.querySelector('${panel}').dataset.view`;
const open = `document.querySelector('${panel}').matches(':popover-open')`;
// The slide between list and message animates; wait until the view has settled in place.
const settled = name => `${view} === '${name}' && Math.abs(document.querySelector('[data-amp-thread-messages-view="${name}"]').getBoundingClientRect().left - document.querySelector('${panel}').getBoundingClientRect().left - document.querySelector('${panel}').clientLeft) < 1`;
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
  const messages = [incoming,
    { role: 'user', messageId: 'human', content: [{ type: 'text', text: 'This human message mentions send_thread_message and ' + child }] },
    { ...incoming, messageId: 'nested', parentToolUseId: 'subagent' },
    { ...incoming, messageId: 'puck', meta: { fromExecutorThreadID: parent, fromPuck: true } },
    send('failed', child), send('sent', 'https://ampcode.com/threads/' + parent), send('pending', parent),
    result('sent', { status: 'done', result: { threadID: parent } }),
    result('failed', { status: 'error', error: 'File too large to upload. The message was not sent.' }),
  ];
  window.messageFixture = { parent, child, result, messages };
  fixtureThreadData['fixture-a'].transcriptPage.messages = messages;
  // The parent is readable and named; the child stays unreadable, so it keeps its ID.
  fixtureThreadData[parent] = { type: 'result', transcriptPage: { messages: [] }, thread: { id: parent, title: '  Release preparation  ' } };
  for (const message of messages) {
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
  browser('wait', '--fn', `document.querySelector('${toggle}') && fixtureThreadRequests.length > 0`);
  check(`document.querySelector('${toggle}').hidden && !document.querySelector('${toggle}').checkVisibility()`, 'a thread without messages to other threads shows no control');
  browser('eval', setup);
  browser('wait', '--fn', `document.querySelector('${toggle}').checkVisibility()`);
  check(`!${open} && !document.querySelector('.app-title-bar [data-amp-thread-messages-ui]')`, 'the control appears closed once the thread has messages');
  check(`(() => { const t = document.querySelector('${toggle}'), r = t.getBoundingClientRect();
    return t.parentElement.matches('[data-message-composer-root] [role="region"][aria-label="Attachments"]') && !t.nextElementSibling && r.width < 60 && r.height <= 24; })()`, 'the control is a small item at the end of the composer toolbar');
  if (process.env.CAPTURE_DIR) {
    browser('eval', `document.querySelector('[data-message-composer-root]').scrollIntoView({ block: 'end' })`);
    browser('screenshot', process.env.CAPTURE_DIR + '/thread-messages-closed.png');
  }
  check(`document.querySelector('${toggle}').title === 'Messages with T-…bcdbf598, T-…cb73b0dc' && !fixtureThreadRequests.some(r => r.id.startsWith('T-'))`, 'before the first open, the tooltip lists thread IDs and no other thread is requested');
  const before = evaluate('fixtureThreadRequests.length');
  browser('click', toggle);
  browser('wait', '--fn', `document.querySelectorAll('${list} > button').length === 4`);
  check(`fixtureThreadRequests.length > ${before} && fixtureThreadRequests.slice(${before}).every(r => ['fixture-a', messageFixture.parent, messageFixture.child].includes(r.id)) && ${view} === 'list'`, 'opening reads only the current thread and its correspondents and shows the conversation list');
  browser('wait', '--fn', `document.querySelector('${list} > button:first-child [data-amp-thread-messages-name]').textContent === 'Release preparation'`);
  check(`document.querySelector('${toggle}').title === 'Messages with Release preparation, T-…cb73b0dc'`, 'after opening, the tooltip names each other thread once');
  check(`(() => { const names = [...document.querySelectorAll('${list} [data-amp-thread-messages-name]')];
    return names.map(n => n.textContent + '|' + n.dataset.kind).join(',') === 'Release preparation|title,T-…cb73b0dc|id,Release preparation|title,Release preparation|title' &&
      fixtureThreadRequests.filter(r => r.id === messageFixture.parent).length === 1; })()`, 'rows name readable threads by title, fetched once, and keep the ID for unreadable ones');
  check(`document.querySelector('${toggle}').textContent.includes('4') && document.querySelector('[data-amp-thread-messages-view="message"]').inert`, 'the control counts loaded messages and the message view is inert behind the list');
  // The track animates its height; wait for it to land on the shown view's content height.
  const fitted = name => `Math.abs(document.querySelector('${track}').getBoundingClientRect().height - document.querySelector('[data-amp-thread-messages-view="${name}"] > div').offsetHeight) < 1`;
  browser('wait', '--fn', fitted('list'));
  check(`${fitted('list')} && document.querySelector('${track}').style.height !== ''`, 'the panel takes the list height, not the message behind it');
  check(`[...document.querySelectorAll('${list} > button')].every(b => (b.dataset.direction === 'incoming') === b.children[1].hidden)`, 'delivery chips appear on sends only');
  if (process.env.CAPTURE_DIR) browser('screenshot', process.env.CAPTURE_DIR + '/thread-messages-list.png');
  browser('click', `${list} > button:first-child`);
  browser('wait', '--fn', `${settled('message')} && document.activeElement.matches('${back}')`);
  check(`document.querySelector('[data-amp-thread-messages-view="list"]').inert && !document.querySelector('${panel} section').inert`, 'choosing an entry transitions to its message and moves focus to the back control');
  browser('wait', '--fn', fitted('message'));
  check(fitted('message'), 'the panel resizes to the message being read');
  check(`document.querySelector('${panel} section').dataset.direction === 'incoming' && document.querySelector('${panel} section').dataset.delivery === 'received' && document.querySelector('${panel} section').textContent.includes('From thread') && !document.querySelector('${panel}').textContent.includes('PRIVATE HIDDEN METADATA')`, 'incoming source metadata excludes human, Puck, nested, and hidden content');
  check(`(() => { const a = document.querySelector('${panel} a'); return a.href === 'https://ampcode.com/threads/' + messageFixture.parent && a.textContent === 'Release preparation' && a.title === messageFixture.parent; })()`, 'incoming link names the parent thread and keeps its ID on hover');
  check(`!document.querySelector('[data-amp-thread-messages-body] script') && !window.untrustedMessageRan && document.querySelector('[data-amp-thread-messages-body]').textContent.includes('<script>')`, 'message text is rendered without interpreting HTML');
  if (process.env.CAPTURE_DIR) browser('screenshot', process.env.CAPTURE_DIR + '/thread-messages-incoming.png');
  browser('click', back);
  browser('wait', '--fn', settled('list'));
  check(`document.activeElement.matches('${list} > button:first-child') && document.activeElement.getAttribute('aria-pressed') === 'true'`, 'back returns to the list with the read entry focused and marked');
  browser('click', `${list} > button:nth-child(2)`);
  browser('wait', '--fn', settled('message'));
  check(`document.querySelector('${panel} section').dataset.delivery === 'failed' && document.querySelector('${panel} header > p').textContent === 'Failed' && document.querySelector('[data-amp-thread-messages-error]').textContent.includes('not sent') && document.querySelector('${panel} a').textContent === messageFixture.child`, 'a complete assistant call with a failed result is not marked sent');
  if (process.env.CAPTURE_DIR) browser('screenshot', process.env.CAPTURE_DIR + '/thread-messages-failed.png');
  browser('click', back);
  browser('wait', '--fn', settled('list'));
  browser('click', `${list} > button:nth-child(3)`);
  browser('wait', '--fn', settled('message'));
  check(`document.querySelector('${panel} header > p').textContent === 'Sent' && document.querySelector('[data-amp-thread-messages-error]').hidden && document.querySelector('${panel} section').textContent.includes('1 attachment')`, 'identical message text remains separate and success follows its own tool ID');
  browser('click', back);
  browser('wait', '--fn', settled('list'));
  browser('click', `${list} > button:nth-child(4)`);
  browser('wait', '--fn', settled('message'));
  check(`document.querySelector('${panel} header > p').textContent === 'Pending'`, 'missing delivery result remains pending');
  browser('eval', `fixtureThreadData['fixture-a'].transcriptPage.messages = [messageFixture.result('pending', {status:'done'})]`);
  browser('wait', '--fn', `document.querySelector('${panel} header > p').textContent === 'Sent'`);
  check(`document.querySelectorAll('${list} > button').length === 4`, 'late results update cached calls after they leave the data page');
  browser('eval', `fixtureThreadData['fixture-a'].transcriptPage.messages = messageFixture.messages`);
  browser('press', 'Escape');
  browser('wait', '--fn', `!${open} && document.activeElement.matches('${toggle}') && document.querySelector('${toggle}').getAttribute('aria-expanded') === 'false'`);
  console.log('PASS Escape closes the popover and restores keyboard focus');
  browser('click', toggle);
  browser('wait', '--fn', open);
  browser('click', '.app-title-bar h2');
  browser('wait', '--fn', `!${open} && document.querySelector('${toggle}').getAttribute('aria-expanded') === 'false'`);
  console.log('PASS clicking elsewhere closes the popover');
  browser('eval', `chrome.storage.local.set({right:false})`);
  browser('click', toggle);
  browser('wait', '--fn', settled('message'));
  check(`(() => { const d = document.querySelector('${panel}').getBoundingClientRect(), t = document.querySelector('${toggle}').getBoundingClientRect();
    return d.bottom <= t.top && t.top - d.bottom < 12 && d.left >= 0 && d.right <= innerWidth; })()`, 'reopening resumes the message being read in a popover just above the control');
  browser('click', back);
  browser('wait', '--fn', settled('list'));
  browser('click', `${list} > button:first-child`);
  browser('wait', '--fn', settled('message'));
  // Amp's transcript scrolls inside [data-thread-transcript-scroll]; make the fixture's scroll too, with the entry out of view.
  const scroller = `document.querySelector('[data-thread-transcript-scroll]')`;
  const received = `document.querySelector('[data-transcript-message-lookup-id="received"]')`;
  const highlighted = `${received}.hasAttribute('data-amp-transcript-highlight')`;
  browser('eval', `${scroller}.style.cssText = 'max-height: 120px; overflow: auto';
    for (let i = 0; i < 30; i++) { const spacer = document.createElement('p'); spacer.dataset.ampTestSpacer = ''; spacer.textContent = 'Later transcript content'; ${scroller}.firstElementChild.append(spacer); }
    ${scroller}.scrollTop = ${scroller}.scrollHeight`);
  check(`${received}.getBoundingClientRect().bottom < ${scroller}.getBoundingClientRect().top && ${scroller}.scrollTop > 400`, 'the entry starts well out of view');
  // Sample every frame from the click until the highlight appears: it must glide over several frames and flash only on arrival.
  const arrival = evaluate(`new Promise(resolve => { const s = ${scroller}, row = ${received}, tops = [];
    document.querySelector('[data-amp-thread-messages-original]').click();
    const tick = () => { tops.push(s.scrollTop);
      if (tops.length < 120 && !${highlighted}) return requestAnimationFrame(tick);
      const r = row.getBoundingClientRect(), b = s.getBoundingClientRect();
      resolve({ moves: tops.filter((top, i) => i && top !== tops[i - 1]).length, highlighted: ${highlighted}, arrived: s.scrollTop === 0 && r.top >= b.top && r.bottom <= b.bottom,
        flashing: row.getAnimations().some(a => a.animationName === 'amp-transcript-flash'), focused: document.activeElement === row, closed: !document.querySelector('${panel}').matches(':popover-open') }); };
    requestAnimationFrame(tick); })`);
  assert.ok(arrival.focused && arrival.closed, 'Show in transcript closes the popover and focuses the native entry');
  console.log('PASS Show in transcript closes the popover and focuses the native entry');
  assert.ok(arrival.moves > 3 && arrival.highlighted && arrival.arrived && arrival.flashing, `the entry glides into view over several frames and flashes only on arrival (${JSON.stringify(arrival)})`);
  console.log('PASS the entry glides into view over several frames and flashes only on arrival');
  browser('wait', '--fn', `!${highlighted}`);
  check(`${received}.getAnimations().length === 0 && getComputedStyle(${received}).boxShadow === 'none'`, 'the highlight is removed after it fades and leaves the entry as it was');
  browser('click', toggle);
  browser('wait', '--fn', settled('message'));
  browser('find', 'role', 'button', 'click', '--name', 'Show in transcript', '--exact');
  browser('wait', '--fn', highlighted);
  check(`${scroller}.scrollTop === 0 && document.activeElement.dataset.transcriptMessageLookupId === 'received'`, 'showing an entry already in view replays the highlight without scrolling');
  browser('eval', `${scroller}.removeAttribute('style'); for (const spacer of document.querySelectorAll('[data-amp-test-spacer]')) spacer.remove()`);
  browser('eval', `chrome.storage.local.set({threadMessagesPanel:false})`);
  browser('wait', '--fn', `!document.querySelector('[data-amp-thread-messages-ui]')`);
  check(`document.querySelectorAll('[data-transcript-message-lookup-id]').length === 9`, 'opt-out removes only the extension control and popover');
  browser('eval', `chrome.storage.local.set({threadMessagesPanel:true})`);
  browser('wait', toggle);
  check(`!${open}`, 're-enabling starts closed');
  browser('eval', `document.querySelector('[data-thread-id]').dataset.threadId = 'fixture-b'`);
  const requested = id => `fixtureThreadRequests.some(r => r.id === '${id}') && !document.querySelector('${toggle}').checkVisibility()`;
  browser('wait', '--fn', requested('fixture-b'));
  check(`!document.querySelector('${panel}').textContent.includes('Regression checks') && document.querySelector('${toggle}').hidden`, 'navigating to a thread without messages hides the control and clears cached content');
  browser('eval', `document.querySelector('[data-thread-id]').dataset.threadId = 'fixture-missing'`);
  browser('wait', '--fn', requested('fixture-missing'));
  check(`document.querySelector('${toggle}').hidden && !document.querySelector('${panel}').textContent.includes('Regression checks')`, 'failed page load shows no control and no stale messages');
  browser('eval', `document.querySelector('[data-thread-id]').dataset.threadId = 'fixture-a'`);
  browser('wait', toggle);
  browser('set', 'viewport', '767', '800', '2');
  browser('wait', '--fn', `!document.querySelector('${toggle}')`);
  browser('set', 'viewport', '768', '800', '2');
  browser('wait', toggle);
  check(`!${open}`, 'mobile remains native and the desktop boundary restores a closed control');
  check(`Object.keys(JSON.parse(localStorage.getItem('extension-settings'))).every(key => ['right','threadMessagesPanel'].includes(key))`, 'only preferences are persisted, never thread content');
  browser('eval', `(() => {
    window.pollRequests = [];
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      if (String(args[0]).includes('fixture-a')) pollRequests.push(performance.now());
      await new Promise(resolve => setTimeout(resolve, 100));
      return originalFetch(...args);
    };
  })()`);
  browser('wait', toggle);
  browser('click', toggle);
  assert.ok(evaluate(`new Promise(resolve => setTimeout(() => resolve(pollRequests.length >= 3), 13000))`),
    'an idle open popover refreshes every five seconds despite response latency');
  console.log('PASS an idle open popover refreshes every five seconds despite response latency');
  console.log('All thread message checks passed.');
} finally {
  browser('close');
}
