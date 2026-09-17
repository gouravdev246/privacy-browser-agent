/**
 * Local Action Resolver — the privacy boundary for form filling.
 *
 * This module intercepts `fill_form_field` actions from the remote LLM,
 * resolves abstract data keys (e.g. "profile.email") to actual values
 * using the LocalDataStore, and passes the resolved values directly to
 * the browser action layer.
 *
 * SECURITY INVARIANT:
 * - The resolved value is NEVER returned in the ActionResult.
 * - The resolved value is NEVER logged (only the key + success boolean).
 * - The resolved value is NEVER sent back to the remote LLM.
 * - If resolution fails for any reason, the action fails closed.
 */
import { localDataStore } from '@extension/storage';
import { createLogger } from '@src/background/log';
import { looksLikeLiteralPII } from './localDataTypes';

const logger = createLogger('LocalActionResolver');

export interface ResolvedFillAction {
  /** The actual value to fill — for local browser use ONLY. */
  value: string;
  /** Sanitized message safe to return to the LLM. */
  sanitizedMessage: string;
}

export class LocalActionResolver {
  /**
   * Resolves a `fill_form_field` action's dataKey to an actual value.
   *
   * @param dataKey - The abstract data key from the LLM (e.g. "profile.email")
   * @returns The resolved value and a sanitized result message
   * @throws Error if the key is invalid, not found, or resolution fails
   */
  async resolve(dataKey: string): Promise<ResolvedFillAction> {
    // 1. Validate the data key against the allowlist
    if (!localDataStore.isValidKey(dataKey)) {
      // PRIVACY: log only the key, never any value
      logger.error(`Invalid local data key requested: ${dataKey}`);
      throw new Error(`Invalid data key "${dataKey}". Allowed keys: ${localDataStore.ALLOWED_KEYS.join(', ')}`);
    }

    // 2. Fail-closed guard: reject if the dataKey itself looks like literal PII
    //    (defense-in-depth against a confused LLM)
    if (looksLikeLiteralPII(dataKey)) {
      logger.error('Rejected fill_form_field: dataKey appears to contain literal PII');
      throw new Error(
        'fill_form_field rejected: the dataKey appears to contain literal personal data instead of a data key reference.',
      );
    }

    // 3. Retrieve the value from local storage
    let value: string | undefined;
    try {
      value = await localDataStore.get(dataKey);
    } catch (err) {
      // PRIVACY: do NOT include the error details (might contain storage internals)
      logger.error(`Failed to access local data store for key: ${dataKey}`);
      throw new Error(
        `Could not access locally stored data for "${dataKey}". Please check that your profile is configured in extension settings.`,
      );
    }

    // 4. Fail-closed if no value is stored
    if (value === undefined || value.length === 0) {
      // PRIVACY: safe to log the key name
      if (import.meta.env.DEV) {
        logger.info(`Local data key "${dataKey}" has no stored value`);
      }
      throw new Error(
        `No value stored for "${dataKey}". Please configure your profile in the extension settings (Options → Profile).`,
      );
    }

    // 5. PRIVACY: log only resolution success, NEVER the value
    if (import.meta.env.DEV) {
      logger.info(`Local data resolved: { dataKey: "${dataKey}", resolved: true }`);
    }

    return {
      value,
      // SANITIZED: This message is safe to send back to the LLM.
      // It confirms the action succeeded without revealing the actual data.
      sanitizedMessage: 'Successfully filled the requested field with locally stored data.',
    };
  }
}
