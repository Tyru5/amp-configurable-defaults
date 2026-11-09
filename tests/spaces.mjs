import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const session = `amp-spaces-test-${process.pid}`;
const url = process.argv[2] || 'http://localhost:8765/tests/fixture.html';
function browser(...args) {
  return execFileSync('agent-browser', ['--session', session, ...args], { encoding: 'utf8' }).trim();
}
// A full Escape press marks headless Chrome's page hidden on macOS, which pauses
// animation frames. Native popovers only close on a full press, so bring the tab
// back to the front afterwards.
function pressEscape() {
  browser('press', 'Escape');
  browser('tab', JSON.parse(browser('--json', 'tab', 'list')).data.tabs.find(tab => tab.active).tabId);
}
// Send Escape as separate key events: a full press marks headless Chrome's page
// hidden on macOS, and returning the tab to the front would refire focus events.
function keyEscape() {
  browser('keydown', 'Escape');
  browser('keyup', 'Escape');
}
function evaluate(code) {
  return JSON.parse(browser('--json', 'eval', code)).data.result;
}
function check(code, label) {
  assert.ok(evaluate(code), label);
  console.log(`PASS ${label}`);
}
function eventually(code, label) {
  assert.ok(evaluate(`(async () => {
    const deadline = performance.now() + 4000;
    do {
      if ((() => { return (${code}); })()) return true;
      await new Promise(resolve => setTimeout(resolve, 50));
    } while (performance.now() < deadline);
    return false;
  })()`), label);
  console.log(`PASS ${label}`);
}
const failures = [];
function test(label, run) {
  try { run(); }
  catch (error) {
    failures.push({ label, error });
    console.error(`FAIL ${label}: ${error.message}`);
  }
}
const context = '[data-amp-composer-context]';
const item = '[data-amp-composer-context-item]';
const toggle = '[data-amp-thread-messages-ui="toggle"]';
const list = '[data-amp-thread-messages-list]';
const subagents = '[data-amp-subagents-ui="toggle"]';
const contextText = id => `[...document.querySelectorAll('#${id} ${context} ${item}')].map(n => n.textContent).join(' | ')`;

function activate(card, selector) {
  if (evaluate(`document.querySelector('#${card} ${selector}').checkVisibility()`)) {
    browser('click', `#${card} ${selector}`);
    return;
  }
  browser('click', `#${card} [data-amp-tools-ui="toggle"]`);
  browser('wait', '--fn', `document.querySelector('#${card} [data-amp-tools-ui="panel"]').getAnimations().length === 0`);
  const index = evaluate(`(() => {
    const controls = [...document.querySelectorAll('#${card} [data-amp-composer-control]:not([data-amp-composer-control="tools"])')].filter(control => !control.hidden);
    return controls.indexOf(document.querySelector('#${card} ${selector}')) + 1;
  })()`);
  browser('click', `#${card} [data-amp-tools-ui="actions"] button:nth-child(${index})`);
}

// Keep the shared fixture's default shell and data untouched. Only this runner
// mounts Spaces. Ownership, tab strips, transcript/chat attributes and the
// top-level spaceChat shape follow the verified live Spaces DOM.
const setup = String.raw`(() => {
  const parentA = 'T-01a190c3-2e10-74ac-8a09-c7b0bcdbf598';
  const parentB = 'T-01a19424-b624-7647-883f-6a0ccb73b0dc';
  const incoming = (id, from, text, extra = {}) => ({
    role: 'user', messageId: id, meta: { fromExecutorThreadID: from, ...extra },
    content: [{ type: 'text', text }],
  });
  const messages = (from, label, sent, started, finished, model) => [
    { role: 'user', messageId: 'shared-user', createdAt: sent, content: [{ type: 'text', text: label + ' human' }] },
    { role: 'assistant', messageId: 'shared-agent', createdAt: started,
      state: { type: 'complete' }, usage: { timestamp: finished, model }, content: [{ type: 'text', text: label + ' reply' }] },
    incoming('received', from, label + ' no-fromPuck message'),
    incoming('received-false', from, label + ' explicit false message', { fromPuck: false }),
    incoming('received-puck', from, label + ' excluded Puck message', { fromPuck: true }),
  ];
  fixtureThreadData['space-chat'] = {
    type: 'result', thread: { id: 'space-chat', title: 'Release Space', agentMode: 'project-puck',
      meta: { executorType: 'sandbox', features: ['model:claude-haiku-5-5'] } },
    spaceChat: [
      { messageId: 'shared-user', author: { type: 'user' }, content: [{ type: 'text', text: 'Space human' }], createdAt: '2026-10-27T02:13:07Z' },
      { messageId: 'shared-agent', author: { type: 'agent' }, content: [{ type: 'text', text: 'Space reply' }], createdAt: '2026-10-27T03:29:43Z' },
      { messageId: 'invalid-chat', author: { type: 'agent' }, content: [], createdAt: 'invalid' },
    ],
  };
  fixtureThreadData['space-worker-a'] = {
    type: 'result', thread: { id: 'space-worker-a', title: 'Worker A', agentMode: 'high',
      meta: { executorType: 'local-client' }, env: { initial: { runnerID: 'space-runner-a', workingDirectory: 'file:///srv/worker%20a' } } },
    transcriptPage: { messages: messages(parentA, 'A', '2026-10-28T11:41:19Z', '2026-10-28T11:42:23Z', '2026-10-28T11:49:53Z', 'claude-opus-5-5') },
  };
  fixtureThreadData['space-worker-b'] = {
    type: 'result', thread: { id: 'space-worker-b', title: 'Worker B', agentMode: 'medium', meta: { executorType: 'sandbox' } },
    transcriptPage: { messages: messages(parentB, 'B', '2026-10-30T17:03:31Z', '2026-10-30T17:05:37Z', '2026-10-30T17:14:59Z', 'claude-sonnet-5-5') },
  };
  for (const [id, title] of [[parentA, 'Correspondent A'], [parentB, 'Correspondent B']]) {
    fixtureThreadData[id] = { type: 'result', thread: { id, title }, transcriptPage: { messages: [] } };
  }
  const composerTemplate = document.querySelector('[data-thread-composer-footer]').cloneNode(true);
  const create = (tag, attributes = {}, text) => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    if (text !== undefined) node.textContent = text;
    return node;
  };
  document.head.append(create('style', {}, '[data-thread-file-tab-pane][hidden] { display: none !important; }'));
  function renderRows(card, id, chat = false) {
    const root = card.querySelector('[data-thread-id]');
    root.dataset.threadId = id;
    const content = chat ? root.querySelector('[data-chat-v2-list]') : root.querySelector('[data-thread-transcript-content]');
    content.replaceChildren();
    for (const message of chat ? fixtureThreadData[id].spaceChat : fixtureThreadData[id]?.transcriptPage?.messages || []) {
      const role = chat ? (message.author.type === 'user' ? 'user' : 'assistant') : message.role;
      const row = create('div', { 'data-transcript-message-lookup-id': message.messageId });
      if (chat) {
        // Live chat has role and lookup ID on the SAME row, not nested nodes.
        row.dataset.transcriptMessageRole = role;
        row.dataset.chatV2ItemKey = 'space-chat:' + message.messageId;
        row.append(create('div', {}, message.content.map(block => block.text || '').join('')));
      } else {
        const entry = create('div', { 'data-transcript-entry-content': '' });
        entry.append(create('div', { 'data-transcript-message-role': role,
          'data-transcript-message-alignment': role === 'user' ? 'right' : 'left' }, message.content.map(block => block.text || '').join('')));
        row.append(entry);
      }
      content.append(row);
    }
    card.querySelector('[data-card-tab="agent"] > button[role="tab"] .truncate').textContent = fixtureThreadData[id]?.thread.title || id;
  }
  function addPane(cardID, id, chat = false, parked = '') {
    const card = create('section', { id: cardID, 'data-agent-pane': '', 'data-thread-file-tab-pane': '' });
    card.style.cssText = 'display: flex; flex-direction: column; flex: 1; min-width: 0; min-height: 0; position: relative; border: 1px solid #ddd';
    const strip = create('div', { 'data-pane-tab-strip': '' });
    strip.style.cssText = 'display: flex; align-items: center; justify-content: space-between; height: 28px; flex-shrink: 0';
    const tab = create('div', { 'data-card-tab': 'agent' });
    const tabButton = create('button', { role: 'tab', 'aria-selected': 'true' });
    tabButton.append(create('span', { class: 'truncate' }));
    tab.append(tabButton);
    strip.append(tab);
    // Only worker strips have native title controls. Chat falls back to its strip.
    if (!chat) {
      const actions = create('div', { 'data-tab-strip-actions': '' });
      const wrapper = create('div');
      wrapper.append(create('div', { 'data-thread-title-bar-controls': '' }));
      actions.append(wrapper);
      strip.append(actions);
    }
    const pane = create('div', { 'data-pane-card': '' });
    const host = create('div', { 'data-thread-agent-tab-content': '' });
    pane.style.cssText = host.style.cssText = 'display: flex; flex: 1; min-height: 0; min-width: 0';
    const presentation = create('div', { role: 'presentation' });
    if (chat) presentation.setAttribute('data-thread-chat-v2-pane', '');
    presentation.style.cssText = 'display: flex; flex: 1; flex-direction: column; min-height: 0; min-width: 0';
    const panel = create('div', { 'data-transcript-panel-host': '' });
    panel.style.cssText = 'flex: 1; overflow: auto; min-height: 0';
    const root = create('div', { 'data-thread-id': id, [chat ? 'data-thread-transcript-override' : 'data-thread-transcript-scroll']: '' });
    root.append(create('div', { [chat ? 'data-chat-v2-list' : 'data-thread-transcript-content']: '' }));
    panel.append(root);
    presentation.append(panel, composerTemplate.cloneNode(true));
    host.append(presentation);
    pane.append(host);
    card.append(strip, pane);
    card.querySelector('.fixture-composer-input').replaceWith(create('textarea', { 'aria-label': cardID + ' draft', rows: '2' }));
    if (parked === 'hidden') card.hidden = true;
    if (parked === 'display') card.style.display = 'none';
    document.querySelector('#space-agent-pane').append(card);
    renderRows(card, id, chat);
    return card;
  }
  window.fixtureSpaces = {
    parentA, parentB,
    mount() {
      document.querySelector('.test-controls > span').textContent = 'Spaces compatibility fixture · Not live Amp · ' + innerWidth + ' × ' + innerHeight;
      const host = document.querySelector('.thread-layout-panes');
      host.style.cssText = 'display: flex; flex: 1; min-height: 0';
      host.replaceChildren(create('div', { id: 'space-agent-pane' }));
      document.querySelector('#space-agent-pane').style.cssText = 'display: flex; flex: 1; min-width: 0; gap: 8px';
      addPane('space-chat-card', 'space-chat', true);
      addPane('space-worker-card', 'space-worker-a');
      addPane('space-hidden-card', 'space-hidden-worker', false, 'hidden');
      addPane('space-parked-card', 'space-parked-worker', false, 'display');
      fixtureThreadRequests.length = 0;
    },
    switchWorker(id) { renderRows(document.querySelector('#space-worker-card'), id); },
    addWorker() { addPane('space-worker-b-card', 'space-worker-b'); },
    addTask(cardID, label) {
      const row = create('div', { 'data-transcript-message-lookup-id': 'task-' + cardID });
      const task = create('div', { 'data-transcript-subagent': '' });
      const wrapper = create('div');
      const header = create('div', { 'data-transcript-expandable-row': '', tabindex: '-1' });
      const labels = create('div');
      labels.append(create('span', { 'data-transcript-subagent-working': '', 'aria-hidden': 'true' }),
        create('span', {}, 'Subagent working'), create('span', {}, label));
      header.append(labels, create('span', { class: 'expandable-row-chevron' }));
      header.onclick = () => {
        const open = header.lastElementChild.classList.toggle('rotate-90');
        if (open) wrapper.append(create('div', { 'data-transcript-subagent-prompt': '' }, 'Task for ' + label));
        else wrapper.querySelector('[data-transcript-subagent-prompt]')?.remove();
      };
      wrapper.append(header);
      task.append(wrapper);
      row.append(task);
      document.querySelector('#' + cardID + ' [data-thread-transcript-content]').append(row);
    },
    orb(cardID) {
      const control = document.querySelector('#' + cardID + ' [data-amp-thread-info-ui="toggle"]');
      return control && ampComposerAnchor(control).checkVisibility() ? control : undefined;
    },
    info(cardID) {
      const orb = this.orb(cardID);
      return orb && document.getElementById(orb.getAttribute('aria-controls'));
    },
  };
  fixtureSpaces.mount();
  for (const id of ['space-worker-a', 'space-worker-b']) {
    fixtureThreadData[id].transcriptPage.messages.push(
      { role: 'assistant', content: [{ type: 'tool_use', id: 'shared-skill-id', name: 'skill', input: { name: id + '-skill' } }] },
      { role: 'user', content: [{ type: 'tool_result', toolUseID: 'shared-skill-id', run: { status: 'done', result: { content: [{ type: 'text', text: 'Worker skill instructions.' }] } } }] }
    );
  }
  chrome.storage.local.set({ showComposerContext: true, infoOrb: true, threadMessagesPanel: true, subagentPanel: true, showComposerSkills: true });
})()`;

try {
  browser('open', url);
  browser('set', 'viewport', '1600', '900', '2');
  browser('eval', `localStorage.setItem('extension-settings', JSON.stringify({showComposerContext:false, infoOrb:false, threadMessagesPanel:false, showComposerSkills:false})); location.reload()`);
  browser('wait', '--fn', 'typeof fixtureAgents === "object"');
  browser('eval', setup);
  test('fixture contract', () => {
    check(`devicePixelRatio === 2 && !document.querySelector('.app-title-bar, .thread-title-bar-container') &&
      document.querySelectorAll('.thread-layout-panes [data-agent-pane] > [data-pane-card]').length === 4 &&
      document.querySelectorAll('[data-thread-transcript-override][data-thread-id] [data-chat-v2-list] [data-transcript-message-role][data-transcript-message-lookup-id][data-chat-v2-item-key^="space-chat:"]').length === 3`,
    'fixture uses modern headers, live Space chat rows, and a shared outer pane at DPR2');
    check(`[...document.querySelectorAll('[data-thread-agent-tab-content]')].every(host =>
      host.querySelectorAll('[data-thread-id]').length === 1 && host.querySelectorAll('[data-message-composer-root]').length === 1 &&
      host.querySelector('[role="presentation"] > [data-transcript-panel-host] > [data-thread-id]') &&
      host.querySelector('[role="presentation"] > [data-thread-composer-footer]')) &&
      !!document.querySelector('#space-worker-card [data-pane-tab-strip] [data-tab-strip-actions] > div > [data-thread-title-bar-controls]') &&
      !document.querySelector('#space-chat-card [data-tab-strip-actions]')`,
    'each native agent-tab content owns exactly one transcript/composer pair and only workers have strip actions');
  });
  test('separate composer contexts', () => {
    eventually(`${contextText('space-chat-card')} === 'claude-haiku-5-5 | Orb' && ${contextText('space-worker-card')} === 'claude-opus-5-5 | space-runner-a'`,
      'Space chat and worker have independent model and runner contexts');
    check(`['space-chat-card', 'space-worker-card'].every(id => {
      const nodes = document.querySelectorAll('#' + id + ' ${context}');
      return nodes.length === 1 && nodes[0].previousElementSibling?.querySelector('input[type="file"]') &&
        nodes[0].parentElement.matches('[role="region"][aria-label="Attachments"]');
    })`, 'each context is beside its own native Attachments trigger');
  });
  test('worker messages ownership and Puck filtering', () => {
    eventually(`document.querySelector('#space-worker-card ${toggle}')?.checkVisibility()`, 'worker messages control appears in its own pane');
    check(`!document.querySelector('#space-chat-card [data-amp-thread-messages-ui]') &&
      document.querySelector('#space-worker-card ${toggle}').parentElement.matches('[data-message-composer-root] [role="region"][aria-label="Attachments"]')`,
    'messages control stays in the worker toolbar and never mounts in Space chat');
    browser('click', `#space-worker-card ${toggle}`);
    const workerList = `document.getElementById(document.querySelector('#space-worker-card ${toggle}').getAttribute('aria-controls')).querySelector('${list}')`;
    eventually(`${workerList}?.children.length === 2`, 'both no-fromPuck and explicit false messages survive, while fromPuck=true is excluded');
    check(`[...${workerList}.children].every(n => n.dataset.direction === 'incoming')`, 'worker message entries retain incoming direction');
    browser('click', `#${evaluate(`document.querySelector('#space-worker-card ${toggle}').getAttribute('aria-controls')`)} ${list} > button:last-child`);
    eventually(`document.querySelector('[data-amp-thread-messages-body]')?.textContent.includes('A no-fromPuck message')`, 'the retained message is the worker A payload, not a same-ID message from another pane');
    check(`!document.querySelector('[data-amp-thread-messages-body]').textContent.includes('excluded Puck')`, 'Puck payload does not leak into message detail');
    pressEscape();
  });
  test('no false Task panel', () => {
    check(`!document.querySelector('[data-amp-subagents-ui]') && !document.querySelector('[data-amp-subagents-open]')`,
      'Space child pane cards alone do not create a Task/Subagents panel');
  });
  test('modern info anchors', () => {
    eventually(`fixtureSpaces.orb('space-chat-card') && fixtureSpaces.orb('space-worker-card')`, 'each visible pane mounts its own thread info control in its composer');
    check(`fixtureSpaces.orb('space-chat-card') !== fixtureSpaces.orb('space-worker-card') &&
      fixtureSpaces.info('space-chat-card') !== fixtureSpaces.info('space-worker-card')`, 'each thread info control owns a distinct popover');
    browser('eval', `fixtureSpaces.orb('space-worker-card').click()`);
    eventually(`fixtureSpaces.info('space-worker-card')?.textContent.includes('space-runner-a')`, 'worker info uses its own runner');
    browser('eval', `fixtureSpaces.orb('space-chat-card').click()`);
    eventually(`fixtureSpaces.info('space-chat-card')?.textContent.includes('Release Space')`, 'chat info reads its own modern header title');
    check(`!fixtureSpaces.info('space-chat-card').textContent.includes('space-runner-a') && !fixtureSpaces.info('space-chat-card').textContent.includes('/srv/worker a')`, 'worker runner and directory never leak into Space info');
    browser('eval', `document.querySelector('#space-chat-card [data-card-tab="agent"] > button[role="tab"] .truncate').textContent = 'Native chat tab title';
      document.querySelector('#space-worker-card [data-card-tab="agent"] > button[role="tab"] .truncate').textContent = 'Native worker tab title'`);
    eventually(`fixtureSpaces.info('space-chat-card')?.textContent.includes('Native chat tab title') &&
      fixtureSpaces.info('space-worker-card')?.textContent.includes('Native worker tab title')`,
    'info titles track each local native tab, rather than cached route titles or another pane');
  });
  test('hidden and parked panes', () => {
    check(`!fixtureThreadRequests.some(r => ['space-hidden-worker','space-parked-worker'].includes(r.id)) &&
      ['space-hidden-card','space-parked-card'].every(id => !document.querySelector('#' + id + ' [data-amp-composer-context], #' + id + ' [data-amp-thread-messages-ui], #' + id + ' [data-amp-subagents-ui], #' + id + ' [data-amp-thread-info-ui]'))`,
    'hidden and display-none parked panes receive neither controls nor thread requests');
    check(`fixtureThreadRequests.some(r => r.id === 'space-chat') && fixtureThreadRequests.some(r => r.id === 'space-worker-a') &&
      fixtureThreadRequests.every(r => ['space-chat','space-worker-a',fixtureSpaces.parentA].includes(r.id) && r.credentials === 'same-origin')`,
    'fetch interception records only visible thread contexts and an opened worker correspondent');
  });
  test('late response after worker switch', () => {
    browser('eval', `(() => {
      const original = window.fetch;
      const held = [];
      window.fetch = async (...args) => {
        const response = await original(...args);
        if (!String(args[0]).includes('/space-worker-b/')) return response;
        return new Promise(resolve => {
          held.push(() => resolve(response));
          window.releaseWorker = () => { window.fetch = original; held.forEach(release => release()); };
        });
      };
      fixtureSpaces.switchWorker('space-worker-b');
    })()`);
    eventually(`typeof releaseWorker === 'function'`, 'worker B request is held while switching away');
    browser('eval', `fixtureSpaces.switchWorker('space-worker-a')`);
    eventually(`${contextText('space-worker-card')} === 'claude-opus-5-5 | space-runner-a'`, 'worker A restores before the old response arrives');
    browser('eval', `releaseWorker(); new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    check(`${contextText('space-worker-card')} === 'claude-opus-5-5 | space-runner-a'`,
    'a late worker B response cannot overwrite worker A labels');
  });
  browser('eval', `fixtureSpaces.switchWorker('space-worker-b')`);
  test('worker switch', () => {
    eventually(`${contextText('space-worker-card')} === 'claude-sonnet-5-5 | Orb' && ${contextText('space-chat-card')} === 'claude-haiku-5-5 | Orb'`,
      'switching the worker drops the stale local runner and leaves chat context unchanged');
    check(`!document.querySelector('#space-worker-card').textContent.includes('space-runner-a') &&
      !document.querySelector('#space-chat-card [data-amp-thread-messages-ui]')`, 'stale worker runner and worker-only messages control do not leak');
    eventually(`!!fixtureSpaces.orb('space-worker-card')`, 'worker thread info control survives switching contexts');
    browser('eval', `(() => { const orb = fixtureSpaces.orb('space-worker-card'); if (orb.getAttribute('aria-expanded') !== 'true') orb.click(); })()`);
    eventually(`fixtureSpaces.info('space-worker-card')?.textContent.includes('Worker B') &&
      !fixtureSpaces.info('space-worker-card').textContent.includes('space-runner-a') && !fixtureSpaces.info('space-worker-card').textContent.includes('/srv/worker a')`,
      'worker info updates its title and clears the prior local runner and directory on switch');
  });
  browser('eval', `fixtureSpaces.switchWorker('space-worker-a'); fixtureSpaces.addWorker()`);
  test('multiple visible workers', () => {
    eventually(`${contextText('space-worker-card')} === 'claude-opus-5-5 | space-runner-a' && ${contextText('space-worker-b-card')} === 'claude-sonnet-5-5 | Orb' &&
      ${contextText('space-chat-card')} === 'claude-haiku-5-5 | Orb'`, 'two visible workers and chat each retain their own composer context');
    eventually(`['space-worker-card','space-worker-b-card'].every(id => {
      const control = document.querySelector('#' + id + ' ${toggle}');
      return control && !control.hidden && ampComposerAnchor(control).checkVisibility();
    })`, 'each visible worker has messages available directly or through Thread tools');
    eventually(`document.querySelector('#space-worker-card [data-amp-tools-ui="rail"] a')?.textContent === 'space-worker-a-skill' &&
      document.querySelector('#space-worker-b-card [data-amp-tools-ui="rail"] a')?.textContent === 'space-worker-b-skill' &&
      !document.querySelector('#space-chat-card [data-amp-tools-ui]')`, 'worker skill histories stay separate despite identical tool IDs, without mounting in Space chat');
    check(`document.querySelectorAll('[data-amp-composer-context]').length === 3`,
    'multiple workers receive independent data even with identical message IDs');
    activate('space-worker-b-card', toggle);
    const panelID = evaluate(`document.querySelector('#space-worker-b-card ${toggle}').getAttribute('aria-controls')`);
    eventually(`document.querySelectorAll('#${panelID} ${list} > button').length === 2`, 'second worker messages come from its own thread');
    browser('click', `#${panelID} ${list} > button:last-child`);
    eventually(`document.querySelector('#${panelID} [data-amp-thread-messages-body]')?.textContent.includes('B no-fromPuck message')`, 'second worker opens B content, not cached A content');
    pressEscape();
    check(`fixtureThreadRequests.some(r => r.id === 'space-worker-b') && !fixtureThreadRequests.some(r => ['space-hidden-worker','space-parked-worker'].includes(r.id))`,
      'adding a visible worker fetches that worker but still ignores parked contexts');
  });
  test('independent tool previews', () => {
    for (const id of ['space-chat-card', 'space-worker-card']) {
      browser('eval', `ampComposerAnchor(fixtureSpaces.orb('${id}')).focus()`);
      keyEscape();
    }
    browser('eval', `for (const [id, key, count] of [['space-worker-card','a-calls',7],['space-worker-b-card','b-calls',9]]) {
      const root = document.querySelector('#' + id + ' [data-thread-transcript-content]');
      root.id = 'fixture-transcript';
      const tools = fixtureToolSection(key, count);
      tools.status.querySelector('[data-transcript-status-row-id]').dataset.transcriptStatusRowId = 'shared-status';
      root.removeAttribute('id');
    }`);
    eventually(`document.querySelector('#space-worker-card [data-amp-tool-preview] button')?.textContent === 'Show all 7 tool calls' &&
      document.querySelector('#space-worker-b-card [data-amp-tool-preview] button')?.textContent === 'Show all 9 tool calls'`,
    'both worker tool previews use their own calls despite identical status IDs');
    browser('click', '#space-worker-card [data-amp-tool-preview] button');
    eventually(`!document.querySelector('#space-worker-card [data-amp-tool-preview]') &&
      !!document.querySelector('#space-worker-b-card [data-amp-tool-preview]')`,
    'expanding one worker tool preview does not expand the other worker');
  });
  browser('eval', `fixtureSpaces.addTask('space-worker-card', 'A task'); fixtureSpaces.addTask('space-worker-b-card', 'B task')`);
  test('modern Subagents anchors', () => {
    eventually(`['space-worker-card','space-worker-b-card'].every(id => {
      const control = document.querySelector('#' + id + ' [data-message-composer-root] [role="region"][aria-label="Attachments"] ${subagents}');
      return control && ampComposerAnchor(control).checkVisibility();
    })`, 'real Task rows mount independent Subagents controls accessible from both worker composers');
    check(`!document.querySelector('#space-chat-card [data-amp-subagents-ui]') && document.querySelectorAll('${subagents}').length === 2`, 'worker Task controls never mount in chat or the shared outer header');
    check(`['space-worker-card','space-worker-b-card'].every(id =>
      document.querySelector('#' + id + ' [data-thread-agent-tab-content]')?.hasAttribute('data-amp-subagents-host')) &&
      !document.querySelector('.thread-layout-panes[data-amp-subagents-host], [data-agent-pane][data-amp-subagents-host], [data-thread-file-tab-pane][data-amp-subagents-host]')`,
    'Subagents panel hosts are the local agent-tab contents, never the shared layout or file-tab panes');
    for (const [id, label, other] of [['space-worker-card','A task','B task'], ['space-worker-b-card','B task','A task']]) {
      activate(id, subagents);
      const panelID = evaluate(`document.querySelector('#${id} ${subagents}').getAttribute('aria-controls')`);
      eventually(`document.getElementById('${panelID}')?.textContent.includes('${label}') && !document.getElementById('${panelID}').textContent.includes('${other}')`,
        `${label} panel reads only its own worker transcript`);
    }
  });
  test('pane lifecycle cleanup', () => {
    browser('eval', `document.querySelector('#space-worker-b-card').hidden = true`);
    eventually(`document.querySelectorAll('[data-amp-thread-info-ui="toggle"]').length === 2 &&
      !document.querySelector('#space-worker-b-card [data-amp-thread-messages-ui], #space-worker-b-card [data-amp-subagents-ui], #space-worker-b-card ${context}, #space-worker-b-card [data-amp-thread-info-ui]')`,
    'hiding a mounted worker removes its controls and thread info');
    browser('eval', `document.querySelector('#space-worker-b-card').hidden = false`);
    eventually(`${contextText('space-worker-b-card')} === 'claude-sonnet-5-5 | Orb' && document.querySelectorAll('[data-amp-thread-info-ui="toggle"]').length === 3`,
      'showing a worker restores its own context');
    browser('eval', `(() => {
      const toolbar = document.querySelector('#space-worker-b-card [role="region"][aria-label="Attachments"]');
      const trigger = toolbar.querySelector('span:has(> input[type="file"])');
      trigger.replaceWith(trigger.cloneNode(true));
    })()`);
    eventually(`document.querySelectorAll('#space-worker-b-card ${context}').length === 1 &&
      document.querySelector('#space-worker-b-card ${context}').previousElementSibling?.querySelector('input[type="file"]')`,
    'remounting the native upload trigger leaves one correctly positioned context label');
  });
  test('focused info-card teardown', () => {
    browser('set', 'viewport', '2560', '900', '2');
    eventually(`fixtureSpaces.orb('space-worker-b-card')?.checkVisibility()`, 'wide worker restores the direct Info control before focused teardown');
    browser('eval', `window.infoTeardownErrors = []; addEventListener('error', event => infoTeardownErrors.push(event.message));
      fixtureSpaces.orb('space-worker-b-card').focus(); chrome.storage.local.set({infoOrb:false})`);
    eventually(`document.querySelectorAll('[data-amp-thread-info-ui="toggle"]').length === 0`, 'disabling info removes focused and unfocused pane controls');
    browser('eval', 'new Promise(resolve => setTimeout(resolve, 250))');
    check(`infoTeardownErrors.length === 0`, 'removing a focused thread info control leaves no delayed callback errors');
    browser('eval', `chrome.storage.local.set({infoOrb:true})`);
    eventually(`document.querySelectorAll('[data-amp-thread-info-ui="toggle"]').length === 3`, 'info controls can be enabled again after focused teardown');
  });
  assert.equal(failures.length, 0, failures.map(({ label }) => label).join(', '));
  console.log('All Spaces compatibility checks passed.');
} finally {
  browser('close');
}
