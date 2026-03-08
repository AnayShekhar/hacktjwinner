import React, { useState, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Palette, Radius } from '@/constants/design';

type PageEntry = { uri: string; fileType: 'image' | 'pdf' };

export default function BillPagesScreen() {
  const router = useRouter();
  const { uri, fileType } = useLocalSearchParams<{ uri?: string; fileType?: 'image' | 'pdf' }>();
  const [pages, setPages] = useState<PageEntry[]>(() =>
    uri && fileType ? [{ uri, fileType }] : []
  );
  const [adding, setAdding] = useState(false);

  const addPage = useCallback(async (source: 'library' | 'pdf') => {
    setAdding(true);
    try {
      if (source === 'pdf') {
        const result = await DocumentPicker.getDocumentAsync({
          type: 'application/pdf',
          copyToCacheDirectory: true,
        });
        // @ts-expect-error SDK version differences
        const assets = result.assets ?? (result.type === 'success' ? [result] : []);
        if (!(result as { canceled?: boolean }).canceled && assets.length > 0 && assets[0].uri) {
          setPages((prev) => [...prev, { uri: assets[0].uri, fileType: 'pdf' }]);
        }
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      setPages((prev) => [...prev, { uri: result.assets[0].uri, fileType: 'image' }]);
    } finally {
      setAdding(false);
    }
  }, []);

  const removePage = (index: number) => {
    setPages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAnalyze = () => {
    if (pages.length === 0) return;
    const first = pages[0];
    const additionalPages = pages.length > 1 ? pages.slice(1).map((p) => ({ uri: p.uri, fileType: p.fileType })) : [];
    router.push({
      pathname: '/analysis',
      params: {
        uri: first.uri,
        fileType: first.fileType,
        ...(additionalPages.length > 0 ? { additionalPages: JSON.stringify(additionalPages) } : {}),
      },
    });
  };

  if (pages.length === 0) {
    router.replace('/(tabs)');
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bill pages</Text>
        <Text style={styles.subtitle}>
          Part of the same bill. Add more pages or analyze now.
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        horizontal
        showsHorizontalScrollIndicator
      >
        {pages.map((page, index) => (
          <View key={`${page.uri}-${index}`} style={styles.pageCard}>
            <Text style={styles.pageLabel}>Page {index + 1}</Text>
            {page.fileType === 'image' ? (
              <Image source={{ uri: page.uri }} style={styles.thumbnail} resizeMode="cover" />
            ) : (
              <View style={styles.pdfPlaceholder}>
                <Text style={styles.pdfText}>PDF</Text>
              </View>
            )}
            {pages.length > 1 && (
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => removePage(index)}
              >
                <Text style={styles.removeBtnText}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.addButton, adding && styles.buttonDisabled]}
          onPress={() => Alert.alert(
            'Add page',
            'Choose source',
            [
              { text: 'Photos from library', onPress: () => addPage('library') },
              { text: 'PDF from files', onPress: () => addPage('pdf') },
              { text: 'Cancel', style: 'cancel' },
            ]
          )}
          disabled={adding}
        >
          {adding ? (
            <ActivityIndicator size="small" color={Palette.text} />
          ) : (
            <Text style={styles.addButtonText}>Add another page</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.primaryButton} onPress={handleAnalyze}>
          <Text style={styles.primaryButtonText}>Analyze bill</Text>
        </TouchableOpacity>
      </View>
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
    paddingBottom: 14,
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pageCard: {
    width: 140,
    backgroundColor: Palette.card,
    borderRadius: Radius.card,
    padding: 8,
    alignItems: 'center',
  },
  pageLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Palette.text,
    marginBottom: 6,
  },
  thumbnail: {
    width: 120,
    height: 160,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  pdfPlaceholder: {
    width: 120,
    height: 160,
    borderRadius: 8,
    backgroundColor: Palette.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pdfText: {
    fontSize: 18,
    fontWeight: '700',
    color: Palette.text,
  },
  removeBtn: {
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  removeBtnText: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '600',
  },
  actions: {
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: Radius.card,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: Palette.card,
    gap: 10,
  },
  addButton: {
    borderColor: Palette.border,
    borderWidth: 1.2,
    paddingVertical: 12,
    borderRadius: Radius.pill,
    alignItems: 'center',
  },
  addButtonText: {
    color: Palette.text,
    fontWeight: '600',
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButton: {
    backgroundColor: Palette.accent,
    paddingVertical: 14,
    borderRadius: Radius.pill,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
