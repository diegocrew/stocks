import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterCompanies, toggleStock, validateSelection, MAX_STOCKS } from '../src/watchlist.js';
import { marketCapCurrency } from '../scripts/data-utils.mjs';

const catalog = [
  { symbol: 'NVDA', name: 'Nvidia', sector: 'ai', country: 'USA' },
  { symbol: 'SAP', name: 'SAP', sector: 'it', country: 'Germany' },
  { symbol: 'LMT', name: 'Lockheed Martin', sector: 'defence', country: 'USA' },
  { symbol: 'LLY', name: 'Eli Lilly', sector: 'medical', country: 'USA' }
];

test('catalog filters compose search, sector, country and selected-only', () => {
  assert.equal(filterCompanies(catalog).length, 4);
  assert.equal(filterCompanies(catalog, { search: ' nViDiA ' })[0].symbol, 'NVDA');
  assert.equal(filterCompanies(catalog, { search: 'Germany' })[0].symbol, 'SAP');
  assert.equal(filterCompanies(catalog, { sector: 'medical', country: 'USA' })[0].symbol, 'LLY');
  assert.equal(filterCompanies(catalog, { sector: 'medical', country: 'Germany' }).length, 0);
  assert.deepEqual(filterCompanies(catalog, { selectedOnly: true, selected: ['SAP', 'LLY'], search: 'SAP' }).map(company => company.symbol), ['SAP']);
});

test('watchlist allows a focused list, enforces 30 maximum and preserves at least one', () => {
  const symbols = Array.from({ length: MAX_STOCKS }, (_, index) => `S${index}`);
  assert.throws(() => toggleStock(symbols, 'NEW'), /limited to 30/);
  assert.equal(symbols.length, 30);
  assert.equal(toggleStock(symbols, 'S0').length, 29);
  assert.deepEqual(toggleStock(['NVDA'], 'SAP'), ['NVDA', 'SAP']);
  assert.throws(() => toggleStock(['NVDA'], 'NVDA'), /at least one/);
});

test('stored selection must be valid, known and nonempty', () => {
  assert.deepEqual(validateSelection(['NVDA', 'NVDA', 'SAP'], catalog), ['NVDA', 'SAP']);
  for (const value of [null, {}, 'NVDA', [1], [], ['UNKNOWN']]) assert.throws(() => validateSelection(value, catalog));
  const large = Array.from({ length: 31 }, (_, i) => ({ symbol: String(i) }));
  assert.throws(() => validateSelection(large.map(item => item.symbol), large), /between 1 and 30/);
});

test('minor-unit quotes use major currency market capitalization', () => {
  for (const [currency, expected] of [['GBp', 'GBP'], ['GBX', 'GBP'], ['ILA', 'ILS'], ['KWF', 'KWD'], ['ZAc', 'ZAR'], ['USD', 'USD'], ['EUR', 'EUR']]) {
    assert.equal(marketCapCurrency(currency), expected);
  }
});
