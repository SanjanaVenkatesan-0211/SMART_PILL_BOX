import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useApp } from '@/context/AppContext';
import { Compartment, Inventory, Schedule } from '@/lib/types';

export default function ScheduleScreen() {
  const { schedule, inventory, updateSchedule, updateInventory } = useApp();
  const [draft, setDraft] = useState(schedule);
  const [stockDraft, setStockDraft] = useState(inventory);
  useEffect(() => setDraft(schedule), [schedule]);
  useEffect(() => setStockDraft(inventory), [inventory]);
  const updateScheduleDraft = (key: keyof Schedule, value: string) => setDraft({ ...draft, [key]: key.endsWith('Dose') ? Number(value) || 0 : value });
  const updateStockDraft = (key: keyof Inventory, value: string) => setStockDraft({ ...stockDraft, [key]: Number(value) || 0 });
  const save = async () => {
    await Promise.all([
      updateSchedule({ ...draft, updatedAt: new Date().toISOString() }),
      updateInventory({ ...stockDraft, updatedAt: new Date().toISOString() }),
    ]);
    Alert.alert('Saved', 'Your schedule and inventory were saved to Firebase.');
  };
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>MEDICATION PLAN</Text>
    <Text style={styles.title}>Your schedule</Text>
    <Text style={styles.sub}>Set medication names, times, doses, and stock.</Text>
    {(['morning', 'afternoon', 'night'] as Compartment[]).map((part) => {
      const stockKey = `${part}Stock` as keyof Inventory;
      const stock = Number(stockDraft[stockKey]);
      const low = stock <= stockDraft.refillThreshold;
      return <View style={styles.card} key={part}>
        <View style={styles.cardHead}><View style={styles.icon}><Ionicons name={part === 'night' ? 'moon-outline' : part === 'morning' ? 'sunny-outline' : 'partly-sunny-outline'} size={20} color="#087F70" /></View><Text style={styles.part}>{part[0].toUpperCase() + part.slice(1)}</Text></View>
        <Text style={styles.label}>MEDICINE NAME</Text>
        <TextInput style={styles.fullInput} value={String(draft[`${part}Medicine`])} onChangeText={(value) => updateScheduleDraft(`${part}Medicine`, value)} placeholder="e.g. Vitamin D" placeholderTextColor="#9AA8A3" />
        <View style={styles.inputs}><View><Text style={styles.label}>TIME</Text><TextInput style={styles.input} value={String(draft[`${part}Time`])} onChangeText={(value) => updateScheduleDraft(`${part}Time`, value)} keyboardType="numbers-and-punctuation" /></View><View><Text style={styles.label}>DOSE</Text><TextInput style={styles.input} value={String(draft[`${part}Dose`])} onChangeText={(value) => updateScheduleDraft(`${part}Dose`, value)} keyboardType="number-pad" /></View><View><Text style={styles.label}>STOCK</Text><TextInput style={styles.input} value={String(stock)} onChangeText={(value) => updateStockDraft(stockKey, value)} keyboardType="number-pad" /></View></View>
        <Text style={[styles.refill, { color: low ? '#B27720' : '#087F70' }]}>{low ? 'Refill required soon' : 'Stock level is healthy'} · threshold {stockDraft.refillThreshold}</Text>
      </View>;
    })}
    <Pressable style={styles.save} onPress={save}><Text style={styles.saveText}>Save schedule and inventory</Text><Ionicons name="checkmark" size={18} color="#FFF" /></Pressable>
    <Text style={styles.note}>Changes are saved to your Firebase account. Notifications require a development build.</Text>
  </ScrollView>;
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#F7FAF8' }, content: { padding: 22, paddingTop: 30, paddingBottom: 40 }, eyebrow: { color: '#70807C', letterSpacing: 1.4, fontSize: 10, fontWeight: '700' }, title: { color: '#142B28', fontSize: 28, fontWeight: '700', marginTop: 8 }, sub: { color: '#778681', marginTop: 7, marginBottom: 25 }, card: { backgroundColor: '#FFF', borderRadius: 17, marginBottom: 12, padding: 17, borderWidth: 1, borderColor: '#E9EFEC' }, cardHead: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 17 }, icon: { backgroundColor: '#DDF4EE', width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' }, part: { color: '#243D38', fontWeight: '700', fontSize: 16 }, inputs: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' }, label: { color: '#879590', fontSize: 10, letterSpacing: 1, fontWeight: '700', marginBottom: 7 }, input: { width: 90, borderWidth: 1, borderColor: '#DCE7E2', borderRadius: 10, padding: 12, color: '#143D36', fontSize: 16, fontWeight: '600' }, fullInput: { borderWidth: 1, borderColor: '#DCE7E2', borderRadius: 10, padding: 12, color: '#143D36', fontSize: 15, marginBottom: 15 }, refill: { fontSize: 11, fontWeight: '700', marginTop: 12 }, save: { backgroundColor: '#087F70', borderRadius: 14, padding: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 10 }, saveText: { color: '#FFF', fontWeight: '700', fontSize: 15 }, note: { color: '#899590', textAlign: 'center', fontSize: 11, lineHeight: 17, marginTop: 15 } });
