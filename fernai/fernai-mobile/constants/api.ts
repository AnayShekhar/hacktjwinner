import { Platform } from 'react-native';

/**
 * Backend API base URL for analysis.
 * - Set EXPO_PUBLIC_API_BASE_URL in .env for real device (your computer's LAN IP:8000).
 * - iOS simulator: localhost works.
 * - Android emulator: 10.0.2.2:8000.
 */
export function getApiBaseUrl(): string {
  const envUrl =
    typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_BASE_URL
      ? process.env.EXPO_PUBLIC_API_BASE_URL
      : null;
  if (envUrl && envUrl.startsWith('http')) return envUrl;

  if (Platform.OS === 'ios') return 'http://localhost:8000';
  if (Platform.OS === 'android') return 'http://10.0.2.2:8000';

  return envUrl || 'http://localhost:8000';
}
