export type Company = {
  symbol: string;
  name: string;
  sector: string;
  country: string;
};

export type Stock = Company & {
  price: number;
  currency: string;
  marketCapUsd: number | null;
  dailyChange: number | null;
  weeklyChange: number | null;
  quoteTime: string;
  fetchedAt: string;
  stale: boolean;
};

export type Point = { time: number; close: number; session?: string };
export type History = { daily: Point[]; monthly: Point[]; intraday: Point[] };
export type Holding = { id: string; symbol: string | null; name: string; weight: number | null };
export type Portfolio = {
  id: string;
  name: string;
  description: string;
  source: string;
  url: string;
  asOf: string;
  checkedAt: string;
  stale: boolean;
  error: string | null;
  holdings: Holding[];
};
export type Snapshot = { generatedAt: string; warnings: string[]; stocks: Stock[] };
export type Catalog = { defaultSymbols: string[]; companies: Company[] };

export const DATA_URL = 'https://diegocrew.github.io/stocks/data/';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function nullableNumber(value: unknown): value is number | null {
  return value === null || finite(value);
}

function timestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function company(value: unknown): value is Company {
  return record(value) && ['symbol', 'name', 'sector', 'country'].every(key => typeof value[key] === 'string');
}

function stock(value: unknown): value is Stock {
  return record(value) && finite(value.price) && value.price > 0 &&
    typeof value.currency === 'string' && nullableNumber(value.marketCapUsd) &&
    nullableNumber(value.dailyChange) && nullableNumber(value.weeklyChange) &&
    timestamp(value.quoteTime) && timestamp(value.fetchedAt) && typeof value.stale === 'boolean' && company(value);
}

export function parseSnapshot(value: unknown): Snapshot {
  if (!record(value) || !timestamp(value.generatedAt) || !strings(value.warnings) ||
      !Array.isArray(value.stocks) || !value.stocks.length || !value.stocks.every(stock)) {
    throw new Error('The market snapshot is invalid. Please retry after the next data update.');
  }
  return { generatedAt: value.generatedAt, warnings: value.warnings, stocks: value.stocks };
}

export function parseCatalog(value: unknown): Catalog {
  if (!record(value) || !strings(value.defaultSymbols) || !Array.isArray(value.companies) ||
      !value.companies.length || !value.companies.every(company)) {
    throw new Error('The company directory is invalid.');
  }
  return { defaultSymbols: value.defaultSymbols, companies: value.companies };
}

function holding(value: unknown): value is Holding {
  return record(value) && typeof value.id === 'string' && typeof value.name === 'string' &&
    (value.symbol === null || typeof value.symbol === 'string') && nullableNumber(value.weight);
}

function portfolio(value: unknown): value is Portfolio {
  return record(value) && ['id', 'name', 'description', 'source', 'url'].every(key => typeof value[key] === 'string') &&
    timestamp(value.asOf) && timestamp(value.checkedAt) && typeof value.stale === 'boolean' &&
    (value.error === null || typeof value.error === 'string') &&
    Array.isArray(value.holdings) && value.holdings.every(holding);
}

export function parsePortfolios(value: unknown): Portfolio[] {
  if (!record(value) || !Array.isArray(value.portfolios) || !value.portfolios.every(portfolio)) {
    throw new Error('The portfolio holdings are invalid.');
  }
  return value.portfolios;
}

function points(value: unknown): value is Point[] {
  return Array.isArray(value) && value.every(point => record(point) && finite(point.time) &&
    finite(point.close) && point.close > 0 && (point.session === undefined || typeof point.session === 'string')) &&
    value.every((point, index) => index === 0 || point.time >= value[index - 1].time);
}

export function parseHistory(value: unknown): History {
  if (!record(value) || !points(value.daily) || !points(value.monthly) || !points(value.intraday)) {
    throw new Error('Price history is invalid.');
  }
  return { daily: value.daily, monthly: value.monthly, intraday: value.intraday };
}

export async function requestData(file: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${DATA_URL}${file}`, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`Data request failed (HTTP ${response.status}). Pull down to retry.`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
