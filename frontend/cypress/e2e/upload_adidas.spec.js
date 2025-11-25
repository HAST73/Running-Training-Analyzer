describe('Adidas full import flow (JSON -> GPX -> HR)', () => {
  it('imports Adidas JSON, attaches GPX and HR, and handles navigation correctly', () => {
    // 1. Setup sesji
    cy.intercept('GET', '/api/session/', { statusCode: 200, body: { authenticated: true } }).as('getSession');
    cy.visit('/#workouts');
    cy.wait('@getSession');

    const adidasTimestamp = 1712943376000;
    
    // BAZOWY obiekt treningu - będziemy go modyfikować w kolejnych krokach
    const baseWorkout = {
      id: 123,
      source: 'adidas',
      created_at: new Date(adidasTimestamp).toISOString(),
      performed_at: new Date(adidasTimestamp).toISOString(),
      distance_m: 15261,
      // Domyślnie brak gpx_file i hr_stats
    };

    // --- KROK 1: IMPORT ADIDAS JSON ---

    // Mock: Upload JSON
    cy.intercept('POST', '/api/workouts/upload/', (req) => {
      req.reply({ statusCode: 200, body: baseWorkout });
    }).as('postAdidas');

    // Mock: Lista treningów (wersja 1: sam trening)
    cy.intercept('GET', '/api/workouts/', (req) => {
      req.reply({ statusCode: 200, body: { workouts: [baseWorkout] } });
    }).as('getWorkoutsStep1');

    // Akcja: Upload pliku
    cy.get('#workout-upload-adidas').selectFile('cypress/fixtures/2024-04-12_basic_file.json', { force: true });
    cy.wait('@postAdidas');
    cy.wait('@getWorkoutsStep1'); // Czekamy na odświeżenie listy
    cy.contains('Zaimportowano trening z Adidas Running (.json).').should('be.visible');

    // --- KROK 2: DOŁĄCZANIE GPX ---

    // Mock: Upload GPX
    cy.intercept('POST', '/api/workouts/123/gpx/', { statusCode: 200, body: { ok: true } }).as('postGpx');

    // Mock: Lista treningów (wersja 2: trening + flaga GPX)
    // WAŻNE: Nadpisujemy poprzedni intercept, żeby frontend widział zmianę po odświeżeniu
    cy.intercept('GET', '/api/workouts/', (req) => {
      req.reply({
        statusCode: 200,
        body: {
          workouts: [{ ...baseWorkout, gpx_file: true, manual: true }]
        },
      });
    }).as('getWorkoutsStep2');

    // Akcja: Wybór pliku GPX
    cy.get('h3').contains('Lista treningów Adidas').parent().within(() => {
      cy.get('input[type="file"][accept*="gpx"]').first().selectFile('cypress/fixtures/2024-04-12_gps_file.gpx', { force: true });
    });
    cy.wait('@postGpx');
    cy.wait('@getWorkoutsStep2');
    cy.contains('Dołączono plik GPX do treningu.').should('be.visible');
      // Verify GPX status text and the manual flag is shown as in the UI
      cy.contains('GPX dołączony – można wygenerować widok trasy').should('be.visible');
      cy.contains('(ręcznie dodany)').should('be.visible');

    // --- KROK 3: DOŁĄCZANIE HR ---

    // We'll load the authoritative HR fixture, compute stats from samples,
    // then register the POST/GET intercepts that reply with those computed stats.
    let expectedWorkoutsAlias = 'getWorkoutsStep3';
    let expectedAnalysisAlias = 'getAnalysis';
    let expectedCountText = '';
    let expectedStatsText = '';

    cy.fixture('2024-04-12_HR_file.json').then((hrSamples) => {
      // Compute HR statistics from samples
      const hrValues = hrSamples.filter(s => s.heart_rate != null).map(s => Number(s.heart_rate));
      const count = hrValues.length;
      const avg = count ? hrValues.reduce((a, b) => a + b, 0) / count : 0;
      const min = count ? Math.min(...hrValues) : 0;
      const max = count ? Math.max(...hrValues) : 0;
      const avgRounded = Math.round(avg * 10) / 10; // one decimal place like 169.4
      const hrStats = { count, avg: avgRounded, min, max };

      expectedCountText = `Plik HR dołączony – ${hrStats.count} próbek`;
      expectedStatsText = `Śr ${hrStats.avg} / min ${hrStats.min} / max ${hrStats.max}`;

      // Mock: Upload HR -> return computed hr_stats
      cy.intercept('POST', '/api/workouts/123/attach_hr/', {
        statusCode: 200,
        body: { hr_stats: hrStats },
      }).as('postHr');

      // Mock: Lista treningów (wersja 3: trening + GPX + HR)
      cy.intercept('GET', '/api/workouts/', (req) => {
        req.reply({
          statusCode: 200,
          body: {
            workouts: [{
              ...baseWorkout,
              gpx_file: true,
              manual: true,
              hr_stats: hrStats
            }]
          }
        });
      }).as(expectedWorkoutsAlias);

      // Mock: Endpoint analizy - include hr_samples so details view can render stats
      cy.intercept('GET', '/api/workouts/123/analysis/', {
        statusCode: 200,
        body: {
          workout: { ...baseWorkout, gpx_file: true, manual: true, hr_stats: hrStats },
          trackpoints: [],
          hr_samples: hrSamples,
          laps: []
        }
      }).as(expectedAnalysisAlias);

      // Akcja: Wybór pliku HR (inside same then so intercepts are registered)
      cy.get('h3').contains('Lista treningów Adidas').parent().within(() => {
        cy.get('input[type="file"][accept*="application/json"]').first().selectFile('cypress/fixtures/2024-04-12_HR_file.json', { force: true });
      });

      // Wait for upload and assert UI updated with computed values
      cy.wait('@postHr');
      cy.contains('Dołączono dane tętna.').should('be.visible');
      cy.contains(expectedCountText).should('be.visible');
      cy.contains(expectedStatsText).should('be.visible');
    });

    // Akcja: Wejście w szczegóły
    cy.get('h3').contains('Lista treningów Adidas').parent().within(() => {
      cy.contains('Szczegóły biegu').click();
    });

    // Asercja: Czy zmieniono URL
    cy.window().its('location.hash').should('include', 'analysis?id=123');

    // Asercja: Czy faktycznie pobrano dane analizy (to potwierdza, że widok działa)
    cy.wait('@getAnalysis');

    // --- KROK 5: POWRÓT DO LISTY (TEST ZACHOWANIA STANU) ---
    
    // Akcja: Kliknij "Wstecz" w przeglądarce lub przycisk powrotu w aplikacji
    // Zakładam tutaj nawigację przeglądarką dla przykładu:
    cy.go('back');

    // Ponowne sprawdzenie listy - tutaj zadziała 'getWorkoutsStep3', więc HR powinien być widoczny
    cy.wait('@getWorkoutsStep3');
    // Use the computed expected text if available, else fall back to a generic check
    if (expectedCountText) {
      cy.contains(expectedCountText).should('be.visible');
    } else {
      cy.contains('Plik HR dołączony').should('be.visible');
    }
  });
});