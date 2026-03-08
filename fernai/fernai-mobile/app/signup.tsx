import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';

import { getIsLoggedIn, setLoggedIn } from '@/stores/authStore';
import { Palette, Radius } from '@/constants/design';

export default function SignupScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (getIsLoggedIn()) {
      router.replace('/(tabs)');
    }
  }, [router]);

  const canSubmit =
    email.trim().length > 0 &&
    password.length >= 6 &&
    password === confirmPassword;

  const handleCreateAccount = () => {
    if (!canSubmit) return;
    setLoggedIn(true);
    router.replace('/(tabs)');
  };

  if (getIsLoggedIn()) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.card}>
          <Text style={styles.logo}>Create an account</Text>
          <Text style={styles.subtitle}>
            Join Fern AI to audit your medical bills and fight overcharges.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Full name (optional)"
            placeholderTextColor="#9ca3af"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoComplete="name"
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#9ca3af"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <TextInput
            style={styles.input}
            placeholder="Password (min 6 characters)"
            placeholderTextColor="#9ca3af"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password-new"
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm password"
            placeholderTextColor="#9ca3af"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoComplete="password-new"
          />

          <TouchableOpacity
            style={[styles.primaryButton, !canSubmit && styles.buttonDisabled]}
            onPress={handleCreateAccount}
            disabled={!canSubmit}
          >
            <Text style={styles.primaryButtonText}>Create account</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
            <Text style={styles.backLinkText}>Back to welcome</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  keyboardView: {
    width: '100%',
    maxWidth: 400,
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    backgroundColor: Palette.primary,
    borderRadius: Radius.screen,
    padding: 24,
  },
  logo: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#C6DDD2',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#184A39',
    borderWidth: 1,
    borderColor: '#286A53',
    borderRadius: Radius.card,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: Palette.accent,
    paddingVertical: 14,
    borderRadius: Radius.pill,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  backLink: {
    alignSelf: 'center',
    marginTop: 20,
  },
  backLinkText: {
    fontSize: 14,
    color: '#C6DDD2',
    fontWeight: '500',
  },
});
