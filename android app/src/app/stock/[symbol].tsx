import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Line, Polyline } from 'react-native-svg';
import { chartColor, formatCap, formatPercent, historyFor } from '../../../../src/market.js';
import { Button } from '../../components';
import { message, parseHistory, requestData, type History, type Point } from '../../data';
import { useMarket } from '../../store';
import { changeColor, colors, styles } from '../../theme';

const ranges = [['day', '1D'], ['week', '1W'], ['month', '1M'], ['year', '1Y'], ['max', 'MAX']] as const;
type Range = typeof ranges[number][0];

export default function StockDetail() {
  const params = useLocalSearchParams<{ symbol: string }>();
  return <StockScreen key={params.symbol} symbol={params.symbol} />;
}

function StockScreen({ symbol }: { symbol: string }) {
  const store = useMarket();
  const stock = store.snapshot?.stocks.find(item => item.symbol === symbol);
  const company = stock ?? store.catalog?.companies.find(item => item.symbol === symbol);
  const [history, setHistory] = useState<History | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [range, setRange] = useState<Range>('month');
  const [selectedPoint, setSelectedPoint] = useState<Point | null>(null);
  const [width, setWidth] = useState(300);

  useEffect(() => {
    let active = true;
    requestData(`history/${encodeURIComponent(symbol)}.json`)
      .then(value => { const next = parseHistory(value); if (active) setHistory(next); })
      .catch(cause => { if (active) setError(`Could not load history: ${message(cause)}`); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [symbol, retry]);

  const points: Point[] = history ? historyFor(history, range) : [];
  const first = points[0];
  const last = points.at(-1);
  const low = points.length ? Math.min(...points.map(point => point.close)) : 0;
  const high = points.length ? Math.max(...points.map(point => point.close)) : 0;
  const x = (point: Point) => 12 + (point.time - (first?.time ?? 0)) / Math.max(1, (last?.time ?? 0) - (first?.time ?? 0)) * (width - 24);
  const y = (point: Point) => 178 - (point.close - low) / (high - low || 1) * 156;
  const lineColor = first && last ? chartColor(first.close, last.close) : colors.muted;
  const highlighted = selectedPoint ?? last;

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Text style={styles.label}>{symbol} | {company?.country ?? 'Company detail'}</Text>
    <Text style={styles.title}>{company?.name ?? symbol}</Text>
    {stock ? <>
      <Text style={styles.title}>{stock.price.toLocaleString(undefined, { maximumFractionDigits: 2 })} {stock.currency}</Text>
      <View style={styles.row}>
        <Text style={{ color: changeColor(stock.dailyChange) }}>{formatPercent(stock.dailyChange)} day</Text>
        <Text style={{ color: changeColor(stock.weeklyChange) }}>{formatPercent(stock.weeklyChange)} week</Text>
      </View>
      <Text style={styles.muted}>Market cap {formatCap(stock.marketCapUsd)}{'\n'}Quote: {new Date(stock.quoteTime).toLocaleString()}</Text>
      {stock.stale && <Text style={styles.error}>Latest quote update failed. Showing retained data.</Text>}
    </> : <Text style={styles.error}>{store.loading ? 'Loading market data...' : 'No quote available for this company.'}</Text>}
    {store.catalog?.companies.some(item => item.symbol === symbol) &&
      <Button label={store.selected.includes(symbol) ? 'Remove from watchlist' : 'Add to watchlist'} onPress={() => void store.toggle(symbol)} />}
    {store.selectionError ? <Text style={styles.error}>{store.selectionError}</Text> : null}
    <View style={styles.card}>
      <Text style={styles.heading}>Price history</Text>
      <View style={styles.row}>{ranges.map(([id, label]) => <Button key={id} label={label} active={range === id} onPress={() => { setRange(id); setSelectedPoint(null); }} />)}</View>
      {loading ? <ActivityIndicator color={colors.accent} /> : error ? <><Text style={styles.error}>{error}</Text><Button label="Retry history" onPress={() => { setLoading(true); setError(''); setRetry(value => value + 1); }} /></> :
        points.length < 2 ? <Text style={styles.muted}>Not enough history available for this period. Choose another period.</Text> : <>
          <Text style={[styles.heading, { color: lineColor }]}>{highlighted?.close.toLocaleString(undefined, { maximumFractionDigits: 2 })} {stock?.currency}</Text>
          <Text style={styles.muted}>{highlighted ? new Date(highlighted.time * 1000).toLocaleString() : ''}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Price history chart. Tap to inspect a price." onLayout={event => setWidth(event.nativeEvent.layout.width)}
            onPress={event => {
              const target = event.nativeEvent.locationX;
              setSelectedPoint(points.reduce((nearest, point) => Math.abs(x(point) - target) < Math.abs(x(nearest) - target) ? point : nearest, points[0]));
            }}>
            <Svg width="100%" height={200} viewBox={`0 0 ${width} 200`}>
              <Line x1={0} x2={width} y1={100} y2={100} stroke={colors.border} />
              <Polyline points={points.map(point => `${x(point)},${y(point)}`).join(' ')} fill="none" stroke={lineColor} strokeWidth={2.5} />
              {selectedPoint && <Line x1={x(selectedPoint)} x2={x(selectedPoint)} y1={10} y2={190} stroke={colors.muted} strokeDasharray="4 4" />}
            </Svg>
          </Pressable>
          <View style={styles.row}><Text style={styles.muted}>Low {low.toFixed(2)}</Text><Text style={styles.muted}>High {high.toFixed(2)}</Text></View>
          <Text style={styles.muted}>Tap the chart for exact prices. {first && last ? `${new Date(first.time * 1000).toLocaleDateString()} - ${new Date(last.time * 1000).toLocaleDateString()}` : ''}</Text>
        </>}
    </View>
    <Text style={styles.muted}>Price returns exclude dividends. Quotes may be delayed. For research only, not investment advice.</Text>
  </ScrollView>;
}
