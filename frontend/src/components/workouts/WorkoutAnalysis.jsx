import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
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

/**
 * Wykres obsługujący teraz trzy serie danych:
 * - pace (tempo) - niebieska linia
 * - elev (wysokość) - szara przerywana
 * - hr (tętno) - czerwona linia (NOWOŚĆ)
 */
function PaceElevationChart({ km, pace, elev, hr }) {
  const w = 820; const h = 220; const pad = 30; // Zwiększyłem nieco wysokość dla czytelności
  if (!km || km.length === 0) return <div style={{ height: h, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Brak danych do wykresu</div>;

  const xMin = 0, xMax = km[km.length - 1];
  
  // Dane Tempa
  const pVals = pace.filter(v => v && isFinite(v));
  const pMin = pVals.length ? Math.min(...pVals) : 0;
  const pMax = pVals.length ? Math.max(...pVals) : 1000;

  // Dane Wysokości
  const eVals = elev.filter(v => v != null && isFinite(v));
  const eMin = eVals.length ? Math.min(...eVals) : 0;
  const eMax = eVals.length ? Math.max(...eVals) : 100;

  // Dane Tętna (NOWOŚĆ)
  const hVals = hr ? hr.filter(v => v != null && isFinite(v)) : [];
  const hMin = hVals.length ? Math.min(...hVals) : 0;
  const hMax = hVals.length ? Math.max(...hVals) : 200;

  // Skalowanie X
  const x = v => pad + (v - xMin) / (xMax - xMin || 1) * (w - 2 * pad);

  // Skalowanie Y (każda seria ma swoją skalę, żeby zmieścić się na wykresie)
  // Tempo: odwrócone (szybciej = niżej na wykresie, lub wyżej - zależy od konwencji. Tutaj: mniej sec/km = wyżej)
  // W poprzednim kodzie: mniej s/km (szybciej) = wyżej na wykresie (mniejsze Y SVG)
  const yP = v => h - pad - (v - pMin) / ((pMax - pMin) || 1) * (h - 2 * pad);
  
  // Wysokość
  const yE = v => h - pad - (v - eMin) / ((eMax - eMin) || 1) * (h - 2 * pad);

  // Tętno
  const yH = v => h - pad - (v - hMin) / ((hMax - hMin) || 1) * (h - 2 * pad);

  // Generowanie ścieżek SVG
  const pPath = km.map((kx, i) => {
    const val = pace[i];
    if (val == null) return ''; 
    const prefix = (i === 0 || pace[i-1] == null) ? 'M' : 'L';
    return `${prefix} ${x(kx).toFixed(1)} ${yP(val).toFixed(1)}`;
  }).join(' ');

  const ePath = km.map((kx, i) => {
    const val = elev[i];
    if (val == null) return '';
    const prefix = (i === 0 || elev[i-1] == null) ? 'M' : 'L';
    return `${prefix} ${x(kx).toFixed(1)} ${yE(val).toFixed(1)}`;
  }).join(' ');

  let hPath = "";
  if (hVals.length > 0) {
    hPath = km.map((kx, i) => {
        const val = hr[i];
        if (val == null) return '';
        const prefix = (i === 0 || hr[i-1] == null) ? 'M' : 'L';
        return `${prefix} ${x(kx).toFixed(1)} ${yH(val).toFixed(1)}`;
    }).join(' ');
  }

  return (
    <svg width={w} height={h} role="img" style={{ display: 'block', margin: '0 auto' }}>
      <rect x={0} y={0} width={w} height={h} fill="#fff" stroke="#e5e7eb" rx={8} />
      
      {/* Wysokość - szary przerywany */}
      {eVals.length > 0 && <path d={ePath} stroke="#9ca3af" strokeDasharray="4 3" strokeWidth="1" fill="none" />}
      
      {/* Tempo - niebieski */}
      {pVals.length > 0 && <path d={pPath} stroke="#2563eb" strokeWidth="2" fill="none" />}
      
      {/* Tętno - czerwony (jeśli jest) */}
      {hVals.length > 0 && <path d={hPath} stroke="#dc2626" strokeWidth="1.5" fill="none" opacity="0.8" />}

      {/* Legenda */}
      <g transform={`translate(${pad}, 16)`}>
        <text x={0} y={0} fontSize={12} fill="#2563eb" fontWeight="600">tempo</text>
        {eVals.length > 0 && <text x={50} y={0} fontSize={12} fill="#6b7280">wysokość</text>}
        {hVals.length > 0 && <text x={120} y={0} fontSize={12} fill="#dc2626" fontWeight="600">tętno</text>}
      </g>
    </svg>
  );
}

function parseAiNote(raw) {
  if (!raw || typeof raw !== 'string') return null;

  const sections = {
    summary: [],
    good: [],
    improve: [],
    anthropo: [],
    bmi: [],
  };

  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let current = null;

  for (const line of lines) {
    if (line.startsWith('Podsumowanie:')) {
      current = 'summary';
      continue;
    }
    if (line.startsWith('Co poszło dobrze:')) {
      current = 'good';
      continue;
    }
    if (line.startsWith('Na co zwrócić uwagę:')) {
      current = 'improve';
      continue;
    }
    if (line.startsWith('Wskazówki antropometryczne:')) {
      current = 'anthropo';
      continue;
    }

    if (line.startsWith('- ')) {
      const text = line.slice(2).trim();
      if (current && text) {
        sections[current].push(text);
      }
      // also capture BMI bullet-like lines if no current section
      else if (/^(Wynik BMI:|Prawidłowa waga|Brakuje|Masz około|Jesteś w normie|Rekomendacja:)/.test(text)) {
        sections.bmi.push(text);
      }
    }
  }

  // Additionally capture standalone BMI lines (not prefixed with '-')
  const bmiLines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean).filter(l => /^(Wynik BMI:|Prawidłowa waga|Brakuje|Masz około|Jesteś w normie|Rekomendacja:)/.test(l));
  for (const bl of bmiLines) {
    if (!sections.bmi.includes(bl)) sections.bmi.push(bl);
  }

  return sections;
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

  const trackPts = (data?.analysis?.track) || [];
  const center = (() => {
    if (trackPts.length) return [trackPts[0].lat, trackPts[0].lon];
    return [52.2297, 21.0122]; // Warsaw fallback
  })();

  function FitRouteBounds({ points }) {
    const map = useMap();
    useEffect(() => {
      if (!points || points.length === 0) return;
      let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
      for (const p of points) {
        if (typeof p.lat !== 'number' || typeof p.lon !== 'number') continue;
        if (p.lat < minLat) minLat = p.lat;
        if (p.lat > maxLat) maxLat = p.lat;
        if (p.lon < minLng) minLng = p.lon;
        if (p.lon > maxLng) maxLng = p.lon;
      }
      if (minLat === 90 || minLng === 180) return;
      const bounds = [[minLat, minLng], [maxLat, maxLng]];
      try {
        const verySmall = (Math.abs(maxLat - minLat) < 0.0005) && (Math.abs(maxLng - minLng) < 0.0005);
        if (verySmall) {
          const cLat = (minLat + maxLat) / 2;
          const cLng = (minLng + maxLng) / 2;
          map.setView([cLat, cLng], 15);
        } else {
          map.fitBounds(bounds, { padding: [24, 24] });
        }
      } catch (_) {
        // ignore
      }
    }, [points, map]);
    return null;
  }

  const polylines = (() => {
    const pts = trackPts;
    const lines = [];
    if (!pts || pts.length < 2) return lines;

    // Collect per-segment pace values (skip nulls)
    const pvals = [];
    for (let i = 1; i < pts.length; i++) {
      const b = pts[i];
      const pace = b.pace_s;
      if (pace != null && isFinite(pace) && pace > 0) pvals.push(pace);
    }

    // Determine min/max for normalization using robust percentiles (5%..95%) to
    // avoid a few outliers collapsing the whole gradient to one color.
    let minP = null;
    let maxP = null;
    if (pvals.length) {
      const sorted = [...pvals].sort((a,b) => a - b);
      const n = sorted.length;
      const loIdx = Math.floor(n * 0.05);
      const hiIdx = Math.max(0, Math.ceil(n * 0.95) - 1);
      minP = sorted[loIdx];
      maxP = sorted[hiIdx];
      // if percentiles are equal (very little spread), fall back to full min/max
      if (minP === maxP) {
        minP = sorted[0];
        maxP = sorted[n-1];
      }
      // add small padding to expand visible range
      const range = maxP - minP || Math.max(1, Math.abs(minP) * 0.1);
      minP = minP - 0.12 * range;
      maxP = maxP + 0.12 * range;
    }

    // Map pace (s/km) to color: slower -> green (hue ~120), faster -> red (hue ~0)
    function paceToColor(p) {
      if (p == null || !isFinite(p)) return '#9ca3af';
      if (minP == null || maxP == null || minP === maxP) {
        // fallback buckets (older behavior)
        if (p > 420) return '#ef4444';
        if (p > 360) return '#f59e0b';
        return '#16a34a';
      }
      // Normalize into 0..1 where 0 -> fastest, 1 -> slowest (so hue grows toward green)
      let nrm = (p - minP) / (maxP - minP);
      if (!isFinite(nrm)) nrm = 0.5;
      if (nrm < 0) nrm = 0;
      if (nrm > 1) nrm = 1;
      // Use a slight easing so mid-range maps to yellow (more visible)
      const eased = Math.pow(nrm, 0.9);
      const hue = eased * 120; // 0 = red, 120 = green
      return `hsl(${Math.round(hue)}, 78%, 45%)`;
    }

    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const pace = b.pace_s || null;
      const color = paceToColor(pace);
      lines.push({ positions: [[a.lat, a.lon], [b.lat, b.lon]], color });
    }
    return lines;
  })();

  const splits = (data?.analysis?.splits) || [];
  const chart = data?.analysis?.chart || { km: [], pace_s: [], elev: [], hr: [] };

  let phaseInfo = null;
  if (splits.length >= 3) {
    const third = Math.max(1, Math.floor(splits.length / 3));

    const meanPace = (arr) => {
      const vals = arr
        .map((s) => s.pace_s)
        .filter((v) => v != null && isFinite(v));
      if (!vals.length) return null;
      const sum = vals.reduce((a, b) => a + b, 0);
      return sum / vals.length;
    };

    const beginPace = meanPace(splits.slice(0, third));
    const middlePace = meanPace(splits.slice(third, 2 * third));
    const endPace = meanPace(splits.slice(2 * third));

    let conclusion = '';
    if (beginPace && endPace) {
      const diff = endPace - beginPace;
      if (diff > 10) {
        conclusion =
          'Końcówka była wyraźnie wolniejsza niż początek – spróbuj zaczynać minimalnie wolniej, żeby utrzymać równe tempo do końca.';
      } else if (diff < -10) {
        conclusion =
          'Druga część biegu była szybsza niż początek (negative split) – bardzo dobra dystrybucja sił.';
      } else {
        conclusion =
          'Tempo na początku i na końcu było bardzo podobne – bieg równy pod względem intensywności.';
      }
    }

    phaseInfo = { beginPace, middlePace, endPace, conclusion };
  }

  const adidasMeta = data?.adidas_meta || {};
  const weather = adidasMeta.weather || null;
  const steps = adidasMeta.steps || null;

  const avgCadence =
    (data?.analysis?.summary?.avg_cadence_spm != null
      ? data.analysis.summary.avg_cadence_spm
      : (steps?.average_step_rate_spm != null
        ? steps.average_step_rate_spm
        : null));
  
  const avgHr = data?.analysis?.summary?.avg_hr_bpm;

  const aiSections = useMemo(
    () => (data?.ai_note ? parseAiNote(data.ai_note) : null),
    [data?.ai_note]
  );
  
  // Parse BMI number (if present) and derive status for UI colorization
  const bmiInfo = useMemo(() => {
    if (!aiSections || !aiSections.bmi || aiSections.bmi.length === 0) return { value: null, status: null };
    let val = null;
    for (const line of aiSections.bmi) {
      const m = line.match(/(\d{1,2}(?:\.\d+)?)/);
      if (m) { val = parseFloat(m[1]); break; }
    }
    const status = (v => {
      if (v == null || !isFinite(v)) return null;
      if (v < 18.5) return 'under';
      if (v < 25.0) return 'normal';
      if (v < 30.0) return 'over';
      return 'obese';
    })(val);
    return { value: val, status };
  }, [aiSections]);
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
              <div style={{ minWidth: 260 }}>
                <div><strong>Trening:</strong> {data.title}</div>
                <div><strong>Data:</strong> {data.performed_at ? new Date(data.performed_at).toLocaleString('pl-PL') : '-'}</div>
                {weather && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.9em', color: '#4b5563' }}>
                    <strong>Pogoda:</strong>{' '}
                    {weather.conditions || 'brak danych'}
                    {weather.temperature_c != null && (
                      <> , {Number(weather.temperature_c).toFixed(1)}°C</>
                    )}
                    {weather.humidity_percent != null && (
                      <> , wilgotność {Math.round(weather.humidity_percent)}%</>
                    )}
                    {weather.wind_speed_ms != null && (
                      <> , wiatr {Number(weather.wind_speed_ms).toFixed(1)} m/s</>
                    )}
                  </div>
                )}
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
                <div><strong>Śr. kadencja:</strong> {avgCadence != null ? Math.round(avgCadence) + ' spm' : '-'}</div>
                {avgHr != null && (
                  <div style={{fontWeight: 600}}><strong>Śr. tętno:</strong> {Math.round(avgHr)} bpm</div>
                )}
              </div>
            </div>
          </div>

          {(steps || adidasMeta.dehydration_volume_ml || adidasMeta.device) && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem' }}>
              <h4 style={{ marginTop: 0 }}>Statystyki z Adidas JSON</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  {steps && (
                    <>
                      <div><strong>Liczba kroków:</strong> {steps.total_steps != null ? steps.total_steps.toLocaleString?.('pl-PL') ?? steps.total_steps : '-'}</div>
                      <div><strong>Śr. kadencja (Adidas):</strong> {steps.average_step_rate_spm != null ? `${steps.average_step_rate_spm} spm` : '-'}</div>
                      <div><strong>Maks. kadencja:</strong> {steps.max_step_rate_spm != null ? `${steps.max_step_rate_spm} spm` : '-'}</div>
                      <div>
                        <strong>Śr. długość kroku:</strong>{' '}
                        {steps.average_step_length_cm != null
                          ? `${(Number(steps.average_step_length_cm) / 100).toFixed(2)} m`
                          : '-'}
                      </div>
                    </>
                  )}
                </div>
                <div>
                  {adidasMeta.dehydration_volume_ml != null && (
                    <div><strong>Szacowana utrata płynów:</strong> ~{Math.round(adidasMeta.dehydration_volume_ml)} ml</div>
                  )}
                  {adidasMeta.duration_ms != null && (
                    <div><strong>Czas wg Adidas:</strong> {fmtTime(adidasMeta.duration_ms / 1000)}</div>
                  )}
                  {adidasMeta.device && (
                    <div style={{ marginTop: '0.4rem', fontSize: '0.9em', color: '#4b5563' }}>
                      <strong>Urządzenie:</strong>{' '}
                      {[adidasMeta.device.name, adidasMeta.device.vendor, adidasMeta.device.os_version]
                        .filter(Boolean)
                        .join(' · ') || 'brak danych'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ margin: '0 0 8px 0' }}>Mapa trasy (pace)</h4>
            <div style={{ height: 420, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              <MapContainer key={workoutId} center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <FitRouteBounds points={trackPts} />
                {polylines.map((ln, idx) => (
                  <Polyline key={idx} positions={ln.positions} pathOptions={{ color: ln.color, weight: 4 }} />
                ))}
              </MapContainer>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ margin: '0 0 8px 0' }}>Wykres tempa, wysokości i tętna</h4>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', padding: '10px 0' }}>
              <PaceElevationChart km={chart.km} pace={chart.pace_s} elev={chart.elev} hr={chart.hr} />
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
                    {(data.analysis?.pace_extremes?.fastest || []).slice(0, 5).map((it, i) => (
                      <li key={i}>{fmtPace(it.pace_s)}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <strong>Najwolniejsze odcinki (~200 m)</strong>
                  <ul>
                    {(data.analysis?.pace_extremes?.slowest || []).slice(0, 5).map((it, i) => (
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
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: 6 }}>tętno (śr.)</th>
                  </tr>
                </thead>
                <tbody>
                  {splits.map((s) => (
                    <tr key={s.km}>
                      <td style={{ padding: 6 }}>{s.km}</td>
                      <td style={{ padding: 6 }}>{fmtPace(s.pace_s)}</td>
                      <td style={{ padding: 6 }}>{s.elev_gain_m != null ? `${Math.round(s.elev_gain_m)} m` : '-'}</td>
                      <td style={{ padding: 6, color: s.hr_bpm ? '#dc2626' : 'inherit' }}>
                        {s.hr_bpm ? Math.round(s.hr_bpm) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem' }}>
              <h4 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Analiza AI</h4>

              {!aiSections ? (
                <p style={{ marginBottom: 0 }}>
                  {data?.ai_note || 'Brak wniosków.'}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {/* BMI card (parsed from AI note) */}
                        {aiSections.bmi && aiSections.bmi.length > 0 && (
                          (() => {
                            const status = bmiInfo.status;
                            let styleOuter = { borderRadius: 6, padding: '0.5rem 0.75rem' };
                            let titleStyle = { fontSize: '0.9em', fontWeight: 700, marginBottom: 6 };
                            let listStyle = { paddingLeft: '1.1rem', margin: 0, fontSize: '0.9em' };
                            if (status === 'normal') {
                              styleOuter = { ...styleOuter, background: '#ecfdf5', border: '1px solid #bbf7d0' };
                              titleStyle = { ...titleStyle, color: '#166534' };
                              listStyle = { ...listStyle, color: '#166534' };
                            } else if (status === 'under') {
                              styleOuter = { ...styleOuter, background: '#eff6ff', border: '1px solid #bfdbfe' };
                              titleStyle = { ...titleStyle, color: '#1d4ed8' };
                              listStyle = { ...listStyle, color: '#1d4ed8' };
                            } else if (status === 'over') {
                              styleOuter = { ...styleOuter, background: '#fff7ed', border: '1px solid #facc15' };
                              titleStyle = { ...titleStyle, color: '#92400e' };
                              listStyle = { ...listStyle, color: '#92400e' };
                            } else if (status === 'obese') {
                              styleOuter = { ...styleOuter, background: '#fee2e2', border: '1px solid #fecaca' };
                              titleStyle = { ...titleStyle, color: '#7f1d1d' };
                              listStyle = { ...listStyle, color: '#7f1d1d' };
                            } else {
                              styleOuter = { ...styleOuter, background: '#fff7ed', border: '1px solid #facc15' };
                              titleStyle = { ...titleStyle, color: '#92400e' };
                              listStyle = { ...listStyle, color: '#92400e' };
                            }

                            return (
                              <div style={styleOuter}>
                                <div style={titleStyle}>BMI</div>
                                <ul style={listStyle}>
                                  {aiSections.bmi.map((t, i) => (
                                    <li key={i}>{t}</li>
                                  ))}
                                </ul>
                              </div>
                            );
                          })()
                        )}
                  {aiSections.summary.length > 0 && (
                    <div
                      style={{
                        borderRadius: 6,
                        padding: '0.5rem 0.75rem',
                        background: '#f9fafb',
                        border: '1px solid #e5e7eb',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.8em',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          color: '#6b7280',
                          marginBottom: 4,
                        }}
                      >
                        Podsumowanie
                      </div>
                      <ul style={{ paddingLeft: '1.1rem', margin: 0, fontSize: '0.9em' }}>
                        {aiSections.summary.map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {aiSections.good.length > 0 && (
                    <div
                      style={{
                        borderRadius: 6,
                        padding: '0.5rem 0.75rem',
                        background: '#ecfdf5',
                        border: '1px solid #bbf7d0',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          marginBottom: 4,
                        }}
                      >
                        <span style={{ fontSize: 18 }}>✅</span>
                        <span style={{ fontSize: '0.9em', fontWeight: 600, color: '#166534' }}>
                          Co poszło dobrze
                        </span>
                      </div>
                      <ul
                        style={{
                          paddingLeft: '1.1rem',
                          margin: 0,
                          fontSize: '0.9em',
                          color: '#166534',
                        }}
                      >
                        {aiSections.good.map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {aiSections.improve.length > 0 && (
                    <div
                      style={{
                        borderRadius: 6,
                        padding: '0.5rem 0.75rem',
                        background: '#fefce8',
                        border: '1px solid #facc15',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          marginBottom: 4,
                        }}
                      >
                        <span style={{ fontSize: 18 }}>⚠️</span>
                        <span style={{ fontSize: '0.9em', fontWeight: 600, color: '#92400e' }}>
                          Na co zwrócić uwagę
                        </span>
                      </div>
                      <ul
                        style={{
                          paddingLeft: '1.1rem',
                          margin: 0,
                          fontSize: '0.9em',
                          color: '#92400e',
                        }}
                      >
                        {aiSections.improve.map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {aiSections.anthropo.length > 0 && (
                    <div
                      style={{
                        borderRadius: 6,
                        padding: '0.5rem 0.75rem',
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.9em',
                          fontWeight: 600,
                          color: '#1d4ed8',
                          marginBottom: 4,
                        }}
                      >
                        Wskazówki antropometryczne
                      </div>
                      <ul
                        style={{
                          paddingLeft: '1.1rem',
                          margin: 0,
                          fontSize: '0.9em',
                          color: '#1d4ed8',
                        }}
                      >
                        {aiSections.anthropo.map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem' }}>
              <h4 style={{ marginTop: 0 }}>Fazy biegu (technika)</h4>

              {phaseInfo ? (
                <>
                  <ul>
                    <li>
                      <strong>Początek:</strong> tempo {fmtPace(phaseInfo.beginPace)}
                    </li>
                    <li>
                      <strong>Środek:</strong> tempo {fmtPace(phaseInfo.middlePace)}
                    </li>
                    <li>
                      <strong>Koniec:</strong> tempo {fmtPace(phaseInfo.endPace)}
                    </li>
                  </ul>
                  {phaseInfo.conclusion && (
                    <p style={{ marginBottom: 0 }}>{phaseInfo.conclusion}</p>
                  )}
                </>
              ) : (
                <p style={{ marginBottom: 0 }}>Za mało danych, aby podzielić bieg na fazy.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}