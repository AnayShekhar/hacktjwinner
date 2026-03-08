/**
 * Last analysis insights. Persisted to AsyncStorage so Insights tab
 * always has access regardless of navigation/stack.
 */

const KEY = '@fernai/last_insights';

export type LastInsights = {
  analysisTimeSec: number | null;
  similarBillsCount: number | null;
  suspicionScore: number | null;
  diagnosisSummary: string[];
  temporalSummary: string[];
  diagnosisCoherenceMessage: string | null;
  temporalCheckMessage: string | null;
  provider: string | null;
  date: string | null;
  insightBillSimilarity: string | null;
  insightDiagnosisCoherence: string | null;
  insightSuspicionScore: string | null;
  insightTemporal: string | null;
};

const empty: LastInsights = {
  analysisTimeSec: null,
  similarBillsCount: null,
  suspicionScore: null,
  diagnosisSummary: [],
  temporalSummary: [],
  diagnosisCoherenceMessage: null,
  temporalCheckMessage: null,
  provider: null,
  date: null,
  insightBillSimilarity: null,
  insightDiagnosisCoherence: null,
  insightSuspicionScore: null,
  insightTemporal: null,
};

let memory: LastInsights = { ...empty };

export function getLastInsights(): LastInsights {
  return { ...memory };
}

export function setLastInsights(update: Partial<LastInsights>): void {
  memory = { ...memory, ...update };
  persist(memory).catch(() => {});
}

export async function setLastInsightsAndPersist(update: Partial<LastInsights>): Promise<void> {
  memory = { ...memory, ...update };
  await persist(memory);
}

async function persist(data: LastInsights): Promise<void> {
  try {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    await AsyncStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export async function loadLastInsights(): Promise<LastInsights> {
  try {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LastInsights> | null;
      const hasData =
        parsed &&
        typeof parsed === 'object' &&
        (parsed.analysisTimeSec != null ||
          parsed.similarBillsCount != null ||
          parsed.suspicionScore != null ||
          (parsed.insightBillSimilarity && parsed.insightBillSimilarity.length > 0));
      if (hasData) {
        memory = {
          ...empty,
          ...parsed,
          diagnosisSummary: Array.isArray(parsed!.diagnosisSummary) ? parsed!.diagnosisSummary : [],
          temporalSummary: Array.isArray(parsed!.temporalSummary) ? parsed!.temporalSummary : [],
        };
      }
    }
    return getLastInsights();
  } catch {
    return getLastInsights();
  }
}
