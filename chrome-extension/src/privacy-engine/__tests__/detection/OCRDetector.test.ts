import { describe, it, expect, beforeEach } from 'vitest';
import { OCRDetector, setCustomOCRDetector, resetOCRDetector } from '../../detection/OCRDetector';

describe('OCRDetector', () => {
  beforeEach(() => {
    resetOCRDetector();
  });

  it('returns [] when no screenshot is provided', async () => {
    setCustomOCRDetector(async () => {
      throw new Error('should not be called');
    });
    const detector = new OCRDetector();
    const regions = await detector.detect({});
    expect(regions).toEqual([]);
  });

  it('detects sensitive patterns (Email, Phone, PAN, Passport) from OCR bounding boxes', async () => {
    setCustomOCRDetector(async () => [
      {
        text: 'user@example.com',
        confidence: 95,
        bbox: { x0: 50, y0: 100, x1: 200, y1: 130 },
      },
      {
        text: '9876543210',
        confidence: 90,
        bbox: { x0: 250, y0: 100, x1: 350, y1: 130 },
      },
      {
        text: 'ABCDE1234F',
        confidence: 92,
        bbox: { x0: 50, y0: 150, x1: 180, y1: 180 },
      },
      {
        text: 'P1234567',
        confidence: 88,
        bbox: { x0: 250, y0: 150, x1: 360, y1: 180 },
      },
      {
        text: 'Normal Public Text',
        confidence: 99,
        bbox: { x0: 10, y0: 10, x1: 100, y1: 30 },
      },
    ]);

    const detector = new OCRDetector();
    const regions = await detector.detect({ screenshot: 'data:image/png;base64,dummy' });

    expect(regions).toHaveLength(4);

    const emailRegion = regions.find(r => r.type === 'EMAIL');
    expect(emailRegion).toBeDefined();
    expect(emailRegion?.bbox).toEqual({ xmin: 50, ymin: 100, xmax: 200, ymax: 130 });
    expect(emailRegion?.source).toBe('ocr');

    const phoneRegion = regions.find(r => r.type === 'PHONE');
    expect(phoneRegion).toBeDefined();

    const panRegion = regions.find(r => r.type === 'PAN');
    expect(panRegion).toBeDefined();

    const passportRegion = regions.find(r => r.type === 'PASSPORT');
    expect(passportRegion).toBeDefined();
  });

  it('detects date formats (DOB) as DOCUMENT sensitive regions', async () => {
    setCustomOCRDetector(async () => [
      {
        text: '01/05/2001',
        confidence: 89,
        bbox: { x0: 100, y0: 200, x1: 220, y1: 230 },
      },
    ]);

    const detector = new OCRDetector();
    const regions = await detector.detect({ screenshot: 'data:image/png;base64,dummy' });

    expect(regions).toHaveLength(1);
    expect(regions[0].type).toBe('DOCUMENT');
    expect(regions[0].bbox).toEqual({ xmin: 100, ymin: 200, xmax: 220, ymax: 230 });
  });

  it('detects synthetic placeholders like [EMAIL] or [MASKED]', async () => {
    setCustomOCRDetector(async () => [
      {
        text: '[EMAIL]',
        confidence: 95,
        bbox: { x0: 100, y0: 300, x1: 180, y1: 330 },
      },
    ]);

    const detector = new OCRDetector();
    const regions = await detector.detect({ screenshot: 'data:image/png;base64,dummy' });

    expect(regions).toHaveLength(1);
    expect(regions[0].type).toBe('UNKNOWN_SENSITIVE');
  });

  it('filters out detections below the minConfidence threshold', async () => {
    setCustomOCRDetector(async () => [
      {
        text: 'user@example.com',
        confidence: 20, // Below minConfidence (default 30)
        bbox: { x0: 50, y0: 50, x1: 150, y1: 80 },
      },
    ]);

    const detector = new OCRDetector(30);
    const regions = await detector.detect({ screenshot: 'data:image/png;base64,dummy' });

    expect(regions).toHaveLength(0);
  });
});
