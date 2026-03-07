import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export function CodeCard({ cpt_code, description, billed_price, cms_price, flagged, flag_reason, savings }) {
  const isFlagged = Boolean(flagged);

  return (
    <View style={[styles.card, isFlagged ? styles.cardFlagged : styles.cardOk]}>
      <View style={styles.row}>
        <View style={styles.codePill}>
          <Text style={styles.codeText}>{cpt_code}</Text>
        </View>
        <Text style={[styles.priceText, isFlagged ? styles.priceFlagged : styles.priceOk]}>
          ${billed_price.toFixed(2)}
        </Text>
      </View>

      <Text style={styles.description}>{description}</Text>

      {cms_price != null && (
        <Text style={styles.cmsText}>CMS rate: ${cms_price.toFixed(2)}</Text>
      )}

      {isFlagged ? (
        <View style={styles.flagContainer}>
          {flag_reason ? <Text style={styles.flagReason}>{flag_reason}</Text> : null}
          {savings > 0 && (
            <Text style={styles.savingsText}>Potential savings: ${savings.toFixed(2)}</Text>
          )}
        </View>
      ) : (
        <Text style={styles.okText}>This charge looks reasonable.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 6,
  },
  cardOk: {
    backgroundColor: '#ecfdf3',
  },
  cardFlagged: {
    backgroundColor: '#fef2f2',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  codePill: {
    backgroundColor: colors.cardSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  codeText: {
    fontWeight: '600',
    color: colors.textPrimary,
    fontSize: 13,
  },
  priceText: {
    fontWeight: '700',
    fontSize: 16,
  },
  priceOk: {
    color: colors.success,
  },
  priceFlagged: {
    color: colors.danger,
  },
  description: {
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  cmsText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  flagContainer: {
    marginTop: 8,
  },
  flagReason: {
    fontSize: 13,
    color: colors.danger,
    marginBottom: 2,
  },
  savingsText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  okText: {
    marginTop: 8,
    fontSize: 13,
    color: colors.success,
    fontWeight: '500',
  },
});

export default CodeCard;

