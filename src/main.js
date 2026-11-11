import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy';
import { chartColor, formatCap, formatPercent, historyFor, normalizedSeries, tileColor, toggleComparison } from './market.js';
import { filterCompanies, toggleStock, validateSelection, MAX_STOCKS, SECTORS, STORAGE_KEY } from './watchlist.js';
import { topHoldings, PORTFOLIO_STORAGE_KEY } from './portfolios.js';
import './style.css';

const $ = selector => document.querySelector(selector);
const palette = ['#7dd3fc', '#c4b5fd', '#fbbf24', '#fb7185', '#5eead4'];
let stocks = [];
let selectedSymbol;
let comparison = [];
let range = 'month';
let snapshot;
let baseWarning = '';
let sector = 'all';
let catalog;
let allStocks = [];
let watchlist = [];
let personalWatchlist = [];
let portfolios = [];
let portfolioId = 'custom';
let portfolioLoadError = '';
let catalogPage = 0;
let chartRequest = 0;
const historyCache = new Map();
const PAGE_SIZE = 50;
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function changeClass(value) {
  return Number.isFinite(value) ? (value >= 0 ? 'positive' : 'negative') : 'muted';
}

function notify(message) {
  $('#notice').hidden = !message;
  $('#notice').textContent = message;
}

function renderOverview() {
  const portfolio = activePortfolio();
  const holdingWeight = stock => portfolio ? portfolio.holdings.find(holding => holding.symbol === stock.symbol)?.weight ?? 0 : stock.marketCapUsd;
  const cap = stocks.reduce((total, stock) => total + (stock.marketCapUsd ?? 0), 0);
  const valid = stocks.filter(stock => Number.isFinite(stock.dailyChange) && stock.marketCapUsd > 0);
  const weight = valid.reduce((total, stock) => total + holdingWeight(stock), 0);
  const weighted = weight ? valid.reduce((total, stock) => total + stock.dailyChange * holdingWeight(stock), 0) / weight : null;
  const rising = stocks.filter(stock => stock.dailyChange > 0).length;
  const falling = stocks.filter(stock => stock.dailyChange < 0).length;
  const cards = [
    ['TRACKED MARKET CAP', formatCap(cap), `${stocks.length} publicly traded companies`],
    [portfolio ? 'HOLDING-WEIGHTED DAILY MOVE' : 'CAP-WEIGHTED DAILY MOVE', formatPercent(weighted), portfolio ? 'Shown holdings only · Not total fund return' : 'Latest price vs. previous trading close', changeClass(weighted)],
    ['MARKET BREADTH', `${rising} ↑  /  ${falling} ↓`, 'Advancing / declining companies'],
    [portfolio ? 'FOLLOWING PORTFOLIO' : 'YOUR WATCHLIST', portfolio ? portfolio.name : `${watchlist.length} / ${MAX_STOCKS}`, portfolio ? `${watchlist.length} top tickered holdings · Auto-follow` : 'AI · IT · Defence · Medical']
  ];
  $('#overview').replaceChildren(...cards.map(([label, value, hint, color]) => {
    const card = element('div', 'summary-card');
    card.append(element('p', 'eyebrow', label), element('strong', color, value), element('span', '', hint));
    return card;
  }));
}

function renderMap() {
  const container = $('#heatmap');
  const width = container.clientWidth;
  if (!width) return;
  const visible = stocks.filter(stock => sector === 'all' || stock.sector === sector);
  if (!visible.length) {
    container.style.height = '180px';
    container.replaceChildren(element('p', 'chart-empty', 'No selected companies with market data in this sector. Choose companies from the directory above.'));
    return;
  }
  const height = width < 640 ? 880 : 580;
  container.style.height = `${height}px`;
  const root = hierarchy({
    children: Object.entries(SECTORS).map(([key, name]) => ({
      name: name.toUpperCase(),
      children: visible.filter(stock => stock.sector === key && stock.marketCapUsd > 0)
    })).filter(group => group.children.length)
  }).sum(item => item.symbol && activePortfolio() ? activePortfolio().holdings.find(holding => holding.symbol === item.symbol)?.weight ?? 0 : item.marketCapUsd ?? 0).sort((a, b) => b.value - a.value);
  treemap().tile(treemapSquarify).size([width, height]).paddingOuter(3).paddingInner(4)
    .paddingTop(node => node.depth === 1 ? 30 : 0).round(true)(root);
  const nodes = [];
  for (const group of root.children) {
    const label = element('div', 'group-label', group.data.name);
    Object.assign(label.style, { left: `${group.x0 + 6}px`, top: `${group.y0 + 6}px`, maxWidth: `${Math.max(0, group.x1 - group.x0 - 12)}px` });
    nodes.push(label);
  }
  for (const leaf of root.leaves()) {
    if (!leaf.data.symbol) continue;
    const stock = leaf.data;
    const tileWidth = leaf.x1 - leaf.x0;
    const tileHeight = leaf.y1 - leaf.y0;
    const compact = tileWidth < 125 || tileHeight < 110;
    const tile = element('div', `tile${compact ? ' compact' : ''}${tileHeight < 70 ? ' tiny' : ''}${tileHeight < 44 ? ' micro' : ''}${stock.symbol === selectedSymbol ? ' selected' : ''}`);
    Object.assign(tile.style, {
      left: `${leaf.x0}px`, top: `${leaf.y0}px`, width: `${tileWidth}px`, height: `${tileHeight}px`,
      background: tileColor(stock.dailyChange)
    });
    const display = stock.symbol.replace(/\.(KS|PA|DE|L)$/, '');
    const action = element('button', 'tile-main');
    action.setAttribute('aria-label', `${stock.name}: daily ${formatPercent(stock.dailyChange)}, week ${formatPercent(stock.weeklyChange)}. View history.`);
    const weight = activePortfolio()?.holdings.find(holding => holding.symbol === stock.symbol)?.weight;
    action.title = `${stock.name}\n${weight === undefined ? `Market cap: ${formatCap(stock.marketCapUsd)}` : `Portfolio weight: ${weight.toFixed(2)}%`}\nDaily: ${formatPercent(stock.dailyChange)}\nWeek: ${formatPercent(stock.weeklyChange)}`;
    const ticker = element('strong', 'ticker', display);
    ticker.style.fontSize = `${Math.max(11, Math.min(compact ? 23 : 42, tileWidth / (display.length * 0.72), tileHeight / 4.6))}px`;
    action.append(ticker, element('span', 'company-name', stock.name), element('span', 'tile-cap', weight === undefined ? formatCap(stock.marketCapUsd) : `${weight.toFixed(2)}% of portfolio`),
      element('strong', 'tile-change', formatPercent(stock.dailyChange)),
      element('span', 'tile-week', `W ${formatPercent(stock.weeklyChange)}`));
    action.addEventListener('click', () => selectCompany(stock.symbol, true));
    const add = element('button', `tile-add${comparison.includes(stock.symbol) ? ' added' : ''}`, comparison.includes(stock.symbol) ? '✓' : '+');
    add.setAttribute('aria-label', `${comparison.includes(stock.symbol) ? 'Remove' : 'Compare'} ${stock.name}`);
    add.setAttribute('aria-pressed', String(comparison.includes(stock.symbol)));
    add.addEventListener('click', () => compare(stock.symbol));
    tile.append(action, add);
    nodes.push(tile);
  }
  container.replaceChildren(...nodes);
}

function selectCompany(symbol, scroll = false) {
  selectedSymbol = symbol;
  $('#company-select').value = symbol;
  renderDetail();
  renderMap();
  if (scroll) $('.analysis').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function compare(symbol) {
  try {
    comparison = toggleComparison(comparison, symbol);
    $('#comparison-notice').hidden = true;
    notify(baseWarning);
    renderDetail();
    renderMap();
  } catch (error) {
    notify(error.message);
    $('#comparison-notice').textContent = error.message;
    $('#comparison-notice').hidden = false;
  }
}

async function loadHistory(stock) {
  if (stock.daily) return stock;
  if (!historyCache.has(stock.symbol)) {
    historyCache.set(stock.symbol, (async () => {
      const response = await fetch(`${import.meta.env.BASE_URL}data/history/${encodeURIComponent(stock.symbol)}.json?v=${encodeURIComponent(stock.fetchedAt)}`);
      if (!response.ok) throw new Error(`${stock.symbol}: price history request failed (${response.status}). Please try again later.`);
      const history = await response.json();
      if (!Array.isArray(history.daily) || !Array.isArray(history.monthly) || !Array.isArray(history.intraday)) throw new Error(`${stock.symbol}: invalid price history.`);
      Object.assign(stock, history);
      return stock;
    })().catch(error => {
      historyCache.delete(stock.symbol);
      throw error;
    }));
  }
  return historyCache.get(stock.symbol);
}

async function renderDetail() {
  const request = ++chartRequest;
  const stock = stocks.find(item => item.symbol === selectedSymbol);
  const detail = $('#company-detail');
  detail.replaceChildren();
  if (!stock) {
    detail.append(element('p', 'muted', 'Selected companies have no available quotes. Choose another company from the directory.'));
    $('#comparison').replaceChildren();
    $('#chart').replaceChildren();
    $('#chart-caption').textContent = 'No market data available';
    return;
  }
  const heading = element('div', 'detail-name');
  heading.append(element('h3', '', stock.name), element('span', 'symbol-badge', stock.symbol));
  const price = element('div', 'detail-price');
  price.append(element('strong', '', `${number.format(stock.price)} ${stock.currency}`),
    element('span', changeClass(stock.dailyChange), `${formatPercent(stock.dailyChange)} day`),
    element('span', changeClass(stock.weeklyChange), `${formatPercent(stock.weeklyChange)} week`));
  detail.append(heading, price, element('p', 'quote-time', `Quote: ${date.format(new Date(stock.quoteTime))}${stock.stale ? ' · Last update failed; retained data' : ''}`));
  $('#comparison').replaceChildren(...comparison.map((symbol, i) => {
    const button = element('button', 'comparison-chip', `${symbol} ×`);
    button.style.setProperty('--series-color', palette[i]);
    button.setAttribute('aria-label', `Remove ${symbol} from comparison`);
    button.addEventListener('click', () => compare(symbol));
    return button;
  }));
  if (!comparison.length) $('#comparison').append(element('span', 'muted', 'Compare companies using the + buttons above. Returns are rebased to a common overlapping period.'));
  $('#clear-comparison').hidden = comparison.length === 0;
  $('#chart').replaceChildren(element('p', 'chart-empty', 'Loading price history...'));
  try {
    await Promise.all((comparison.length ? comparison.map(symbol => stocks.find(item => item.symbol === symbol)) : [stock]).map(loadHistory));
    if (request === chartRequest) renderChart(stock);
  } catch (error) {
    if (request !== chartRequest) return;
    $('#chart').replaceChildren(element('p', 'chart-empty', error.message));
    $('#chart-caption').textContent = 'History unavailable';
  }
}

function renderChart(stock) {
  const container = $('#chart');
  container.replaceChildren();
  const comparing = comparison.length > 0;
  let series;
  try {
    series = comparing
      ? normalizedSeries(comparison.map(symbol => stocks.find(item => item.symbol === symbol)), range)
      : [{ stock, points: historyFor(stock, range).map(point => ({ ...point, value: point.close })) }];
    if (series[0].points.length < 2) throw new Error('No price history available for this period.');
  } catch (error) {
    container.append(element('p', 'chart-empty', error.message));
    $('#chart-caption').textContent = 'History unavailable';
    return;
  }
  const width = Math.max(container.clientWidth, 300);
  const height = 330;
  const pad = { top: 24, right: 76, bottom: 40, left: 18 };
  const points = series.flatMap(item => item.points);
  const minTime = Math.min(...points.map(point => point.time));
  const maxTime = Math.max(...points.map(point => point.time));
  let min = Math.min(...points.map(point => point.value));
  let max = Math.max(...points.map(point => point.value));
  const margin = (max - min) * 0.12 || Math.abs(max) * 0.01 || 1;
  min -= margin;
  max += margin;
  const x = time => pad.left + (time - minTime) / (maxTime - minTime || 1) * (width - pad.left - pad.right);
  const y = value => height - pad.bottom - (value - min) / (max - min) * (height - pad.top - pad.bottom);
  const ns = 'http://www.w3.org/2000/svg';
  const svgNode = (tag, attrs = {}, text) => {
    const node = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const svg = svgNode('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': `${comparing ? comparison.join(', ') + ' comparison in percent' : stock.name + ' price in ' + stock.currency}, ${range} history` });
  svg.append(svgNode('title', {}, 'Price history. Hover or touch the chart for exact values.'));
  for (let i = 0; i < 5; i++) {
    const value = min + (max - min) * i / 4;
    svg.append(svgNode('line', { x1: pad.left, x2: width - pad.right, y1: y(value), y2: y(value), class: 'grid-line' }),
      svgNode('text', { x: width - pad.right + 12, y: y(value) + 4, class: 'axis-label' }, `${number.format(value)}${comparing ? '%' : ''}`));
  }
  const formatter = new Intl.DateTimeFormat(undefined, range === 'day' ? { hour: '2-digit', minute: '2-digit' } : { month: 'short', ...(range === 'max' ? { year: 'numeric' } : { day: 'numeric' }) });
  for (let i = 0; i < 4; i++) {
    const time = minTime + (maxTime - minTime) * i / 3;
    svg.append(svgNode('text', { x: x(time), y: height - 10, 'text-anchor': i === 0 ? 'start' : i === 3 ? 'end' : 'middle', class: 'axis-label' }, formatter.format(new Date(time * 1000))));
  }
  series.forEach((item, index) => {
    const color = comparing ? palette[index] : chartColor(item.points[0].value, item.points.at(-1).value);
    const path = item.points.map((point, i) => `${i ? 'L' : 'M'}${x(point.time).toFixed(2)},${y(point.value).toFixed(2)}`).join(' ');
    if (!comparing) {
      svg.append(svgNode('path', { d: `${path} L${x(item.points.at(-1).time)},${height - pad.bottom} L${x(item.points[0].time)},${height - pad.bottom} Z`, fill: color, opacity: '.06' }));
    }
    svg.append(svgNode('path', { d: path, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
  });
  const tooltip = element('div', 'chart-tooltip');
  tooltip.hidden = true;
  const cursor = svgNode('line', { y1: pad.top, y2: height - pad.bottom, class: 'chart-cursor', visibility: 'hidden' });
  svg.append(cursor);
  svg.addEventListener('pointermove', event => {
    const rect = svg.getBoundingClientRect();
    const mouseX = (event.clientX - rect.left) / rect.width * width;
    const time = minTime + (mouseX - pad.left) / (width - pad.left - pad.right) * (maxTime - minTime);
    const nearest = series.map(item => ({
      stock: item.stock,
      point: item.points.reduce((best, point) => Math.abs(point.time - time) < Math.abs(best.time - time) ? point : best)
    }));
    cursor.setAttribute('x1', x(nearest[0].point.time));
    cursor.setAttribute('x2', x(nearest[0].point.time));
    cursor.setAttribute('visibility', 'visible');
    tooltip.replaceChildren(element('strong', '', date.format(new Date(nearest[0].point.time * 1000))),
      ...nearest.map(({ stock: company, point }) => element('span', '', `${company.symbol}: ${comparing ? formatPercent(point.value) : `${number.format(point.value)} ${company.currency}`}`)));
    tooltip.hidden = false;
    tooltip.style.left = `${Math.max(0, Math.min(event.clientX - rect.left + 12, rect.width - 230))}px`;
  });
  svg.addEventListener('pointerleave', () => {
    tooltip.hidden = true;
    cursor.setAttribute('visibility', 'hidden');
  });
  container.append(svg, tooltip);
  $('#chart-caption').textContent = comparing
    ? 'Price returns · 0% at each series’ first observation in the common period · Excludes dividends'
    : `${range === 'day' ? 'Latest available trading session · 5-minute prices' : 'Split-adjusted closing prices · Excludes dividends'} · ${stock.currency}`;
}

function selectionNotice(message) {
  $('#selection-notice').textContent = message;
  $('#selection-notice').hidden = !message;
}

function persistWatchlist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(personalWatchlist));
    localStorage.setItem(PORTFOLIO_STORAGE_KEY, portfolioId);
  } catch (error) {
    selectionNotice(`Your selection works for this visit but could not be saved in this browser: ${error.message}`);
  }
}

function applyWatchlist() {
  const portfolio = activePortfolio();
  watchlist = portfolio ? topHoldings(portfolio).map(holding => holding.symbol) : [...personalWatchlist];
  stocks = watchlist.map(symbol => allStocks.find(stock => stock.symbol === symbol)).filter(Boolean);
  comparison = comparison.filter(symbol => stocks.some(stock => stock.symbol === symbol));
  $('#comparison-notice').hidden = true;
  $('#clear-comparison').hidden = comparison.length === 0;
  if (!stocks.some(stock => stock.symbol === selectedSymbol)) selectedSymbol = stocks[0]?.symbol;
  $('#company-select').replaceChildren(...stocks.map(stock => {
    const option = element('option', '', `${stock.name} (${stock.symbol})`);
    option.value = stock.symbol;
    return option;
  }));
  $('#company-select').value = selectedSymbol ?? '';
  $('#company-select').disabled = !stocks.length;
  const missing = watchlist.filter(symbol => !stocks.some(stock => stock.symbol === symbol));
  const stale = stocks.filter(stock => stock.stale).map(stock => stock.symbol);
  const warnings = [];
  if (portfolioLoadError) warnings.push(portfolioLoadError);
  if (portfolio?.stale) warnings.push(`${portfolio.name}: holdings refresh failed; retained ${portfolio.asOf} data. ${portfolio.error}`);
  if (portfolio && Date.now() - new Date(portfolio.checkedAt).getTime() > 36 * 3600000) warnings.push('Portfolio sources have not been checked in over 36 hours.');
  if (missing.length) warnings.push(`Quotes unavailable for: ${missing.join(', ')}.`);
  if (stale.length) warnings.push(`Previous quotes retained after update failures: ${stale.join(', ')}.`);
  if (Date.now() - new Date(snapshot.generatedAt).getTime() > 36 * 3600000) warnings.push('This snapshot is over 36 hours old. Check the scheduled workflow.');
  baseWarning = warnings.join(' ');
  notify(baseWarning);
  $('#map-sizing').textContent = `Area = ${portfolio ? 'portfolio holding weight' : 'market cap (USD)'} · Color = daily change`;
  renderPortfolio();
  renderCatalog();
  renderOverview();
  renderMap();
  renderDetail();
}

function updateWatchlist(symbol) {
  try {
    if (activePortfolio()) throw new Error('Switch to My personal watchlist before editing companies. Followed portfolios update automatically.');
    const company = catalog.companies.find(item => item.symbol === symbol);
    if (!company) throw new Error('This company is not in the stock catalog.');
    personalWatchlist = toggleStock(personalWatchlist, symbol);
    selectionNotice('');
    persistWatchlist();
    applyWatchlist();
  } catch (error) {
    selectionNotice(error.message);
    renderCatalog();
  }
}

function renderCatalog() {
  const filtered = filterCompanies(catalog.companies, {
    search: $('#catalog-search').value,
    sector: $('#catalog-sector').value,
    country: $('#catalog-country').value,
    selectedOnly: $('#catalog-selected').checked,
    selected: watchlist
  });
  catalogPage = Math.min(catalogPage, Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1));
  $('#watchlist-count').textContent = activePortfolio() ? `${watchlist.length} following` : `${watchlist.length} / ${MAX_STOCKS} selected`;
  $('#catalog-results').textContent = `${filtered.length} of ${catalog.companies.length} companies · ${watchlist.length} selected`;
  $('#selected-stocks').replaceChildren(...watchlist.map(symbol => {
    const button = element('button', 'selected-chip', `${symbol} ×`);
    button.disabled = Boolean(activePortfolio());
    button.setAttribute('aria-label', `Untrack ${symbol}`);
    button.addEventListener('click', () => updateWatchlist(symbol));
    return button;
  }));
  const rows = filtered.slice(catalogPage * PAGE_SIZE, (catalogPage + 1) * PAGE_SIZE).map(company => {
    const stock = allStocks.find(item => item.symbol === company.symbol);
    const row = element('tr', watchlist.includes(company.symbol) ? 'tracked-row' : '');
    const track = element('td');
    const checkbox = element('input');
    checkbox.type = 'checkbox';
    checkbox.checked = watchlist.includes(company.symbol);
    checkbox.disabled = Boolean(activePortfolio());
    checkbox.dataset.symbol = company.symbol;
    checkbox.setAttribute('aria-label', `Track ${company.name} (${company.symbol})`);
    track.append(checkbox);
    const name = element('td');
    name.append(element('strong', '', company.symbol), element('span', '', company.name));
    const category = element('td');
    category.append(element('span', '', SECTORS[company.sector]), element('span', 'muted', company.country));
    row.append(track, name, category, element('td', '', stock ? formatCap(stock.marketCapUsd) : 'Unavailable'),
      element('td', changeClass(stock?.dailyChange), formatPercent(stock?.dailyChange)),
      element('td', changeClass(stock?.weeklyChange), formatPercent(stock?.weeklyChange)));
    if (stock?.stale) name.append(element('small', 'stale-label', 'Retained quote'));
    if (!stock) name.append(element('small', 'stale-label', 'Quote unavailable'));
    return row;
  });
  if (!rows.length) {
    const row = element('tr');
    const cell = element('td', 'catalog-empty', 'No companies match your filters.');
    cell.colSpan = 6;
    row.append(cell);
    rows.push(row);
  }
  $('#catalog-rows').replaceChildren(...rows);
  $('#catalog-page').textContent = `Page ${catalogPage + 1} of ${Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))}`;
  $('#catalog-prev').disabled = catalogPage === 0;
  $('#catalog-next').disabled = (catalogPage + 1) * PAGE_SIZE >= filtered.length;
}

function activePortfolio() {
  return portfolios.find(portfolio => portfolio.id === portfolioId);
}

function renderPortfolio() {
  const portfolio = activePortfolio();
  $('#portfolio-select').value = portfolioId;
  $('#portfolio-info').hidden = !portfolio;
  $('#portfolio-description').textContent = portfolio
    ? `${portfolio.description} Auto-follow is on: the latest top 30 tickered holdings replace this view whenever new published holdings are loaded. Your personal watchlist is preserved.`
    : 'Choose a preset to follow its top 30 tickered holdings automatically. Switch back to keep editing your personal watchlist.';
  if (!portfolio) return;
  const status = $('#portfolio-status');
  status.replaceChildren(element('span', '', `Holdings as of ${portfolio.asOf} · Source checked ${date.format(new Date(portfolio.checkedAt))} · `));
  const source = element('a', '', portfolio.source);
  source.href = portfolio.url;
  source.target = '_blank';
  source.rel = 'noopener noreferrer';
  status.append(source);
  const covered = stocks.reduce((sum, stock) => sum + (portfolio.holdings.find(holding => holding.symbol === stock.symbol)?.weight ?? 0), 0);
  $('#portfolio-coverage').textContent = `Showing ${stocks.length} of ${watchlist.length} followed holdings · ${covered.toFixed(2)}% of reported portfolio weight. Rectangles are scaled within shown holdings, not the entire fund. This is not a fund-return or investment-performance chart.`;
  $('#holdings-summary').textContent = `All ${portfolio.holdings.length} reported holdings`;
  const search = $('#holdings-search').value.trim().toLowerCase();
  const filtered = portfolio.holdings.filter(holding => `${holding.name} ${holding.symbol ?? ''}`.toLowerCase().includes(search));
  $('#holdings-rows').replaceChildren(...filtered.map(holding => {
    const row = element('tr');
    const followed = watchlist.includes(holding.symbol);
    const available = allStocks.some(stock => stock.symbol === holding.symbol);
    row.append(element('td', '', holding.name), element('td', '', holding.symbol ?? 'No stock ticker'),
      element('td', '', holding.weight === null ? 'Not reported' : `${holding.weight.toFixed(3)}%`),
      element('td', '', followed ? available ? 'Following' : 'Following · quote unavailable' : holding.symbol ? 'Outside top 30' : 'Not chartable'));
    return row;
  }));
  if (!filtered.length) {
    const row = element('tr');
    const cell = element('td', 'catalog-empty', 'No holdings match your search.');
    cell.colSpan = 4;
    row.append(cell);
    $('#holdings-rows').append(row);
  }
  const changes = $('#portfolio-changes');
  changes.replaceChildren(element('p', 'manager-description', 'Detected changes compare published snapshots, not confirmed trades. Weight movements can reflect price changes. Up to 60 change events are retained.'));
  if (!portfolio.changes.length) changes.append(element('p', 'muted', 'Tracking started with this snapshot. No changes detected yet.'));
  for (const change of portfolio.changes) {
    const event = element('div', 'portfolio-change');
    event.append(element('strong', '', `${change.fromDate} → ${change.toDate} · Detected ${date.format(new Date(change.detectedAt))}`),
      element('p', '', `Added: ${change.added.map(holding => holding.symbol ?? holding.name).join(', ') || 'None'}`),
      element('p', '', `Removed: ${change.removed.map(holding => holding.symbol ?? holding.name).join(', ') || 'None'}`));
    if (change.weights.length) {
      const weights = element('details');
      weights.append(element('summary', '', `${change.weights.length} reported weight changes`),
        ...change.weights.map(holding => element('p', '', `${holding.symbol ?? holding.name}: ${holding.before === null ? 'Not reported' : `${holding.before.toFixed(3)}%`} → ${holding.after === null ? 'Not reported' : `${holding.after.toFixed(3)}%`}`)));
      event.append(weights);
    }
    changes.append(event);
  }
}

function initCatalog() {
  $('#portfolio-select').append(...portfolios.map(portfolio => {
    const option = element('option', '', portfolio.name);
    option.value = portfolio.id;
    return option;
  }));
  $('#portfolio-select').addEventListener('change', event => {
    portfolioId = event.target.value;
    sector = 'all';
    comparison = [];
    document.querySelectorAll('[data-sector]').forEach(button => {
      const active = button.dataset.sector === 'all';
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    selectionNotice('');
    persistWatchlist();
    applyWatchlist();
  });
  $('#holdings-search').addEventListener('input', renderPortfolio);
  const countries = [...new Set(catalog.companies.map(company => company.country))].sort();
  $('#catalog-country').append(...countries.map(country => {
    const option = element('option', '', country);
    option.value = country;
    return option;
  }));
  for (const selector of ['#catalog-search', '#catalog-sector', '#catalog-country', '#catalog-selected']) {
    $(selector).addEventListener(selector === '#catalog-search' ? 'input' : 'change', () => {
      catalogPage = 0;
      renderCatalog();
    });
  }
  $('#catalog-rows').addEventListener('change', event => {
    const symbol = event.target.dataset.symbol;
    if (symbol) updateWatchlist(symbol);
  });
  $('#catalog-prev').addEventListener('click', () => { catalogPage--; renderCatalog(); });
  $('#catalog-next').addEventListener('click', () => { catalogPage++; renderCatalog(); });
  $('#reset-watchlist').addEventListener('click', () => {
    personalWatchlist = validateSelection(catalog.defaultSymbols, catalog.companies);
    portfolioId = 'custom';
    sector = 'all';
    document.querySelectorAll('[data-sector]').forEach(button => {
      const active = button.dataset.sector === 'all';
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    selectionNotice('');
    persistWatchlist();
    applyWatchlist();
  });
  $('.watchlist-link').addEventListener('click', () => { $('#stock-manager').open = true; });
}

async function init() {
  try {
    [snapshot, catalog] = await Promise.all(['market', 'companies'].map(async name => {
      const response = await fetch(`${import.meta.env.BASE_URL}data/${name}.json`);
      if (!response.ok) throw new Error(`${name === 'market' ? 'Market data' : 'Company catalog'} request failed (${response.status}). Run the publishing workflow.`);
      return response.json();
    }));
    allStocks = snapshot.stocks.filter(stock => Number.isFinite(stock.price) && stock.marketCapUsd > 0);
    if (!allStocks.length) throw new Error('No market data available. Run npm run update-data or the GitHub Actions workflow first.');
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}data/portfolios.json`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.portfolios)) throw new Error('Invalid portfolio data');
      portfolios = data.portfolios;
    } catch (error) {
      portfolioLoadError = `Portfolio presets unavailable: ${error.message}. Your personal watchlist is still available.`;
    }
    personalWatchlist = validateSelection(catalog.defaultSymbols, catalog.companies);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) personalWatchlist = validateSelection(JSON.parse(saved), catalog.companies);
      const followed = localStorage.getItem(PORTFOLIO_STORAGE_KEY);
      if (followed && followed !== 'custom') {
        if (!portfolios.some(portfolio => portfolio.id === followed)) throw new Error('Your followed portfolio is unavailable. Showing your personal watchlist.');
        portfolioId = followed;
      }
    } catch (error) {
      selectionNotice(`Could not restore a saved watchlist: ${error.message} Using the default list.`);
      $('#stock-manager').open = true;
    }
    $('#updated').textContent = `Updated ${date.format(new Date(snapshot.generatedAt))}`;
    selectedSymbol = 'NVDA';
    initCatalog();
    $('#company-select').addEventListener('change', event => selectCompany(event.target.value));
    $('.sector-tabs').addEventListener('click', event => {
      const button = event.target.closest('button[data-sector]');
      if (!button) return;
      sector = button.dataset.sector;
      document.querySelectorAll('[data-sector]').forEach(item => {
        item.classList.toggle('active', item === button);
        item.setAttribute('aria-pressed', String(item === button));
      });
      renderMap();
    });
    $('.range-tabs').addEventListener('click', event => {
      const button = event.target.closest('button[data-range]');
      if (!button) return;
      range = button.dataset.range;
      document.querySelectorAll('[data-range]').forEach(item => {
        item.classList.toggle('active', item === button);
        item.setAttribute('aria-pressed', String(item === button));
      });
      renderDetail();
    });
    $('#clear-comparison').addEventListener('click', () => {
      comparison = [];
      $('#comparison-notice').hidden = true;
      notify(baseWarning);
      renderDetail();
      renderMap();
    });
    document.querySelectorAll('[data-range]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.range === range)));
    applyWatchlist();
    new ResizeObserver(() => { renderMap(); renderDetail(); }).observe($('#heatmap'));
    setInterval(async () => {
      if (!activePortfolio() || document.hidden) return;
      try {
        const [latestPortfolios, latestMarket] = await Promise.all(['portfolios', 'market'].map(async name => {
          const response = await fetch(`${import.meta.env.BASE_URL}data/${name}.json`, { cache: 'no-store' });
          if (!response.ok) throw new Error(`Could not check ${name}: HTTP ${response.status}`);
          return response.json();
        }));
        if (!Array.isArray(latestPortfolios.portfolios) || !latestPortfolios.portfolios.some(portfolio => portfolio.id === portfolioId) || !Array.isArray(latestMarket.stocks)) {
          throw new Error('Invalid published portfolio or quote data');
        }
        portfolios = latestPortfolios.portfolios;
        snapshot = latestMarket;
        allStocks = snapshot.stocks.filter(stock => Number.isFinite(stock.price) && stock.marketCapUsd > 0);
        historyCache.clear();
        $('#updated').textContent = `Updated ${date.format(new Date(snapshot.generatedAt))}`;
        applyWatchlist();
      } catch (error) {
        notify(`Automatic portfolio check failed: ${error.message}. Current view retained.`);
      }
    }, 15 * 60 * 1000);
  } catch (error) {
    $('#updated').textContent = 'Market data unavailable';
    notify(error.message);
  }
}

init();
