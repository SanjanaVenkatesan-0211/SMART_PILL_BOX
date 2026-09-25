import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';

const icons = { index: 'grid-outline', schedule: 'time-outline', history: 'pulse-outline', caregiver: 'people-outline' } as const;
export default function TabLayout() { return <Tabs screenOptions={({ route }) => ({ headerShown: false, tabBarActiveTintColor: '#087F70', tabBarInactiveTintColor: '#8B9895', tabBarStyle: styles.tabBar, tabBarLabelStyle: styles.label, tabBarIcon: ({ color, focused }) => <View style={focused ? styles.activeIcon : undefined}><Ionicons name={icons[route.name as keyof typeof icons] || 'ellipse-outline'} size={21} color={color} /></View> })}><Tabs.Screen name="index" options={{ title: 'Today' }} /><Tabs.Screen name="schedule" options={{ title: 'Schedule' }} /><Tabs.Screen name="history" options={{ title: 'History' }} /><Tabs.Screen name="caregiver" options={{ title: 'Insights' }} /></Tabs>; }
const styles = StyleSheet.create({ tabBar: { height: 76, paddingTop: 8, paddingBottom: 13, borderTopColor: '#E5ECE9', backgroundColor: '#FFFFFF' }, label: { fontSize: 11, fontWeight: '600' }, activeIcon: { backgroundColor: '#DDF4EE', borderRadius: 14, paddingHorizontal: 9, paddingVertical: 3 } });
