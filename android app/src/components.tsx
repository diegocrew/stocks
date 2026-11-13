import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { formatPercent } from '../../src/market.js';
import type { Company, Stock } from './data';
import { changeColor, styles } from './theme';

export function Button({ label, onPress, active = false }: { label: string; onPress: () => void; active?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.button, active && styles.active]}>
    <Text style={styles.buttonText}>{label}</Text>
  </Pressable>;
}

export function StockRow({ company, stock, action, onAction }: {
  company: Company; stock?: Stock; action?: string; onAction?: () => void;
}) {
  return <View style={[styles.row, { paddingVertical: 14 }]}>
    <Link href={{ pathname: '/stock/[symbol]', params: { symbol: company.symbol } }} asChild>
      <Pressable accessibilityRole="button" accessibilityLabel={`View ${company.name}`} style={{ flex: 1, gap: 4, minHeight: 44 }}>
        <Text style={[styles.text, { fontWeight: '700' }]}>{company.symbol}</Text>
        <Text style={styles.muted} numberOfLines={1}>{company.name}</Text>
      </Pressable>
    </Link>
    <View style={{ alignItems: 'flex-end', gap: 4 }}>
      <Text style={styles.text}>{stock ? `${stock.price.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${stock.currency}` : 'Quote unavailable'}</Text>
      <Text style={{ color: changeColor(stock?.dailyChange ?? null) }}>{formatPercent(stock?.dailyChange)} day</Text>
      {stock?.stale && <Text style={styles.error}>Retained quote</Text>}
    </View>
    {action && onAction && <Button label={action} onPress={onAction} />}
  </View>;
}
