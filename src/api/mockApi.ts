export type Field = { id: string; name: string; crop: string };
export type Station = { id: string; fieldId: string; label: string };
export type Reading = {
  stationId: string;
  date: string; // "2027-01-15"
  lowTempC: number | null; // null = station did not report that day
};

export const AS_OF_DATE = '2027-01-15'; // treat this as "today"
export const FAILURE_RATE = 0.05; // 0 while building, 1 to test errors

// Each field's usual daily low (°C): before this week, and during the last 7 days
const FIELDS = [
  { name: 'North Orchard', crop: 'Apples', earlierC: 5, lastWeekC: 6, stations: 4 },
  { name: 'River Flats', crop: 'Cherries', earlierC: 3, lastWeekC: 0, stations: 5 },
  { name: 'Hilltop', crop: 'Grapes', earlierC: 7, lastWeekC: 8, stations: 3 },
  { name: 'Pear Hollow', crop: 'Pears', earlierC: 4, lastWeekC: 4, stations: 4 },
  { name: 'Creekside', crop: 'Apples', earlierC: 3.5, lastWeekC: 2.5, stations: 6 },
  { name: 'South Slope', crop: 'Almonds', earlierC: 0, lastWeekC: -1, stations: 4 },
  { name: 'Old Barn', crop: 'Cherries', earlierC: 4, lastWeekC: 5, stations: 3 },
  { name: 'West Gate', crop: 'Grapes', earlierC: 7, lastWeekC: 7, stations: 5 },
];

// Small ups and downs added to the usual low, so the numbers aren't flat
const DAILY_CHANGE = [0, 1, -1, 2, -2];

// No station reported 3 days ago, and these stations stopped reporting 2 days ago
const MISSED_DAY = 3;
const OFFLINE_STATIONS = ['field-2-s3', 'field-5-s1', 'field-5-s2', 'field-8-s4'];

export function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const fields: Field[] = [];
const stations: Station[] = [];
const readings: Reading[] = [];

FIELDS.forEach((field, i) => {
  const fieldId = `field-${i + 1}`;
  fields.push({ id: fieldId, name: field.name, crop: field.crop });

  for (let s = 1; s <= field.stations; s++) {
    const stationId = `${fieldId}-s${s}`;
    stations.push({ id: stationId, fieldId, label: `S-0${s}` });

    for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
      const usual = daysAgo < 7 ? field.lastWeekC : field.earlierC;
      const change = DAILY_CHANGE[(daysAgo + s) % DAILY_CHANGE.length];
      const offline = OFFLINE_STATIONS.includes(stationId) && daysAgo < 2;
      readings.push({
        stationId,
        date: addDays(AS_OF_DATE, -daysAgo),
        lowTempC: daysAgo === MISSED_DAY || offline ? null : usual + change,
      });
    }
  }
});

function respond<T>(data: T): Promise<T> {
  const delay = 300 + Math.random() * 1200;
  return new Promise((resolve, reject) =>
    setTimeout(() => {
      if (Math.random() < FAILURE_RATE) reject(new Error('Network request failed'));
      else resolve(structuredClone(data));
    }, delay),
  );
}

export const getFields = () => respond(fields);
export const getStations = (fieldIds?: string[]) =>
  respond(fieldIds ? stations.filter((s) => fieldIds.includes(s.fieldId)) : stations);
export const getReadings = (stationIds: string[], from: string, to: string) =>
  respond(readings.filter((r) => stationIds.includes(r.stationId) && r.date >= from && r.date <= to));