import React, { useState, useEffect } from 'react';

// Prosty komponent listy planów treningowych.
// Na razie jeden plan: "Od chodu do biegu" – cel: przebiegnięcie 5 km bez zatrzymania.
export default function TrainingPlans({ session, refreshSession }) {
  const [selected, setSelected] = useState(null);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const proUnlocked = !!session?.pro_unlocked;
  const [justUnlocked, setJustUnlocked] = useState(false);

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
  ];

  const onSelect = (p) => {
    setSelected(p);
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
        {!selected && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {plans.map((p) => (
              <div key={p.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.9rem' }}>
                <h3 style={{ margin: '0 0 0.4rem 0' }}>{p.name}</h3>
                <p style={{ margin: '0 0 0.4rem 0', fontSize: '0.9rem', color: '#374151' }}>{p.short}</p>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8rem', color: '#4b5563' }}>
                  <span><strong>Poziom:</strong> {p.level}</span>
                  <span><strong>Czas trwania:</strong> ~{p.durationWeeks} tyg.</span>
                  <span><strong>Cel:</strong> 5 km ciągłego biegu</span>
                </div>
                <div style={{ marginTop: '0.7rem' }}>
                  <button onClick={() => onSelect(p)} disabled={!proUnlocked}>Zobacz szczegóły</button>
                </div>
              </div>
            ))}
            {proUnlocked && justUnlocked && (
              <div style={{ border: '1px solid #10b981', background: '#ecfdf5', padding: '0.8rem', borderRadius: 8, fontSize: '0.85rem' }}>
                Dostęp PRO został aktywowany! Miłego korzystania z planów.
              </div>
            )}
          </div>
        )}
        {selected && (
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
    </div>
  );
}
