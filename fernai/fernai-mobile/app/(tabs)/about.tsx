import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Palette, Radius } from '@/constants/design';

export default function AboutScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>About Fern AI</Text>
        <Text style={styles.subtitle}>Fight back against overcharges</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>How it works</Text>
        <Text style={styles.paragraph}>
          1. Scan or upload your hospital or medical bill.
        </Text>
        <Text style={styles.paragraph}>
          2. Fern AI audits every line item against Medicare CMS rates and flags unusual charges.
        </Text>
        <Text style={styles.paragraph}>
          3. Get a dispute letter you can share with your provider or insurer.
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>What we check</Text>
        <Text style={styles.paragraph}>• Price vs CMS reference rates (overcharge detection)</Text>
        <Text style={styles.paragraph}>• Unusual amounts vs other line items</Text>
        <Text style={styles.paragraph}>• Procedure dates (e.g. after discharge)</Text>
        <Text style={styles.paragraph}>• Diagnosis vs procedure coherence</Text>
        <Text style={styles.paragraph}>• Similar billing patterns from other bills</Text>
      </View>
      <Text style={styles.footer}>Fern AI — built to help you dispute unfair medical bills.</Text>
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
  paragraph: {
    fontSize: 14,
    color: '#32453D',
    lineHeight: 22,
    marginBottom: 6,
  },
  footer: {
    fontSize: 13,
    color: '#8B9A94',
    textAlign: 'center',
    marginTop: 8,
    marginHorizontal: 20,
  },
});
