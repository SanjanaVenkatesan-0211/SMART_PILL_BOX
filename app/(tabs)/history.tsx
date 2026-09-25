import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '@/context/AppContext';
import { HistoryRecord } from '@/lib/types';

type Filter = 'all' | 'week' | 'month';

export default function History() {
  const { history } = useApp();
  const [filter, setFilter] = useState<Filter>('all');
  const [showAll, setShowAll] = useState(false);
  const visibleHistory = history.filter((item) => matchesFilter(item, filter));
  const displayedHistory = showAll ? visibleHistory : visibleHistory.slice(0, 5);
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>MEDICATION LOG</Text>
    <Text style={styles.title}>History</Text>
    <View style={styles.filter}>{([['all', 'All activity'], ['week', 'This week'], ['month', 'This month']] as [Filter, string][]).map(([value, label]) => <Pressable key={value} onPress={() => { setFilter(value); setShowAll(false); }}><Text style={filter === value ? styles.active : styles.muted}>{label}</Text></Pressable>)}</View>
    {displayedHistory.map((item) => <View style={styles.item} key={item.id}><View style={[styles.dot, { backgroundColor: item.status === 'Missed' ? '#C05252' : item.status === 'Taken' ? '#087F70' : '#B27720' }]}><Ionicons name={item.status === 'Taken' ? 'checkmark' : item.status === 'Missed' ? 'close' : 'time'} size={16} color="#FFF" /></View><View style={{ flex: 1 }}><Text style={styles.medicine}>{item.medicine}</Text><Text style={styles.meta}>{item.date} · Scheduled {item.scheduledTime}{item.takenTime ? ` · Taken ${item.takenTime}` : ''}</Text></View><Text style={[styles.status, { color: item.status === 'Taken' ? '#087F70' : item.status === 'Missed' ? '#C05252' : '#B27720' }]}>{item.status}</Text></View>)}
    {visibleHistory.length === 0 && <Text style={styles.empty}>No medication history for this period.</Text>}
    {visibleHistory.length > 5 && <Pressable style={styles.more} onPress={() => setShowAll(!showAll)}><Text style={styles.moreText}>{showAll ? 'Show less' : `Show more (${visibleHistory.length - 5})`}</Text><Ionicons name={showAll ? 'chevron-up' : 'chevron-down'} size={16} color="#087F70" /></Pressable>}
  </ScrollView>;
}

function matchesFilter(item: HistoryRecord, filter: Filter) {
  if (filter === 'all') return true;
  const created = new Date(item.createdAt);
  if (Number.isNaN(created.getTime())) return false;
  const age = Date.now() - created.getTime();
  return filter === 'week' ? age <= 7 * 24 * 60 * 60 * 1000 : age <= 30 * 24 * 60 * 60 * 1000;
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#F7FAF8' }, content: { padding: 22, paddingTop: 30, paddingBottom: 40 }, eyebrow: { color: '#70807C', letterSpacing: 1.4, fontSize: 10, fontWeight: '700' }, title: { color: '#142B28', fontSize: 28, fontWeight: '700', marginTop: 8 }, filter: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 25, borderBottomWidth: 1, borderBottomColor: '#DFE8E4', paddingBottom: 12 }, active: { color: '#087F70', fontWeight: '700' }, muted: { color: '#879590', fontSize: 12 }, item: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF', padding: 15, borderRadius: 14, marginBottom: 9, borderWidth: 1, borderColor: '#E9EFEC' }, dot: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' }, medicine: { color: '#243D38', fontWeight: '700', fontSize: 14 }, meta: { color: '#899590', fontSize: 11, marginTop: 5, lineHeight: 16 }, status: { fontSize: 10, fontWeight: '700' }, empty: { color: '#879590', textAlign: 'center', padding: 24 }, more: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, padding: 15 }, moreText: { color: '#087F70', fontWeight: '700', fontSize: 13 } });
