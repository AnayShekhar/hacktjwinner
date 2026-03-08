import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

import { getApiBaseUrl } from '@/constants/api';
import { logout } from '@/stores/authStore';
import { Palette, Radius } from '@/constants/design';

export default function SettingsScreen() {
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.replace('/welcome');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>App and account</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Server</Text>
        <Text style={styles.urlLabel}>API base URL</Text>
        <Text style={styles.urlValue} numberOfLines={2}>{getApiBaseUrl()}</Text>
        <Text style={styles.hint}>
          To change this, edit EXPO_PUBLIC_API_BASE_URL in fernai-mobile/.env and restart Expo.
        </Text>
      </View>
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Log out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.appBg,
  },
  content: {
    paddingBottom: 120,
  },
  header: {
    marginHorizontal: 16,
    marginTop: 66,
    marginBottom: 10,
    backgroundColor: Palette.primary,
    borderRadius: Radius.screen,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: '#CDE3D8',
    marginTop: 4,
  },
  card: {
    backgroundColor: Palette.card,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 18,
    borderRadius: Radius.card,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Palette.text,
    marginBottom: 10,
  },
  urlLabel: {
    fontSize: 12,
    color: Palette.muted,
    marginBottom: 4,
  },
  urlValue: {
    fontSize: 13,
    color: Palette.text,
    fontFamily: 'monospace',
  },
  hint: {
    fontSize: 12,
    color: '#8C9A94',
    marginTop: 10,
  },
  logoutButton: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: Radius.card,
    backgroundColor: Palette.danger,
    alignItems: 'center',
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
