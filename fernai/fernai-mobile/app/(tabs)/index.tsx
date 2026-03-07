import React from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';

const GREEN = '#1a3a2a';
const LIME = '#a8e063';

export default function HomeScreen() {
  const router = useRouter();

  const handleScanBill = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      alert('Camera permission is required to scan your bill.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
    });

    if (result.canceled || !result.assets || !result.assets[0]?.uri) {
      return;
    }

    const uri = result.assets[0].uri;
    router.push({
      pathname: '/analysis',
      params: { uri, fileType: 'image' },
    });
  };

  const handleUploadPdf = async () => {
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
      pathname: '/analysis',
      params: { uri, fileType: 'pdf' },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.heroCard}>
        <Text style={styles.logo}>Fern AI</Text>
        <Text style={styles.tagline}>Fight Back Against Overcharges</Text>
        <Text style={styles.subtitle}>
          Scan or upload your hospital bill and let Fern AI audit it for fraud and overcharges.
        </Text>

        <TouchableOpacity style={styles.primaryButton} onPress={handleScanBill}>
          <Text style={styles.primaryButtonText}>Scan Bill</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={handleUploadPdf}>
          <Text style={styles.secondaryButtonText}>Upload PDF</Text>
        </TouchableOpacity>

        <View style={styles.steps}>
          <Text style={styles.stepsTitle}>How it works</Text>
          <Text style={styles.stepItem}>1. Scan your bill</Text>
          <Text style={styles.stepItem}>2. Fern AI audits every line</Text>
          <Text style={styles.stepItem}>3. Get a dispute letter</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GREEN,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroCard: {
    width: '88%',
    backgroundColor: '#f9fafb',
    borderRadius: 32,
    padding: 24,
  },
  logo: {
    fontSize: 26,
    fontWeight: '800',
    color: GREEN,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 18,
    fontWeight: '600',
    color: GREEN,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: LIME,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButtonText: {
    color: GREEN,
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryButton: {
    borderColor: GREEN,
    borderWidth: 1.5,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    marginBottom: 18,
    backgroundColor: '#ffffff',
  },
  secondaryButtonText: {
    color: GREEN,
    fontWeight: '600',
    fontSize: 15,
  },
  steps: {
    marginTop: 4,
  },
  stepsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  stepItem: {
    fontSize: 13,
    color: '#4b5563',
  },
});