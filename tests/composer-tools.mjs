import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const session = `amp-skills-${process.pid}`;
const url = process.argv[2] || 'http://localhost:8765/tests/fixture.html';
const browser = (...args) => execFileSync('agent-browser', ['--session', session, ...args], { encoding: 'utf8' }).trim();
const evaluate = code => JSON.parse(browser('--json', 'eval', code)).data.result;
function check(code, label) {
  assert.ok(evaluate(code), label);
  console.log(`PASS ${label}`);
}
const rail = '[data-amp-tools-ui="rail"]';
const toggle = '[data-amp-tools-ui="toggle"]';
const panel = '[data-amp-tools-ui="panel"]';
const tip = '[data-amp-tools-ui="tooltip"]';
const names = `[...document.querySelectorAll('${rail} a')].map(a => a.textContent).join(',')`;
const collapsed = `document.querySelector('[data-message-composer-root]').hasAttribute('data-amp-tools-collapsed')`;
const open = `document.querySelector('${panel}').hasAttribute('data-open')`;
const settled = `document.querySelector('${panel}').getAnimations().length === 0`;

// Published Amp payload contracts, inspected 2026-11-09. These are synthetic
// thread records, not live user data. Calls and results deliberately span pages.
const setup = String.raw`(() => {
  const call = (id, name) => ({ role: 'assistant', content: [{ type: 'tool_use', id, name: 'skill', input: { name } }] });
  const result = (id, status = 'done', text = 'Check keyboard focus and accessible names.') => ({ role: 'user', content: [
    { type: 'tool_result', toolUseID: id, run: { status, result: { content: [{ type: 'text', text: '<loaded_skill name="example">\n# Example\n\n' + text + '\n\nBase directory for this skill: file:///example/skills\n</loaded_skill>' }] } } },
  ] });
  const latest = [call('design', 'frontend-design'), result('design'), call('reuse', 'frontend-design'), result('reuse'), result('cross'),
    ...['error','cancelled','rejected-by-user','queued','in-progress'].flatMap(status => [call(status, status), result(status, status)]),
    { ...call('nested', 'subagent-only'), parentToolUseId: 'task' }, { ...result('nested'), parentToolUseId: 'task' }];
  const pages = { '100': { messages: [call('cross', 'creating-views')], hasMoreBefore: true, firstMessageIndex: 50, firstMessageID: 'middle', lastMessageIndex: 99 },
    '50': { messages: [call('browser', 'agent-browser'), result('browser')], hasMoreBefore: false, firstMessageIndex: 0, lastMessageIndex: 49,
      collapsedTurns: [{ turnID: 'old-turn', sources: { skills: [{ name: 'tdd', baseDir: 'file:///example/tdd' }] } }] } };
  const originalFetch = window.fetch;
  window.skillFixture = { call, result, pages, requests: [], fail: false };
  window.fetch = async (input, init) => {
    if (!String(input).startsWith('/api/threads/')) return originalFetch(input, init);
    skillFixture.requests.push({ url: String(input), credentials: init?.credentials });
    if (skillFixture.fail) return new Response('', {status: 409});
    const params = new URL(String(input), location.origin).searchParams;
    return new Response(JSON.stringify(pages[params.has('before') ? params.get('before') : 'after:' + params.get('after')]));
  };
  fixtureThreadData['skills-test'] = { type: 'result', thread: { id: 'skills-test', agentMode: 'high', meta: { executorType: 'sandbox' } },
    transcriptPage: { messages: latest, hasMoreBefore: true, firstMessageIndex: 100, firstMessageID: 'latest', lastMessageIndex: 150, lastMessageID: 'end' } };
  fixtureAgents.navigate('skills-test');
})()`;

try {
  browser('open', url);
  browser('set', 'viewport', '1440', '900', '2');
  browser('eval', 'localStorage.clear(); location.reload()');
  browser('wait', '--fn', `document.querySelector('${rail}') !== null`);
  browser('eval', setup);
  browser('wait', '--fn', `${names} === 'agent-browser,creating-views,frontend-design,tdd'`);
  check(`!${collapsed} && document.querySelector('${rail}').textContent.startsWith('Skills (4)')`, 'successful loads deduplicate across pages and collapsed turns, excluding nested and failed calls');
  check(`skillFixture.requests.length === 2 && skillFixture.requests[0].url.endsWith('before=100&anchorID=latest&conversation=1') && skillFixture.requests[1].url.includes('anchorID=middle') && skillFixture.requests.every(r => r.credentials === 'same-origin')`, 'older pages use the server cursor and same-origin session');
  browser('focus', `${rail} a`);
  browser('wait', '--fn', `document.querySelector('${tip}').matches(':popover-open')`);
  check(`document.querySelector('${tip}').textContent.includes('Check keyboard focus') && document.querySelector('${rail} a').getAttribute('aria-describedby') === document.querySelector('${tip}').id`, 'keyboard focus reveals the instruction excerpt with an accessible description');
  browser('press', 'Escape');
  check(`!document.querySelector('${tip}').matches(':popover-open')`, 'Escape dismisses skill details');
  check(`[...document.querySelectorAll('${rail} a')].every(a => a.pathname === '/settings/skills' && a.target === '_blank' && a.rel === 'noopener')`, 'skill links open the verified Skills settings route without replacing the draft tab');
  browser('fill', '#message', 'Preserve this unsent draft');
  const originalTab = JSON.parse(browser('--json', 'tab', 'list')).data.tabs.find(tab => tab.active).tabId;
  browser('click', `${rail} a`);
  const settingsTab = JSON.parse(browser('--json', 'tab', 'list')).data.tabs.find(tab => new URL(tab.url).pathname === '/settings/skills');
  assert.ok(settingsTab, 'clicking a skill actually opens the settings path in another tab');
  browser('tab', 'close', settingsTab.tabId);
  browser('tab', originalTab);
  check(`document.querySelector('#message').value === 'Preserve this unsent draft'`, 'settings navigation leaves the original draft untouched');
  browser('eval', `fixtureAgents.add('alpha', 'Inspect composer', 'Check the layout'); fixtureAgents.add('beta', 'Inspect metadata', 'Check the schema'); document.querySelector('[data-message-composer-root]').style.width = '380px'`);
  browser('wait', '--fn', collapsed);
  check(`document.querySelector('${toggle}').checkVisibility() && !document.querySelector('${rail}').checkVisibility() && document.querySelector('[aria-label="Send"]').checkVisibility() && document.querySelector('[aria-label="Add images and files"]').checkVisibility()`, 'crowding folds extension controls only and preserves attachment and send');
  const closedHeight = evaluate(`document.querySelector('[data-message-composer-root]').getBoundingClientRect().height`);
  browser('click', toggle);
  browser('wait', '--fn', `${open} && ${settled}`);
  check(`(() => { const p = document.querySelector('${panel}'), c = document.querySelector('[data-message-composer-root]'), rect = p.getBoundingClientRect(); return !document.querySelector(':modal') && c.contains(p) && rect.height > 0 && rect.bottom <= document.querySelector('${toggle}').getBoundingClientRect().top && Math.abs(c.getBoundingClientRect().height - ${closedHeight} - rect.height) < 1; })()`, 'Thread tools expands the composer above the trigger in normal flow, never as a centered modal or overlay');
  check(`document.activeElement === document.querySelector('${toggle}') && document.querySelector('${toggle}').getAttribute('aria-expanded') === 'true' && document.querySelector('${toggle}').getAttribute('aria-controls') === document.querySelector('${panel}').id && document.querySelector('${panel}').textContent.includes('Subagents (2)') && document.querySelector('${panel}').textContent.includes('Skills (4)')`, 'disclosure keeps focus on its trigger and exposes expanded state and counts');
  check(`(() => { const p = document.querySelector('${panel}'), c = p.closest('[data-message-composer-root]'); return p.getBoundingClientRect().left >= c.getBoundingClientRect().left && p.getBoundingClientRect().right <= c.getBoundingClientRect().right && p.scrollWidth <= p.clientWidth; })()`, 'expanded panel fits a narrow composer without horizontal overflow');
  browser('focus', `${panel} footer a`);
  browser('press', 'Tab');
  check(`document.activeElement === document.querySelector('[aria-label="Add images and files"]') && ${open}`, 'Tab leaves the panel for native composer controls without a focus trap');
  browser('fill', '#message', 'Still editable while tools are open');
  check(`${open} && document.querySelector('#message').value === 'Still editable while tools are open'`, 'the rest of the thread stays interactive while tools are expanded');
  browser('fill', '#message', 'Preserve this unsent draft');
  browser('click', toggle);
  browser('wait', '--fn', `!${open} && ${settled}`);
  check(`document.querySelector('${panel}').getBoundingClientRect().height === 0 && document.querySelector('${panel}').inert && document.querySelector('${toggle}').getAttribute('aria-expanded') === 'false'`, 'clicking the trigger again collapses the panel and removes hidden controls from keyboard navigation');
  browser('focus', toggle);
  browser('press', 'Enter');
  browser('wait', '--fn', `${open} && ${settled}`);
  browser('focus', `${panel} footer a`);
  browser('press', 'Escape');
  check(`!${open} && document.activeElement === document.querySelector('${toggle}')`, 'keyboard activation opens the disclosure and Escape closes it with focus restored');
  browser('press', 'Space');
  browser('wait', '--fn', `${open} && ${settled}`);
  browser('focus', '[data-amp-tools-ui="actions"] button:nth-child(2)');
  browser('eval', `fixtureAgents.add('gamma', 'Check keyboard focus', 'Keep focused actions stable as counts change')`);
  browser('wait', '--fn', `document.querySelector('[data-amp-tools-ui="actions"] button:nth-child(2)').textContent === 'Subagents (3)'`);
  check(`document.activeElement.textContent === 'Subagents (3)'`, 'live count updates preserve the focused panel action');
  browser('focus', '[data-amp-tools-ui="list"] li:last-child a');
  check(`document.querySelector('[data-amp-tools-ui="detail"]').textContent.includes("Instruction text isn't included")`, 'historical summaries show an honest metadata fallback');
  browser('click', '[data-amp-tools-ui="actions"] button:first-child');
  browser('wait', '--fn', `!${open} && ${settled} && document.querySelector('[data-amp-thread-info-ui="panel"]').matches(':popover-open')`);
  check(`(() => { const p = document.querySelector('[data-amp-thread-info-ui="panel"]').getBoundingClientRect(), t = document.querySelector('${toggle}').getBoundingClientRect(); return p.bottom <= t.top && p.left >= 0; })()`, 'Info opens its existing panel anchored to the visible tools button');
  browser('press', 'Escape');
  browser('click', toggle);
  browser('wait', '--fn', `${open} && ${settled}`);
  browser('click', '[data-amp-tools-ui="actions"] button:nth-child(2)');
  browser('wait', '--fn', `!document.querySelector('[data-amp-subagents-ui="panel"]').hidden`);
  browser('click', '[aria-label="Close subagents"]');
  check(`document.activeElement === document.querySelector('${toggle}') && document.querySelector('#message').value === 'Preserve this unsent draft'`, 'existing Subagents panel opens and restores focus without touching drafts');
  browser('click', toggle);
  browser('wait', '--fn', `${open} && ${settled}`);
  browser('eval', `document.querySelector('[data-message-composer-root]').style.width = ''`);
  browser('wait', '--fn', `!${collapsed}`);
  check(`document.querySelector('${rail}').checkVisibility() && document.querySelector('[data-amp-subagents-ui="toggle"]').textContent === '(3)'`, 'growing the composer restores skill names and parenthesized compact counts');
  check(`${open} && document.querySelector('${rail} button').getAttribute('aria-expanded') === 'true'`, 'resizing keeps the panel open and updates the visible Skills trigger');
  browser('click', `${rail} button`);
  browser('wait', '--fn', `!${open} && ${settled}`);
  browser('click', `${rail} button`);
  browser('wait', '--fn', `${open} && ${settled}`);
  browser('click', '[aria-label="Close thread tools"]');
  check(`!${open} && document.activeElement === document.querySelector('${rail} button')`, 'Skills opens the same inline panel and its close button restores the roomy-layout trigger');
  browser('set', 'media', 'light', 'reduced-motion');
  browser('click', `${rail} button`);
  check(`${open} && document.querySelector('${panel}').getBoundingClientRect().height > 0 && ${settled}`, 'reduced motion expands the panel immediately without animation');
  browser('click', '[aria-label="Close thread tools"]');
  check(`document.querySelector('${panel}').getBoundingClientRect().height === 0`, 'reduced motion collapses the panel immediately');
  browser('set', 'media', 'light');
  browser('focus', `${rail} a`);
  browser('eval', `const f = skillFixture; fixtureThreadData['skills-test'].transcriptPage.messages.push(f.call('new', 'new-skill'), f.result('new')); document.querySelector('#fixture-transcript').append(document.createElement('p'))`);
  browser('wait', '--fn', `${names} === 'agent-browser,creating-views,frontend-design,new-skill,tdd'`);
  check(`skillFixture.requests.length === 2`, 'live refresh discovers new skills without refetching completed older history');
  check(`document.activeElement.textContent === 'agent-browser'`, 'a newly loaded skill does not steal keyboard focus from an existing link');
  browser('eval', `(() => {
    const f = skillFixture;
    f.previous = fixtureThreadData['skills-test'].transcriptPage;
    f.pages['400'] = {messages:[f.call('gap', 'gap-skill'), f.result('gap')], firstMessageIndex:130, firstMessageID:'gap', lastMessageIndex:399, hasMoreBefore:true};
    fixtureThreadData['skills-test'].transcriptPage = {messages:[], firstMessageIndex:400, firstMessageID:'new-page', lastMessageIndex:450, hasMoreBefore:true};
    document.querySelector('#fixture-transcript').append(document.createElement('p'));
  })()`);
  browser('wait', '--fn', `(${names}).includes('gap-skill')`);
  check(`skillFixture.requests.length === 3 && skillFixture.requests.at(-1).url.includes('before=400')`, 'live bursts bridge missing pages but stop at already-read history');
  browser('eval', `fixtureThreadData['skills-test'].transcriptPage = skillFixture.previous`);
  browser('eval', `skillFixture.fail = true; fixtureThreadData['skills-partial'] = fixtureThreadData['skills-test']; fixtureAgents.navigate('skills-partial')`);
  browser('wait', '--fn', `document.querySelector('${rail}').textContent.startsWith('Skills (2+)')`);
  check(`!(${names}).includes('tdd') && document.querySelector('[data-amp-tools-ui="notice"]').textContent.includes("Couldn't load all history")`, 'stale pagination labels a partial count and cannot leak another thread’s cached skills');
  browser('eval', `skillFixture.fail = false; document.querySelector('#fixture-transcript').append(document.createElement('p'))`);
  browser('wait', '--fn', `document.querySelector('${rail}').textContent.startsWith('Skills (5)')`);
  browser('eval', `fixtureThreadData['skills-unknown'] = {type:'result', thread:{id:'skills-unknown'}, transcriptPage:{messages:[], collapsedTurns:[{turnID:'no-sources'}]}}; fixtureAgents.navigate('skills-unknown')`);
  browser('wait', '--fn', `document.querySelector('${rail}').textContent.startsWith('Skills (0+)')`);
  check(`document.querySelector('[data-amp-tools-ui="notice"]').textContent.includes('no skill summary')`, 'missing collapsed-turn summaries are not presented as a complete empty history');
  browser('eval', `(() => {
    const f = skillFixture;
    f.pages['after:10'] = {messages:[f.result('forward')], hasMoreAfter:false, lastMessageIndex:20};
    fixtureThreadData['skills-forward'] = {type:'result', thread:{id:'skills-forward'}, transcriptPage:{messages:[f.call('forward','forward-skill')], hasMoreAfter:true, lastMessageIndex:10, lastMessageID:'forward-start'}};
    fixtureAgents.navigate('skills-forward');
  })()`);
  browser('wait', '--fn', `${names} === 'forward-skill'`);
  check(`skillFixture.requests.at(-1).url.includes('after=10&anchorID=forward-start')`, 'an anchored transcript page also loads newer history');
  browser('eval', `fixtureAgents.navigate('fixture-b')`);
  browser('wait', '--fn', `document.querySelector('${rail}').textContent.includes('No skills used yet')`);
  check(`${names} === ''`, 'empty thread has no skill links from the previous thread');
  browser('eval', 'chrome.storage.local.set({showComposerSkills:false, showComposerContext:false, infoOrb:false, threadMessagesPanel:false})');
  browser('wait', '--fn', `!document.querySelector('${rail}')`);
  const before = evaluate('fixtureThreadRequests.length');
  browser('eval', `fixtureAgents.navigate('skills-test')`);
  browser('wait', '5500');
  check(`fixtureThreadRequests.length === ${before}`, 'disabling data-reading features stops requests and clears the skills cache');
  browser('eval', 'chrome.storage.local.set({showComposerSkills:true})');
  browser('wait', '--fn', `${names} === 'agent-browser,creating-views,frontend-design,new-skill,tdd'`);
  browser('set', 'viewport', '767', '900', '2');
  browser('wait', '--fn', `!document.querySelector('${rail}') && !document.querySelector('${panel}')`);
  check(`!document.querySelector('[data-amp-tools-collapsed]')`, 'mobile cleanup removes the panel, controls, and layout markers');
  check(`Object.keys(JSON.parse(localStorage.getItem('extension-settings'))).every(key => ['showComposerSkills','showComposerContext','infoOrb','threadMessagesPanel'].includes(key))`, 'only preferences persist, never skill content');
  check(`JSON.parse(${JSON.stringify(browser('--json', 'errors'))}).data.errors.length === 0`, 'no browser runtime errors');
} finally {
  browser('close');
}
