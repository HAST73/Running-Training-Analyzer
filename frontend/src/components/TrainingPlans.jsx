import React, { useState, useEffect } from 'react';

// Prosty komponent listy planów treningowych.
// Na razie jeden plan: "Od chodu do biegu" – cel: przebiegnięcie 5 km bez zatrzymania.
export default function TrainingPlans({ session, refreshSession }) {
  const [selected, setSelected] = useState(null);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const proUnlocked = !!session?.pro_unlocked;
  const [justUnlocked, setJustUnlocked] = useState(false);
  const [customizing, setCustomizing] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [workoutsLoading, setWorkoutsLoading] = useState(false);
  const [selectedWorkouts, setSelectedWorkouts] = useState([]);
  const [targetImprovement, setTargetImprovement] = useState(8);
  const [generatedPlan, setGeneratedPlan] = useState(null);

  // Detect success parameters after returning from Stripe Checkout
  useEffect(() => {
    const hash = window.location.hash || '';
    if (hash.startsWith('#plans') && hash.includes('success=1')) {
      const paramsPart = hash.split('?')[1] || '';
      const searchParams = new URLSearchParams(paramsPart);
      const sessionId = searchParams.get('session_id');
      if (sessionId) {
        // Confirm session without webhook
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
 - Stopniowe zwiększanie czasu biegu i skracanie przerw w marszu

Struktura przykładowych tygodni:
 Tydzień 1–2: Interwały marsz 2 min / bieg spokojny 1 min (powtórzenia 6–8x)
 Tydzień 3–4: Marsz 1.5 min / bieg 1.5 min (8–10x)
 Tydzień 5–6: Marsz 1 min / bieg 2–3 min (6–8x)
 Tydzień 7: Bieg ciągły ~15–20 min + lekkie interwały.
 Tydzień 8: Bieg ciągły 25–30 min – docelowe 5 km.

Wskazówki:
 - Trenuj 3 razy w tygodniu (np. pon, śr, sob)
 - Jeśli czujesz zbyt duże zmęczenie – powtórz tydzień zamiast przyspieszać.
 - Dni wolne możesz uzupełniać spacerem lub lekkim rozciąganiem.

Do końca tego planu będziesz mógł swobodnie przebiec 5 km bez przystanków.`,
    },
    {
      id: 'beg3k',
      name: 'Początkujący – pierwsze 3 km',
      level: 'Początkujący',
      durationWeeks: 6,
      goal: 'Swobodnie przebiec 3 km bez zatrzymywania.',
      short: 'Idealny pierwszy plan, jeśli 5 km brzmi jeszcze groźnie.',
      description: `Plan dla osób, które chcą spokojnie wejść w bieganie i celem jest pierwsze 3 km biegu bez przerwy.

Struktura:
 Tydzień 1–2: Marsz 3 min / bieg 1 min (6–8x)
 Tydzień 3–4: Marsz 2 min / bieg 2 min (6–8x)
 Tydzień 5: Marsz 1 min / bieg 3 min (6–7x)
 Tydzień 6: Bieg ciągły 18–20 min (~3 km)

Wskazówki:
 - 3 treningi w tygodniu.
 - Jeśli oddech wymyka się spod kontroli – przejdź na marsz i wróć do biegu, gdy się uspokoi.
 - Nie ciśnij tempa – ma być „komfortowa rozmowa”.`,
    },
    {
      id: 'beg5k',
      name: 'Początkujący – pierwsze 5 km',
      level: 'Początkujący',
      durationWeeks: 8,
      goal: 'Pierwsze 5 km biegu bez przerwy w tempie komfortowym.',
      short: 'Plan dla osób, które potrafią już truchtać kilka minut, ale chcą dowieźć pełne 5 km.',
      description: `Plan zakłada, że jesteś w stanie potruchtać 5–7 minut ciurkiem. Celem jest pełne 5 km bez zatrzymywania.

Struktura:
 Tydzień 1–2: Bieg 3–4 min / marsz 1–2 min (5–7x)
 Tydzień 3–4: Bieg 6–8 min / marsz 1–2 min (4–5x)
 Tydzień 5–6: Bieg ciągły 15–20 min + krótkie przerwy
 Tydzień 7–8: Bieg ciągły 25–30 min (~5 km)

Wskazówki:
 - 3–4 treningi tygodniowo, jeden z nich bardzo spokojny.
 - Lepiej dołożyć minutę biegu niż przyspieszać tempo.
 - Gdy dzień jest „słabszy”, zrób lżejszą wersję zamiast skipować cały trening.`,
    },
    {
      id: 'adv10k',
      name: 'Zaawansowany – 10 km szybciej',
      level: 'Średniozaawansowany / zaawansowany',
      durationWeeks: 8,
      goal: 'Poprawić wynik na 10 km (czas / tempo).',
      short: 'Plan dla osób, które już biegają regularnie 8–10 km, ale chcą przyspieszyć.',
      description: `Ten plan zakłada, że 10 km to dla Ciebie normalny dystans treningowy. Celem jest poprawa tempa.

Struktura tygodnia:
 - 1 trening tempowy (np. 4–6 × 1 km w tempie startowym 10 km)
 - 1 bieg spokojny 6–8 km
 - 1 dłuższy bieg 10–14 km w luźnym tempie
 - Opcjonalnie 1 trening siły biegowej (podbiegi, skipy)

Wskazówki:
 - Zachowaj minimum 1 dzień pełnego odpoczynku.
 - Trening tempowy rób po rozgrzewce 10–15 min truchtu i zakończ schłodzeniem.
 - Jeżeli czujesz narastające zmęczenie – odejmij 1 serię z odcinków tempowych.`,
    },
    {
      id: 'first_hm',
      name: 'Pierwszy półmaraton',
      level: 'Średniozaawansowany',
      durationWeeks: 10,
      goal: 'Bezpiecznie ukończyć półmaraton (21.1 km) bez długich przerw w marszu.',
      short: 'Plan dla osób, które biegają już komfortowo 8–10 km.',
      description: `Celem planu jest pierwsze podejście do półmaratonu bez ciśnienia na wynik.

Założenia startowe:
 - Biegasz 3–4 razy w tygodniu.
 - Dłuższy bieg 8–10 km nie stanowi problemu.

Struktura:
 - 2 biegi spokojne 6–10 km
 - 1 bieg „jakościowy” (np. tempo progowe, krótkie interwały)
 - 1 dłuższy bieg w weekend: od 12 km do 18–20 km w szczycie planu

Wskazówki:
 - Ostatni tydzień przed startem jest łagodniejszy (tzw. tapering).
 - Kluczowy jest długi bieg – nie rób go za szybko.
 - Dbaj o nawadnianie i lekkie śniadania przed długimi wybieganiami.`,
    },
    {
      id: 'first_marathon',
      name: 'Pierwszy maraton',
      level: 'Średniozaawansowany / zaawansowany',
      durationWeeks: 16,
      goal: 'Ukończyć maraton w zdrowiu, z kontrolą tempa.',
      short: 'Plan dla osób z doświadczeniem w półmaratonie, cel: pierwszy maraton bez „ściany”.',
      description: `Plan zakłada, że masz za sobą co najmniej jeden półmaraton lub regularne biegi 18–20 km.

Struktura tygodnia:
 - 2–3 biegi spokojne (6–12 km)
 - 1 trening jakościowy (tempo, interwały lub podbiegi)
 - 1 długi bieg (od 18 km stopniowo do 30–32 km)

Wskazówki:
 - Nie każdy długi bieg musi być bardzo szybki – klucz to objętość i ekonomia.
 - Wprowadzaj testowo żele / przekąski na długich biegach.
 - Na 2 tygodnie przed maratonem mocno zmniejszamy kilometraż.`,
    },
    {
      id: 'fatburn',
      name: 'Bieg na spalanie kalorii',
      level: 'Początkujący / średniozaawansowany',
      durationWeeks: 6,
      goal: 'Zwiększyć dzienny wydatek energetyczny i poprawić sylwetkę.',
      short: 'Krótkie, częste biegi w spokojnej intensywności – idealne pod redukcję.',
      description: `Plan skupia się na regularności, a nie na rekordach. Treningi są krótkie, ale częste.

Struktura:
 - 4–5 treningów w tygodniu po 25–40 min
 - Większość w bardzo spokojnym tempie (tzw. strefa „konwersacyjna”)
 - 1 trening z krótkimi przebieżkami 6–8 × 20–30 s dla pobudzenia metabolizmu

Wskazówki:
 - Najważniejsza jest sumaryczna aktywność tygodniowa.
 - Łącz bieganie z lekkim deficytem kalorycznym, ale nie głodówką.
 - Słabszy dzień? Zrób choć 15–20 min truchtu zamiast rezygnować całkowicie.`,
    },
    {
      id: 'stamina',
      name: 'Bieg dla lepszej kondycji (stamina)',
      level: 'Początkujący / średniozaawansowany',
      durationWeeks: 8,
      goal: 'Poprawić wydolność i „rozruszać się” bez zajechania organizmu.',
      short: 'Plan pod ogólną kondycję – dużo spokojnego biegania, bez wyżyłowanych akcentów.',
      description: `Adaptacyjny plan poprawy ogólnej kondycji.

    Zamiast sztywnej tabelki – bazujemy na Twoich wcześniejszych treningach, wyliczamy realne bazowe tempo i budujemy 8‑tygodniową progresję Easy / Tempo / Interwały kadencji.

    Główne założenia:
     - 3–4 biegi tygodniowo, większość bardzo spokojna (regeneracyjna strefa rozmowy)
     - 1 akcent jakościowy (Tempo lub Interwały kadencji dla techniki kroku)
     - Stopniowe, umiarkowane zwiększanie bodźca – bez „katowania” organizmu

    Personalizacja daje Ci:
     - Bazowe tempo wyliczone z historii (unikamy zgadywania)
     - Docelowe tempo po zadanej poprawie (%)
     - Szacowaną długość kroku z wzrostu – kontekst dla ekonomii biegu
     - Tygodniową listę akcentów z tempami dopasowanymi do progresji

    Jak korzystać:
     1. Wybierz do 5 swoich reprezentatywnych treningów.
     2. Ustaw realistyczny % poprawy (np. 5–12%).
     3. Wygeneruj plan i potraktuj tempa jako kierunkowe widełki, nie sztywny nakaz.

    Wskazówki:
     - Jeśli dzień jest ciężki – bieg Easy skróć lub zwolnij zamiast pomijać.
     - Interwały kadencji wykonuj na pełnym luzie, dbając o rytm i długość kroku.
     - Postęp oceniaj po odczuciach i spadku zmęczenia, tempo przyjdzie samo.`,
    },
  ];

    // <<< DODAJ TO >>>
  const beginnerPlans = plans.filter((p) => p.level.toLowerCase().includes('początkujący')
  );

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
      // Auto-scroll do panelu personalizacji
      setTimeout(() => {
        const el = document.getElementById('customizing-panel');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
      console.log('[Personalizacja] Otwarto panel stamina');
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

  const formatPace = (secPerKm) => {
    if (!isFinite(secPerKm) || secPerKm <= 0) return '-';
    const m = Math.floor(secPerKm / 60);
    const s = Math.round(secPerKm % 60);
    return `${m}:${s.toString().padStart(2,'0')} min/km`;
  };

  const generatePlan = () => {
    if (!customizing || selectedWorkouts.length === 0) return;
    let totalDistM = 0, totalDurMs = 0;
    selectedWorkouts.forEach(w => {
      if (w.distance_m && w.duration_ms) {
        totalDistM += w.distance_m;
        totalDurMs += w.duration_ms;
      }
    });
    if (totalDistM === 0 || totalDurMs === 0) return;
    const baselinePaceSec = (totalDurMs / 1000) / (totalDistM / 1000);
    const improvementFrac = targetImprovement / 100;
    const targetPaceSec = baselinePaceSec * (1 - improvementFrac);
    const heightCm = session?.height_cm;
    const weightKg = session?.weight_kg;
    const strideLenM = heightCm ? (heightCm * 0.415) / 100.0 : null;
    const weeks = [];
    for (let w = 1; w <= 8; w++) {
      const r = w / 8;
      const easy = baselinePaceSec * (1 - improvementFrac * r * 0.35);
      const tempo = baselinePaceSec * (1 - improvementFrac * r * 0.7);
      const intervals = baselinePaceSec * (1 - improvementFrac * r * 0.9);
      weeks.push({ week: w, easy_run: formatPace(easy), tempo_run: formatPace(tempo), cadence_intervals: formatPace(intervals) });
    }
    setGeneratedPlan({
      baselinePace: formatPace(baselinePaceSec),
      targetPace: formatPace(targetPaceSec),
      strideLenM: strideLenM ? strideLenM.toFixed(2) : null,
      weightKg: weightKg || null,
      weeks,
      selectedIds: selectedWorkouts.map(w => w.id)
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
        window.location.href = data.url; // redirect to Stripe hosted page
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

  return (
    <div className={"plans-page-wrapper" + (proUnlocked ? '' : ' locked') }>
      <div className="plans-inner" style={{ maxWidth: 880, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>Plany treningowe</h2>
        {!selected && !customizing && (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: '1.2rem',
                alignItems: 'flex-start',
              }}
            >
              {/* KOLUMNA 1 – POCZĄTKUJĄCY */}
              <div>
                <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Dla początkujących</h3>
                {beginnerPlans.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      padding: '0.9rem',
                      marginBottom: '0.8rem',
                    }}
                  >
                    <h4 style={{ margin: '0 0 0.4rem 0' }}>{p.name}</h4>
                    <p
                      style={{
                        margin: '0 0 0.4rem 0',
                        fontSize: '0.9rem',
                        color: '#374151',
                      }}
                    >
                      {p.short}
                    </p>
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.75rem',
                        flexWrap: 'wrap',
                        fontSize: '0.8rem',
                        color: '#4b5563',
                      }}
                    >
                      <span>
                        <strong>Poziom:</strong> {p.level}
                      </span>
                      <span>
                        <strong>Czas trwania:</strong> ~{p.durationWeeks} tyg.
                      </span>
                      <span>
                        <strong>Cel:</strong> {p.goal}
                      </span>
                    </div>
                    <div style={{ marginTop: '0.7rem' }}>
                      <button onClick={() => onSelect(p)} disabled={!proUnlocked}>Zobacz szczegóły</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* KOLUMNA 2 – ŚREDNIO / ZAAWANSOWANI */}
              <div>
                <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>
                  Dla średnio / zaawansowanych
                </h3>
                {advancedPlans.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      padding: '0.9rem',
                      marginBottom: '0.8rem',
                    }}
                  >
                    <h4 style={{ margin: '0 0 0.4rem 0' }}>{p.name}</h4>
                    <p
                      style={{
                        margin: '0 0 0.4rem 0',
                        fontSize: '0.9rem',
                        color: '#374151',
                      }}
                    >
                      {p.short}
                    </p>
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.75rem',
                        flexWrap: 'wrap',
                        fontSize: '0.8rem',
                        color: '#4b5563',
                      }}
                    >
                      <span>
                        <strong>Poziom:</strong> {p.level}
                      </span>
                      <span>
                        <strong>Czas trwania:</strong> ~{p.durationWeeks} tyg.
                      </span>
                      <span>
                        <strong>Cel:</strong> {p.goal}
                      </span>
                    </div>
                    <div style={{ marginTop: '0.7rem' }}>
                      <button onClick={() => onSelect(p)} disabled={!proUnlocked}>Zobacz szczegóły</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* KOLUMNA 3 – BIEG DLA LEPSZEJ KONDYCJI */}
              <div>
                <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>
                  Bieg dla lepszej kondycji
                </h3>
                {staminaPlans.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      padding: '0.9rem',
                      marginBottom: '0.8rem',
                    }}
                  >
                    <h4 style={{ margin: '0 0 0.4rem 0' }}>{p.name}</h4>
                    <p
                      style={{
                        margin: '0 0 0.4rem 0',
                        fontSize: '0.9rem',
                        color: '#374151',
                      }}
                    >
                      {p.short}
                    </p>
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.75rem',
                        flexWrap: 'wrap',
                        fontSize: '0.8rem',
                        color: '#4b5563',
                      }}
                    >
                      <span>
                        <strong>Poziom:</strong> {p.level}
                      </span>
                      <span>
                        <strong>Czas trwania:</strong> ~{p.durationWeeks} tyg.
                      </span>
                      <span>
                        <strong>Cel:</strong> {p.goal}
                      </span>
                    </div>
                    <div style={{ marginTop: '0.7rem' }}>
                      <button onClick={() => onSelect(p)} disabled={!proUnlocked}>{p.id === 'stamina' ? 'Dostosuj plan' : 'Dostosuj plan'}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {proUnlocked && justUnlocked && (
              <div
                style={{
                  marginTop: '0.8rem',
                  border: '1px solid #10b981',
                  background: '#ecfdf5',
                  padding: '0.8rem',
                  borderRadius: 8,
                  fontSize: '0.85rem',
                }}
              >
                Dostęp PRO został aktywowany! Miłego korzystania z planów.
              </div>
            )}
          </>
        )}


        {selected && !customizing && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
            <button onClick={() => setSelected(null)} style={{ float: 'right' }}>Powrót</button>
            <h3 style={{ marginTop: 0 }}>{selected.name}</h3>
            <p style={{ whiteSpace: 'pre-line', fontSize: '0.9rem', lineHeight: 1.4 }}>{selected.description}</p>
            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <button disabled={!proUnlocked} onClick={onStart} style={{ padding: '0.6rem 1.2rem', opacity: proUnlocked ? 1 : 0.6 }}>
                Kontynuuj / rozpocznij plan treningowy
              </button>
            </div>
          </div>
        )}
      </div>
      {!proUnlocked && (
        <div className="plans-lock-overlay">
          <div className="plans-lock-modal">
            <h3>Treść zablokowana (PRO)</h3>
            <p>Aby uzyskać dostęp do planów treningowych wykup dostęp PRO. Po opłaceniu strona odblokuje się automatycznie.</p>
            <div className="plans-lock-actions">
              <button className="btn-pro-unlock" onClick={beginCheckout} disabled={loadingCheckout}>
                {loadingCheckout ? 'Tworzenie płatności...' : 'Odblokuj PRO'}
              </button>
              <button className="btn-pro-cancel" onClick={() => { window.location.hash = '#home'; }}>Powrót</button>
            </div>
          </div>
        </div>
      )}
      {proUnlocked && customizing && (
        <div id="customizing-panel" style={{ marginTop: '1rem', maxWidth: 980, marginLeft: 'auto', marginRight: 'auto' }}>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.2rem 1.4rem', boxShadow: '0 4px 18px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Personalizacja: {customizing.name}</h3>
              <button onClick={() => { setCustomizing(null); setGeneratedPlan(null); setSelectedWorkouts([]); }} style={{ background: '#e2e8f0', color: '#0f172a', border: 'none', padding: '0.45rem 0.8rem', borderRadius: 6 }}>Zamknij</button>
            </div>
            <p style={{ marginTop: '0.6rem', fontSize: '0.85rem', lineHeight: 1.45, color: '#334155', whiteSpace: 'pre-line' }}>Ten panel bierze Twoje realne biegi i wylicza bazowe tempo oraz docelowe tempa dla kolejnych tygodni. Dzięki temu progresja jest osadzona w Twojej aktualnej formie, a nie w oderwanych tabelkach.

Kroki:
 1. Zaznacz do 5 reprezentatywnych treningów (różne długości / tempa).
 2. Ustaw procent oczekiwanej poprawy w 8 tygodniach.
 3. Kliknij Generuj – zobaczysz tempa Easy, Tempo i Interwały kadencji.

Możesz modyfikować wybór i % żeby zobaczyć różne scenariusze. Traktuj wynik jako kierunkowe widełki, nie sztywne limity.</p>
            <hr style={{ margin: '1rem 0' }} />
            <h4 style={{ margin: '0 0 0.4rem 0' }}>Krok 1: Wybierz treningi bazowe</h4>
            {workoutsLoading && <p>Ładowanie treningów...</p>}
            {!workoutsLoading && workouts.length === 0 && <p>Brak treningów do analizy.</p>}
            {!workoutsLoading && workouts.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: '0.6rem' }}>
                {workouts.map(w => {
                  const checked = !!selectedWorkouts.find(x => x.id === w.id);
                  const distKm = w.distance_m ? (w.distance_m/1000).toFixed(2) : '-';
                  const paceSec = (w.distance_m && w.duration_ms) ? (w.duration_ms/1000)/(w.distance_m/1000) : null;
                  return (
                    <label key={w.id} style={{ border: '1px solid ' + (checked ? '#2563eb' : '#e2e8f0'), borderRadius: 8, padding: '0.55rem 0.65rem', fontSize: '0.75rem', cursor: 'pointer', background: checked ? '#eff6ff' : '#ffffff' }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleWorkout(w)} style={{ marginRight: 6 }} />
                      <strong style={{ display: 'block', fontSize: '0.78rem' }}>{w.title}</strong>
                      <span>Dystans: {distKm} km</span><br />
                      <span>Pace: {paceSec ? formatPace(paceSec) : '-'}</span>
                    </label>
                  );
                })}
              </div>
            )}
            <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.35rem' }}>Wybrane: {selectedWorkouts.length} / 5</p>
            <h4 style={{ margin: '1rem 0 0.4rem' }}>Krok 2: Cel poprawy tempa (%)</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input type="range" min={0} max={20} value={targetImprovement} onChange={e => setTargetImprovement(parseInt(e.target.value))} />
              <span style={{ fontSize: '0.85rem' }}>{targetImprovement}%</span>
              <button onClick={generatePlan} disabled={selectedWorkouts.length === 0} style={{ padding: '0.5rem 1rem' }}>Generuj plan</button>
            </div>
            {generatedPlan && (
              <div style={{ marginTop: '1.2rem' }}>
                <h4 style={{ margin: '0 0 0.6rem 0' }}>Wynik personalizacji</h4>
                <p style={{ fontSize: '0.8rem', margin: '0 0 0.4rem 0' }}>Bazowe tempo: <strong>{generatedPlan.baselinePace}</strong> | Docelowe: <strong>{generatedPlan.targetPace}</strong></p>
                {generatedPlan.strideLenM && (
                  <p style={{ fontSize: '0.75rem', margin: '0 0 0.4rem 0', color: '#475569' }}>Szacowana długość kroku: {generatedPlan.strideLenM} m {generatedPlan.weightKg ? `| Masa: ${generatedPlan.weightKg} kg` : ''}</p>
                )}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9' }}>
                        <th style={{ textAlign: 'left', padding: '0.4rem' }}>Tydzień</th>
                        <th style={{ textAlign: 'left', padding: '0.4rem' }}>Easy Run</th>
                        <th style={{ textAlign: 'left', padding: '0.4rem' }}>Tempo Progression</th>
                        <th style={{ textAlign: 'left', padding: '0.4rem' }}>Cadence Intervals</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generatedPlan.weeks.map(w => (
                        <tr key={w.week} style={{ borderTop: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '0.35rem 0.4rem' }}>{w.week}</td>
                          <td style={{ padding: '0.35rem 0.4rem' }}>{w.easy_run}</td>
                          <td style={{ padding: '0.35rem 0.4rem' }}>{w.tempo_run}</td>
                          <td style={{ padding: '0.35rem 0.4rem' }}>{w.cadence_intervals}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.5rem' }}>Easy Run ≈ 60–70% docelowej intensywności; Interwały kadencji wspierają wydłużenie kroku przy zachowaniu rytmu.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
