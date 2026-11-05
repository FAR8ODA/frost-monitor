import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as api from '../api/mockApi';
import type { Field, Reading, Station } from '../api/mockApi';
import App from '../App';

// Replace the 3 API calls with fakes we control (keeps AS_OF_DATE, addDays, etc. real)
vi.mock('../api/mockApi', async (importOriginal) => {
  const actual = await importOriginal<typeof api>();
  return { ...actual, getFields: vi.fn(), getStations: vi.fn(), getReadings: vi.fn() };
});

const fields: Field[] = [
  { id: 'field-2', name: 'River Flats', crop: 'Cherries' },
  { id: 'field-3', name: 'Hilltop', crop: 'Grapes' },
];

const stations: Station[] = [
  { id: 'field-2-s1', fieldId: 'field-2', label: 'S-01' },
  { id: 'field-3-s1', fieldId: 'field-3', label: 'S-01' },
];

const readings: Reading[] = [
  { stationId: 'field-2-s1', date: '2027-01-15', lowTempC: -1 }, // frost
  { stationId: 'field-3-s1', date: '2027-01-15', lowTempC: 8 }, // safe
];

beforeEach(() => {
  vi.mocked(api.getStations).mockResolvedValue(stations);
  vi.mocked(api.getReadings).mockResolvedValue(readings);
});

afterEach(() => {
  vi.resetAllMocks();
});

it('shows an error, recovers after Retry, and opens a field', async () => {
  const user = userEvent.setup();
  vi.mocked(api.getFields)
    .mockRejectedValueOnce(new Error('Network request failed')) // first load fails
    .mockResolvedValueOnce(fields); // retry works

  render(<App />);

  // Error state with a way to retry
  expect(await screen.findByRole('alert')).toHaveTextContent('Network request failed');
  await user.click(screen.getByRole('button', { name: 'Retry' }));

  // Data loads, at-risk field is first and labelled with text (not colour only)
  expect(await screen.findByText('1 of 2 fields')).toBeInTheDocument();
  const rows = screen.getAllByRole('row');
  expect(rows[1]).toHaveTextContent('River Flats');
  expect(rows[1]).toHaveTextContent('Frost risk');

  // Selecting a field opens its detail panel
  await user.click(screen.getByRole('button', { name: 'River Flats' }));
  expect(screen.getByRole('heading', { name: /River Flats/ })).toBeInTheDocument();
});

it('filters the table down to fields at frost risk', async () => {
  const user = userEvent.setup();
  vi.mocked(api.getFields).mockResolvedValue(fields);

  render(<App />);

  await user.click(await screen.findByRole('checkbox', { name: 'Show only fields at frost risk' }));

  expect(screen.getByRole('button', { name: 'River Flats' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Hilltop' })).toBeNull();
});