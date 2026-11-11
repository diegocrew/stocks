export const PORTFOLIO_STORAGE_KEY = 'stock-atlas.portfolio.v1';

export function topHoldings(portfolio) {
  return portfolio.holdings.filter(holding => holding.symbol && holding.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.symbol.localeCompare(b.symbol)).slice(0, 30);
}

export function holdingChanges(previous, current) {
  const before = new Map(previous.map(holding => [holding.id, holding]));
  const after = new Map(current.map(holding => [holding.id, holding]));
  return {
    added: current.filter(holding => !before.has(holding.id)),
    removed: previous.filter(holding => !after.has(holding.id)),
    weights: current.filter(holding => before.has(holding.id) && (
      holding.weight === null || before.get(holding.id).weight === null
        ? holding.weight !== before.get(holding.id).weight
        : Math.abs(holding.weight - before.get(holding.id).weight) >= 0.0001))
      .map(holding => ({ id: holding.id, symbol: holding.symbol, name: holding.name, before: before.get(holding.id).weight, after: holding.weight }))
  };
}

export function validateHoldings(holdings, minimum) {
  if (!Array.isArray(holdings) || holdings.length < minimum) throw new Error(`Incomplete holdings: expected at least ${minimum} rows`);
  const ids = new Set();
  for (const holding of holdings) {
    if (!holding.id || !holding.name || (holding.weight !== null && (!Number.isFinite(holding.weight) || Math.abs(holding.weight) > 100)) || ids.has(holding.id)) {
      throw new Error(`Invalid or duplicate holding: ${holding.id}`);
    }
    ids.add(holding.id);
  }
  const total = holdings.reduce((sum, holding) => sum + holding.weight, 0);
  if (total < 90 || total > 105) throw new Error(`Unexpected total holdings weight: ${total.toFixed(2)}%`);
  return holdings.sort((a, b) => b.weight - a.weight);
}
