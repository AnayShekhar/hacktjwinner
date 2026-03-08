import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
// Use the legacy filesystem API so readAsStringAsync works on SDK 54
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';

import { useInsights } from '@/contexts/InsightsContext';
import { getApiBaseUrl } from '@/constants/api';
import { addToHistory } from '@/stores/historyStore';
import { setLetter as setLetterStore, setCleanBillExplanation, getAndClearAppealRequested, clearAppealUsed } from '@/stores/letterStore';
import { Palette, Radius } from '@/constants/design';

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
  const { setInsightsAndPersist } = useInsights();
  const { uri, fileType, additionalUris, additionalPages } = useLocalSearchParams<{
    uri?: string;
    fileType?: string;
    additionalUris?: string;
    additionalPages?: string;
  }>();

  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bill, setBill] = useState<BillJSON | null>(null);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [letter, setLetter] = useState<string | null>(null);
  const [analysisTimeSec, setAnalysisTimeSec] = useState<number | null>(null);
  const [suspicionScore, setSuspicionScore] = useState<number | null>(null);
  const [similarBillsCount, setSimilarBillsCount] = useState<number | null>(null);
  const [cleanBillExplanation, setCleanBillExplanationState] = useState<string | null>(null);

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

      const body: Record<string, unknown> = {
        image_base64: base64,
        file_type: fileType,
      };

      if (additionalPages && typeof additionalPages === 'string') {
        try {
          const pages: { uri: string; fileType: 'image' | 'pdf' }[] = JSON.parse(additionalPages);
          const additional_pages: { base64: string; file_type: 'image' | 'pdf' }[] = [];
          for (const p of pages) {
            if (p?.uri && (p.fileType === 'image' || p.fileType === 'pdf')) {
              const b64 = await FileSystem.readAsStringAsync(p.uri, { encoding: 'base64' });
              additional_pages.push({ base64: b64, file_type: p.fileType });
            }
          }
          if (additional_pages.length > 0) {
            body.additional_pages = additional_pages;
          }
        } catch {
          // fallback to legacy additionalUris (all images)
        }
      }
      if (!body.additional_pages && additionalUris && typeof additionalUris === 'string') {
        try {
          const uris: string[] = JSON.parse(additionalUris);
          const additionalBase64: string[] = [];
          for (const u of uris) {
            if (u && typeof u === 'string') {
              const b64 = await FileSystem.readAsStringAsync(u, { encoding: 'base64' });
              additionalBase64.push(b64);
            }
          }
          if (additionalBase64.length > 0) {
            body.additional_images_base64 = additionalBase64;
          }
        } catch {
          // ignore
        }
      }

      const response = await fetch(`${getApiBaseUrl()}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        const detail = json.detail;
        let message: string;
        if (response.status === 413) {
          message = 'File too large. Maximum size is 20 MB.';
        } else if (response.status === 404) {
          message =
            'Backend not found (404). Start the server: from the project root run ./run_backend.sh (then try again).';
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

      // Basic response validation (letter is optional; NO APPEAL returns only clean_bill_explanation)
      const billData = json.bill;
      const letterData = json.letter != null ? json.letter : null;
      const agentsData = json.agents;
      if (
        !billData ||
        typeof billData !== 'object' ||
        !Array.isArray(billData.line_items) ||
        !Array.isArray(agentsData)
      ) {
        throw new Error('Invalid response from server. Please try again.');
      }

      setBill(billData as BillJSON);
      setLetter(letterData);
      setLetterStore(letterData);
      const rawExpl = json.clean_bill_explanation;
      const cleanExpl =
        typeof rawExpl === 'string' && rawExpl.trim().length > 0 ? rawExpl.trim() : null;
      setCleanBillExplanationState(cleanExpl);
      setCleanBillExplanation(cleanExpl);
      setAgents(agentsData as AgentStatus[]);
      setAnalysisTimeSec(typeof json.analysis_time_seconds === 'number' ? json.analysis_time_seconds : null);
      setSuspicionScore(typeof json.suspicion_score === 'number' ? json.suspicion_score : null);
      setSimilarBillsCount(typeof json.similar_bills_count === 'number' ? json.similar_bills_count : null); // Always returned; insights run regardless of recoverable

      try {
        const lineItems = billData.line_items ?? [];
        const diagnosisReasons: string[] = [];
        const temporalReasons: string[] = [];
        for (const item of lineItems) {
          const r = String((item as LineItem).flag_reason ?? '').toLowerCase();
          if (r && /diagnosis|maternity|ortho|match/.test(r)) diagnosisReasons.push((item as LineItem).flag_reason ?? '');
          if (r && /discharge|procedure date|overlapping|duplicate/.test(r)) temporalReasons.push((item as LineItem).flag_reason ?? '');
        }
        const sb = typeof json.insight_bill_similarity === 'string' ? json.insight_bill_similarity : null;
        const dc = typeof json.insight_diagnosis_coherence === 'string' ? json.insight_diagnosis_coherence : null;
        const ss = typeof json.insight_suspicion_score === 'string' ? json.insight_suspicion_score : null;
        const tm = typeof json.insight_temporal === 'string' ? json.insight_temporal : null;
        const insUpdate = {
          analysisTimeSec: typeof json.analysis_time_seconds === 'number' ? json.analysis_time_seconds : null,
          similarBillsCount: typeof json.similar_bills_count === 'number' ? json.similar_bills_count : null,
          suspicionScore: typeof json.suspicion_score === 'number' ? json.suspicion_score : null,
          diagnosisSummary: diagnosisReasons,
          temporalSummary: temporalReasons,
          diagnosisCoherenceMessage: typeof json.diagnosis_coherence_message === 'string' ? json.diagnosis_coherence_message : null,
          temporalCheckMessage: typeof json.temporal_check_message === 'string' ? json.temporal_check_message : null,
          provider: billData.provider || null,
          date: billData.date_of_service || null,
          insightBillSimilarity: sb && sb.trim() ? sb.trim() : null,
          insightDiagnosisCoherence: dc && dc.trim() ? dc.trim() : null,
          insightSuspicionScore: ss && ss.trim() ? ss.trim() : null,
          insightTemporal: tm && tm.trim() ? tm.trim() : null,
        };
        await setInsightsAndPersist(insUpdate);
      } catch {
        // Non-critical: insights tab may not update; analysis still succeeds
      }

      const savedTotal =
        (typeof billData.total_recoverable === 'number' && billData.total_recoverable > 0)
          ? billData.total_recoverable
          : (billData.line_items ?? [])
              .filter((i: LineItem) => i.flagged)
              .reduce((s: number, i: LineItem) => s + (Number(i.savings) || 0), 0);
      try {
        addToHistory({
          date: billData.date_of_service || new Date().toISOString().slice(0, 10),
          provider: billData.provider || 'Unknown',
          totalRecoverable: savedTotal,
          letter: letterData || null,
          cleanBillExplanation: cleanExpl ?? null,
        });
      } catch {
        // Non-critical: history may not update; analysis still succeeds
      }
    } catch (e: unknown) {
      console.error(e);
      const raw = e instanceof Error ? e.message : String(e);
      const isNetwork =
        /network request failed|failed to fetch|network error|econnrefused|enotfound/i.test(raw) ||
        (e instanceof TypeError && raw.toLowerCase().includes('fetch'));
      setError(
        isNetwork
          ? 'network'
          : raw || 'Something went wrong while analyzing your bill.'
      );
    } finally {
      setLoading(false);
    }
  }, [uri, fileType, additionalUris, additionalPages, setInsightsAndPersist]);

  useEffect(() => {
    clearAppealUsed();
    runAnalysis();
  }, [runAnalysis]);

  useFocusEffect(
    React.useCallback(() => {
      if (getAndClearAppealRequested()) {
        runAnalysis();
      }
    }, [runAnalysis])
  );

  const handleViewLetter = () => {
    // NO APPEAL: only explanation, no dispute letter (use fallback if backend didn't send one)
    if (totalRecoverable === 0) {
      setLetterStore(null);
      const explanation =
        cleanBillExplanation && cleanBillExplanation.trim().length > 0
          ? cleanBillExplanation
          : [
              'Summary: We ran a full audit on your bill and found no overcharges or misused CPT codes. No dispute letter is generated when everything checks out.',
              '',
              '1. CPT code validation: Every procedure code on this bill was checked against our reference database. All codes were valid and appropriate; no unknown or mismatched codes were found.',
              '',
              '2. Price audit (CMS comparison): Each line item was compared to Medicare CMS reference rates. We flag charges that exceed reasonable thresholds (e.g. more than 20% above CMS). None of the charges on this bill exceeded those thresholds.',
              '',
              '3. Temporal checks: We looked for procedures billed after discharge or on overlapping dates. No such issues were flagged.',
              '',
              '4. Diagnosis coherence: Where diagnosis codes were available, we verified that procedures matched the diagnosis. No mismatches were found.',
              '',
              'Conclusion: All checks passed. We did not identify insurance scams, misused CPT codes, or overcharges. If you believe a charge is incorrect, tap Appeal to re-run the analysis or contact your provider.',
            ].join('\n');
      setCleanBillExplanation(explanation);
      router.push('/letter');
      return;
    }
    // Recoverable: show dispute letter
    if (letter) {
      setLetterStore(letter);
      setCleanBillExplanation(null);
      router.push('/letter');
    }
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
          <ActivityIndicator size="small" color={Palette.accent} />
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

  // Backend total_recoverable; fallback: sum savings of flagged items (in case API sends 0)
  const fromBackend = typeof bill?.total_recoverable === 'number' ? bill.total_recoverable : 0;
  const fromItems =
    (bill?.line_items ?? [])
      .filter((i) => i.flagged)
      .reduce((sum, i) => sum + (Number(i.savings) || 0), 0) || 0;
  const totalRecoverable = fromBackend > 0 ? fromBackend : fromItems;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Fern AI Analysis</Text>
        <Text style={styles.subtitle}>
          We’re auditing every line item on your bill.
        </Text>
        <Text style={styles.accuracyNote}>
          Charges are compared to Medicare CMS rates when available; unusual amounts are flagged.
        </Text>
        {analysisTimeSec != null && (
          <Text style={styles.timingText}>Analysis completed in {analysisTimeSec}s</Text>
        )}
        {suspicionScore != null && (
          <View style={styles.suspicionPill}>
            <Text style={styles.suspicionLabel}>Suspicion score </Text>
            <Text style={[styles.suspicionValue, suspicionScore >= 50 && styles.suspicionHigh]}>
              {suspicionScore}/100
            </Text>
          </View>
        )}
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
          <ActivityIndicator size="large" color={Palette.accent} />
          <Text style={styles.loadingText}>Analyzing your bill…</Text>
        </View>
      )}

      {!loading && error && (
        <View style={styles.errorArea}>
          <Text style={styles.errorTitle}>
            {error === 'network' ? "Can't reach the server" : 'We hit a snag'}
          </Text>
          {error === 'network' ? (
            <>
              <Text style={styles.errorText}>
                Check: backend running (./run_backend.sh), same WiFi as this device, and
                fernai-mobile/.env has your computer&apos;s IP. If you changed .env, restart Expo (r).
              </Text>
              <Text style={styles.errorUrl}>Trying: {getApiBaseUrl()}</Text>
            </>
          ) : (
            <Text style={styles.errorText}>{error}</Text>
          )}
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

      {!loading && !error && bill && similarBillsCount != null && similarBillsCount > 0 && (
        <View style={styles.similarBillsBanner}>
          <Text style={styles.similarBillsText}>
            We&apos;ve seen similar billing patterns from {similarBillsCount} other bill(s) in our database.
          </Text>
        </View>
      )}

      {!loading && !error && bill && (
        <>
          {totalRecoverable === 0 ? (
            <TouchableOpacity
              style={styles.explanationCard}
              onPress={handleViewLetter}
              activeOpacity={0.85}
            >
              <Text style={styles.explanationTitle}>Why we found no issues</Text>
              <Text style={styles.explanationText} numberOfLines={6}>
                {cleanBillExplanation && cleanBillExplanation.trim().length > 0
                  ? cleanBillExplanation
                  : 'We audited this bill and found no overcharges or misused CPT codes. Tap to read the full explanation.'}
              </Text>
              <Text style={styles.explanationTapHint}>Tap to read full explanation</Text>
            </TouchableOpacity>
          ) : null}

          <FlatList
            data={bill.line_items ?? []}
            keyExtractor={(item, index) => `${item.cpt_code}-${index}`}
            renderItem={renderLineItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={runAnalysis}
                tintColor={Palette.accent}
              />
            }
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
            <View style={styles.bottomButtons}>
              {totalRecoverable === 0 ? (
                <TouchableOpacity style={styles.primaryButton} onPress={handleViewLetter}>
                  <Text style={styles.primaryButtonText}>View full explanation</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.primaryButton, !letter && { opacity: 0.6 }]}
                  disabled={!letter}
                  onPress={handleViewLetter}
                >
                  <Text style={styles.primaryButtonText}>View Dispute Letter</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </>
      )}
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
  accuracyNote: {
    fontSize: 11,
    color: '#A7C2B6',
    marginTop: 6,
    fontStyle: 'italic',
  },
  timingText: {
    fontSize: 11,
    color: '#CDE3D8',
    marginTop: 4,
  },
  suspicionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  suspicionLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  suspicionValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  suspicionHigh: {
    color: '#b91c1c',
  },
  similarBillsBanner: {
    backgroundColor: '#fef3c7',
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
  },
  similarBillsText: {
    fontSize: 13,
    color: '#92400e',
    fontWeight: '500',
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
    color: Palette.accent,
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
    marginBottom: 8,
  },
  errorUrl: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'monospace',
  },
  secondaryButton: {
    borderColor: Palette.text,
    borderWidth: 1.5,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  secondaryButtonText: {
    color: Palette.text,
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
    color: Palette.text,
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
    color: Palette.text,
  },
  okText: {
    marginTop: 6,
    fontSize: 13,
    color: '#16a34a',
    fontWeight: '500',
  },
  explanationCard: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    padding: 16,
    backgroundColor: '#ecfdf5',
    borderRadius: 14,
    borderLeftWidth: 4,
    borderLeftColor: Palette.accent,
  },
  explanationTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Palette.text,
    marginBottom: 8,
  },
  explanationText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
  },
  explanationTapHint: {
    marginTop: 10,
    fontSize: 12,
    color: Palette.accent,
    fontWeight: '600',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Palette.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomLabel: {
    color: '#d1fae5',
    fontSize: 12,
  },
  bottomAmount: {
    color: '#D7F0E3',
    fontSize: 20,
    fontWeight: '700',
  },
  bottomButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryButton: {
    backgroundColor: Palette.accent,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});

