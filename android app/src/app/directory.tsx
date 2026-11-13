import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { filterCompanies, SECTORS } from '../../../src/watchlist.js';
import { Button, StockRow } from '../components';
import { useMarket } from '../store';
import { colors, styles } from '../theme';
import type { Company } from '../data';

export default function Directory() {
  const store = useMarket();
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('all');
  const companies: Company[] = useMemo(() => filterCompanies(store.catalog?.companies ?? [], { search, sector }), [store.catalog, search, sector]);
  const quotes = useMemo(() => new Map(store.snapshot?.stocks.map(stock => [stock.symbol, stock])), [store.snapshot]);

  return <FlatList
    style={styles.screen}
    contentContainerStyle={styles.content}
    data={companies}
    keyExtractor={item => item.symbol}
    keyboardShouldPersistTaps="handled"
    refreshControl={<RefreshControl refreshing={store.loading} tintColor={colors.accent} onRefresh={() => void store.refresh()} />}
    ListHeaderComponent={<View style={{ gap: 14 }}>
      <Text style={styles.title}>Discover companies</Text>
      <Text style={styles.muted}>{store.selected.length}/{store.maxStocks} selected. Changes are saved on this phone.</Text>
      <TextInput accessibilityLabel="Search companies" placeholder="Search name, ticker or country" placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} autoCapitalize="none" style={styles.input} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Button label="All sectors" active={sector === 'all'} onPress={() => setSector('all')} />
        {Object.entries(SECTORS).map(([id, name]) => <Button key={id} label={name} active={sector === id} onPress={() => setSector(id)} />)}
      </ScrollView>
      {store.error ? <Text style={styles.error}>{store.error}</Text> : null}
      {store.selectionError ? <Text accessibilityRole="alert" style={styles.error}>{store.selectionError}</Text> : null}
      <Text style={styles.muted}>{companies.length} results</Text>
    </View>}
    renderItem={({ item }) => <StockRow company={item} stock={quotes.get(item.symbol)} action={store.selected.includes(item.symbol) ? 'Remove' : 'Add'} onAction={() => void store.toggle(item.symbol)} />}
    ItemSeparatorComponent={() => <View style={styles.divider} />}
    ListEmptyComponent={<Text style={styles.muted}>{store.loading ? 'Loading companies...' : 'No matching companies.'}</Text>}
  />;
}
