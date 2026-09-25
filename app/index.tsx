import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useApp } from '@/context/AppContext';

export default function Index() {
	const { user, loading } = useApp();
	if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#087F70" /></View>;
	return <Redirect href={user ? '/(tabs)' : '/auth'} />;
}
