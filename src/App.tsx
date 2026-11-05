import { useState } from 'react';
import { AS_OF_DATE, getFields, getReadings, getStations } from './api/mockApi';
import { PREV_WEEK_START, TREND_LABEL, WEEK_START, formatTemp, summarizeFarm } from './frost';
import { useAsync } from './useAsync';
import './App.css';

// Loads everything the screen needs: all fields, all stations, and 14 days of
// readings (7 for frost risk + the 7 before for the trend). Defined outside the
// component so useAsync receives the same function on every render.
async function loadFarm() {
  const [fields, stations] = await Promise.all([getFields(), getStations()]);
  const readings = await getReadings(
    stations.map((s) => s.id),
    PREV_WEEK_START,
    AS_OF_DATE,
  );
  return summarizeFarm(fields, stations, readings);
}

export default function App() {
  const { state, retry } = useAsync(loadFarm);
  const [onlyAtRisk, setOnlyAtRisk] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (state.status === 'loading') {
    return (
      <main>
        <p role="status">Loading farm data...</p>
      </main>
    );
  }

  if (state.status === 'error') {
    return (
      <main>
        <div role="alert" className="error">
          <p>Couldn't load farm data: {state.message}</p>
          <button onClick={retry}>Retry</button>
        </div>
      </main>
    );
  }

  const fields = state.data;
  const atRiskCount = fields.filter((f) => f.atRisk).length;
  const visibleFields = onlyAtRisk ? fields.filter((f) => f.atRisk) : fields;
  const selected = fields.find((f) => f.field.id === selectedId);

  let emptyMessage = '';
  if (fields.length === 0) emptyMessage = 'No fields found for this farm.';
  else if (visibleFields.length === 0) emptyMessage = 'No fields are at frost risk right now.';

  return (
    <main>
      <h1>Frost Monitor</h1>
      <p className="subtitle">
        Data as of {AS_OF_DATE}. A field is at frost risk if any of its stations recorded
        0 °C or below from {WEEK_START} to {AS_OF_DATE}.
      </p>

      <p className="summary">
        <strong>
          {atRiskCount} of {fields.length} fields
        </strong>{' '}
        at frost risk
      </p>

      <label className="filter">
        <input
          type="checkbox"
          checked={onlyAtRisk}
          onChange={(e) => setOnlyAtRisk(e.target.checked)}
        />
        Show only fields at frost risk
      </label>

      {emptyMessage ? (
        <p>{emptyMessage}</p>
      ) : (
        <table>
          <caption>Fields at frost risk first, then coldest first</caption>
          <thead>
            <tr>
              <th scope="col">Field</th>
              <th scope="col">Crop</th>
              <th scope="col">Coldest low (7 days)</th>
              <th scope="col">Trend vs last week</th>
              <th scope="col">Frost risk</th>
              <th scope="col">Offline stations</th>
            </tr>
          </thead>
          <tbody>
            {visibleFields.map((f) => (
              <tr key={f.field.id} className={f.field.id === selectedId ? 'selected' : undefined}>
                <th scope="row">
                  <button
                    className="link"
                    aria-pressed={f.field.id === selectedId}
                    onClick={() => setSelectedId(f.field.id)}
                  >
                    {f.field.name}
                  </button>
                </th>
                <td>{f.field.crop}</td>
                <td>{formatTemp(f.coldestC)}</td>
                <td>{TREND_LABEL[f.trend]}</td>
                <td>
                  {f.atRisk ? (
                    <span className="badge risk">
                      <span aria-hidden="true">❄ </span>Frost risk
                    </span>
                  ) : (
                    <span className="badge ok">No risk</span>
                  )}
                </td>
                <td>{f.offlineCount === 0 ? 'None' : f.offlineCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selected ? (
        <p>Selected: {selected.field.name} (detail panel comes in the next step)</p>
      ) : (
        <p className="hint">Select a field to see its stations.</p>
      )}
    </main>
  );
}