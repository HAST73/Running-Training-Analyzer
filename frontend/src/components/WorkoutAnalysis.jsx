import WorkoutAnalysis from './workouts/WorkoutAnalysis';

export default WorkoutAnalysis;

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

function parseAiNote(raw) {
  if (!raw || typeof raw !== 'string') return null;

  const sections = {
    summary: [],
    good: [],
    improve: [],
    anthropo: [],
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
    }
  }

  return sections;
}


