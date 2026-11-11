import { readFile, writeFile, rename } from 'node:fs/promises';
import readXlsxFile from 'read-excel-file/node';
import { parse } from 'csv-parse/sync';
import { holdingChanges, validateHoldings } from '../src/portfolios.js';

const destination = new URL('../public/data/portfolios.json', import.meta.url);
const now = new Date().toISOString();
let previous;
try {
  previous = JSON.parse(await readFile(destination, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const definitions = [
  { id: 'spy', name: 'S&P 500 · SPY', minimum: 490, source: 'State Street official SPY holdings',
    url: 'https://www.ssga.com/us/en/individual/etfs/library-content/products/fund-data/etfs/us/holdings-daily-us-en-spy.xlsx',
    description: 'S&P 500 exposure through SPY ETF holdings; cash and other non-equity positions may differ from index constituents.' },
  { id: 'berkshire', name: 'Berkshire Hathaway', minimum: 20, source: 'DATAROMA · Berkshire reported holdings',
    url: 'https://www.dataroma.com/m/holdings.php?m=BRK',
    description: 'Quarterly reported US equity holdings, compiled by DATAROMA from disclosures. Delayed, not live; excludes private subsidiaries, cash and unreported foreign positions.' },
  { id: 'qqq', name: 'Nasdaq-100 · QQQ', minimum: 95, source: 'Invesco official QQQ holdings',
    url: 'https://dng-api.invesco.com/cache/v1/accounts/en_US/shareclasses/QQQ/holdings/fund?idType=ticker&interval=monthly&productType=ETF',
    description: 'Nasdaq-100 exposure through QQQ ETF holdings. The provider endpoint determines the available reporting date.' },
  { id: 'arkk', name: 'ARK Innovation · ARKK', minimum: 20, source: 'ARK official ARKK holdings',
    url: 'https://assets.ark-funds.com/fund-documents/funds-etf-csv/ARK_INNOVATION_ETF_ARKK_HOLDINGS.csv',
    description: 'ARK Innovation ETF disclosed holdings. Untickered/private positions remain in the full list but cannot be charted.' }
];
const text = value => String(value ?? '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').trim();
const ticker = value => {
  const symbol = text(value).replace(/\./g, '-');
  return /^[A-Z][A-Z0-9-]{0,14}$/.test(symbol) && !['USD', 'CASH', 'OTHER', 'N-A'].includes(symbol) ? symbol : null;
};
const isoDate = value => {
  if (typeof value !== 'string') throw new Error('Missing holdings date');
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value} 12:00:00 GMT`);
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid holdings date: ${value}`);
  return date.toISOString().slice(0, 10);
};

async function download(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      console.error(`Holdings download attempt ${attempt}/3: ${url}: ${error.message}`);
      if (attempt === 3) throw error;
      await new Promise(resolve => setTimeout(resolve, attempt * 2000));
    }
  }
}

async function collect(definition) {
  const buffer = await download(definition.url);
  let holdings;
  let asOf;
  if (definition.id === 'spy') {
    const sheets = await readXlsxFile(buffer);
    const rows = sheets.find(sheet => sheet.sheet === 'holdings')?.data;
    if (!rows) throw new Error('SPY holdings worksheet missing');
    asOf = isoDate(rows.find(row => row[0] === 'Holdings:')?.[1]?.replace('As of ', ''));
    const header = rows.findIndex(row => row[0] === 'Name' && row[1] === 'Ticker');
    if (header < 0) throw new Error('SPY holdings columns changed');
    holdings = rows.slice(header + 1).filter(row => row[0] && Number.isFinite(row[4])).map(row => ({
      id: String(row[2] ?? row[1] ?? row[0]), symbol: ticker(row[1]), name: text(row[0]), weight: row[4], shares: row[6] ?? null
    }));
  } else if (definition.id === 'qqq') {
    const data = JSON.parse(buffer.toString('utf8'));
    asOf = isoDate(data.effectiveDate);
    if (!Array.isArray(data.holdings) || data.holdings.length !== data.totalNumberOfHoldings) throw new Error('Incomplete QQQ response');
    holdings = data.holdings.map(row => ({
      id: `${row.cusip ?? row.ticker ?? row.issuerName}:${row.securityTypeCode}`,
      symbol: ['COM', 'ADR', 'DRNY', 'PREF'].includes(row.securityTypeCode) ? ticker(row.ticker) : null,
      name: text(row.issuerName), weight: row.percentageOfTotalNetAssets ?? null, shares: row.units ?? null
    }));
  } else if (definition.id === 'arkk') {
    const rows = parse(buffer, { columns: true, skip_empty_lines: true, bom: true, relax_column_count: true })
      .filter(row => row.fund === 'ARKK' && row.company && row['weight (%)']);
    const dates = new Set(rows.map(row => isoDate(row.date)));
    if (dates.size !== 1) throw new Error('ARKK holdings have inconsistent dates');
    asOf = [...dates][0];
    holdings = rows.map(row => ({ id: row.cusip || row.ticker || row.company, symbol: ticker(row.ticker), name: row.company, weight: Number(row['weight (%)'].replace('%', '')), shares: Number(row.shares.replaceAll(',', '')) }));
  } else {
    const html = buffer.toString('utf8');
    asOf = isoDate(html.match(/Portfolio date:\s*<span>([^<]+)<\/span>/)?.[1]);
    holdings = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].flatMap(([, row]) => {
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(([, cell]) => cell);
      const match = cells[1]?.match(/stock\.php\?sym=([^"]+)">([^<]+)<span>\s*-\s*([\s\S]*?)<\/span>/);
      if (!match) return [];
      const symbol = ticker(match[1]);
      return [{ id: match[1], symbol, name: text(match[3]), weight: Number(text(cells[2])), shares: Number(text(cells[4]).replaceAll(',', '')) }];
    });
  }
  validateHoldings(holdings, definition.minimum);
  if (asOf > now.slice(0, 10)) throw new Error('Holdings date is in the future');
  const old = previous?.portfolios.find(portfolio => portfolio.id === definition.id);
  if (old && asOf < old.asOf) throw new Error(`Provider returned older holdings (${asOf} < ${old.asOf})`);
  const diff = old ? holdingChanges(old.holdings, holdings) : null;
  const changed = diff && (diff.added.length || diff.removed.length || diff.weights.length);
  const changes = changed ? [{ detectedAt: now, fromDate: old.asOf, toDate: asOf, ...diff }, ...(old.changes ?? [])].slice(0, 60) : old?.changes ?? [];
  return { ...definition, holdings, asOf, checkedAt: now, stale: false, error: null, changes };
}

const portfolios = [];
for (const definition of definitions) {
  try {
    const result = await collect(definition);
    portfolios.push(result);
    console.log(`${result.name}: ${result.holdings.length} holdings, as of ${result.asOf}`);
  } catch (error) {
    const old = previous?.portfolios.find(portfolio => portfolio.id === definition.id);
    console.error(`${definition.name}: ${error.message}. ${old ? 'Retaining previous holdings.' : 'No previous holdings available.'}`);
    if (!old) throw error;
    portfolios.push({ ...old, stale: true, error: error.message, attemptedAt: now });
  }
}
if (portfolios.every(portfolio => portfolio.stale)) throw new Error('All holdings sources failed; previous file unchanged');
const temporary = new URL('../public/data/portfolios.json.tmp', import.meta.url);
await writeFile(temporary, JSON.stringify({ generatedAt: now, portfolios }) + '\n');
await rename(temporary, destination);
