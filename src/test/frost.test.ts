// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AS_OF_DATE, getFields, getReadings, getStations } from '../api/mockApi';
import type { Reading } from '../api/mockApi';
import {
  PREV_WEEK_START,
  coldest,
  isFrostRisk,
  isOffline,
  reportedLows,
  summarizeFarm,
  trend,
} from '../frost';

function reading(date: string, lowTempC: number | null): Reading {
  return { stationId: 'field-2-s1', date, lowTempC };
}

describe('frost rules', () => {
  it('counts exactly 0 °C as frost, 0.5 °C as safe, and no data as not at risk', () => {
    expect(isFrostRisk(0)).toBe(true);
    expect(isFrostRisk(0.5)).toBe(false);
    expect(isFrostRisk(null)).toBe(false);
  });

  it('only uses the 7 days ending on AS_OF_DATE and skips missing reports', () => {
    const readings = [
      reading('2027-01-08', -5), // one day before the window: ignored
      reading('2027-01-09', 3), // first day of the window
      reading('2027-01-12', null), // station didn't report
      reading('2027-01-15', 1),
    ];
    expect(coldest(reportedLows(readings, '2027-01-09', '2027-01-15'))).toBe(1);
  });

  it('returns null instead of Infinity when there are no reports', () => {
    expect(coldest([])).toBeNull();
  });

  it('flags a station offline only when today and yesterday are both missing', () => {
    expect(isOffline([reading('2027-01-14', null), reading('2027-01-15', null)])).toBe(true);
    expect(isOffline([reading('2027-01-14', 2), reading('2027-01-15', null)])).toBe(false);
  });

  it('calls changes under 0.5 °C steady', () => {
    expect(trend(0, 3)).toBe('colder');
    expect(trend(6, 5)).toBe('warmer');
    expect(trend(4.04, 3.96)).toBe('steady');
    expect(trend(null, 3)).toBe('unknown');
  });
});

describe('summarizeFarm with the real mock API data', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ranks at-risk fields first, then coldest first', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // API never fails, fixed delay

    const [fields, stations] = await Promise.all([getFields(), getStations()]);
    const readings = await getReadings(
      stations.map((s) => s.id),
      PREV_WEEK_START,
      AS_OF_DATE,
    );
    const farm = summarizeFarm(fields, stations, readings);

    expect(farm.map((f) => [f.field.name, f.coldestC, f.atRisk])).toEqual([
      ['South Slope', -3, true],
      ['River Flats', -2, true],
      ['Creekside', 0.5, false],
      ['Pear Hollow', 2, false],
      ['Old Barn', 3, false],
      ['North Orchard', 4, false],
      ['West Gate', 5, false],
      ['Hilltop', 6, false],
    ]);

    const riverFlats = farm.find((f) => f.field.name === 'River Flats');
    expect(riverFlats?.trend).toBe('colder'); // usual low went from 3 °C to 0 °C
    expect(riverFlats?.offlineCount).toBe(1); // S-03 stopped reporting
  });
});