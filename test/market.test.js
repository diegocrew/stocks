import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chartColor, percentChange, formatPercent, tileColor, historyFor, normalizedSeries, toggleComparison } from '../src/market.js';
import { cleanPoints, weeklyChange, shouldRunSchedule } from '../scripts/data-utils.mjs';

test('chart color follows selected-period endpoints, with neutral for unchanged prices', () => {
  assert.equal(chartColor(100, 110), '#5cc69d');
  assert.equal(chartColor(110, 100), '#ee8490');
  assert.equal(chartColor(100, 100), '#8290a4');
});

test('daily returns and missing values never become fabricated zeroes', () => {
  assert.equal(percentChange(110, 100), 10.000000000000009);
  assert.equal(percentChange(100, 0), null);
  assert.equal(percentChange(undefined, 100), null);
  assert.equal(formatPercent(null), 'N/A');
  assert.equal(tileColor(null), '#414b5a');
  assert.notEqual(tileColor(-5), tileColor(5));
  assert.equal(tileColor(12), tileColor(100));
});

test('weekly change uses the last available close at or before seven calendar days ago', () => {
  const time = Date.parse('2026-11-09T16:00:00Z') / 1000;
  const daily = [{ time: time - 10 * 86400, close: 80 }, { time: time - 7 * 86400, close: 100 }, { time: time - 6 * 86400, close: 105 }];
  assert.ok(Math.abs(weeklyChange(110, new Date(time * 1000), daily) - 10) < 1e-10);
  assert.equal(weeklyChange(110, new Date(time * 1000), []), null);
});

test('history periods use the latest quote, not the current calendar date', () => {
  const daily = Array.from({ length: 800 }, (_, i) => ({ time: i * 86400, close: i + 1 }));
  const stock = { daily, monthly: [{ time: -86400, close: 1 }], intraday: [
    { time: 1, close: 1, session: '2026-11-06' }, { time: 2, close: 2, session: '2026-11-09' }
  ] };
  assert.equal(historyFor(stock, 'day').length, 1);
  assert.equal(historyFor(stock, 'week').length, 8);
  assert.equal(historyFor(stock, 'month').length, 32);
  assert.equal(historyFor(stock, 'year').length, 367);
  assert.equal(historyFor(stock, 'max').length, 801);
});

test('comparison caps at five and allows removal at the limit', () => {
  const five = ['A', 'B', 'C', 'D', 'E'];
  assert.throws(() => toggleComparison(five, 'F'), /up to 5/);
  assert.deepEqual(toggleComparison(five, 'C'), ['A', 'B', 'D', 'E']);
  assert.equal(toggleComparison(['A'], 'B').length, 2);
});

test('comparison rebases different currencies and rejects nonoverlapping history', () => {
  const a = { daily: [{ time: 1, close: 100 }, { time: 2, close: 200 }, { time: 3, close: 220 }] };
  const b = { daily: [{ time: 2, close: 10 }, { time: 3, close: 11 }] };
  const series = normalizedSeries([a, b], 'week');
  assert.equal(series[0].points[0].value, 0);
  assert.ok(Math.abs(series[0].points[1].value - series[1].points[1].value) < 1e-10);
  assert.throws(() => normalizedSeries([a, { daily: [{ time: 9, close: 1 }, { time: 10, close: 2 }] }], 'week'), /overlapping/);
  assert.throws(() => normalizedSeries([a, { daily: [] }], 'week'), /Not enough/);
});

test('intraday sessions follow exchange timezone; invalid close is excluded', () => {
  const points = cleanPoints([{ date: '2026-01-01T23:30:00Z', close: 100 }, { date: '2026-01-02T00:00:00Z', close: null }], 'Asia/Seoul', true);
  assert.equal(points.length, 1);
  assert.equal(points[0].session, '2026-01-02');
});

test('Prague schedule selects the right UTC pair including DST transition days', () => {
  for (const date of ['2026-01-01', '2026-03-28', '2026-10-25', '2026-12-01']) {
    assert.equal(shouldRunSchedule('0 9,15 * * *', new Date(date)), true);
    assert.equal(shouldRunSchedule('0 8,14 * * *', new Date(date)), false);
  }
  for (const date of ['2026-03-29', '2026-07-01', '2026-10-24']) {
    assert.equal(shouldRunSchedule('0 8,14 * * *', new Date(date)), true);
    assert.equal(shouldRunSchedule('0 9,15 * * *', new Date(date)), false);
  }
});
