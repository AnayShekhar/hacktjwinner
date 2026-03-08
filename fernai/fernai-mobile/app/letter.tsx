import React, { useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';

import { getLetter, getCleanBillExplanation, setAppealRequested, setAppealUsed, getAppealUsed } from '@/stores/letterStore';
import { Palette, Radius } from '@/constants/design';

export default function LetterScreen() {
  const router = useRouter();
  const letterContent = getLetter() ?? '';
  const cleanExplanation = getCleanBillExplanation();
  const appealUsed = getAppealUsed();
  const isCleanBill = !letterContent && !!cleanExplanation;
  const isPostAppeal = isCleanBill && appealUsed;

  const content = isCleanBill
    ? isPostAppeal
      ? 'We re-audited this bill after you requested an appeal. Our conclusion remains the same: we did not find any overcharges or misused CPT codes.\n\n' + (cleanExplanation ?? '')
      : cleanExplanation!
    : (letterContent || 'No letter available.');
  const title = isCleanBill
    ? (isPostAppeal ? 'Re-audit: Why we found no issues' : 'Why we found no issues')
    : 'Dispute Letter';
  const subtitleLine = isCleanBill
    ? (isPostAppeal
        ? 'Result of the re-audit after your appeal. You cannot appeal again for this bill.'
        : 'Detailed explanation of why no overcharges or CPT misuse were found.')
    : 'Review and share this letter with your provider or insurer.';
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const canAppeal = isCleanBill && !appealUsed;

  const handleShare = async () => {
    try {
      await Share.share({
        message: content,
        title: 'Dispute Letter',
      });
    } catch {
      // User cancelled or share not available
    }
  };

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(content);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch {
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 2000);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>
          {subtitleLine}
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <View style={styles.card}>
          <Text style={styles.letterText}>{content}</Text>
        </View>
      </ScrollView>
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Text style={styles.shareButtonText}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.copyButton} onPress={handleCopy}>
          <Text style={styles.copyButtonText}>
            {copyStatus === 'copied' ? 'Copied!' : copyStatus === 'error' ? 'Failed' : 'Copy'}
          </Text>
        </TouchableOpacity>
        {canAppeal && (
          <TouchableOpacity
            style={styles.appealButton}
            onPress={() => {
              setAppealUsed(true);
              setAppealRequested(true);
              router.back();
            }}
          >
            <Text style={styles.appealButtonText}>Appeal</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>Back to Analysis</Text>
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
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    backgroundColor: Palette.primary,
    borderRadius: Radius.screen,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 13,
    color: '#CDE3D8',
    marginTop: 4,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 130,
  },
  card: {
    backgroundColor: Palette.card,
    borderRadius: Radius.card,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 4,
  },
  letterText: {
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
  },
  bottomBar: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Palette.primary,
    borderRadius: 26,
    borderTopWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 4,
  },
  shareButton: {
    backgroundColor: Palette.accent,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  copyButton: {
    borderColor: '#CDE3D8',
    borderWidth: 1.5,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  copyButtonText: {
    color: '#D7F0E3',
    fontWeight: '600',
    fontSize: 14,
  },
  appealButton: {
    borderColor: '#d1fae5',
    borderWidth: 1.5,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  appealButtonText: {
    color: '#d1fae5',
    fontWeight: '600',
    fontSize: 14,
  },
  secondaryButton: {
    borderColor: '#CDE3D8',
    borderWidth: 1.5,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    color: '#D7F0E3',
    fontWeight: '600',
    fontSize: 14,
  },
});

