import { StorageEnum } from '../base/enums';
import { createStorage } from '../base/base';
import type { BaseStorage } from '../base/types';

/**
 * User profile data stored EXCLUSIVELY in the local browser.
 *
 * SECURITY: This data must NEVER be:
 * - sent to the remote LLM
 * - included in LLM prompts, task history, or telemetry
 * - logged with actual values (only log key + resolved boolean)
 * - synced to any server or cloud storage
 *
 * The remote LLM only ever sees abstract data keys (e.g. "profile.email"),
 * never the resolved values.
 */
export interface CustomProfileField {
  id: string;
  label: string;
  value: string;
}

export interface LocalProfileData {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  customFields?: CustomProfileField[];
}

export const DEFAULT_LOCAL_PROFILE: LocalProfileData = {
  fullName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  address: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  customFields: [],
};

/**
 * The canonical set of allowed data keys. Any key not in this list
 * is rejected by `isValidKey()` and `get()` unless defined in customFields.
 */
const ALLOWED_KEYS: readonly string[] = [
  'profile.fullName',
  'profile.email',
  'profile.phone',
  'profile.dateOfBirth',
  'profile.address',
  'profile.city',
  'profile.state',
  'profile.postalCode',
  'profile.country',
] as const;

/** Maps a dot-notation key (e.g. "profile.email") to its field on LocalProfileData. */
function keyToField(key: string): keyof LocalProfileData | null {
  if (!key.startsWith('profile.')) return null;
  const field = key.slice('profile.'.length);
  if (field in DEFAULT_LOCAL_PROFILE && field !== 'customFields') {
    return field as keyof LocalProfileData;
  }
  return null;
}

const storage = createStorage<LocalProfileData>('local-profile-data', DEFAULT_LOCAL_PROFILE, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

export type LocalDataStorage = BaseStorage<LocalProfileData> & {
  /**
   * Overloaded get:
   * - `get()` returns the full profile (satisfying BaseStorage).
   * - `get(key: string)` resolves a dot-notation data key to its stored value.
   *
   * SECURITY: The returned key value must NEVER be sent to the remote LLM,
   * logged, or included in action results. It is for local browser
   * action execution only.
   */
  get(): Promise<LocalProfileData>;
  get(key: string): Promise<string | undefined>;
  /** Returns the full profile (for the local UI only). */
  getAll(): Promise<LocalProfileData>;
  /** Updates one or more profile fields. */
  updateProfile(data: Partial<LocalProfileData>): Promise<void>;
  /** Checks whether a data key is in the allowed set. */
  isValidKey(key: string): boolean;
  /** The full list of valid data keys. */
  readonly ALLOWED_KEYS: readonly string[];
};

export const localDataStore: LocalDataStorage = {
  // Spread the base storage methods (getSnapshot, subscribe, set)
  // but override `get` with key-based resolution below.
  set: storage.set,
  getSnapshot: storage.getSnapshot,
  subscribe: storage.subscribe,

  ALLOWED_KEYS,

  isValidKey(key: string): boolean {
    if ((ALLOWED_KEYS as readonly string[]).includes(key)) {
      return true;
    }
    const snapshot = storage.getSnapshot();
    if (snapshot?.customFields && snapshot.customFields.length > 0) {
      const cleanKey = key.startsWith('profile.') ? key.slice('profile.'.length) : key;
      const normalizedKey = cleanKey.toLowerCase().replace(/[^a-z0-9]/g, '');
      return snapshot.customFields.some(f => {
        const normalizedLabel = f.label.toLowerCase().replace(/[^a-z0-9]/g, '');
        return f.id === key || f.id === cleanKey || (normalizedLabel.length > 0 && normalizedLabel === normalizedKey);
      });
    }
    return false;
  },

  async get(key?: string): Promise<any> {
    if (key === undefined) {
      return (await storage.get()) ?? DEFAULT_LOCAL_PROFILE;
    }
    const field = keyToField(key);
    const profile = await storage.get();

    if (field) {
      const value = profile?.[field];
      return typeof value === 'string' && value.length > 0 ? value : undefined;
    }

    // Check custom fields
    if (profile?.customFields && profile.customFields.length > 0) {
      const cleanKey = key.startsWith('profile.') ? key.slice('profile.'.length) : key;
      const normalizedKey = cleanKey.toLowerCase().replace(/[^a-z0-9]/g, '');
      const customMatch = profile.customFields.find(f => {
        const normalizedLabel = f.label.toLowerCase().replace(/[^a-z0-9]/g, '');
        return f.id === key || f.id === cleanKey || (normalizedLabel.length > 0 && normalizedLabel === normalizedKey);
      });
      if (customMatch && customMatch.value.length > 0) {
        return customMatch.value;
      }
    }

    return undefined;
  },

  async getAll(): Promise<LocalProfileData> {
    return (await storage.get()) ?? DEFAULT_LOCAL_PROFILE;
  },

  async updateProfile(data: Partial<LocalProfileData>): Promise<void> {
    const current = (await storage.get()) ?? DEFAULT_LOCAL_PROFILE;
    await storage.set({ ...current, ...data });
  },
};
