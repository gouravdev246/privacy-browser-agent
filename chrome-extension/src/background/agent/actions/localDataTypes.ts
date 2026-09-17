/**
 * Local Data Reference types for privacy-preserving form filling.
 *
 * The remote LLM generates actions referencing data by KEY only
 * (e.g. "profile.email"). The actual values are resolved locally
 * by the LocalActionResolver and NEVER sent to the remote LLM.
 */

/**
 * A reference to locally-stored user data. The remote LLM produces
 * these references; the local resolver converts them to actual values.
 */
export interface LocalDataReference {
  type: 'local_data';
  key: string;
}

/**
 * Type guard: checks if a value is a well-formed LocalDataReference.
 */
export function isLocalDataReference(value: unknown): value is LocalDataReference {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (value as Record<string, unknown>).type === 'local_data' &&
    'key' in value &&
    typeof (value as Record<string, unknown>).key === 'string'
  );
}

/**
 * Heuristic: detects if a string looks like a literal sensitive value
 * rather than a data key reference. Used as a fail-closed guard when
 * the LLM accidentally returns a real value instead of a data key.
 *
 * This is NOT a privacy engine detector — it's a quick sanity check
 * at the action boundary. The real privacy protection comes from the
 * architecture (the LLM never sees the values in the first place).
 */
export function looksLikeLiteralPII(text: string): boolean {
  const trimmed = text.trim();

  // Data keys look like "profile.email", "profile.fullName" etc.
  // If it starts with "profile." and has no spaces, it's likely a key.
  if (/^profile\.[a-zA-Z0-9_]+$/.test(trimmed)) {
    return false;
  }

  // Email pattern
  if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(trimmed)) {
    return true;
  }

  // Phone pattern (7+ digits, possibly with separators)
  if (/[\d\s\-().+]{7,}/.test(trimmed) && /\d{7,}/.test(trimmed.replace(/\D/g, ''))) {
    return true;
  }

  return false;
}
