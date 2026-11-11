import YahooFinance from 'yahoo-finance2';
import { readFile, mkdir, writeFile, rename, readdir, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { cleanPoints, weeklyChange, marketCapCurrency } from './data-utils.mjs';
import { percentChange } from '../src/market.js';
import { topHoldings } from '../src/portfolios.js';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
const destination = new URL('../public/data/market.json', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('../public/data/companies.json', import.meta.url), 'utf8'));
const portfolios = JSON.parse(await readFile(new URL('../public/data/portfolios.json', import.meta.url), 'utf8'));
const companyMap = new Map(catalog.companies.map(company => [company.symbol, company]));
for (const portfolio of portfolios.portfolios) {
  for (const holding of topHoldings(portfolio)) {
    if (!companyMap.has(holding.symbol)) companyMap.set(holding.symbol, { symbol: holding.symbol, name: holding.name, sector: 'other', country: 'US listing' });
  }
}
const companies = [...companyMap.values()];
const historyDirectory = new URL('../public/data/history/', import.meta.url);
const now = new Date();
const DAY = 86400000;
let previous;
try {
  previous = JSON.parse(await readFile(destination, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

async function retry(label, operation) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.error(`${label}, attempt ${attempt}/3: ${error.message}`);
      if (attempt === 3) throw error;
      await new Promise(resolve => setTimeout(resolve, attempt * 2000));
    }
  }
}

const fxCache = new Map([['USD', Promise.resolve(1)]]);
function exchangeRate(currency) {
  const majorCurrency = marketCapCurrency(currency);
  if (!fxCache.has(majorCurrency)) {
    fxCache.set(majorCurrency, retry(`${majorCurrency}/USD`, async () => {
      const quote = await yf.quote(`${majorCurrency}USD=X`);
      if (!(quote?.regularMarketPrice > 0)) throw new Error(`Missing ${majorCurrency}/USD exchange rate`);
      return quote.regularMarketPrice;
    }));
  }
  return fxCache.get(majorCurrency);
}

async function collect(company) {
  let old = previous?.stocks.find(stock => stock.symbol === company.symbol);
  if (old && !old.daily) {
    try {
      old = { ...old, ...JSON.parse(await readFile(new URL(`${encodeURIComponent(company.symbol)}.json`, historyDirectory), 'utf8')) };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      console.warn(`Missing cached history for ${company.symbol}; fetching full listing history.`);
    }
  }
  const quote = await retry(`${company.symbol} quote`, () => yf.quote(company.symbol));
  if (!(quote?.regularMarketPrice > 0) || !(quote.marketCap > 0) || !quote.currency || !quote.regularMarketTime) {
    throw new Error(`Incomplete price, market cap, currency or timestamp for ${company.symbol}`);
  }
  const timeZone = quote.exchangeTimezoneName;
  if (!timeZone) throw new Error(`Missing exchange timezone for ${company.symbol}`);
  const getChart = (period1, interval) => retry(`${company.symbol} ${interval}`, () => yf.chart(company.symbol, {
    period1, period2: now, interval, includePrePost: false
  }));
  const dailyResult = await getChart(new Date(now.getTime() - 2 * 366 * DAY), '1d');
  const intradayResult = await getChart(new Date(now.getTime() - 5 * DAY), '5m');
  const monthly = old?.historyCoverage === 'full-listing' && old.monthly?.length && now - new Date(old.historyUpdatedAt) < 7 * DAY
    ? old.monthly
    : cleanPoints((await getChart(new Date(quote.firstTradeDateMilliseconds ?? '1900-01-01'), '1mo')).quotes, timeZone);
  const daily = cleanPoints(dailyResult.quotes, timeZone);
  const intraday = cleanPoints(intradayResult.quotes, timeZone, true);
  if (daily.length < 2 || !monthly.length) throw new Error(`Incomplete history for ${company.symbol}`);
  if (!intraday.length) console.warn(`${company.symbol}: no intraday history; the day chart will show an unavailable message.`);
  const rate = await exchangeRate(quote.currency);
  const price = quote.regularMarketPrice;
  const dayChange = percentChange(price, quote.regularMarketPreviousClose);
  if (dayChange === null) throw new Error(`Missing previous close for ${company.symbol}`);
  return {
    ...company,
    currency: quote.currency,
    price,
    marketCapUsd: Math.round(quote.marketCap * rate),
    dailyChange: dayChange,
    weeklyChange: weeklyChange(price, quote.regularMarketTime, daily),
    quoteTime: quote.regularMarketTime.toISOString(),
    exchangeTimezone: timeZone,
    fetchedAt: now.toISOString(),
    historyUpdatedAt: monthly === old?.monthly ? old.historyUpdatedAt : now.toISOString(),
    historyCoverage: 'full-listing',
    daily, intraday, monthly,
    stale: false
  };
}

const results = [];
const warnings = [];
let freshCount = 0;
await mkdir(historyDirectory, { recursive: true });
// Sequential requests avoid large bursts against the unofficial data provider.
for (const company of companies) {
  try {
    const stock = await collect(company);
    const { daily, intraday, monthly, ...summary } = stock;
    await writeFile(new URL(`${encodeURIComponent(stock.symbol)}.json`, historyDirectory), JSON.stringify({ daily, intraday, monthly }) + '\n');
    results.push(summary);
    freshCount++;
    console.log(`${company.symbol}: ${stock.price} ${stock.currency}, daily ${stock.dailyChange.toFixed(2)}%`);
  } catch (error) {
    const old = previous?.stocks.find(stock => stock.symbol === company.symbol);
    const warning = `${company.symbol}: update failed (${error.message}). ${old ? 'Previous snapshot retained.' : 'Company unavailable and excluded.'}`;
    console.error(warning);
    warnings.push(warning);
    if (old) {
      const { daily, intraday, monthly, ...summary } = old;
      if (daily) await writeFile(new URL(`${encodeURIComponent(old.symbol)}.json`, historyDirectory), JSON.stringify({ daily, intraday, monthly }) + '\n');
      results.push({ ...summary, stale: true });
    }
  }
}
if (!freshCount) throw new Error('All quote updates failed. Existing snapshot was not changed.');
const data = { schemaVersion: 2, generatedAt: now.toISOString(), source: 'Yahoo Finance', warnings, stocks: results };
await mkdir(new URL('../public/data/', import.meta.url), { recursive: true });
const temporary = fileURLToPath(destination) + '.tmp';
await writeFile(temporary, JSON.stringify(data) + '\n');
await rename(temporary, destination);
const configuredFiles = new Set(companies.map(company => `${encodeURIComponent(company.symbol)}.json`));
for (const filename of await readdir(historyDirectory)) {
  if (filename.endsWith('.json') && !configuredFiles.has(filename)) await unlink(new URL(filename, historyDirectory));
}
if (warnings.length) console.log(`::warning::${warnings.length} company updates failed; see snapshot warnings.`);
console.log(`Saved ${results.length} companies (${freshCount} fresh).`);
