import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '@/context/AppContext';
import { getAdaptiveReminder } from '@/lib/analytics';
import { Compartment } from '@/lib/types';

export default function Caregiver() {
  const { history, inventory, alerts, schedule } = useApp();
  const taken = history.filter((item) => item.status === 'Taken').length;
  const missed = history.filter((item) => item.status === 'Missed').length;
  const total = taken + missed;
  const adherence = total ? Math.round((taken / total) * 100) : 100;
  const low = Object.values(inventory).some((value) => typeof value === 'number' && value <= inventory.refillThreshold);
  const openAlerts = alerts
    .filter((item) => !item.resolved)
    .sort((first, second) => String(second.createdAt ?? '').localeCompare(String(first.createdAt ?? '')));

  return <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <Text style={styles.eyebrow}>CARE OVERVIEW</Text>
    <Text style={styles.title}>Care insights</Text>
    <Text style={styles.sub}>A clearer view of how the routine is going.</Text>
    <View style={styles.score}><View><Text style={styles.scoreLabel}>7-DAY ADHERENCE</Text><Text style={styles.scoreValue}>{adherence}%</Text><Text style={styles.scoreSub}>Keep building the habit</Text></View><View style={styles.ring}><Text style={styles.ringText}>{taken}</Text><Text style={styles.ringLabel}>taken</Text></View></View>
    <View style={styles.grid}><Metric icon="checkmark-circle" value={String(taken)} label="Taken doses" color="#087F70" /><Metric icon="alert-circle" value={String(missed)} label="Missed doses" color="#C05252" /><Metric icon="cube-outline" value={String(inventory.morningStock + inventory.afternoonStock + inventory.nightStock)} label="Tablets left" color="#B27720" /></View>
    <View style={styles.alert}><Ionicons name={low ? 'warning-outline' : 'shield-checkmark-outline'} size={23} color={low ? '#B27720' : '#087F70'} /><View style={{ flex: 1 }}><Text style={styles.alertTitle}>{low ? 'Refill needed soon' : 'Inventory looks healthy'}</Text><Text style={styles.alertText}>{low ? 'One or more compartments are below 15 tablets.' : 'No refill action is needed right now.'}</Text></View></View>
    <Text style={styles.section}>Caregiver alerts ({openAlerts.length})</Text>
    <View style={styles.alertWindow}>
      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator contentContainerStyle={styles.alertContent}>
        {openAlerts.map((item) => <View style={styles.alertItem} key={item.id}><Ionicons name="notifications-outline" size={19} color="#C05252" /><Text style={styles.alertItemText}>{item.message}</Text></View>)}
        {openAlerts.length === 0 && <Text style={styles.empty}>No active caregiver alerts.</Text>}
      </ScrollView>
    </View>
    <Text style={styles.section}>Adaptive reminders</Text>
    <Text style={styles.helper}>Suggestions use your last 7 taken records.</Text>
    <View style={styles.adaptiveGrid}>{(['morning', 'afternoon', 'night'] as Compartment[]).map((compartment) => { const result = getAdaptiveReminder(history, compartment); const scheduledTime = String(schedule[`${compartment}Time`]); return <View style={styles.adaptiveCard} key={compartment}><Text style={styles.adaptiveName}>{compartment[0].toUpperCase() + compartment.slice(1)}</Text><Text style={styles.adaptiveValue}>{result.averageDelay ? `${result.averageDelay} min late` : 'No delay yet'}</Text><Text style={styles.adaptiveMeta}>{result.recordsAnalyzed} record{result.recordsAnalyzed === 1 ? '' : 's'} analyzed</Text><Text style={styles.adaptiveSuggestion}>{result.suggestedAdvance ? `Try ${subtractMinutes(scheduledTime, result.suggestedAdvance)}` : `Keep ${scheduledTime}`}</Text></View>; })}</View>
    <Text style={styles.section}>Recent pattern</Text>
    <View style={styles.chart}>{[62, 82, 70, 92, 76, 88, adherence].map((height, index) => <View key={index} style={styles.barWrap}><View style={[styles.bar, { height: height * 0.9, backgroundColor: index === 6 ? '#087F70' : '#B9DED4' }]} /><Text style={styles.day}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</Text></View>)}</View>
  </ScrollView>;
}

function Metric({ icon, value, label, color }: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string; color: string }) {
  return <View style={styles.metric}><Ionicons name={icon} size={20} color={color} /><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function subtractMinutes(time: string, amount: number) {
  const [hour, minute] = time.split(':').map(Number);
  const date = new Date(2000, 0, 1, hour, minute - amount);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F7FAF8' },
  content: { padding: 22, paddingTop: 30, paddingBottom: 40 },
  eyebrow: { color: '#70807C', letterSpacing: 1.4, fontSize: 10, fontWeight: '700' },
  title: { color: '#142B28', fontSize: 28, fontWeight: '700', marginTop: 8 },
  sub: { color: '#778681', marginTop: 7, marginBottom: 24 },
  score: { backgroundColor: '#143D36', borderRadius: 19, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scoreLabel: { color: '#ACCEC5', fontSize: 10, letterSpacing: 1, fontWeight: '700' },
  scoreValue: { color: '#FFF', fontSize: 42, fontWeight: '700', marginTop: 3 },
  scoreSub: { color: '#ACCEC5', fontSize: 12 },
  ring: { width: 76, height: 76, borderWidth: 7, borderColor: '#8BCDBF', borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  ringText: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  ringLabel: { color: '#ACCEC5', fontSize: 10 },
  grid: { flexDirection: 'row', gap: 9, marginVertical: 14 },
  metric: { backgroundColor: '#FFF', borderRadius: 14, padding: 13, flex: 1, borderWidth: 1, borderColor: '#E9EFEC' },
  metricValue: { color: '#243D38', fontSize: 22, fontWeight: '700', marginTop: 8 },
  metricLabel: { color: '#879590', fontSize: 10, marginTop: 3 },
  alert: { backgroundColor: '#FFF', borderRadius: 15, padding: 16, flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: '#E9EFEC' },
  alertTitle: { color: '#243D38', fontWeight: '700', fontSize: 14 },
  alertText: { color: '#879590', fontSize: 11, marginTop: 5 },
  section: { color: '#243D38', fontWeight: '700', fontSize: 17, marginTop: 27, marginBottom: 13 },
  alertWindow: { height: 220, backgroundColor: '#FFF', borderRadius: 15, borderWidth: 1, borderColor: '#E9EFEC', overflow: 'hidden' },
  alertContent: { padding: 10 },
  alertItem: { backgroundColor: '#FFF4F1', borderRadius: 13, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 8 },
  alertItemText: { color: '#82453E', fontSize: 12, flex: 1 },
  empty: { color: '#879590', fontSize: 12, padding: 8 },
  helper: { color: '#879590', fontSize: 11, marginTop: -7, marginBottom: 12 },
  adaptiveGrid: { gap: 9 },
  adaptiveCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E9EFEC' },
  adaptiveName: { color: '#087F70', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  adaptiveValue: { color: '#243D38', fontSize: 17, fontWeight: '700', marginTop: 6 },
  adaptiveMeta: { color: '#879590', fontSize: 11, marginTop: 4 },
  adaptiveSuggestion: { color: '#B27720', fontSize: 12, fontWeight: '700', marginTop: 8 },
  chart: { height: 150, backgroundColor: '#FFF', borderRadius: 15, padding: 18, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', borderWidth: 1, borderColor: '#E9EFEC' },
  barWrap: { alignItems: 'center', gap: 7 },
  bar: { width: 18, borderRadius: 9 },
  day: { color: '#879590', fontSize: 10 },
});
