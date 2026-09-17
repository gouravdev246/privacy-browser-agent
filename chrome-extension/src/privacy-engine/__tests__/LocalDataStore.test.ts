import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock chrome.storage.local before importing the store
const { mockStorage } = vi.hoisted(() => {
  const mockStorage: Record<string, unknown> = {};
  (globalThis as any).chrome = {
    storage: {
      local: {
        get: vi.fn(async (keys: string[]) => {
          const result: Record<string, unknown> = {};
          for (const key of keys) {
            if (key in mockStorage) {
              result[key] = mockStorage[key];
            }
          }
          return result;
        }),
        set: vi.fn(async (data: Record<string, unknown>) => {
          Object.assign(mockStorage, data);
        }),
        onChanged: {
          addListener: vi.fn(),
        },
      },
    },
  };
  return { mockStorage };
});

// Now import after mocks are in place
import { localDataStore, DEFAULT_LOCAL_PROFILE } from '../../../../packages/storage/lib/profile/localDataStore';

describe('LocalDataStore', () => {
  beforeEach(() => {
    // Reset mock storage to default profile
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
    mockStorage['local-profile-data'] = {
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+1-555-123-4567',
      dateOfBirth: '1990-01-15',
      address: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      postalCode: '62701',
      country: 'US',
    };
  });

  describe('isValidKey()', () => {
    it('accepts all canonical profile keys', () => {
      const validKeys = [
        'profile.fullName',
        'profile.email',
        'profile.phone',
        'profile.dateOfBirth',
        'profile.address',
        'profile.city',
        'profile.state',
        'profile.postalCode',
        'profile.country',
      ];
      for (const key of validKeys) {
        expect(localDataStore.isValidKey(key)).toBe(true);
      }
    });

    it('rejects keys not in the allowlist', () => {
      expect(localDataStore.isValidKey('profile.ssn')).toBe(false);
      expect(localDataStore.isValidKey('profile.password')).toBe(false);
      expect(localDataStore.isValidKey('user.email')).toBe(false);
      expect(localDataStore.isValidKey('email')).toBe(false);
      expect(localDataStore.isValidKey('')).toBe(false);
      expect(localDataStore.isValidKey('profile.')).toBe(false);
    });
  });

  describe('get(key)', () => {
    it('resolves a valid key to the stored value', async () => {
      const email = await localDataStore.get('profile.email');
      expect(email).toBe('jane@example.com');
    });

    it('resolves profile.fullName correctly', async () => {
      const name = await localDataStore.get('profile.fullName');
      expect(name).toBe('Jane Doe');
    });

    it('returns undefined for an invalid key', async () => {
      const result = await localDataStore.get('profile.ssn');
      expect(result).toBeUndefined();
    });

    it('returns undefined when no data is stored (empty profile)', async () => {
      mockStorage['local-profile-data'] = DEFAULT_LOCAL_PROFILE;
      const result = await localDataStore.get('profile.email');
      expect(result).toBeUndefined();
    });

    it('returns undefined for a valid key with empty string value', async () => {
      mockStorage['local-profile-data'] = { ...DEFAULT_LOCAL_PROFILE, email: '' };
      const result = await localDataStore.get('profile.email');
      expect(result).toBeUndefined();
    });
  });

  describe('custom fields', () => {
    it('resolves a custom field by key or normalized label', async () => {
      mockStorage['local-profile-data'] = {
        ...DEFAULT_LOCAL_PROFILE,
        customFields: [
          { id: 'custom_passport', label: 'Passport Number', value: 'P1234567' },
          { id: 'custom_company', label: 'Company', value: 'Acme Corp' },
        ],
      };
      const passport = await localDataStore.get('profile.passportNumber');
      expect(passport).toBe('P1234567');

      const company = await localDataStore.get('profile.company');
      expect(company).toBe('Acme Corp');
    });

    it('returns undefined if custom field value is empty', async () => {
      mockStorage['local-profile-data'] = {
        ...DEFAULT_LOCAL_PROFILE,
        customFields: [{ id: 'custom_empty', label: 'Note', value: '' }],
      };
      const result = await localDataStore.get('profile.note');
      expect(result).toBeUndefined();
    });
  });

  describe('ALLOWED_KEYS', () => {
    it('exposes a readonly list of 9 profile keys', () => {
      expect(localDataStore.ALLOWED_KEYS).toHaveLength(9);
      expect(localDataStore.ALLOWED_KEYS).toContain('profile.email');
      expect(localDataStore.ALLOWED_KEYS).toContain('profile.country');
    });
  });
});
