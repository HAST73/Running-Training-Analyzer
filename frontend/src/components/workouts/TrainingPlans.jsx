import React, { useState, useEffect } from 'react';

export default function TrainingPlans({ session, refreshSession }) {
  const [selected, setSelected] = useState(null);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const proUnlocked = !!session?.pro_unlocked;
  const [justUnlocked, setJustUnlocked] = useState(false);
  
  // Stan personalizacji
  const [customizing, setCustomizing] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [workoutsLoading, setWorkoutsLoading] = useState(false);
  const [selectedWorkouts, setSelectedWorkouts] = useState([]);
  
  // Parametry generatora
  const [targetImprovement, setTargetImprovement] = useState(10); // %
  const [targetDistance, setTargetDistance] = useState(10); // km (domyślnie 10)
  
  const [generatedPlan, setGeneratedPlan] = useState(null);

  useEffect(() => {
    const hash = window.location.hash || '';
    if (hash.startsWith('#plans') && hash.includes('success=1')) {
      const paramsPart = hash.split('?')[1] || '';
      const searchParams = new URLSearchParams(paramsPart);
      const sessionId = searchParams.get('session_id');
      if (sessionId) {
        (async () => {
          try {
            const res = await fetch(`http://127.0.0.1:8000/api/payments/confirm/?session_id=${encodeURIComponent(sessionId)}`, {
              credentials: 'include'
            });
            const data = await res.json();
            if (data.status === 'paid') {
              refreshSession && refreshSession();
              setJustUnlocked(true);
            }
          } catch (e) {
            // silent fail
          }
        })();
      }
    }
  }, [refreshSession]);

  const plans = [
    {
      id: 'walk2run',
      name: 'Od chodu do biegu',
      level: 'Początkujący',
      durationWeeks: 8,
      goal: 'Na koniec planu przebiegniesz 5 km bez większego zmęczenia.',
      short: 'Stopniowe przejście z marszu do swobodnego biegu w ciągu ~8 tygodni.',
      description: `Plan "Od chodu do biegu" jest przeznaczony dla osób, które dopiero zaczynają swoją przygodę z bieganiem.
Cele główne:
 - Budowa nawyku regularnej aktywności
 - Wzmocnienie układu ruchu (stawy, ścięgna, mięśnie)
 - Stopniowe zwiększanie czasu biegu i skracanie przerw w marszu`,
    },
    {
      id: 'beg3k',
      name: 'Początkujący – pierwsze 3 km',
      level: 'Początkujący',
      durationWeeks: 6,
      goal: 'Swobodnie przebiec 3 km bez zatrzymania.',
      short: 'Idealny pierwszy plan, jeśli 5 km brzmi jeszcze groźnie.',
      description: `Plan dla osób, które chcą spokojnie wejść w bieganie i celem jest pierwsze 3 km biegu bez przerwy.`,
    },
    {
      id: 'beg5k',
      name: 'Początkujący – pierwsze 5 km',
      level: 'Początkujący',
      durationWeeks: 8,
      goal: 'Pierwsze 5 km biegu bez przerwy w tempie komfortowym.',
      short: 'Plan dla osób, które potrafią już truchtać kilka minut, ale chcą dowieźć pełne 5 km.',
      description: `Plan zakłada, że jesteś w stanie potruchtać 5–7 minut ciurkiem. Celem jest pełne 5 km bez zatrzymywania.`,
    },
    {
      id: 'adv10k',
      name: 'Zaawansowany – 10 km szybciej',
      level: 'Średniozaawansowany / zaawansowany',
      durationWeeks: 8,
      goal: 'Poprawić wynik na 10 km (czas / tempo).',
      short: 'Plan dla osób, które już biegają regularnie 8–10 km, ale chcą przyspieszyć.',
      description: `Ten plan zakłada, że 10 km to dla Ciebie normalny dystans treningowy. Celem jest poprawa tempa.`,
    },
    {
      id: 'first_hm',
      name: 'Pierwszy półmaraton',
      level: 'Średniozaawansowany',
      durationWeeks: 10,
      goal: 'Bezpiecznie ukończyć półmaraton (21.1 km) bez długich przerw w marszu.',
      short: 'Plan dla osób, które biegają już komfortowo 8–10 km.',
      description: `Celem planu jest pierwsze podejście do półmaratonu bez ciśnienia na wynik.`,
    },
    {
      id: 'first_marathon',
      name: 'Pierwszy maraton',
      level: 'Średniozaawansowany / zaawansowany',
      durationWeeks: 16,
      goal: 'Ukończyć maraton w zdrowiu, z kontrolą tempa.',
      short: 'Plan dla osób z doświadczeniem w półmaratonie, cel: pierwszy maraton bez „ściany”.',
      description: `Plan zakłada, że masz za sobą co najmniej jeden półmaraton lub regularne biegi 18–20 km.`,
    },
    {
      id: 'stamina',
      name: 'Bieg dla lepszej kondycji (stamina)',
      level: 'Początkujący / średniozaawansowany',
      durationWeeks: 8,
      goal: 'Poprawić wydolność i „rozruszać się” bez zajechania organizmu.',
      short: 'Plan pod ogólną kondycję – dużo spokojnego biegania, bez wyżyłowanych akcentów.',
      description: `Adaptacyjny plan poprawy ogólnej kondycji.`,
    },
  ];

  const beginnerPlans = plans.filter((p) => p.level.toLowerCase().includes('początkujący') && p.id !== 'stamina');
  const staminaPlans = plans.filter((p) => p.id === 'stamina');
  const advancedPlans = plans.filter(
    (p) => !p.level.toLowerCase().includes('początkujący') && p.id !== 'stamina'
  );

  const onSelect = (p) => {
    if (p.id === 'stamina') {
      setCustomizing(p);
      setSelected(null);
      if (proUnlocked && workouts.length === 0) {
        loadWorkouts();
      }
      setTimeout(() => {
        const el = document.getElementById('customizing-panel');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    } else {
      setSelected(p);
      setCustomizing(null);
    }
  };

  const loadWorkouts = async () => {
    setWorkoutsLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/workouts/', { credentials: 'include' });
      const data = await res.json();
      const items = Array.isArray(data.workouts) ? data.workouts.slice(0, 30) : [];
      setWorkouts(items);
    } catch (e) {
      setWorkouts([]);
    } finally {
      setWorkoutsLoading(false);
    }
  };

  const toggleWorkout = (w) => {
    if (selectedWorkouts.find(x => x.id === w.id)) {
      setSelectedWorkouts(selectedWorkouts.filter(x => x.id !== w.id));
    } else {
      if (selectedWorkouts.length >= 5) return;
      setSelectedWorkouts([...selectedWorkouts, w]);
    }
  };

  // NAPRAWA BŁĘDU 5:60
  const formatPace = (secPerKm) => {
    if (!isFinite(secPerKm) || secPerKm <= 0) return '-';
    let m = Math.floor(secPerKm / 60);
    let s = Math.round(secPerKm % 60);
    
    // Zabezpieczenie przed 60s
    if (s === 60) {
        m += 1;
        s = 0;
    }
    return `${m}:${s.toString().padStart(2,'0')} min/km`;
  };

  const generatePlan = () => {
    if (!customizing || selectedWorkouts.length === 0) return;
    
    // Obliczanie bazy
    let totalDistM = 0, totalDurMs = 0;
    selectedWorkouts.forEach(w => {
      if (w.distance_m && w.duration_ms) {
        totalDistM += w.distance_m;
        totalDurMs += w.duration_ms;
      }
    });
    if (totalDistM === 0 || totalDurMs === 0) return;
    const baselinePaceSec = (totalDurMs / 1000) / (totalDistM / 1000); // sec/km

    const improvementFrac = targetImprovement / 100;
    const targetPaceSec = baselinePaceSec * (1 - improvementFrac);
    
    const weeks = [];
    for (let w = 1; w <= 8; w++) {
      const r = w / 8; 
      
      // -- TRENING 1: EASY RUN --
      // Progresja dystansu: 60% -> 110% celu
      const startDistFactor = 0.6;
      const endDistFactor = 1.1; 
      const currentDistFactor = startDistFactor + (endDistFactor - startDistFactor) * r;
      
      const easyPaceSec = baselinePaceSec * (1 - improvementFrac * r * 0.3);
      const easyDist = Math.max(3, Math.round(targetDistance * currentDistFactor));
      
      const easyText = `${easyDist} km (tempo: ${formatPace(easyPaceSec)})`;

      // -- TRENING 2: TEMPO PROGRESSION --
      const tempoDist = Math.max(3, Math.round(targetDistance * (0.5 + 0.5 * r)));
      const tempoSplits = [];
      
      const startPace = baselinePaceSec + 10; 
      const endPace = baselinePaceSec * (1 - improvementFrac * 0.9);
      const step = (startPace - endPace) / Math.max(1, tempoDist - 1);

      for (let k = 1; k <= tempoDist; k++) {
         const currentKmPace = startPace - (step * (k - 1));
         tempoSplits.push(`${k}. km: ${formatPace(currentKmPace)}`);
      }

      // -- TRENING 3: INTERVALS --
      const maxReps = Math.max(3, Math.round(targetDistance / 1.5));
      const currentReps = Math.max(3, Math.round(maxReps * (0.5 + 0.5 * r)));
      
      const intervalPaceSec = baselinePaceSec * (1 - improvementFrac * 1.1);
      const intervalsText = `${currentReps}x 1km w tempie ${formatPace(intervalPaceSec)} (p. 3min)`;

      weeks.push({ 
          week: w, 
          easy_run: easyText, 
          tempo_run_splits: tempoSplits, 
          intervals: intervalsText 
      });
    }

    setGeneratedPlan({
      baselinePace: formatPace(baselinePaceSec),
      targetPace: formatPace(targetPaceSec),
      targetDistance: targetDistance,
      weeks,
    });
  };

  const beginCheckout = async () => {
    setLoadingCheckout(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/payments/create-checkout-session/', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('Nie udało się utworzyć sesji płatności.');
      }
    } catch (e) {
      alert('Błąd sieci podczas tworzenia sesji płatności');
    } finally {
      setLoadingCheckout(false);
    }
  };

  const onStart = () => {
    if (!proUnlocked) {
      alert('Najpierw odblokuj dostęp (PRO).');
      return;
    }
    alert('Plan treningowy został oznaczony jako rozpoczęty (placeholder).');
  };

  const cardStyle = {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '16px',
    boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
    color: '#1e293b',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between'
  };

  const colHeaderStyle = {
    color: '#ffffff',
    textShadow: '0 2px 4px rgba(0,0,0,0.6)',
    marginBottom: '10px',
    marginTop: 0,
    textAlign: 'center'
  };

  return (
    <div className={"plans-page-wrapper" + (proUnlocked ? '' : ' locked') }>
      <div className="plans-inner" style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '2rem', color: '#ffffff', textShadow: '0 2px 4px rgba(0,0,0,0.6)' }}>Plany treningowe</h2>
        
        {!selected && !customizing && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', alignItems: 'flex-start' }}>
              <div>
                <h3 style={colHeaderStyle}>Dla początkujących</h3>
                {beginnerPlans.map((p) => (
                  <div key={p.id} style={cardStyle}>
                    <div>
                        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>{p.name}</h4>
                        <p style={{ margin: '0 0 0.8rem 0', fontSize: '0.9rem', color: '#475569', lineHeight: 1.4 }}>{p.short}</p>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            <span><strong>Poziom:</strong> {p.level}</span><br/>
                            <span><strong>Czas:</strong> ~{p.durationWeeks} tyg.</span>
                        </div>
                    </div>
                    <div style={{ marginTop: '1rem' }}>
                      <button className="btn-primary" onClick={() => onSelect(p)} disabled={!proUnlocked} style={{ width: '100%', padding: '8px' }}>Zobacz szczegóły</button>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <h3 style={colHeaderStyle}>Dla średnio / zaawansowanych</h3>
                {advancedPlans.map((p) => (
                  <div key={p.id} style={cardStyle}>
                    <div>
                        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>{p.name}</h4>
                        <p style={{ margin: '0 0 0.8rem 0', fontSize: '0.9rem', color: '#475569', lineHeight: 1.4 }}>{p.short}</p>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            <span><strong>Poziom:</strong> {p.level}</span><br/>
                            <span><strong>Czas:</strong> ~{p.durationWeeks} tyg.</span>
                        </div>
                    </div>
                    <div style={{ marginTop: '1rem' }}>
                      <button className="btn-primary" onClick={() => onSelect(p)} disabled={!proUnlocked} style={{ width: '100%', padding: '8px' }}>Zobacz szczegóły</button>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <h3 style={colHeaderStyle}>Bieg dla lepszej kondycji</h3>
                {staminaPlans.map((p) => (
                  <div key={p.id} style={cardStyle}>
                    <div>
                        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>{p.name}</h4>
                        <p style={{ margin: '0 0 0.8rem 0', fontSize: '0.9rem', color: '#475569', lineHeight: 1.4 }}>{p.short}</p>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            <span><strong>Poziom:</strong> {p.level}</span><br/>
                            <span><strong>Czas:</strong> ~{p.durationWeeks} tyg.</span>
                        </div>
                    </div>
                    <div style={{ marginTop: '1rem' }}>
                      <button className="btn-primary" onClick={() => onSelect(p)} disabled={!proUnlocked} style={{ width: '100%', padding: '8px' }}>Dostosuj plan</button>
                    </div>
                  </div>
                ))}
              </div>
          </div>
        )}

        {selected && !customizing && (
          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', color: '#0f172a', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <button onClick={() => setSelected(null)} style={{ float: 'right', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>Powrót</button>
            <h3 style={{ marginTop: 0 }}>{selected.name}</h3>
            <p style={{ whiteSpace: 'pre-line', fontSize: '0.95rem', lineHeight: 1.6, color: '#334155' }}>{selected.description}</p>
            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <button disabled={!proUnlocked} onClick={onStart} className="btn-primary" style={{ padding: '10px 20px', fontSize: '1rem', opacity: proUnlocked ? 1 : 0.6 }}>Kontynuuj / rozpocznij</button>
            </div>
          </div>
        )}
      </div>

      {!proUnlocked && (
        <div className="plans-lock-overlay">
          <div className="plans-lock-modal">
            <h3>Treść zablokowana (PRO)</h3>
            <p>Aby uzyskać dostęp do planów treningowych wykup dostęp PRO.</p>
            <div className="plans-lock-actions">
              <button className="btn-pro-unlock" onClick={beginCheckout} disabled={loadingCheckout}>Odblokuj PRO (59 zł)</button>
              <button className="btn-pro-cancel" onClick={() => { window.location.hash = '#home'; }}>Powrót</button>
            </div>
          </div>
        </div>
      )}

      {/* --- PANEL PERSONALIZACJI STAMINA --- */}
      {proUnlocked && customizing && (
        <div id="customizing-panel" style={{ marginTop: '1rem', maxWidth: 980, marginLeft: 'auto', marginRight: 'auto' }}>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.5rem', boxShadow: '0 4px 18px rgba(0,0,0,0.08)', color: '#0f172a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Personalizacja: {customizing.name}</h3>
              <button onClick={() => { setCustomizing(null); setGeneratedPlan(null); setSelectedWorkouts([]); }} style={{ background: '#f1f5f9', color: '#475569', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer' }}>Zamknij</button>
            </div>
            
            <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#334155' }}>
              Ten panel ułoży plan "km po km" na podstawie Twoich możliwości.
            </p>
            <hr style={{ margin: '1rem 0', borderColor: '#e2e8f0' }} />
            
            <h4 style={{ margin: '0 0 0.5rem 0' }}>Krok 1: Wybierz treningi bazowe (do analizy tempa)</h4>
            {workoutsLoading && <p>Ładowanie treningów...</p>}
            {!workoutsLoading && workouts.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: '10px' }}>
                {workouts.map(w => {
                  const checked = !!selectedWorkouts.find(x => x.id === w.id);
                  const distKm = w.distance_m ? (w.distance_m/1000).toFixed(2) : '-';
                  const paceSec = (w.distance_m && w.duration_ms) ? (w.duration_ms/1000)/(w.distance_m/1000) : null;
                  return (
                    <label key={w.id} style={{ border: '1px solid ' + (checked ? '#2563eb' : '#e2e8f0'), borderRadius: 8, padding: '10px', fontSize: '0.8rem', cursor: 'pointer', background: checked ? '#eff6ff' : '#ffffff', color: '#1e293b' }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleWorkout(w)} style={{ marginRight: 6 }} />
                      <strong style={{ display: 'block' }}>{w.title}</strong>
                      <span>Dyst: {distKm} km | Pace: {paceSec ? formatPace(paceSec) : '-'}</span>
                    </label>
                  );
                })}
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '30px', marginTop: '20px' }}>
                <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 0.5rem' }}>Krok 2: Cel poprawy tempa (%)</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <input type="range" min={0} max={20} value={targetImprovement} onChange={e => setTargetImprovement(parseInt(e.target.value))} style={{ width: '100%' }} />
                    <span style={{ fontWeight: 'bold' }}>{targetImprovement}%</span>
                    </div>
                </div>
                <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 0.5rem' }}>Krok 3: Dystans docelowy (km)</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <input type="range" min={3} max={42} step={1} value={targetDistance} onChange={e => setTargetDistance(parseInt(e.target.value))} style={{ width: '100%' }} />
                    <span style={{ fontWeight: 'bold' }}>{targetDistance} km</span>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '20px', textAlign: 'center' }}>
                <button className="btn-primary" onClick={generatePlan} disabled={selectedWorkouts.length === 0} style={{ padding: '10px 30px' }}>Generuj szczegółowy plan</button>
            </div>

            {generatedPlan && (
              <div style={{ marginTop: '2rem', background: '#f8fafc', padding: '20px', borderRadius: 12 }}>
                <h4 style={{ margin: '0 0 5px 0', fontSize: '1.2rem' }}>Twój Plan na {generatedPlan.targetDistance} km</h4>

                {/* --- NOWA INSTRUKCJA DLA UŻYTKOWNIKA --- */}
                <p style={{ fontSize: '0.9rem', color: '#15803d', fontWeight: 600, margin: '0 0 15px 0' }}>
                   Plan zakłada 3 treningi w tygodniu. Rozłóż je na osobne dni (np. Wtorek, Czwartek, Sobota).
                </p>

                <p style={{ fontSize: '0.9rem', marginBottom: '15px' }}>Bazowe tempo (z historii): <strong>{generatedPlan.baselinePace}</strong></p>
                
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', color: '#334155' }}>
                    <thead>
                      <tr style={{ background: '#cbd5e1', color: '#1e293b' }}>
                        <th style={{ textAlign: 'left', padding: '10px' }}>Tydzień</th>
                        
                        {/* --- ZMIENIONE NAGŁÓWKI TABELI --- */}
                        <th style={{ textAlign: 'left', padding: '10px' }}>
                            Trening 1<br/>
                            <span style={{ fontWeight: 'normal', fontSize: '0.75rem' }}>Easy Run</span>
                        </th>
                        <th style={{ textAlign: 'left', padding: '10px' }}>
                            Trening 2<br/>
                            <span style={{ fontWeight: 'normal', fontSize: '0.75rem' }}>Bieg narastający</span>
                        </th>
                        <th style={{ textAlign: 'left', padding: '10px' }}>
                            Trening 3<br/>
                            <span style={{ fontWeight: 'normal', fontSize: '0.75rem' }}>Interwały</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {generatedPlan.weeks.map(w => (
                        <tr key={w.week} style={{ borderTop: '1px solid #e2e8f0', background: '#ffffff', verticalAlign: 'top' }}>
                          <td style={{ padding: '10px', fontWeight: 'bold' }}>{w.week}</td>
                          <td style={{ padding: '10px' }}>
                             {w.easy_run} <br/>
                             <span style={{ fontSize: '0.75rem', color: '#64748b' }}>(spokojnie, tlenowo)</span>
                          </td>
                          <td style={{ padding: '10px' }}>
                             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '0.8rem' }}>
                                {w.tempo_run_splits.map((split, i) => (
                                    <div key={i} style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>{split}</div>
                                ))}
                             </div>
                          </td>
                          <td style={{ padding: '10px' }}>{w.intervals}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}