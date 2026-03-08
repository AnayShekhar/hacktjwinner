import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';

import { getApiBaseUrl } from '@/constants/api';
import { Palette, Radius } from '@/constants/design';

export default function HomeScreen() {
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const [serverOk, setServerOk] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${getApiBaseUrl()}/health`)
      .then((r) => r.ok)
      .then((ok) => { if (!cancelled) setServerOk(ok); })
      .catch(() => { if (!cancelled) setServerOk(false); });
    return () => { cancelled = true; };
  }, []);

  const handleScanBill = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      alert('Camera permission is required to scan your bill.');
      return;
    }

    setOpening(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });

      if (result.canceled || !result.assets || !result.assets[0]?.uri) {
        return;
      }

      const uri = result.assets[0].uri;
      router.push({
        pathname: '/bill-pages',
        params: { uri, fileType: 'image' },
      });
    } finally {
      setOpening(false);
    }
  };

  const handleUploadPdf = async () => {
    setOpening(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        multiple: false,
        copyToCacheDirectory: true,
      });

      // In SDK 51, `canceled` is a boolean and selected files are in `assets`
      // Fallback to older `assets` shape if needed.
      // @ts-expect-error SDK version differences
      const assets = result.assets || (result.type === 'success' ? [result] : []);

      if ((result as any).canceled || !assets || !assets[0]?.uri) {
        return;
      }

      const uri = assets[0].uri;
      router.push({
        pathname: '/bill-pages',
        params: { uri, fileType: 'pdf' },
      });
    } finally {
      setOpening(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.logo}>Fern AI</Text>
          <Text style={styles.headerSub}>Save money on your medical bills</Text>
        </View>

        <View style={styles.heroImageCard}>
          <Text style={styles.heroTitle}>Save on your bills</Text>
          <Text style={styles.heroSub}>Let our AI find hidden overcharges in seconds.</Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, opening && styles.buttonDisabled]}
          onPress={handleScanBill}
          disabled={opening}
        >
          {opening ? (
            <View style={styles.buttonLoading}>
              <ActivityIndicator size="small" color="#ffffff" />
              <Text style={styles.primaryButtonText}>Opening...</Text>
            </View>
          ) : (
            <Text style={styles.primaryButtonText}>Scan Bill</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, opening && styles.buttonDisabled]}
          onPress={handleUploadPdf}
          disabled={opening}
        >
          <Text style={styles.secondaryButtonText}>{opening ? 'Opening...' : 'Upload PDF'}</Text>
        </TouchableOpacity>

        {serverOk !== null && (
          <View style={[styles.statusPill, serverOk ? styles.statusOk : styles.statusOff]}>
            <Text style={styles.statusText}>
              {serverOk ? 'Server connected' : 'Cannot reach server'}
            </Text>
          </View>
        )}

        <View style={styles.stepsCard}>
          <Text style={styles.stepsTitle}>How it works</Text>
          <View style={styles.stepRow}>
            <Text style={styles.stepNumber}>1</Text>
            <Text style={styles.stepItem}>Snap or upload your bill pages.</Text>
          </View>
          <View style={styles.stepRow}>
            <Text style={styles.stepNumber}>2</Text>
            <Text style={styles.stepItem}>Fern AI checks prices and code consistency.</Text>
          </View>
          <View style={styles.stepRow}>
            <Text style={styles.stepNumber}>3</Text>
            <Text style={styles.stepItem}>View savings and generate your letter.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.appBg,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 120,
  },
  header: {
    backgroundColor: Palette.primary,
    borderRadius: Radius.screen,
    padding: 20,
    marginBottom: 14,
  },
  logo: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerSub: {
    marginTop: 5,
    fontSize: 14,
    color: '#D8EADF',
  },
  heroImageCard: {
    backgroundColor: '#9B5A2A',
    borderRadius: Radius.card,
    padding: 18,
    minHeight: 160,
    justifyContent: 'flex-end',
    marginBottom: 14,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  heroSub: {
    color: '#F8F8F8',
    fontSize: 13,
    marginTop: 4,
  },
  statusPill: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
    marginBottom: 14,
  },
  statusOk: {
    backgroundColor: '#D9F2DF',
  },
  statusOff: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1C3528',
  },
  primaryButton: {
    backgroundColor: Palette.accent,
    paddingVertical: 15,
    borderRadius: Radius.pill,
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryButton: {
    borderColor: Palette.border,
    borderWidth: 1.2,
    paddingVertical: 13,
    borderRadius: Radius.pill,
    alignItems: 'center',
    marginBottom: 14,
    backgroundColor: Palette.card,
  },
  secondaryButtonText: {
    color: Palette.text,
    fontWeight: '600',
    fontSize: 15,
  },
  stepsCard: {
    backgroundColor: Palette.card,
    borderRadius: Radius.card,
    padding: 16,
  },
  stepsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Palette.text,
    marginBottom: 10,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: 'center',
    lineHeight: 24,
    backgroundColor: Palette.accentSoft,
    color: Palette.accent,
    fontWeight: '800',
    fontSize: 12,
  },
  stepItem: {
    fontSize: 13,
    color: Palette.muted,
    flex: 1,
  },
});