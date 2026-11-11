export function percentChange(value, baseline) {
  return Number.isFinite(value) && Number.isFinite(baseline) && baseline > 0
    ? (value / baseline - 1) * 100
    : null;
}

export function formatPercent(value) {
  return Number.isFinite(value) ? `${value > 0 ? '+' : ''}${value.toFixed(2)}%` : 'N/A';
}

export function chartColor(start, end) {
  if (end > start) return '#5cc69d';
  if (end < start) return '#ee8490';
  return '#8290a4';
}

export function formatCap(value) {
  if (!Number.isFinite(value)) return 'N/A';
  const [divisor, suffix] = value >= 1e12 ? [1e12, 'T'] : [1e9, 'B'];
  return `$${(value / divisor).toFixed(2)}${suffix}`;
}

export function tileColor(change) {
  if (!Number.isFinite(change)) return '#414b5a';
  const strength = Math.min(Math.abs(change) / 12, 1);
  const start = [28, 36, 34];
  const end = change >= 0 ? [13, 131, 77] : [166, 35, 54];
  return `rgb(${start.map((channel, i) => Math.round(channel + (end[i] - channel) * strength)).join(',')})`;
}

export function historyFor(stock, range) {
  if (range === 'day') {
    const points = stock.intraday ?? [];
    if (!points.length) return [];
    const latestSession = points.at(-1).session;
    return points.filter(point => point.session === latestSession);
  }
  const daily = stock.daily ?? [];
  const monthly = stock.monthly ?? [];
  if (range === 'max') {
    const firstDaily = daily[0]?.time ?? Infinity;
    return [...monthly.filter(point => point.time < firstDaily), ...daily];
  }
  if (!daily.length) return [];
  const days = { week: 7, month: 31, year: 366 }[range];
  const cutoff = daily.at(-1).time - days * 86400;
  return daily.filter(point => point.time >= cutoff);
}

export function toggleComparison(selected, symbol) {
  if (selected.includes(symbol)) return selected.filter(item => item !== symbol);
  if (selected.length >= 5) throw new Error('You can compare up to 5 companies. Remove one before adding another.');
  return [...selected, symbol];
}

export function normalizedSeries(stocks, range) {
  const series = stocks.map(stock => ({ stock, points: historyFor(stock, range) }));
  if (series.some(item => item.points.length < 2)) {
    throw new Error('Not enough history for every selected company in this period. Choose another period or remove a company.');
  }
  const start = Math.max(...series.map(item => item.points[0].time));
  const end = Math.min(...series.map(item => item.points.at(-1).time));
  const aligned = series.map(({ stock, points }) => {
    const visible = points.filter(point => point.time >= start && point.time <= end);
    if (visible.length < 2) throw new Error('These companies have no overlapping trading history in this period.');
    return { stock, points: visible.map(point => ({ ...point, value: percentChange(point.close, visible[0].close) })) };
  });
  return aligned;
}
