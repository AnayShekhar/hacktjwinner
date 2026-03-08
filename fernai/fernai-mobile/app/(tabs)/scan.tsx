import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';

import { Palette, Radius } from '@/constants/design';

export default function ScanScreen() {
  const router = useRouter();
  const [opening, setOpening] = useState(false);

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

      if (result.canceled || !result.assets || !result.assets[0]?.uri) return;

      router.push({
        pathname: '/bill-pages',
        params: { uri: result.assets[0].uri, fileType: 'image' },
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

      // @ts-expect-error SDK version differences
      const assets = result.assets || (result.type === 'success' ? [result] : []);
      if ((result as any).canceled || !assets || !assets[0]?.uri) return;

      router.push({
        pathname: '/bill-pages',
        params: { uri: assets[0].uri, fileType: 'pdf' },
      });
    } finally {
      setOpening(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Quick Scan</Text>
        <Text style={styles.subtitle}>
          Start a new analysis from anywhere in the app.
        </Text>

        <TouchableOpacity
          style={[styles.primaryButton, opening && styles.buttonDisabled]}
          onPress={handleScanBill}
          disabled={opening}
        >
          {opening ? (
            <View style={styles.buttonLoading}>
              <ActivityIndicator size="small" color="#FFFFFF" />
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.appBg,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  card: {
    backgroundColor: Palette.card,
    borderRadius: Radius.screen,
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Palette.text,
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 16,
    fontSize: 14,
    color: Palette.muted,
  },
  primaryButton: {
    backgroundColor: Palette.accent,
    paddingVertical: 14,
    borderRadius: Radius.pill,
    alignItems: 'center',
    marginBottom: 10,
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: Palette.border,
    paddingVertical: 13,
    borderRadius: Radius.pill,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: Palette.text,
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
