import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';

import { getHistory, type HistoryEntry } from '@/stores/historyStore';
import { setLetter, setCleanBillExplanation } from '@/stores/letterStore';
import { logout } from '@/stores/authStore';
import { Palette, Radius } from '@/constants/design';

export default function HistoryScreen() {
  const router = useRouter();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = () => {
    getHistory().then(setEntries);
  };

  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
    setRefreshing(false);
  };

  const openEntry = (entry: HistoryEntry) => {
    if (entry.letter || entry.cleanBillExplanation) {
      setLetter(entry.letter ?? null);
      setCleanBillExplanation(entry.cleanBillExplanation ?? null);
      router.push('/letter');
    }
  };

  const handleLogout = () => {
    logout();
    router.replace('/welcome');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <Text style={styles.subtitle}>Track previous bill audits</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No past analyses yet.</Text>
            <Text style={styles.emptySubtext}>Scan or upload a bill from Home to get started.</Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.accent} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => openEntry(item)} activeOpacity={0.8}>
            <Text style={styles.cardProvider} numberOfLines={1}>{item.provider}</Text>
            <Text style={styles.cardDate}>{item.date}</Text>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Recoverable</Text>
              <Text style={styles.cardAmount}>${item.totalRecoverable.toFixed(2)}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.appBg,
  },
  header: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 10,
    backgroundColor: Palette.primary,
    borderRadius: Radius.screen,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
  },
  title: {
    fontSize: 29,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: '#CDE3D8',
    marginTop: 4,
  },
  logoutBtn: {
    alignSelf: 'flex-end',
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
    backgroundColor: '#16513D',
  },
  logoutText: {
    color: '#D8F0E3',
    fontWeight: '600',
    fontSize: 13,
  },
  list: {
    padding: 16,
    paddingBottom: 120,
  },
  empty: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Palette.muted,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#95A39C',
    marginTop: 8,
  },
  card: {
    backgroundColor: Palette.card,
    borderRadius: Radius.card,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  cardProvider: {
    fontSize: 16,
    fontWeight: '700',
    color: Palette.text,
  },
  cardDate: {
    fontSize: 13,
    color: Palette.muted,
    marginTop: 4,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  cardLabel: {
    fontSize: 12,
    color: '#90A19A',
  },
  cardAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: Palette.accent,
  },
});
