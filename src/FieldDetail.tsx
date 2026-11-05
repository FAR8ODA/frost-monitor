import { AS_OF_DATE } from './api/mockApi';
import { TREND_LABEL, WEEK_START, formatTemp } from './frost';
import type { FieldSummary } from './frost';

type FieldDetailProps = {
  summary: FieldSummary;
};

export default function FieldDetail({ summary }: FieldDetailProps) {
  const { field, stations, offlineCount } = summary;
  const reportingCount = stations.length - offlineCount;

  return (
    <section className="detail" aria-labelledby="detail-heading">
      <h2 id="detail-heading">
        {field.name} <span className="crop">({field.crop})</span>
      </h2>
      <p className="hint">
        {reportingCount} of {stations.length} stations reporting. Sorted coldest first.
        Daily lows from {WEEK_START} to {AS_OF_DATE}, oldest to newest.
      </p>

      {stations.length === 0 ? (
        <p>This field has no stations.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Station</th>
              <th scope="col">Status</th>
              <th scope="col">Coldest low (7 days)</th>
              <th scope="col">Trend vs last week</th>
              <th scope="col">Daily lows (°C)</th>
            </tr>
          </thead>
          <tbody>
            {stations.map((s) => (
              <tr key={s.station.id}>
                <th scope="row">{s.station.label}</th>
                <td>
                  {s.offline ? (
                    <span className="badge offline">
                      <span aria-hidden="true">⚠ </span>Offline
                    </span>
                  ) : (
                    'Reporting'
                  )}
                </td>
                <td>{formatTemp(s.coldestC)}</td>
                <td>{TREND_LABEL[s.trend]}</td>
                <td>
                  <ol className="lows">
                    {s.lastWeek.map((r) => (
                      <li
                        key={r.date}
                        title={r.date}
                        className={r.lowTempC !== null && r.lowTempC <= 0 ? 'cold' : undefined}
                      >
                        {r.lowTempC === null ? 'n/a' : r.lowTempC}
                      </li>
                    ))}
                  </ol>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}