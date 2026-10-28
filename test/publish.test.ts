import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.ts';
import { applyAction, EMPTY_CONTROLS } from '../src/controls.ts';
import { parseAction } from '../src/controlsSchema.ts';
import { problems } from '../src/dashboard.ts';
import { isDue, unitsFor } from '../src/publish/plan.ts';

const post = { caption: 'tekst', images: { feed: ['a.png', 'b.png'], story: ['c.png', 'd.png'] } };

test('the morning post goes out at 07:00, is useless after 11:00, and never twice', () => {
  const [feed, story] = unitsFor('2026-10-25', post, true);
  assert.deepEqual([feed.key, feed.publishAt, feed.expiresAt, story.key], ['2026-10-25-feed', '2026-10-25T07:00', '2026-10-25T11:00', '2026-10-25-story']);
  assert.equal(isDue(feed, {}, '2026-10-25T06:50'), false);
  assert.equal(isDue(feed, {}, '2026-10-25T07:10'), true);
  assert.equal(isDue(feed, {}, '2026-10-25T11:10'), false);
  assert.equal(isDue(feed, { '2026-10-25-feed': {} }, '2026-10-25T07:40'), false);
  assert.equal(unitsFor('2026-10-25', post, false).length, 1);
});

test('dashboard actions are validated and logged', () => {
  assert.deepEqual(parseAction({ type: 'publish-now', key: '2026-10-25-feed' }), { type: 'publish-now', key: '2026-10-25-feed' });
  assert.throws(() => parseAction({ type: 'skip', key: '../x' }), /Ugyldig/);
  const c = applyAction(EMPTY_CONTROLS, { type: 'pause' }, 'a@b.no');
  assert.equal(c.paused, true);
  assert.equal(c.log[0].action, 'Satte automatisk publisering på pause');
});

test('the dashboard flags failed traffic data and a failed post', () => {
  const base = { config: loadConfig(), controls: EMPTY_CONTROLS, published: {}, units: [], rows: [], tokenRefreshedAt: null, now: '2026-10-25T16:00', builtAt: '2026-10-25T14:00:00Z', repo: null };
  assert.deepEqual(problems({ ...base, status: {} }), []);
  const p = problems({ ...base, status: { generate: { at: '', date: '2026-10-25', total: 500000, diff: 2, passed: 1, errors: ['bare 5 av 8 punkter fullt målt i går'], warnings: [] }, publish: { at: '', paused: false, published: [], failed: [{ key: '2026-10-25-feed', error: 'timeout' }] } } });
  assert.deepEqual(p.map((x) => x.level), ['bad', 'bad']);
});
