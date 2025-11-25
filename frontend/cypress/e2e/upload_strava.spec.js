describe('Strava .fit import flow (.fit -> GPX -> HR)', () => {
  it('uploads a .fit as Strava run, attaches GPX and HR, and verifies UI matches the screenshot', () => {
    // --- PRZYGOTOWANIE ŚRODOWISKA ---
    
    // 1. Mock sesji (zalogowany użytkownik)
    cy.intercept('GET', '/api/session/', { statusCode: 200, body: { authenticated: true } }).as('getSession');
    
    // 2. Mock początkowy: Pusta lista treningów (zanim cokolwiek wgramy)
    cy.intercept('GET', '/api/workouts/', { statusCode: 200, body: { workouts: [] } }).as('getWorkoutsEmpty');

    // 3. Dane testowe (zgodne z Twoim zrzutem: 4.11.2021)
    const stravaTimestamp = new Date('2021-11-04T18:17:58').getTime();
    
    const baseWorkout = {
      id: 234,
      source: 'strava',
      title: 'Strava 11.8 km',
      created_at: new Date(stravaTimestamp).toISOString(),
      performed_at: new Date(stravaTimestamp).toISOString(),
      distance_m: 11800, // 11.80 km
      duration_ms: 4548000, // 1h 15m 48s
      manual: false,
      raw_data: {} // Pusty obiekt, żeby frontend się nie wywalił
    };

    // Odwiedzamy stronę i czekamy na załadowanie pustej listy
    cy.visit('/#workouts');
    cy.wait('@getSession');
    cy.wait('@getWorkoutsEmpty');

    // --- KROK 1: UPLOAD .FIT ---
    
    // Definiujemy mocki ODPOWIEDZI, które przyjdą PO uploadzie
    cy.intercept('POST', '/api/workouts/upload/', { statusCode: 200, body: baseWorkout }).as('postFit');
    
    // Ważne: Nadpisujemy intercept GET, żeby po odświeżeniu listy zwrócił już nasz trening
    cy.intercept('GET', '/api/workouts/', { statusCode: 200, body: { workouts: [baseWorkout] } }).as('getWorkoutsAfterFit');

    // Wybieramy plik (symulacja uploadu)
    cy.get('#workout-upload-strava, #workout-upload-adidas').then(($el) => {
      const sel = $el.length ? '#workout-upload-strava' : '#workout-upload-adidas';
      cy.get(sel).selectFile('cypress/fixtures/Evening_Run.fit', { force: true });
    });

    // Czekamy na zakończenie requestów
    cy.wait('@postFit');
    cy.wait('@getWorkoutsAfterFit');

    // Weryfikacja UI (czy trening pojawił się na liście)
    // Szukamy sekcji Strava i sprawdzamy czy zawiera nasz dystans
    const distanceStr = (baseWorkout.distance_m / 1000).toFixed(1) + ' km';
    cy.contains('h3', 'Lista treningów Strava')
      .parent()
      .should('contain', distanceStr);

    // --- KROK 2: DOŁĄCZANIE GPX ---
    
    const workoutWithGpx = { ...baseWorkout, gpx_file: true, manual: true };
    
    cy.intercept('POST', '/api/workouts/234/gpx/', { statusCode: 200, body: { ok: true } }).as('postGpx');
    cy.intercept('GET', '/api/workouts/', { statusCode: 200, body: { workouts: [workoutWithGpx] } }).as('getWorkoutsAfterGpx');

    // Znajdujemy input dla GPX wewnątrz naszego kafelka z treningiem
    cy.contains('li', distanceStr)
      .find('input[type="file"][accept*="gpx"]')
      .selectFile('cypress/fixtures/Evening_Run.gpx', { force: true });

    cy.wait('@postGpx');
    cy.wait('@getWorkoutsAfterGpx');
    
    // Weryfikacja komunikatów o GPX
    cy.contains('Dołączono plik GPX do treningu.').should('be.visible');
    cy.contains('(ręcznie dodany)').should('be.visible');

    // --- KROK 3: DOŁĄCZANIE HR i WERYFIKACJA KOŃCOWA ---
    
    cy.fixture('synthetic_hr_data_final.json').then((hrSamples) => {
      // Statystyki zgodne z Twoim zdjęciem (Śr 148)
      const hrStats = { 
        count: hrSamples.length, 
        avg: 148.0, 
        min: 100, 
        max: 174 
      };
      
      const finalWorkout = { ...workoutWithGpx, hr_stats: hrStats };
      
      cy.intercept('POST', '/api/workouts/234/attach_hr/', { statusCode: 200, body: { hr_stats: hrStats } }).as('postHr');
      
      // Mock listy po dodaniu HR (zielone statystyki)
      cy.intercept('GET', '/api/workouts/', { statusCode: 200, body: { workouts: [finalWorkout] } }).as('getWorkoutsAfterHr');
      
      // Mock widoku analizy (dla kroku 4)
      cy.intercept('GET', '/api/workouts/234/analysis/', { 
         statusCode: 200, 
         body: { 
           workout: finalWorkout, 
           trackpoints: [], 
           hr_samples: hrSamples, 
           laps: [] 
         } 
      }).as('getAnalysisStrava');

      // Upload pliku HR: znajdź list item po dystansie i użyj jego inputu
      cy.contains('li', distanceStr)
        .find('input[type="file"][accept*="application/json"]')
        .selectFile('cypress/fixtures/synthetic_hr_data_final.json', { force: true });

      // Weryfikacja tekstów i kolorów (zielony tekst sukcesu)
      // Wait for attach_hr POST to complete
      cy.wait('@postHr');

      // Weryfikacja tekstów i kolorów (zielony tekst sukcesu)
      cy.contains(`Plik HR dołączony – ${hrStats.count} próbek`)
        .should('be.visible')
        .and('have.css', 'color', 'rgb(22, 163, 74)'); // #16a34a
        
      cy.contains('Śr 148 / min 100 / max 174').should('be.visible');

      // --- KROK 4: WEJŚCIE W SZCZEGÓŁY ---
      cy.contains('Szczegóły biegu').click();
      cy.wait('@getAnalysisStrava');
      
      // Sprawdzenie URL
      cy.url().should('include', 'id=234');
      
      // Powrót do listy
      cy.go('back');
      cy.wait('@getWorkoutsAfterHr');
      
      // Upewnienie się, że stan na liście jest zachowany
      cy.contains(`Plik HR dołączony – ${hrStats.count} próbek`).should('be.visible');
    });
  });
});