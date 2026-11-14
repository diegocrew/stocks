import assert from 'node:assert/strict';
import test from 'node:test';
import { startAutoRefresh } from '../src/auto-refresh.ts';

test('refreshes on start, foreground and interval only while active, and cleans up', context => {
  context.mock.timers.enable({ apis: ['setInterval'] });
  let listener;
  let removed = false;
  let calls = 0;
  const lifecycle = {
    currentState: 'active',
    addEventListener(type, callback) {
      assert.equal(type, 'change');
      listener = callback;
      return { remove() { removed = true; } };
    },
  };
  const stop = startAutoRefresh(lifecycle, () => calls++);
  assert.equal(calls, 1);
  context.mock.timers.tick(15 * 60 * 1000);
  assert.equal(calls, 2);
  lifecycle.currentState = 'background';
  listener('background');
  context.mock.timers.tick(15 * 60 * 1000);
  assert.equal(calls, 2);
  lifecycle.currentState = 'active';
  listener('active');
  assert.equal(calls, 3);
  stop();
  assert.equal(removed, true);
  context.mock.timers.tick(15 * 60 * 1000);
  assert.equal(calls, 3);
});
