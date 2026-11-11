import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { historyFor } from '../src/market.js';
import { topHoldings, PORTFOLIO_STORAGE_KEY } from '../src/portfolios.js';

test('portfolio presets follow top holdings, show full disclosures and preserve personal choices', async ({ page }) => {
  const data = JSON.parse(await readFile(new URL('../public/data/portfolios.json', import.meta.url), 'utf8'));
  await page.goto('/');
  await page.locator('#stock-manager > summary').click();
  await expect(page.locator('#portfolio-select option')).toHaveCount(5);
  for (const id of ['spy', 'berkshire', 'qqq', 'arkk']) {
    await page.locator('#portfolio-select').selectOption(id);
    await expect(page.locator('#portfolio-status')).toContainText('Holdings as of');
    await expect(page.locator('#map-sizing')).toContainText('portfolio holding weight');
    await expect(page.locator('#portfolio-coverage')).toContainText('reported portfolio weight');
    await expect(page.locator('.selected-chip').first()).toBeDisabled();
    await expect(page.locator('#chart svg')).toBeVisible();
    if (id === 'berkshire') {
      await expect(page.locator('#portfolio-description')).toContainText('Delayed, not live');
      await expect(page.locator('.tile')).toHaveCount(topHoldings(data.portfolios.find(portfolio => portfolio.id === id)).length);
    } else await expect(page.locator('.tile')).toHaveCount(30);
  }
  await page.locator('#holdings-summary').click();
  await expect(page.locator('#holdings-rows tr')).toHaveCount(44);
  await page.locator('#holdings-search').fill('TESLA');
  await expect(page.locator('#holdings-rows tr')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('#portfolio-select')).toHaveValue('arkk');
  await expect(page.locator('#map-sizing')).toContainText('portfolio holding weight');
  await page.locator('#stock-manager > summary').click();
  await page.locator('#portfolio-select').selectOption('custom');
  await expect(page.locator('#watchlist-count')).toHaveText('30 / 30 selected');
  await expect(page.locator('#company-select option[value="005930.KS"]')).toHaveCount(1);
  await expect(page.locator('#map-sizing')).toContainText('market cap');
});

test('followed portfolio applies changed published membership and weights on reload', async ({ page }) => {
  const data = JSON.parse(await readFile(new URL('../public/data/portfolios.json', import.meta.url), 'utf8'));
  const spy = data.portfolios.find(portfolio => portfolio.id === 'spy');
  const initialTop = topHoldings(spy);
  const removed = initialTop.at(-1).symbol;
  const added = spy.holdings.find(holding => holding.symbol === 'AXP');
  expect(initialTop.some(holding => holding.symbol === 'AXP')).toBe(false);
  await page.addInitScript(key => localStorage.setItem(key, 'spy'), PORTFOLIO_STORAGE_KEY);
  await page.goto('/');
  await expect(page.locator(`#company-select option[value="${removed}"]`)).toHaveCount(1);
  added.weight = 20;
  spy.holdings.find(holding => holding.symbol === removed).weight = 0;
  await page.route('**/data/portfolios.json', route => route.fulfill({ json: data }));
  await page.reload();
  await expect(page.locator('#company-select option[value="AXP"]')).toHaveCount(1);
  await expect(page.locator(`#company-select option[value="${removed}"]`)).toHaveCount(0);
  const axp = page.locator('.tile').filter({ has: page.locator('.ticker', { hasText: /^AXP$/ }) });
  await expect(axp.locator('.tile-cap')).toHaveText('20.00% of portfolio');
});

test('visible followed portfolio refreshes automatically after 15 minutes', async ({ page }) => {
  const data = JSON.parse(await readFile(new URL('../public/data/portfolios.json', import.meta.url), 'utf8'));
  const spy = data.portfolios.find(portfolio => portfolio.id === 'spy');
  const removed = topHoldings(spy).at(-1).symbol;
  await page.clock.install();
  await page.addInitScript(key => localStorage.setItem(key, 'spy'), PORTFOLIO_STORAGE_KEY);
  await page.goto('/');
  await expect(page.locator(`#company-select option[value="${removed}"]`)).toHaveCount(1);
  spy.holdings.find(holding => holding.symbol === 'AXP').weight = 20;
  spy.holdings.find(holding => holding.symbol === removed).weight = 0;
  await page.route('**/data/portfolios.json', route => route.fulfill({ json: data }));
  await page.clock.fastForward(15 * 60 * 1000);
  await expect(page.locator('#company-select option[value="AXP"]')).toHaveCount(1);
  await expect(page.locator(`#company-select option[value="${removed}"]`)).toHaveCount(0);
});

test('a retained holdings source is explicitly flagged and portfolio fetch errors preserve personal mode', async ({ page }) => {
  const data = JSON.parse(await readFile(new URL('../public/data/portfolios.json', import.meta.url), 'utf8'));
  const spy = data.portfolios.find(portfolio => portfolio.id === 'spy');
  spy.stale = true;
  spy.error = 'Provider unavailable';
  await page.route('**/data/portfolios.json', route => route.fulfill({ json: data }));
  await page.goto('/');
  await page.locator('#stock-manager > summary').click();
  await page.locator('#portfolio-select').selectOption('spy');
  await expect(page.locator('#notice')).toContainText('holdings refresh failed');
  await expect(page.locator('#notice')).toContainText('Provider unavailable');
  await expect(page.locator('.tile')).toHaveCount(30);
  await page.route('**/data/portfolios.json', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.reload();
  await expect(page.locator('#notice')).toContainText('Portfolio presets unavailable');
  await expect(page.locator('#portfolio-select')).toHaveValue('custom');
  await expect(page.locator('#company-select option[value="005930.KS"]')).toHaveCount(1);
});

test('single-company chart line and fill follow the selected period rather than daily performance', async ({ page }) => {
  const history = JSON.parse(await readFile(new URL('../public/data/history/NVDA.json', import.meta.url), 'utf8'));
  await page.goto('/');
  const colors = new Set();
  for (const range of ['day', 'week', 'month', 'year', 'max']) {
    await page.locator(`[data-range="${range}"]`).click();
    const points = historyFor(history, range);
    const start = points[0].close;
    const end = points.at(-1).close;
    const expected = end > start ? '#5cc69d' : end < start ? '#ee8490' : '#8290a4';
    colors.add(expected);
    await expect(page.locator('#chart path[fill="none"]')).toHaveAttribute('stroke', expected);
    await expect(page.locator('#chart path:not([fill="none"])')).toHaveAttribute('fill', expected);
  }
  expect(colors.has('#5cc69d')).toBe(true);
  expect(colors.has('#ee8490')).toBe(true);
  await page.getByRole('button', { name: 'Compare Nvidia', exact: true }).click();
  await page.getByRole('button', { name: 'Compare Microsoft', exact: true }).click();
  await expect(page.locator('#chart path[fill="none"]')).toHaveCount(2);
  await expect(page.locator('#chart path[fill="none"]').nth(0)).toHaveAttribute('stroke', '#7dd3fc');
  await expect(page.locator('#chart path[fill="none"]').nth(1)).toHaveAttribute('stroke', '#c4b5fd');
});

test('real snapshot, company history, sector zoom and five-company comparison', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.tile')).toHaveCount(30);
  await expect(page.locator('#notice')).toBeHidden();
  await expect(page.locator('#chart svg')).toBeVisible();
  await page.getByRole('button', { name: 'Defence & aerospace', exact: true }).click();
  await expect(page.locator('.tile')).toHaveCount(12);
  await page.getByRole('button', { name: /^Lockheed Martin: daily/ }).click();
  await expect(page.locator('#company-detail h3')).toHaveText('Lockheed Martin');
  const paths = [];
  for (const period of ['day', 'week', 'month', 'year', 'max']) {
    await page.locator(`[data-range="${period}"]`).click();
    await expect(page.locator('#chart svg')).toBeVisible();
    await expect(page.locator(`[data-range="${period}"]`)).toHaveAttribute('aria-pressed', 'true');
    paths.push(await page.locator('#chart path[fill="none"]').getAttribute('d'));
  }
  expect(new Set(paths).size).toBe(5);
  await page.getByRole('button', { name: 'All companies', exact: true }).click();
  for (const name of ['Nvidia', 'Microsoft', 'Amazon', 'Meta', 'Broadcom']) {
    await page.getByRole('button', { name: `Compare ${name}`, exact: true }).click();
  }
  await expect(page.locator('.comparison-chip')).toHaveCount(5);
  await expect(page.locator('#chart path[fill="none"]')).toHaveCount(5);
  await page.getByRole('button', { name: 'Compare AMD', exact: true }).click();
  await expect(page.locator('.comparison-chip')).toHaveCount(5);
  await expect(page.locator('#comparison-notice')).toContainText('up to 5');
  await page.getByRole('button', { name: 'Remove MSFT from comparison' }).click();
  await page.getByRole('button', { name: 'Compare AMD', exact: true }).click();
  await expect(page.locator('.comparison-chip')).toHaveCount(5);
  await page.getByRole('button', { name: 'Clear comparison', exact: true }).click();
  await expect(page.locator('.comparison-chip')).toHaveCount(0);
  await expect(page.locator('#notice')).toBeHidden();
  expect(errors).toEqual([]);
});

test('mobile layout, international quote and mixed-market comparison', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.tile')).toHaveCount(30);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Defence & aerospace', exact: true }).click();
  await page.getByRole('button', { name: /^BAE Systems: daily/ }).click();
  await expect(page.locator('#company-detail')).toContainText('GBp');
  await page.locator('[data-range="week"]').click();
  await expect(page.locator('#chart svg')).toBeVisible();
  await page.getByRole('button', { name: 'Compare BAE Systems', exact: true }).click();
  await page.getByRole('button', { name: 'Compare Lockheed Martin', exact: true }).click();
  await expect(page.locator('#chart path[fill="none"]')).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a failed data request produces a visible error, not demo prices', async ({ page }) => {
  await page.route('**/data/market.json', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.goto('/');
  await expect(page.locator('#notice')).toContainText('503');
  await expect(page.locator('.tile')).toHaveCount(0);
});

test('Stock Atlas catalog filters 500 companies and limits a persistent personal watchlist to 30', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Stock Atlas | Your market dashboard');
  await expect(page.getByText('TWICE-DAILY SNAPSHOT')).toHaveCount(0);
  await page.locator('#stock-manager > summary').click();
  await expect(page.locator('#catalog-results')).toContainText('500 of 500');
  await expect(page.locator('#catalog-rows tr')).toHaveCount(50);
  await page.locator('#catalog-search').fill('Apple');
  const apple = page.getByRole('checkbox', { name: 'Track Apple (AAPL)', exact: true });
  await apple.click();
  await expect(page.locator('#selection-notice')).toContainText('limited to 30');
  await expect(apple).not.toBeChecked();
  await page.getByRole('button', { name: 'Untrack NVDA', exact: true }).click();
  await apple.check();
  await expect(page.locator('#watchlist-count')).toHaveText('30 / 30 selected');
  await expect(page.locator('#company-select option[value="AAPL"]')).toHaveCount(1);
  await expect(page.locator('#company-select option[value="NVDA"]')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#company-select option[value="AAPL"]')).toHaveCount(1);
  await expect(page.locator('.tile')).toHaveCount(30);
  await page.locator('#stock-manager > summary').click();
  await page.locator('#catalog-sector').selectOption('medical');
  await expect(page.locator('#catalog-results')).toContainText('180 of 500');
  await page.locator('#catalog-country').selectOption('USA');
  await page.locator('#catalog-search').fill('LLY');
  await expect(page.locator('#catalog-rows tr')).toHaveCount(1);
  await expect(page.locator('#catalog-rows')).toContainText('Eli Lilly');
  await page.getByRole('button', { name: 'Untrack MSFT', exact: true }).click();
  await page.getByRole('checkbox', { name: /Track Eli Lilly.*\(LLY\)/ }).check();
  await page.locator('[data-sector="medical"]').click();
  await expect(page.locator('.tile')).toHaveCount(1);
  await page.locator('.tile-main').click();
  await expect(page.locator('#company-detail h3')).toContainText('Lilly');
  await expect(page.locator('#chart svg')).toBeVisible();
  await page.getByRole('button', { name: 'Restore default 30' }).click();
  await expect(page.locator('.tile')).toHaveCount(30);
  await expect(page.locator('#company-select option[value="NVDA"]')).toHaveCount(1);
  await expect(page.locator('#company-select option[value="AAPL"]')).toHaveCount(0);
});

test('mobile directory paginates without overflow and handles zero results', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('#stock-manager > summary').click();
  await expect(page.locator('#catalog-page')).toHaveText('Page 1 of 10');
  await page.getByRole('button', { name: 'Next →', exact: true }).click();
  await expect(page.locator('#catalog-page')).toHaveText('Page 2 of 10');
  await page.locator('#catalog-search').fill('No such company 999');
  await expect(page.locator('#catalog-rows')).toContainText('No companies match');
  await expect(page.locator('#catalog-page')).toHaveText('Page 1 of 1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('corrupt saved data restores defaults with a visible warning', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('stock-atlas.watchlist.v1', '{invalid'));
  await page.goto('/');
  await expect(page.locator('#selection-notice')).toContainText('Could not restore');
  await expect(page.locator('.tile')).toHaveCount(30);
});

test('history fetch failure is explicit while the heatmap remains usable', async ({ page }) => {
  await page.route('**/data/history/**', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.goto('/');
  await expect(page.locator('.tile')).toHaveCount(30);
  await expect(page.locator('#chart')).toContainText('history request failed (503)');
  await expect(page.locator('#chart svg')).toHaveCount(0);
});
