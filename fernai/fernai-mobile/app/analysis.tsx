import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
// Use the legacy filesystem API so readAsStringAsync works on SDK 54
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { getApiBaseUrl } from '@/constants/api';
import { setLetter as setLetterStore } from '@/stores/letterStore';

const GREEN = '#1a3a2a';
const LIME = '#a8e063';

type AgentStatus = {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
};

type LineItem = {
  cpt_code: string;
  description: string;
  billed_price: number;
  flagged: boolean;
  flag_reason?: string | null;
  cms_price?: number | null;
  savings: number;
};

type BillJSON = {
  patient: string;
  date_of_service: string;
  provider: string;
  line_items: LineItem[];
  total_billed: number;
  total_recoverable: number;
};

export default function AnalysisScreen() {
  const { uri, fileType } = useLocalSearchParams<{
    uri?: string;
    fileType?: string;
  }>();

  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bill, setBill] = useState<BillJSON | null>(null);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [letter, setLetter] = useState<string | null>(null);

  const runAnalysis = React.useCallback(async () => {
    if (!uri || !fileType) {
      setError('Missing file information.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      const response = await fetch(`${getApiBaseUrl()}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_base64: base64,
          file_type: fileType,
        }),
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        const detail = json.detail;
        const baseUrl = getApiBaseUrl();
        let message: string;
        if (response.status === 404) {
          message =
            `Backend not found (404). Start the server: from the project root run ./run_backend.sh (then try again).`;
        } else if (Array.isArray(detail) && detail[0]?.msg) {
          message = detail[0].msg;
        } else if (typeof detail === 'object' && detail?.message) {
          message = detail.message + (detail.agent ? ` (${detail.agent})` : '');
        } else if (typeof detail === 'string') {
          message = detail;
        } else {
          message = `Backend error (${response.status})`;
        }
        throw new Error(message);
      }

      setBill(json.bill as BillJSON);
      const letterText = (json.letter ?? '') as string;
      setLetter(letterText);
      setLetterStore(letterText);
      setAgents((json.agents ?? []) as AgentStatus[]);
    } catch (e: unknown) {
      console.error(e);
      const raw = e instanceof Error ? e.message : String(e);
      const isNetwork =
        /network request failed|failed to fetch|network error|econnrefused|enotfound/i.test(raw) ||
        (e instanceof TypeError && raw.toLowerCase().includes('fetch'));
      setError(
        isNetwork
          ? "Can't reach the server. From the project root run ./run_backend.sh, then try again. On a phone? Use the same WiFi and set EXPO_PUBLIC_API_BASE_URL in fernai-mobile/.env to your computer's IP (e.g. http://192.168.1.x:8000)."
          : raw || 'Something went wrong while analyzing your bill.'
      );
    } finally {
      setLoading(false);
    }
  }, [uri, fileType]);

  useEffect(() => {
    runAnalysis();
  }, [runAnalysis]);

  const handleViewLetter = () => {
    if (!letter) return;
    setLetterStore(letter);
    router.push('/letter');
  };

  const renderAgent = (agent: AgentStatus) => {
    const isCompleted = agent.status === 'completed';
    const isRunning = agent.status === 'running';
    const isFailed = agent.status === 'failed';
    return (
      <View key={agent.name} style={[styles.agentChip, isFailed && styles.agentChipFailed]}>
        <Text style={styles.agentName}>{agent.name}</Text>
        {isCompleted ? (
          <Text style={styles.agentStatusCompleted}>✓</Text>
        ) : isRunning ? (
          <ActivityIndicator size="small" color={LIME} />
        ) : isFailed ? (
          <Text style={styles.agentStatusFailed}>✕</Text>
        ) : (
          <Text style={styles.agentStatusPending}>•</Text>
        )}
      </View>
    );
  };

  const renderLineItem = ({ item }: { item: LineItem }) => {
    const flagged = item.flagged;
    return (
      <View style={[styles.card, flagged ? styles.cardFlagged : styles.cardOk]}>
        <View style={styles.cardHeader}>
          <View style={styles.codePill}>
            <Text style={styles.codeText}>{item.cpt_code}</Text>
          </View>
          <Text style={[styles.priceText, flagged ? styles.priceFlagged : styles.priceOk]}>
            ${item.billed_price.toFixed(2)}
          </Text>
        </View>
        <Text style={styles.descriptionText}>{item.description}</Text>
        {item.cms_price != null && (
          <Text style={styles.cmsText}>CMS rate: ${item.cms_price.toFixed(2)}</Text>
        )}
        {flagged ? (
          <View style={styles.flagSection}>
            {item.flag_reason ? (
              <Text style={styles.flagReason}>{item.flag_reason}</Text>
            ) : null}
            {item.savings > 0 ? (
              <Text style={styles.savingsText}>
                Potential savings: ${item.savings.toFixed(2)}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text style={styles.okText}>This charge looks reasonable.</Text>
        )}
      </View>
    );
  };

  const totalRecoverable = bill?.total_recoverable ?? 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Fern AI Analysis</Text>
        <Text style={styles.subtitle}>
          We’re auditing every line item on your bill.
        </Text>
      </View>

      <View style={styles.agentsRow}>
        {['Parser', 'CPT Validator', 'Price Auditor', 'Letter Gen'].map((name) => {
          const fromBackend = agents.find((a) => a.name === name);
          return renderAgent(
            fromBackend ?? { name, status: loading ? 'running' : 'completed' } as AgentStatus
          );
        })}
      </View>

      {loading && (
        <View style={styles.loadingArea}>
          <ActivityIndicator size="large" color={LIME} />
          <Text style={styles.loadingText}>Analyzing your bill…</Text>
        </View>
      )}

      {!loading && error && (
        <View style={styles.errorArea}>
          <Text style={styles.errorTitle}>We hit a snag.</Text>
          <Text style={styles.errorText}>{error}</Text>
          <View style={styles.errorButtons}>
            <TouchableOpacity style={styles.primaryButton} onPress={() => runAnalysis()}>
              <Text style={styles.primaryButtonText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
              <Text style={styles.secondaryButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!loading && !error && bill && (
        <>
          <FlatList
            data={bill.line_items ?? []}
            keyExtractor={(item, index) => `${item.cpt_code}-${index}`}
            renderItem={renderLineItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No line items found on this bill.</Text>
              </View>
            }
          />

          <View style={styles.bottomBar}>
            <View>
              <Text style={styles.bottomLabel}>Total Recoverable</Text>
              <Text style={styles.bottomAmount}>${totalRecoverable.toFixed(2)}</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                !letter && { opacity: 0.6 },
              ]}
              disabled={!letter}
              onPress={handleViewLetter}
            >
              <Text style={styles.primaryButtonText}>View Dispute Letter</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: GREEN,
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  agentsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  agentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  agentName: {
    fontSize: 11,
    fontWeight: '600',
    marginRight: 6,
    color: '#374151',
  },
  agentStatusCompleted: {
    color: LIME,
    fontWeight: '700',
  },
  agentStatusPending: {
    color: '#9ca3af',
    fontSize: 12,
  },
  agentStatusFailed: {
    color: '#b91c1c',
    fontWeight: '700',
  },
  agentChipFailed: {
    backgroundColor: '#fee2e2',
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6b7280',
  },
  loadingArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: '#4b5563',
  },
  errorArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  errorButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#b91c1c',
    marginBottom: 6,
  },
  errorText: {
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 16,
  },
  secondaryButton: {
    borderColor: GREEN,
    borderWidth: 1.5,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  secondaryButtonText: {
    color: GREEN,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  card: {
    borderRadius: 18,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 4,
  },
  cardOk: {
    backgroundColor: '#ecfdf3',
  },
  cardFlagged: {
    backgroundColor: '#fef2f2',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  codePill: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  codeText: {
    fontWeight: '600',
    color: GREEN,
    fontSize: 13,
  },
  priceText: {
    fontWeight: '700',
    fontSize: 16,
  },
  priceOk: {
    color: '#16a34a',
  },
  priceFlagged: {
    color: '#b91c1c',
  },
  descriptionText: {
    fontSize: 14,
    color: '#111827',
    marginBottom: 2,
  },
  cmsText: {
    fontSize: 12,
    color: '#6b7280',
  },
  flagSection: {
    marginTop: 8,
  },
  flagReason: {
    fontSize: 13,
    color: '#b91c1c',
    marginBottom: 2,
  },
  savingsText: {
    fontSize: 13,
    fontWeight: '600',
    color: GREEN,
  },
  okText: {
    marginTop: 6,
    fontSize: 13,
    color: '#16a34a',
    fontWeight: '500',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomLabel: {
    color: '#d1fae5',
    fontSize: 12,
  },
  bottomAmount: {
    color: LIME,
    fontSize: 20,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: LIME,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  primaryButtonText: {
    color: GREEN,
    fontWeight: '700',
    fontSize: 14,
  },
});

