import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { companies as defaults } from '../scripts/companies.mjs';
import { historyFor } from '../src/market.js';
import { SECTORS, validateSelection } from '../src/watchlist.js';
import { topHoldings, validateHoldings } from '../src/portfolios.js';

test('500-company catalog spans four sectors and global countries with original defaults', async () => {
  const catalog = JSON.parse(await readFile(new URL('../public/data/companies.json', import.meta.url), 'utf8'));
  assert.equal(catalog.companies.length, 500);
  assert.equal(new Set(catalog.companies.map(company => company.symbol)).size, 500);
  assert.ok(new Set(catalog.companies.map(company => company.country)).size >= 20);
  assert.deepEqual(new Set(catalog.companies.map(company => company.sector)), new Set(Object.keys(SECTORS).filter(sector => sector !== 'other')));
  assert.deepEqual(catalog.defaultSymbols, defaults.map(company => company.symbol));
  assert.equal(validateSelection(catalog.defaultSymbols, catalog.companies).length, 30);
  for (const symbol of ['AAPL', 'LLY', 'NVDA', 'LMT']) assert.ok(catalog.companies.some(company => company.symbol === symbol), `Missing major company ${symbol}`);
});

test('published snapshot uses real finite quotes and separately loadable price histories', async () => {
  const catalog = JSON.parse(await readFile(new URL('../public/data/companies.json', import.meta.url), 'utf8'));
  const companies = catalog.companies;
  const snapshot = JSON.parse(await readFile(new URL('../public/data/market.json', import.meta.url), 'utf8'));
  assert.equal(snapshot.schemaVersion, 2);
  assert.ok(Number.isFinite(Date.parse(snapshot.generatedAt)));
  const configured = new Set(companies.map(company => company.symbol));
  const portfolioData = JSON.parse(await readFile(new URL('../public/data/portfolios.json', import.meta.url), 'utf8'));
  for (const portfolio of portfolioData.portfolios) {
    for (const holding of topHoldings(portfolio)) configured.add(holding.symbol);
  }
  const symbols = new Set();
  for (const stock of snapshot.stocks) {
    assert.ok(configured.has(stock.symbol));
    assert.ok(!symbols.has(stock.symbol), `Duplicate ${stock.symbol}`);
    symbols.add(stock.symbol);
    assert.ok(stock.price > 0);
    assert.ok(stock.marketCapUsd > 0);
    assert.ok(Number.isFinite(stock.dailyChange));
    assert.ok(stock.weeklyChange === null || Number.isFinite(stock.weeklyChange));
    assert.ok(Number.isFinite(Date.parse(stock.quoteTime)));
    assert.equal(stock.daily, undefined, 'Market index must not download all company histories');
    const history = JSON.parse(await readFile(new URL(`../public/data/history/${encodeURIComponent(stock.symbol)}.json`, import.meta.url), 'utf8'));
    const complete = { ...stock, ...history };
    for (const range of ['day', 'week', 'month', 'year', 'max']) {
      const points = historyFor(complete, range);
      if (range !== 'day') assert.ok(points.length >= 2, `${stock.symbol} ${range} missing history`);
      assert.ok(points.every((point, index) => point.close > 0 && Number.isFinite(point.time) && (!index || points[index - 1].time < point.time)), `${stock.symbol} ${range} invalid points`);
    }
  }
  assert.ok(snapshot.stocks.length > 0);
  for (const symbol of catalog.defaultSymbols) assert.ok(symbols.has(symbol), `Default company ${symbol} is unavailable`);
  const missing = companies.filter(company => !symbols.has(company.symbol));
  for (const company of missing) assert.ok(snapshot.warnings.some(warning => warning.startsWith(`${company.symbol}:`)));
});

test('all four portfolios publish complete dated holdings and trackable top selections', async () => {
  const data = JSON.parse(await readFile(new URL('../public/data/portfolios.json', import.meta.url), 'utf8'));
  assert.deepEqual(data.portfolios.map(portfolio => portfolio.id), ['spy', 'berkshire', 'qqq', 'arkk']);
  const market = JSON.parse(await readFile(new URL('../public/data/market.json', import.meta.url), 'utf8'));
  for (const portfolio of data.portfolios) {
    validateHoldings(portfolio.holdings, portfolio.minimum);
    assert.match(portfolio.asOf, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(Date.parse(portfolio.checkedAt) > 0);
    assert.ok(portfolio.url.startsWith('https://'));
    assert.ok(Array.isArray(portfolio.changes));
    const top = topHoldings(portfolio);
    assert.ok(top.length >= 20 && top.length <= 30);
    assert.equal(new Set(top.map(holding => holding.symbol)).size, top.length);
    for (const holding of top) {
      assert.ok(market.stocks.some(stock => stock.symbol === holding.symbol) || market.warnings.some(warning => warning.startsWith(`${holding.symbol}:`)), `Missing quote or explicit warning for ${holding.symbol}`);
    }
  }
});
