import { test } from 'node:test';
import assert from 'node:assert/strict';
import { topHoldings, holdingChanges, validateHoldings } from '../src/portfolios.js';

const holding = (symbol, weight) => ({ id: symbol, symbol, name: symbol, weight });

test('portfolio top 30 follows weights, excludes untickered positions, does not fill unavailable quotes', () => {
  const holdings = Array.from({ length: 40 }, (_, i) => holding(`S${i}`, i + 1));
  holdings.push({ id: 'cash', symbol: null, name: 'Cash', weight: 99 });
  const top = topHoldings({ holdings });
  assert.equal(top.length, 30);
  assert.equal(top[0].symbol, 'S39');
  assert.equal(top.at(-1).symbol, 'S10');
  assert.equal(topHoldings({ holdings: [holding('A', 50)] }).length, 1);
});

test('new membership and changed weights are detected without mutating earlier snapshots', () => {
  const before = [holding('A', 60), holding('B', 40)];
  const after = [holding('A', 55), holding('C', 45)];
  const changes = holdingChanges(before, after);
  assert.deepEqual(changes.added.map(item => item.symbol), ['C']);
  assert.deepEqual(changes.removed.map(item => item.symbol), ['B']);
  assert.deepEqual(changes.weights, [{ id: 'A', symbol: 'A', name: 'A', before: 60, after: 55 }]);
  assert.equal(before[0].weight, 60);
  assert.deepEqual(holdingChanges(after, after), { added: [], removed: [], weights: [] });
});

test('new source weights automatically change top-30 membership', () => {
  const holdings = Array.from({ length: 31 }, (_, i) => holding(`S${i}`, 31 - i));
  assert.ok(!topHoldings({ holdings }).some(item => item.symbol === 'S30'));
  holdings[30].weight = 50;
  assert.ok(topHoldings({ holdings }).some(item => item.symbol === 'S30'));
  assert.ok(!topHoldings({ holdings }).some(item => item.symbol === 'S29'));
});

test('incomplete and invalid holdings fail validation, while offsetting derivative positions remain visible', () => {
  assert.throws(() => validateHoldings([], 20), /Incomplete/);
  assert.throws(() => validateHoldings([holding('A', 50), holding('A', 50)], 2), /duplicate/);
  assert.throws(() => validateHoldings([holding('A', NaN)], 1), /Invalid/);
  assert.throws(() => validateHoldings([holding('A', 30)], 1), /total/);
  assert.equal(validateHoldings([holding('A', 100), holding('future', 1), holding('contra', -1)], 3).length, 3);
  assert.equal(validateHoldings([holding('A', 100), { id: 'pending', name: 'Pending dividends', symbol: null, weight: null }], 2).length, 2);
});
