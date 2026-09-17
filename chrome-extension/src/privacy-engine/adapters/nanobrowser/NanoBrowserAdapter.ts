/**
 * privacy-engine/adapters/nanobrowser/NanoBrowserAdapter.ts
 *
 * NanoBrowser's integration with the generic privacy engine (Part 10/11).
 * This is deliberately the ONLY place in the codebase that both:
 *   (a) knows about NanoBrowser's BrowserState/DOMElementNode types, AND
 *   (b) knows about the generic PrivacyEngine.
 *
 * Any other agent wanting the same protection implements its own adapter that
 * builds a `PageContext` and calls the same `PrivacyEngine` — see
 * `privacy-engine/adapters/test-agent` (Part 15) for a second, independent
 * example that proves the engine isn't NanoBrowser-specific.
 */
import type { BrowserState } from '@src/background/browser/views';
import { PrivacyEngine } from '@src/privacy-engine/core/PrivacyEngine';
import type { PrivacyEngineConfig } from '@src/privacy-engine/core/PrivacyEngine';
import type {
  NamedText,
  PageContext,
  PrivacyMetadata,
  SensitiveRegion,
  TabContext,
} from '@src/privacy-engine/core/types';
import { domStateToSnapshot } from './domTranslate';
import { normalizeImageData } from '@src/privacy-engine/utils/imageUtils';

export type NanoBrowserPrivacyResult =
  | {
      allowed: true;
      /** Sanitized, LLM-ready element listing — produced by NanoBrowser's OWN
       *  `clickableElementsToString()`, called on the (now-redacted) tree. */
      elementsText: string;
      /** Sanitized screenshot (or null if none was requested), safe to send. */
      screenshot: string | null;
      /** Sanitized current-tab url/title and other-tabs list — NEVER the raw values. */
      url?: string;
      title?: string;
      tabs?: TabContext[];
      /** Sanitized action results/extracted content, same order/ids as the input. */
      actionResults?: NamedText[];
      sensitiveRegions: SensitiveRegion[];
      privacyMetadata: PrivacyMetadata;
    }
  | { allowed: false; reason: string };

// Dev-only tracker for active screenshot preview object URL to avoid memory leaks across repeated runs
let activePreviewUrl: string | null = null;

export class NanoBrowserAdapter {
  private engine: PrivacyEngine;

  constructor(config?: PrivacyEngineConfig) {
    this.engine = new PrivacyEngine(config);
  }

  /**
   * Sanitizes EVERYTHING a NanoBrowser prompt might put in front of the model
   * before it is allowed anywhere near a prompt/network call: the DOM +
   * screenshot, the current tab's url/title, every other open tab's url/title,
   * and any action-result text (extractedContent/error strings), which can
   * themselves contain PII echoed back from the page. `includeAttributes` is
   * passed straight through to NanoBrowser's own `clickableElementsToString`,
   * exactly as `buildBrowserStateUserMessage` used to call it directly on raw
   * data. There is no code path in this method that returns a raw field from
   * `browserState`/`actionResults` when `allowed` is true.
   */
  async sanitizeBrowserState(
    browserState: BrowserState,
    includeAttributes: string[] | null,
    actionResults: NamedText[] = [],
  ): Promise<NanoBrowserPrivacyResult> {
    const snapshot = domStateToSnapshot(browserState);
    const tabs: TabContext[] = (browserState.tabs ?? []).map(tab => ({ id: tab.id, url: tab.url, title: tab.title }));

    const pageContext: PageContext = {
      url: browserState.url,
      title: browserState.title,
      dom: snapshot,
      screenshot: browserState.screenshot,
      tabs,
      extraText: actionResults,
    };

    const result = await this.engine.sanitize(pageContext);

    if (!result.allowed) {
      return { allowed: false, reason: result.reason };
    }

    // The engine redacted the DOM in place (see domTranslate.ts's
    // shared-reference design), so calling NanoBrowser's own serializer now on
    // the SAME elementTree object yields sanitized text — no re-implementation
    // of clickableElementsToString needed.
    const elementsText = browserState.elementTree
      ? browserState.elementTree.clickableElementsToString(includeAttributes)
      : '';

    // ---------------------------------------------------------------------
    // TEMPORARY DEV-ONLY DEBUG LOGGING — for manual privacy-boundary
    // verification only. Gated on import.meta.env.DEV so it never runs in a
    // production build. Logs ONLY the already-sanitized values that were
    // just computed above (elementsText, redacted screenshot, sanitized
    // url/title/tabs/actionResults, and SensitiveRegion metadata, which by
    // design never carries a raw matched value — see
    // privacy-engine/core/types.ts's SensitiveRegion doc comment). Does NOT
    // change any privacy behavior; remove once manual verification is done.
    if (import.meta.env.DEV) {
      console.log('[PRIVACY DEBUG] SANITIZED CONTEXT', {
        url: result.context.url,
        title: result.context.title,
        tabs: result.context.tabs,
        elementsTextLength: elementsText.length,
        elementsTextSample: elementsText,
        screenshotIncluded: !!result.context.sanitizedScreenshot,
        screenshotLength: result.context.sanitizedScreenshot?.length ?? 0,
        actionResults: result.context.sanitizedExtraText,
        sensitiveRegions: result.context.sensitiveRegions,
        privacyMetadata: result.context.privacyMetadata,
      });

      const sanitizedScreenshot = result.context.sanitizedScreenshot;

      if (sanitizedScreenshot) {
        // Clean up prior object URL to prevent memory leaks during repeated tests
        if (activePreviewUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
          try {
            URL.revokeObjectURL(activePreviewUrl);
          } catch {
            // ignore
          }
          activePreviewUrl = null;
        }

        let dataUrlFallback = '';
        try {
          const { dataUrl, rawBase64, mimeType } = normalizeImageData(sanitizedScreenshot);
          dataUrlFallback = dataUrl;
          const binaryString = atob(rawBase64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: mimeType });

          if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
            activePreviewUrl = URL.createObjectURL(blob);
          }
        } catch (err) {
          console.warn('[PRIVACY DEBUG] Failed to create blob for sanitized screenshot preview:', err);
        }

        const previewSource = activePreviewUrl ?? dataUrlFallback;
        if (dataUrlFallback) {
          (globalThis as unknown as { __lastSanitizedScreenshot?: string }).__lastSanitizedScreenshot = dataUrlFallback;
        }

        console.log('[PRIVACY DEBUG] SANITIZED SCREENSHOT', {
          screenshotIncluded: true,
          screenshotLength: sanitizedScreenshot.length,
          detectedCount: result.context.privacyMetadata.detectedCount,
          redactedCount: result.context.privacyMetadata.redactedCount,
          sensitiveRegions: result.context.sensitiveRegions,
          ...(activePreviewUrl ? { previewUrl: activePreviewUrl } : {}),
        });

        if (previewSource) {
          // DevTools CSS image rendering: inspectable inline visual representation in console
          console.log(
            '%c ',
            `font-size: 1px; padding: 140px 240px; background-image: url("${previewSource}"); background-size: contain; background-repeat: no-repeat; background-position: center; border: 2px solid #2563eb; border-radius: 8px; background-color: #111;`,
          );

          // If HTMLImageElement is supported in this environment, log an Image instance for inspection
          if (typeof Image !== 'undefined') {
            try {
              const img = new Image();
              img.src = previewSource;
              console.log(img);
            } catch {
              // ignore
            }
          }
        }
      } else {
        console.log('[PRIVACY DEBUG] SANITIZED SCREENSHOT', {
          screenshotIncluded: false,
          screenshotLength: 0,
          detectedCount: result.context.privacyMetadata.detectedCount,
          redactedCount: result.context.privacyMetadata.redactedCount,
          sensitiveRegions: result.context.sensitiveRegions,
        });
      }
    }
    // ---------------------------------------------------------------------

    return {
      allowed: true,
      elementsText,
      screenshot: result.context.sanitizedScreenshot ?? null,
      url: result.context.url,
      title: result.context.title,
      tabs: result.context.tabs,
      actionResults: result.context.sanitizedExtraText,
      sensitiveRegions: result.context.sensitiveRegions,
      privacyMetadata: result.context.privacyMetadata,
    };
  }
}
