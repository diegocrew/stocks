import { Link } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { formatCap, formatPercent, tileColor } from '../../../src/market.js';
import { topHoldings } from '../../../src/portfolios.js';
import { Button, StockRow } from '../components';
import { useMarket } from '../store';
import { changeColor, colors, styles } from '../theme';
import type { Holding } from '../data';

export default function Dashboard() {
  const store = useMarket();
  const portfolio = store.portfolios.find(item => item.id === store.portfolioId);
  const holdings: Holding[] = portfolio ? topHoldings(portfolio) : [];
  const symbols: string[] = portfolio ? holdings.flatMap(holding => holding.symbol ? [holding.symbol] : []) : store.selected;
  const stocks = symbols.flatMap(symbol => store.snapshot?.stocks.find(stock => stock.symbol === symbol) ?? []);
  const totalCap = stocks.reduce((sum, stock) => sum + (stock.marketCapUsd ?? 0), 0);
  const weighted = stocks.filter(stock => stock.dailyChange !== null && (portfolio ? true : (stock.marketCapUsd ?? 0) > 0));
  const weight = (symbol: string, cap: number | null) => portfolio ? holdings.find(item => item.symbol === symbol)?.weight ?? 0 : cap ?? 0;
  const denominator = weighted.reduce((sum, stock) => sum + weight(stock.symbol, stock.marketCapUsd), 0);
  const daily = denominator ? weighted.reduce((sum, stock) => sum + (stock.dailyChange ?? 0) * weight(stock.symbol, stock.marketCapUsd), 0) / denominator : null;
  const missing = symbols.filter(symbol => !stocks.some(stock => stock.symbol === symbol));

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={
    <RefreshControl refreshing={store.loading} tintColor={colors.accent} onRefresh={() => { void store.refresh(); void store.refreshPortfolios(); }} />
  }>
    <View style={styles.row}>
      <View><Text style={styles.label}>YOUR MARKET, AT A GLANCE</Text><Text style={styles.title}>Stock Atlas</Text></View>
      <Link href="/directory" asChild><Pressable style={styles.button}><Text style={styles.buttonText}>+ Companies</Text></Pressable></Link>
    </View>
    <Text style={styles.muted}>Global stocks. Native on your phone.</Text>
    <Link href="/about" asChild><Pressable style={styles.button}><Text style={styles.buttonText}>Privacy & support</Text></Pressable></Link>
    {store.error ? <View style={styles.card}><Text style={styles.error}>{store.error}</Text><Button label="Retry market data" onPress={() => void store.refresh()} /></View> : null}
    {store.selectionError ? <Text style={styles.error}>{store.selectionError}</Text> : null}
    {store.loading && !store.snapshot ? <ActivityIndicator size="large" color={colors.accent} /> : null}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      <Button label="My watchlist" active={!portfolio} onPress={() => store.setPortfolioId('custom')} />
      {store.portfolios.map(item => <Button key={item.id} label={item.name} active={item.id === store.portfolioId} onPress={() => store.setPortfolioId(item.id)} />)}
    </ScrollView>
    {store.portfolioError ? <View><Text style={styles.error}>{store.portfolioError}</Text><Button label="Retry portfolios" onPress={() => void store.refreshPortfolios()} /></View> : null}
    {portfolio && <View style={styles.card}>
      <Text style={styles.heading}>{portfolio.name}</Text>
      <Text style={styles.muted}>{portfolio.description}</Text>
      <Text style={styles.muted}>{portfolio.source}{'\n'}Reported {portfolio.asOf} | Checked {new Date(portfolio.checkedAt).toLocaleString()}</Text>
      <Text style={styles.muted}>Top {symbols.length} tickered holdings; {stocks.length} have quotes. Shown holding weight: {holdings.reduce((sum, item) => sum + (item.weight ?? 0), 0).toFixed(2)}%.</Text>
      {portfolio.stale && <Text style={styles.error}>Retained holdings: {portfolio.error || 'Latest source update failed.'}</Text>}
    </View>}
    {store.snapshot && <>
      <View style={styles.row}>
        <View style={[styles.card, { flex: 1 }]}><Text style={styles.label}>TRACKED CAP</Text><Text style={styles.heading}>{formatCap(totalCap)}</Text><Text style={styles.muted}>{stocks.length} companies</Text></View>
        <View style={[styles.card, { flex: 1 }]}><Text style={styles.label}>DAILY MOVE</Text><Text style={[styles.heading, { color: changeColor(daily) }]}>{formatPercent(daily)}</Text><Text style={styles.muted}>{portfolio ? 'Holding-weighted' : 'Cap-weighted'}</Text></View>
      </View>
      <Text style={styles.muted}>{portfolio ? 'Shown holdings only; not total fund return.' : 'Latest price versus the previous trading close.'} {stocks.filter(stock => (stock.dailyChange ?? 0) > 0).length} rising / {stocks.filter(stock => (stock.dailyChange ?? 0) < 0).length} falling.</Text>
      <Text style={styles.heading}>Daily performance</Text>
      <Text style={styles.muted}>Tap a company for history. Tiles show daily change; tile sizes are equal.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {stocks.map(stock => <Link key={stock.symbol} href={{ pathname: '/stock/[symbol]', params: { symbol: stock.symbol } }} asChild>
          <Pressable accessibilityLabel={`${stock.name}, daily ${formatPercent(stock.dailyChange)}`} style={{ flexBasis: '30%', flexGrow: 1, padding: 12, minHeight: 98, borderRadius: 12, backgroundColor: tileColor(stock.dailyChange), gap: 6 }}>
            <Text style={[styles.text, { fontWeight: '700' }]} numberOfLines={1}>{stock.symbol}</Text>
            <Text style={styles.text}>{formatPercent(stock.dailyChange)}</Text>
            <Text style={[styles.muted, { color: '#c4d2e3' }]}>W {formatPercent(stock.weeklyChange)}</Text>
          </Pressable>
        </Link>)}
      </View>
      {missing.length > 0 && <Text style={styles.error}>Quotes unavailable: {missing.join(', ')}. These holdings are not replaced with lower-ranked ones.</Text>}
      <View style={styles.row}><Text style={styles.heading}>{portfolio ? 'Top holdings' : `Watchlist ${store.selected.length}/${store.maxStocks}`}</Text>
        {!portfolio && <Button label="Reset" onPress={() => void store.reset()} />}
      </View>
      {stocks.map(stock => <View key={stock.symbol}>
        <StockRow company={stock} stock={stock} />
        {portfolio && <Text style={styles.muted}>{holdings.find(item => item.symbol === stock.symbol)?.weight?.toFixed(2)}% of portfolio</Text>}
        <View style={styles.divider} />
      </View>)}
      <Text style={styles.muted}>Snapshot: {new Date(store.snapshot.generatedAt).toLocaleString()}</Text>
      {store.snapshot.warnings.map(warning => <Text key={warning} style={styles.error}>{warning}</Text>)}
    </>}
    <Text style={styles.muted}>Yahoo Finance quotes may be delayed. Pull down to refresh. For research only, not investment advice.</Text>
  </ScrollView>;
}
