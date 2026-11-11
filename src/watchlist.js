export const MAX_STOCKS = 30;
export const STORAGE_KEY = 'stock-atlas.watchlist.v1';
export const SECTORS = {
  ai: 'AI & technology',
  it: 'IT & software',
  defence: 'Defence & aerospace',
  medical: 'Medical & healthcare',
  other: 'Other industries'
};

export function validateSelection(symbols, catalog) {
  if (!Array.isArray(symbols) || symbols.some(symbol => typeof symbol !== 'string')) throw new Error('Saved stock selection is invalid. The default list has been restored.');
  const known = new Set(catalog.map(company => company.symbol));
  if (symbols.some(symbol => !known.has(symbol))) throw new Error('Saved selection contains companies no longer in the catalog. The default list has been restored.');
  const selected = [...new Set(symbols)].filter(symbol => known.has(symbol));
  if (selected.length < 1 || selected.length > MAX_STOCKS) throw new Error(`Select between 1 and ${MAX_STOCKS} companies.`);
  return selected;
}

export function filterCompanies(companies, { search = '', sector = 'all', country = 'all', selectedOnly = false, selected = [] } = {}) {
  const term = search.trim().toLocaleLowerCase();
  const symbols = new Set(selected);
  return companies.filter(company =>
    (sector === 'all' || company.sector === sector) &&
    (country === 'all' || company.country === country) &&
    (!selectedOnly || symbols.has(company.symbol)) &&
    (!term || `${company.symbol} ${company.name} ${company.country}`.toLocaleLowerCase().includes(term))
  );
}

export function toggleStock(selected, symbol) {
  if (selected.includes(symbol)) {
    if (selected.length === 1) throw new Error('Keep at least one company on your dashboard.');
    return selected.filter(item => item !== symbol);
  }
  if (selected.length >= MAX_STOCKS) throw new Error('Your dashboard is limited to 30 companies. Remove one before adding another.');
  return [...selected, symbol];
}
