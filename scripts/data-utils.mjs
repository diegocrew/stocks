import { percentChange } from '../src/market.js';

export async function retry(label, operation, wait = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.error(`${label}, attempt ${attempt}/3: ${error.message}`);
      if (attempt === 3) throw error;
      await wait(attempt * 2000);
    }
  }
}

export function requireCompleteQuote(quote, symbol) {
  const missing = [];
  if (!Number.isFinite(quote?.regularMarketPrice) || quote.regularMarketPrice <= 0) missing.push('price');
  if (!Number.isFinite(quote?.marketCap) || quote.marketCap <= 0) missing.push('market cap');
  if (typeof quote?.currency !== 'string' || !quote.currency.trim()) missing.push('currency');
  if (!(quote?.regularMarketTime instanceof Date) || !Number.isFinite(quote.regularMarketTime.getTime())) missing.push('timestamp');
  if (missing.length) throw new Error(`Incomplete quote for ${symbol}: ${missing.join(', ')}`);
  return quote;
}

export function cleanPoints(quotes, timeZone, intraday = false) {
  const sessionFormat = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  return quotes.filter(quote => Number.isFinite(quote.close) && quote.close > 0)
    .map(quote => ({
      time: Math.floor(new Date(quote.date).getTime() / 1000),
      close: Math.round(quote.close * 1e6) / 1e6,
      ...(intraday ? { session: sessionFormat.format(new Date(quote.date)) } : {})
    })).filter(point => Number.isFinite(point.time))
    .sort((a, b) => a.time - b.time);
}

export function weeklyChange(price, quoteTime, daily) {
  const cutoff = Math.floor(new Date(quoteTime).getTime() / 1000) - 7 * 86400;
  const baseline = daily.findLast(point => point.time <= cutoff);
  return percentChange(price, baseline?.close);
}

export function marketCapCurrency(currency) {
  // Yahoo market caps use major currency units even when quotes use minor units.
  return { GBp: 'GBP', GBX: 'GBP', ILA: 'ILS', ZAc: 'ZAR', KWF: 'KWD' }[currency] ?? currency;
}

export function shouldRunSchedule(cron, now = new Date()) {
  const pragueHour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Prague', hour: '2-digit', hourCycle: 'h23'
  }).format(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12))));
  const summer = pragueHour === 14;
  return cron === (summer ? '0 8,14 * * *' : '0 9,15 * * *');
}
