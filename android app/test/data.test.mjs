import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseCatalog, parseHistory, parsePortfolios, parseSnapshot } from '../src/data.ts';

test('accepts repository market, directory, holdings and price history snapshots', () => {
  const read = file => JSON.parse(readFileSync(new URL(`../../public/data/${file}`, import.meta.url), 'utf8'));
  const snapshot = parseSnapshot(read('market.json'));
  const catalog = parseCatalog(read('companies.json'));
  assert.ok(catalog.defaultSymbols.every(symbol => catalog.companies.some(company => company.symbol === symbol)));
  assert.ok(snapshot.stocks.some(stock => stock.symbol === 'NVDA'));
  assert.ok(parsePortfolios(read('portfolios.json')).length > 0);
  assert.ok(parseHistory(read('history/NVDA.json')).daily.length > 1);
});

test('rejects invalid quote timestamps and non-numeric prices before rendering', () => {
  const valid = JSON.parse(readFileSync(new URL('../../public/data/market.json', import.meta.url), 'utf8'));
  valid.stocks[0].quoteTime = 'not a date';
  assert.throws(() => parseSnapshot(valid), /snapshot is invalid/);
  valid.stocks[0].quoteTime = new Date().toISOString();
  valid.stocks[0].price = '123';
  assert.throws(() => parseSnapshot(valid), /snapshot is invalid/);
});

test('rejects malformed, unordered and non-positive chart points', () => {
  for (const daily of [[{ time: 1, close: null }], [{ time: 1, close: 0 }], [{ time: 2, close: 10 }, { time: 1, close: 20 }]]) {
    assert.throws(() => parseHistory({ daily, monthly: [], intraday: [] }), /history is invalid/);
  }
  assert.deepEqual(parseHistory({ daily: [], monthly: [], intraday: [] }), { daily: [], monthly: [], intraday: [] });
});
