import { StyleSheet } from 'react-native';

export const colors = {
  background: '#0b111c', card: '#151e2d', border: '#28364b', text: '#edf3fc',
  muted: '#94a6bf', accent: '#7dd3fc', green: '#5cc69d', red: '#ee8490',
};

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 18, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { color: colors.text, fontSize: 30, fontWeight: '700' },
  heading: { color: colors.text, fontSize: 20, fontWeight: '700' },
  text: { color: colors.text, fontSize: 15 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  label: { color: colors.muted, fontSize: 11, letterSpacing: 1.5, fontWeight: '700' },
  card: { padding: 18, gap: 10, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  button: { minHeight: 44, paddingHorizontal: 15, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  buttonText: { color: colors.accent, fontWeight: '600', fontSize: 14 },
  active: { backgroundColor: '#213b50', borderColor: colors.accent },
  chips: { gap: 8, paddingVertical: 4 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, color: colors.text, padding: 14, fontSize: 16, backgroundColor: colors.card },
  error: { color: colors.red, fontSize: 14, lineHeight: 21 },
  divider: { height: 1, backgroundColor: colors.border },
});

export function changeColor(value: number | null) {
  return value === null ? colors.muted : value >= 0 ? colors.green : colors.red;
}
