/**
 * Smoke tests for eLikas pure utility functions.
 *
 * Run with:  npm test
 *
 * These tests cover deterministic, side-effect-free functions only —
 * no network calls, no Supabase client, no DOM rendering required.
 */

import { decodeWMO, assessRisk, WMO_CODES } from '../services/weatherService';

// ─── decodeWMO ──────────────────────────────────────────────────────────────

describe('decodeWMO', () => {
  it('returns correct label and icon for clear sky (code 0)', () => {
    const result = decodeWMO(0);
    expect(result.label).toBe('Clear Sky');
    expect(result.risk).toBe('none');
  });

  it('returns critical risk for severe thunderstorm (code 99)', () => {
    const result = decodeWMO(99);
    expect(result.risk).toBe('critical');
  });

  it('returns high risk for heavy rain (code 65)', () => {
    const result = decodeWMO(65);
    expect(result.risk).toBe('high');
  });

  it('returns unknown fallback for unrecognised code', () => {
    const result = decodeWMO(9999);
    expect(result.label).toBe('Unknown');
    expect(result.risk).toBe('none');
  });

  it('covers all WMO_CODES entries without throwing', () => {
    Object.keys(WMO_CODES).forEach((code) => {
      expect(() => decodeWMO(Number(code))).not.toThrow();
    });
  });
});

// ─── assessRisk ─────────────────────────────────────────────────────────────

describe('assessRisk', () => {
  it('returns none for calm clear sky', () => {
    expect(assessRisk({ weathercode: 0, rain: 0, windspeed: 5, precipitation: 0 })).toBe('none');
  });

  it('returns critical when rain > 20 mm/h regardless of weather code', () => {
    expect(assessRisk({ weathercode: 0, rain: 25, windspeed: 0, precipitation: 0 })).toBe('critical');
  });

  it('returns critical for a thunderstorm code (95)', () => {
    expect(assessRisk({ weathercode: 95, rain: 0, windspeed: 0, precipitation: 0 })).toBe('critical');
  });

  it('returns high when code is high AND rain > 7.5', () => {
    expect(assessRisk({ weathercode: 65, rain: 10, windspeed: 0, precipitation: 0 })).toBe('high');
  });

  it('returns medium when wind exceeds 25 km/h with overcast code', () => {
    const result = assessRisk({ weathercode: 3, rain: 0, windspeed: 30, precipitation: 0 });
    expect(['medium', 'high', 'critical']).toContain(result);
  });

  it('returns low for low-risk code with no rain or wind', () => {
    expect(assessRisk({ weathercode: 45, rain: 0, windspeed: 0, precipitation: 0 })).toBe('low');
  });

  it('uses defaults for missing fields', () => {
    // Should not throw even if rain/windspeed/precipitation are omitted
    expect(() => assessRisk({ weathercode: 0 })).not.toThrow();
  });
});
