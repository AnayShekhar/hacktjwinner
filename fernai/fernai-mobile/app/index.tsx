import React, { useEffect } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import { getIsLoggedIn } from '@/stores/authStore';
import { Palette, Radius } from '@/constants/design';

export default function WelcomeScreen() {
  const router = useRouter();

  useEffect(() => {
    if (getIsLoggedIn()) {
      router.replace('/(tabs)');
    }
  }, [router]);

  if (getIsLoggedIn()) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.welcome}>Welcome to</Text>
        <Text style={styles.logo}>Fern AI</Text>
        <Text style={styles.tagline}>Fight back against medical billing overcharges</Text>
        <Text style={styles.prompt}>
          Log in to continue auditing your bills and managing dispute letters.
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/login')}
          activeOpacity={0.9}
        >
          <Text style={styles.primaryButtonText}>Log in</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/signup')}
          activeOpacity={0.9}
        >
          <Text style={styles.secondaryButtonText}>Create an account</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.appBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '88%',
    maxWidth: 400,
    alignItems: 'flex-start',
    backgroundColor: Palette.primary,
    borderRadius: Radius.screen,
    padding: 24,
  },
  welcome: {
    fontSize: 16,
    color: '#D9ECE2',
    marginBottom: 8,
    fontWeight: '500',
  },
  logo: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 15,
    fontWeight: '600',
    color: '#D2E8DD',
    marginBottom: 14,
  },
  prompt: {
    fontSize: 14,
    color: '#B9D2C6',
    marginBottom: 22,
    lineHeight: 21,
  },
  primaryButton: {
    backgroundColor: Palette.accent,
    paddingVertical: 15,
    paddingHorizontal: 32,
    borderRadius: Radius.pill,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 17,
  },
  secondaryButton: {
    borderColor: '#3F725D',
    borderWidth: 1.2,
    backgroundColor: '#174D3A',
    paddingVertical: 13,
    paddingHorizontal: 32,
    borderRadius: Radius.pill,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#D9ECE2',
    fontWeight: '600',
    fontSize: 16,
  },
});
