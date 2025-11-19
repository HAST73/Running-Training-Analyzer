import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function getHashParams() {
  const hash = window.location.hash || '';
  const qIndex = hash.indexOf('?');
  if (qIndex === -1) return {};
  const query = new URLSearchParams(hash.slice(qIndex + 1));
  const out = {};
  for (const [k, v] of query.entries()) out[k] = v;
  return out;
}

function fmtPace(paceSec) {
  if (!paceSec || !isFinite(paceSec)) return '-';
  const m = Math.floor(paceSec / 60);
  const s = Math.round(paceSec % 60).toString().padStart(2, '0');
  return `${m}:${s} min/km`;
}

function fmtTime(totalSec) {
  if (!totalSec || !isFinite(totalSec)) return '-';
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  return [h, m, s].map((v, i) => (i === 0 ? v : String(v).padStart(2, '0'))).join(':');
}

// Minimal SVG chart (pace + elevation) without external libs
function PaceElevationChart({ km, pace, elev }) {
  const w = 820; const h = 180; const pad = 30;
  if (!km || km.length === 0) return <div style={{ height: h }}>Brak danych do wykresu</div>;
  const xMin = 0, xMax = km[km.length - 1];
  const pVals = pace.filter(v => v && isFinite(v));
  const eVals = elev.filter(v => v != null && isFinite(v));
  const pMin = Math.min(...pVals), pMax = Math.max(...pVals);
  const eMin = eVals.length ? Math.min(...eVals) : 0;
  const eMax = eVals.length ? Math.max(...eVals) : 1;
  const x = v => pad + (v - xMin) / (xMax - xMin || 1) * (w - 2 * pad);
  const yP = v => h - pad - (v - pMin) / ((pMax - pMin) || 1) * (h - 2 * pad);
  const yE = v => h - pad - (v - eMin) / ((eMax - eMin) || 1) * (h - 2 * pad);
  const pPath = km.map((kx, i) => `${i === 0 ? 'M' : 'L'} ${x(kx).toFixed(1)} ${yP((pace[i] ?? pMin)).toFixed(1)}`).join(' ');
  const ePath = km.map((kx, i) => `${i === 0 ? 'M' : 'L'} ${x(kx).toFixed(1)} ${yE((elev[i] ?? eMin)).toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} role="img">
      <rect x={0} y={0} width={w} height={h} fill="#fff" stroke="#e5e7eb" />
      <path d={ePath} stroke="#9ca3af" strokeDasharray="4 3" fill="none" />
      <path d={pPath} stroke="#2563eb" fill="none" />
      <text x={pad} y={16} fontSize={12} fill="#2563eb">tempo</text>
      <text x={pad + 50} y={16} fontSize={12} fill="#6b7280">wysokość</text>
    </svg>
  );
}

export default function WorkoutAnalysis() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const params = useMemo(() => getHashParams(), [window.location.hash]);
  const workoutId = params.id ? Number(params.id) : null;

  useEffect(() => {
    let abort = false;
    async function go() {
      setLoading(true); setError(''); setData(null);
      if (!workoutId) { setError('Brak identyfikatora treningu w adresie.'); setLoading(false); return; }
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/workouts/${workoutId}/analysis/`, { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!abort) setData(json);
      } catch (e) {
        console.error(e);
        if (!abort) setError('Nie udało się pobrać analizy treningu.');
      } finally {
        if (!abort) setLoading(false);
      }
    }
    go();
    return () => { abort = true; };
  }, [workoutId]);

  const handleBack = () => { window.location.hash = '#workouts'; };

  const center = (() => {
    const pts = (data?.analysis?.track) || [];
    if (pts.length) return [pts[0].lat, pts[0].lon];
    return [52.2297, 21.0122]; // Warsaw fallback
  })();

  // Build colored polylines from pace
  const polylines = (() => {
    const pts = (data?.analysis?.track) || [];
    const lines = [];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const pace = b.pace_s || 0;
      // green faster, red slower
      let color = '#16a34a';
      if (pace > 420) color = '#ef4444';
      else if (pace > 360) color = '#f59e0b';
      lines.push({ positions: [[a.lat, a.lon], [b.lat, b.lon]], color });
    }
    return lines;
  })();

  const splits = (data?.analysis?.splits) || [];
  const chart = data?.analysis?.chart || { km: [], pace_s: [], elev: [] };

  return (
    <section>
      <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>Szczegółowa analiza biegu</h2>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: '1rem' }}>
        <button onClick={handleBack}>Powrót</button>
      </div>

      {loading && <p style={{ textAlign: 'center' }}>Ładowanie...</p>}
      {error && <p style={{ color: 'red', textAlign: 'center' }}>{error}</p>}

      {!loading && !error && data && (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 8 }}>
              <div>
                <div><strong>Trening:</strong> {data.title}</div>
                <div><strong>Data:</strong> {data.performed_at ? new Date(data.performed_at).toLocaleString('pl-PL') : '-'}</div>
              </div>
              <div>
                <div><strong>Dystans:</strong> {data.distance_m ? (data.distance_m / 1000).toFixed(2) + ' km' : '-'}</div>
                <div><strong>Czas:</strong> {fmtTime((data.analysis?.summary?.duration_s) || (data.duration_ms ? data.duration_ms / 1000 : 0))}</div>
                <div><strong>Śr. tempo:</strong> {fmtPace(data.analysis?.summary?.avg_pace_s_per_km)}</div>
                <div><strong>Przewyższenie:</strong> {data.analysis?.summary?.elev_gain_m != null ? Math.round(data.analysis?.summary?.elev_gain_m) + ' m' : '-'}</div>
                {data.meta && (
                  <p style={{ fontSize: '0.8em', color: '#6b7280', marginTop: '0.5rem' }}>
                    Źródło wysokości: {data.meta.elevation_source === 'gpx'
                      ? 'próbki z pliku GPX'
                      : 'brak próbek – JSON nie zawiera wysokości'}
                  </p>
                )}
                <div><strong>Kalorie:</strong> {data.calories_kcal ? Math.round(data.calories_kcal) + ' kcal' : (data.analysis?.summary?.calories_kcal != null ? Math.round(data.analysis?.summary?.calories_kcal) + ' kcal' : '-')}</div>
                <div><strong>Śr. kadencja:</strong> {data.analysis?.summary?.avg_cadence_spm != null ? Math.round(data.analysis?.summary?.avg_cadence_spm) + ' spm' : '-'}</div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ margin: '0 0 8px 0' }}>Mapa trasy (pace)</h4>
            <div style={{ height: 420, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {polylines.map((ln, idx) => (
                  <Polyline key={idx} positions={ln.positions} pathOptions={{ color: ln.color, weight: 4 }} />
                ))}
              </MapContainer>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ margin: '0 0 8px 0' }}>Wykres tempa i wysokości (km → tempo / wysokość)</h4>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              <PaceElevationChart km={chart.km} pace={chart.pace_s} elev={chart.elev} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1rem' }}>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem' }}>
              <h4 style={{ marginTop: 0 }}>Najmocniejsze segmenty biegu</h4>
              <ul>
                <li>Najlepszy 1 km: {fmtPace(data.analysis?.best_segments?.best_1k_pace_s)}</li>
                <li>Najlepsze 5 km: {fmtPace(data.analysis?.best_segments?.best_5k_pace_s)}</li>
                <li>Najszybsze 400 m: {fmtPace(data.analysis?.best_segments?.best_400m_pace_s)}</li>
              </ul>
            </div>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem' }}>
              <h4 style={{ marginTop: 0 }}>Miejsca, gdzie tempo wyraźnie się zmieniało</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <strong>Najszybsze odcinki (~200 m)</strong>
                  <ul>
                    {(data.analysis?.pace_extremes?.fastest || []).slice(0,5).map((it, i) => (
                      <li key={i}>{fmtPace(it.pace_s)}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <strong>Najwolniejsze odcinki (~200 m)</strong>
                  <ul>
                    {(data.analysis?.pace_extremes?.slowest || []).slice(0,5).map((it, i) => (
                      <li key={i}>{fmtPace(it.pace_s)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem' }}>
            <h4 style={{ marginTop: 0 }}>Splity (kilometrowe)</h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: 6 }}>km</th>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: 6 }}>tempo</th>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: 6 }}>przewyższenie</th>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: 6 }}>tętno</th>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: 6 }}>kadencja</th>
                  </tr>
                </thead>
                <tbody>
                  {splits.map((s) => (
                    <tr key={s.km}>
                      <td style={{ padding: 6 }}>{s.km}</td>
                      <td style={{ padding: 6 }}>{fmtPace(s.pace_s)}</td>
                      <td style={{ padding: 6 }}>{s.elev_gain_m != null ? `${Math.round(s.elev_gain_m)} m` : '-'}</td>
                      <td style={{ padding: 6 }}>-</td>
                      <td style={{ padding: 6 }}>{s.cadence_spm != null ? Math.round(s.cadence_spm) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem' }}>
              <h4 style={{ marginTop: 0 }}>Analiza AI</h4>
              <p>{data.ai_note || 'Brak wniosków.'}</p>
            </div>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem' }}>
              <h4 style={{ marginTop: 0 }}>Fazy biegu (technika)</h4>
              <ul>
                <li><strong>Początek:</strong> tempo {fmtPace((splits[0]?.pace_s) || data.analysis?.best_segments?.best_1k_pace_s)}</li>
                <li><strong>Środek:</strong> tempo {fmtPace((splits[Math.floor(splits.length/2)]?.pace_s))}</li>
                <li><strong>Koniec:</strong> tempo {fmtPace((splits[splits.length-1]?.pace_s))}</li>
              </ul>
              <p>Tempo może się wahać zależnie od terenu i zmęczenia.</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
