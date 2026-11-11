import { writeFile, mkdir } from 'node:fs/promises';
import { companies as defaults } from './companies.mjs';

const sources = [
  { sector: 'ai', path: 'artificial-intelligence/largest-ai-companies-by-marketcap/', pages: 1 },
  { sector: 'it', path: 'tech/largest-tech-companies-by-market-cap/', pages: 4 },
  { sector: 'defence', path: 'aerospace/largest-companies-by-market-cap/', pages: 1 },
  { sector: 'medical', path: 'healthcare/largest-healthcare-companies-by-market-cap/', pages: 2 },
  { sector: 'medical', path: 'pharmaceuticals/largest-pharmaceutical-companies-by-market-cap/', pages: 2 }
];
// Listings without usable Yahoo quotes are omitted rather than given synthetic prices.
const unsupportedSymbols = new Set(['PUREHEALTH.AE', 'PEL.NS', 'SEM', 'BURJEEL.AE', 'NWH-UN.TO', 'TALK', 'EHAB', 'MIDAN.KW', 'MDRX', 'GMPC.AE', 'FOBK.F', 'ANCR.L', 'ATC.KW', 'OKDBV.HE', 'QIPT', 'PRESIGHT.AE', 'SPACE42.AE', 'AIW.MI', 'APGE', 'CRNX', 'TERN', 'AILE']);
const decode = value => value.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').trim();
const defaultCountries = { 'RHM.DE': 'Germany', GD: 'USA', LHX: 'USA' };
const candidates = new Map(defaults.map(company => [company.symbol, { ...company, country: defaultCountries[company.symbol] }]));
const sourceUrls = [];

for (const source of sources) {
  for (let page = 1; page <= source.pages; page++) {
    const url = `https://companiesmarketcap.com/${source.path}${page > 1 ? `?page=${page}` : ''}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Catalog source ${url}: HTTP ${response.status}`);
    const html = await response.text();
    const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)];
    let count = 0;
    for (const [, row] of rows) {
      const name = row.match(/class="company-name">([\s\S]*?)<\/div>/)?.[1];
      const ticker = row.match(/class="company-code">([\s\S]*?)<\/div>/)?.[1];
      const country = row.match(/class="responsive-hidden">([^<]+)<\/span>/)?.[1];
      const cap = row.match(/class="td-right" data-sort="(\d+)"/)?.[1];
      if (!name || !ticker || !country || !cap) continue;
      const sourceSymbol = decode(ticker);
      const symbol = sourceSymbol === 'GOOG' ? 'GOOGL' : sourceSymbol;
      if (['SPCX', 'OPENAI', 'ANTHROPIC'].includes(symbol) || unsupportedSymbols.has(symbol)) continue;
      const existing = candidates.get(symbol);
      candidates.set(symbol, {
        symbol,
        name: existing?.name ?? decode(name),
        sector: existing?.sector ?? source.sector,
        country: decode(country),
        catalogMarketCapUsd: Number(cap)
      });
      count++;
    }
    if (count < 10) throw new Error(`Too few companies parsed from ${url}: ${count}`);
    sourceUrls.push(url);
    console.log(`${source.sector} page ${page}: ${count} listings`);
  }
}

const required = new Set(defaults.map(company => company.symbol));
const selected = [...candidates.values()].filter(company => required.has(company.symbol));
for (const [sector, quota] of [['defence', 75], ['medical', 180], ['ai', 65], ['it', 180]]) {
  const pool = [...candidates.values()].filter(company => company.sector === sector && !required.has(company.symbol))
    .sort((a, b) => b.catalogMarketCapUsd - a.catalogMarketCapUsd);
  const needed = quota - selected.filter(company => company.sector === sector).length;
  if (pool.length < needed) throw new Error(`Not enough ${sector} companies: need ${needed}, found ${pool.length}`);
  selected.push(...pool.slice(0, needed));
}
if (selected.length !== 500 || selected.some(company => !company.country)) {
  throw new Error(`Expected 500 companies with country metadata; found ${selected.length}; missing countries: ${selected.filter(company => !company.country).map(company => company.symbol).join(', ')}`);
}
await mkdir(new URL('../public/data/', import.meta.url), { recursive: true });
await writeFile(new URL('../public/data/companies.json', import.meta.url), JSON.stringify({
  generatedAt: new Date().toISOString(),
  methodology: '500 representative public listings across AI, IT, aerospace/defence and healthcare, selected by market capitalization within sector quotas. Not an official popularity ranking.',
  sources: sourceUrls,
  defaultSymbols: defaults.map(company => company.symbol),
  companies: selected
}) + '\n');
console.log(`Saved ${selected.length} companies across ${new Set(selected.map(company => company.country)).size} countries.`);
