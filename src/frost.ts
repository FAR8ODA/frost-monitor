import { addDays, AS_OF_DATE } from './api/mockApi';
import type { Field, Reading, Station } from './api/mockApi';

// "This week": the 7 days ending on AS_OF_DATE, including it 
export const WEEK_START = addDays(AS_OF_DATE, -6);
// "Last week": the 7 days before that , only used for trends
export const PREV_WEEK_START = addDays(AS_OF_DATE, -13);
export const PREV_WEEK_END = addDays(AS_OF_DATE, -7);

// If the weekly average moves less than this many °C, we call it "steady"
const TREND_THRESHOLD_C = 0.5;

export type Trend = 'colder' | 'warmer' | 'steady' | 'unknown';

export type StationSummary = {
  station: Station;
  lastWeek: Reading[]; // this week's readings, oldest first (nulls kept so gaps show)
  coldestC: number | null; // null = no reports this week
  trend: Trend;
  offline: boolean;
};

export type FieldSummary = {
  field: Field;
  stations: StationSummary[]; // coldest first
  coldestC: number | null;
  atRisk: boolean;
  trend: Trend;
  offlineCount: number;
};

// Daily lows between from and to (inclusive), skipping days the station didn't report
export function reportedLows(readings: Reading[], from: string, to: string): number[] {
  const lows: number[] = [];
  for (const r of readings) {
    if (r.date >= from && r.date <= to && r.lowTempC !== null) {
      lows.push(r.lowTempC);
    }
  }
  return lows;
}

export function coldest(lows: number[]): number | null {
  if (lows.length === 0) return null;
  return Math.min(...lows);
}

export function average(lows: number[]): number | null {
  if (lows.length === 0) return null;
  let sum = 0;
  for (const t of lows) sum += t;
  return sum / lows.length;
}

// Frost risk: any reported low of 0 °C or below this week
export function isFrostRisk(coldestC: number | null): boolean {
  return coldestC !== null && coldestC <= 0;
}

// Compare this week's average low with last week's
export function trend(thisWeekAvg: number | null, prevWeekAvg: number | null): Trend {
  if (thisWeekAvg === null || prevWeekAvg === null) return 'unknown';
  const change = thisWeekAvg - prevWeekAvg;
  if (change <= -TREND_THRESHOLD_C) return 'colder';
  if (change >= TREND_THRESHOLD_C) return 'warmer';
  return 'steady';
}

// Offline: no reading on AS_OF_DATE and none on the day before
export function isOffline(stationReadings: Reading[]): boolean {
  const yesterday = addDays(AS_OF_DATE, -1);
  for (const r of stationReadings) {
    const isRecent = r.date === AS_OF_DATE || r.date === yesterday;
    if (isRecent && r.lowTempC !== null) return false;
  }
  return true;
}

// Sort helper: coldest first, "no data" last
function compareColdest(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

export function summarizeStation(station: Station, readings: Reading[]): StationSummary {
  const mine = readings.filter((r) => r.stationId === station.id);
  const thisWeekLows = reportedLows(mine, WEEK_START, AS_OF_DATE);
  const prevWeekLows = reportedLows(mine, PREV_WEEK_START, PREV_WEEK_END);

  const lastWeek = mine
    .filter((r) => r.date >= WEEK_START && r.date <= AS_OF_DATE)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  return {
    station,
    lastWeek,
    coldestC: coldest(thisWeekLows),
    trend: trend(average(thisWeekLows), average(prevWeekLows)),
    offline: isOffline(mine),
  };
}

export function summarizeField(field: Field, stations: Station[], readings: Reading[]): FieldSummary {
  const fieldStations = stations.filter((s) => s.fieldId === field.id);
  const stationIds = fieldStations.map((s) => s.id);
  const fieldReadings = readings.filter((r) => stationIds.includes(r.stationId));

  const thisWeekLows = reportedLows(fieldReadings, WEEK_START, AS_OF_DATE);
  const prevWeekLows = reportedLows(fieldReadings, PREV_WEEK_START, PREV_WEEK_END);
  const coldestC = coldest(thisWeekLows);

  const stationSummaries = fieldStations.map((s) => summarizeStation(s, fieldReadings));
  stationSummaries.sort((a, b) => compareColdest(a.coldestC, b.coldestC));

  return {
    field,
    stations: stationSummaries,
    coldestC,
    atRisk: isFrostRisk(coldestC),
    trend: trend(average(thisWeekLows), average(prevWeekLows)),
    offlineCount: stationSummaries.filter((s) => s.offline).length,
  };
}

// The whole overview: at-risk fields first, then coldest first
export function summarizeFarm(fields: Field[], stations: Station[], readings: Reading[]): FieldSummary[] {
  const summaries = fields.map((f) => summarizeField(f, stations, readings));
  summaries.sort((a, b) => {
    if (a.atRisk !== b.atRisk) return a.atRisk ? -1 : 1;
    return compareColdest(a.coldestC, b.coldestC);
  });
  return summaries;
}

// Display helpers shared by the overview and detail tables
export const TREND_LABEL: Record<Trend, string> = {
  colder: '↓ Colder',
  warmer: '↑ Warmer',
  steady: '→ Steady',
  unknown: 'No data',
};

export function formatTemp(c: number | null): string {
  return c === null ? 'No data' : `${c} °C`;
}