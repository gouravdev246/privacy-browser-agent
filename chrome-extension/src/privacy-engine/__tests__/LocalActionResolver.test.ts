import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @extension/storage with a controllable localDataStore
const { mockProfileData, MOCK_ALLOWED_KEYS } = vi.hoisted(() => {
  const mockProfileData: Record<string, string> = {};
  const MOCK_ALLOWED_KEYS = [
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
  return { mockProfileData, MOCK_ALLOWED_KEYS };
});

vi.mock('@extension/storage', () => ({
  localDataStore: {
    isValidKey: (key: string) => MOCK_ALLOWED_KEYS.includes(key),
    ALLOWED_KEYS: MOCK_ALLOWED_KEYS,
    get: async (key: string) => {
      const field = key.startsWith('profile.') ? key.slice('profile.'.length) : null;
      if (!field) return undefined;
      const value = mockProfileData[field];
      return value && value.length > 0 ? value : undefined;
    },
    getAll: async () => ({ ...mockProfileData }),
    updateProfile: vi.fn(),
  },
}));

// Mock the logger to avoid console noise
vi.mock('@src/background/log', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

import { LocalActionResolver } from '../../background/agent/actions/localActionResolver';

describe('LocalActionResolver', () => {
  let resolver: LocalActionResolver;

  beforeEach(() => {
    resolver = new LocalActionResolver();
    // Populate test data
    Object.assign(mockProfileData, {
      fullName: 'Test User',
      email: 'test@example.com',
      phone: '+1-555-999-0000',
      dateOfBirth: '1985-06-15',
      address: '456 Oak Ave',
      city: 'Portland',
      state: 'OR',
      postalCode: '97201',
      country: 'US',
    });
  });

  describe('successful resolution', () => {
    it('resolves a valid data key and returns a sanitized message', async () => {
      const result = await resolver.resolve('profile.email');
      expect(result.value).toBe('test@example.com');
      expect(result.sanitizedMessage).toBe('Successfully filled the requested field with locally stored data.');
    });

    it('sanitized message does NOT contain the actual value', async () => {
      const result = await resolver.resolve('profile.email');
      expect(result.sanitizedMessage).not.toContain('test@example.com');
      expect(result.sanitizedMessage).not.toContain('test');
      expect(result.sanitizedMessage).not.toContain('@');
    });

    it('resolves different profile fields correctly', async () => {
      const nameResult = await resolver.resolve('profile.fullName');
      expect(nameResult.value).toBe('Test User');

      const phoneResult = await resolver.resolve('profile.phone');
      expect(phoneResult.value).toBe('+1-555-999-0000');
    });
  });

  describe('fail-closed behavior', () => {
    it('rejects an invalid data key', async () => {
      await expect(resolver.resolve('profile.ssn')).rejects.toThrow('Invalid data key');
    });

    it('rejects a key that is not profile-prefixed', async () => {
      await expect(resolver.resolve('email')).rejects.toThrow('Invalid data key');
    });

    it('rejects when no value is stored for the key', async () => {
      // Clear all data
      for (const key of Object.keys(mockProfileData)) {
        mockProfileData[key] = '';
      }
      await expect(resolver.resolve('profile.email')).rejects.toThrow('No value stored');
    });

    it('rejects when the stored value is empty string', async () => {
      mockProfileData.email = '';
      await expect(resolver.resolve('profile.email')).rejects.toThrow('No value stored');
    });
  });

  describe('literal PII guard', () => {
    it('rejects a data key that looks like a literal email address', async () => {
      // user@example.com is not in ALLOWED_KEYS, so it'll fail at key validation first
      await expect(resolver.resolve('user@example.com')).rejects.toThrow(/Invalid data key/);
    });

    it('rejects a data key that looks like a phone number', async () => {
      await expect(resolver.resolve('+1-555-123-4567')).rejects.toThrow(/Invalid data key/);
    });

    it("accepts legitimate data keys that don't look like PII", async () => {
      const result = await resolver.resolve('profile.email');
      expect(result.value).toBeDefined();
    });
  });
});
