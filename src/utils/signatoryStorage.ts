import { SignatoryItem } from '../types';

export const SIGNATORIES_STORAGE_KEY = 'pme_saved_signatories_v1';

export interface SavedSignatoryConfig {
  signatories: SignatoryItem[];
  signatoryLayout: 'single-right' | 'single-left' | 'dual' | 'triple';
  ketuaTimKerja: string;
  nipKetua?: string;
  kotaDokumen?: string;
  savedAt: string;
  isCustomLocked: boolean;
}

export function getSavedSignatoryConfig(): SavedSignatoryConfig | null {
  try {
    const raw = localStorage.getItem(SIGNATORIES_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.signatories) && parsed.signatories.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.warn('Failed to read saved signatories from localStorage:', err);
  }
  return null;
}

export function saveSignatoryConfig(config: {
  signatories: SignatoryItem[];
  signatoryLayout: 'single-right' | 'single-left' | 'dual' | 'triple';
  ketuaTimKerja: string;
  nipKetua?: string;
  kotaDokumen?: string;
}): SavedSignatoryConfig | null {
  try {
    const dataToSave: SavedSignatoryConfig = {
      ...config,
      savedAt: new Date().toISOString(),
      isCustomLocked: true,
    };
    localStorage.setItem(SIGNATORIES_STORAGE_KEY, JSON.stringify(dataToSave));
    return dataToSave;
  } catch (err) {
    console.warn('Failed to save signatories to localStorage:', err);
    return null;
  }
}

export function clearSavedSignatoryConfig(): void {
  try {
    localStorage.removeItem(SIGNATORIES_STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear saved signatories:', err);
  }
}

export function hasSavedSignatoryConfig(): boolean {
  return getSavedSignatoryConfig() !== null;
}
