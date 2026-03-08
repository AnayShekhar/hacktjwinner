/**
 * Persist analysis history (AsyncStorage when available, else in-memory).
 */

export type HistoryEntry = {
  id: string;
  date: string;
  provider: string;
  totalRecoverable: number;
  letter: string | null;
  /** When totalRecoverable is 0, backend may send this instead of a dispute letter. */
  cleanBillExplanation?: string | null;
};

const KEY = '@fernai/history';
const MAX_ENTRIES = 50;

let memoryFallback: HistoryEntry[] = [];

async function getStorage(): Promise<{ getItem: (k: string) => Promise<string | null>; setItem: (k: string, v: string) => Promise<void> }> {
  try {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    return AsyncStorage;
  } catch {
    return {
      getItem: async () => null,
      setItem: async () => {},
    };
  }
}

export async function getHistory(): Promise<HistoryEntry[]> {
  const storage = await getStorage();
  const raw = await storage.getItem(KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : memoryFallback;
    } catch {
      return memoryFallback;
    }
  }
  return memoryFallback;
}

export async function addToHistory(entry: Omit<HistoryEntry, 'id'>): Promise<void> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const full: HistoryEntry = { ...entry, id };
  const list = await getHistory();
  const next = [full, ...list].slice(0, MAX_ENTRIES);
  memoryFallback = next;
  const storage = await getStorage();
  await storage.setItem(KEY, JSON.stringify(next));
}
