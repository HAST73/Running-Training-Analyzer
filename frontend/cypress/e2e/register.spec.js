describe('User registration flow', () => {
  it('allows a new user to register (including metrics), passes validation, and auto-logs in', () => {
    // --- 1. Przygotowanie mocków (Intercepts) ---

    // A. Sesja początkowa (niezalogowany)
    cy.intercept('GET', '/api/session/', { 
      statusCode: 200, 
      body: { authenticated: false } 
    }).as('getSession');

    // B. Walidacja username/email (odblokowanie przycisku)
    cy.intercept('GET', '/api/check_username/*', { statusCode: 200, body: { available: true } }).as('checkUsername');
    cy.intercept('GET', '/api/check_email/*', { statusCode: 200, body: { available: true } }).as('checkEmail');

    // C. Mock rejestracji (Dane użytkownika)
    const newUser = {
      id: 999,
      username: 'testuser',
      email: 'testuser@example.com',
      height_cm: 180,
      weight_kg: 75.5
    };

    cy.intercept('POST', '/api/register/', (req) => {
      // Weryfikujemy, czy frontend wysyła wszystkie wymagane pola
      expect(req.body).to.have.property('username');
      expect(req.body).to.have.property('email');
      expect(req.body).to.have.property('password');
      expect(req.body).to.have.property('height_cm'); // Sprawdzenie wzrostu
      expect(req.body).to.have.property('weight_kg'); // Sprawdzenie wagi
      
      req.reply({ statusCode: 201, body: { user: newUser, ok: true } });
    }).as('postRegister');

    // D. Automatyczne logowanie
    cy.intercept('POST', '/api/login/', { 
      statusCode: 200, 
      body: { ok: true, user: newUser } 
    }).as('postLogin');

    // E. Mocki dla strony głównej (Home)
    cy.intercept('GET', '/api/workouts/last/', { statusCode: 200, body: { workout: null } }).as('getLastWorkout');
    cy.intercept('GET', '/api/workouts/weekly_summary/*', { statusCode: 200, body: { items: [], total_distance_m: 0 } }).as('getWeeklySummary');
    cy.intercept('GET', '/api/workouts/', { statusCode: 200, body: { workouts: [] } }).as('getRecentWorkouts');

    // --- 2. Akcja w UI ---

    cy.visit('/#register');
    cy.wait('@getSession');

    // Wypełnianie pól podstawowych
    cy.get('input[name="username"]').clear().type(newUser.username);
    cy.get('input[name="email"]').clear().type(newUser.email);
    cy.get('input[name="password"]').clear().type('P@ssw0rd!');
    
    // Wypełnianie pól wymiarów (wymagane teraz przez backend)
    cy.get('input[name="height_cm"]').clear().type('180');
    cy.get('input[name="weight_kg"]').clear().type('75.5');

    // Czekamy na odblokowanie przycisku (walidacja username/email - debounce)
    cy.wait('@checkUsername');
    cy.wait('@checkEmail');

    // --- 3. Zmiana stanu sesji i kliknięcie ---

    // Nadpisujemy intercept sesji na "zalogowany"
    cy.intercept('GET', '/api/session/', { 
      statusCode: 200, 
      body: { authenticated: true, user: newUser } 
    }).as('getSessionAuthenticated');

    // Sprawdzamy czy przycisk jest aktywny i klikamy
    cy.get('button[type="submit"]').should('not.be.disabled').click();

    // --- 4. Weryfikacja ---

    // Czekamy na request rejestracji (tu sprawdzane są expecty z punktu C)
    cy.wait('@postRegister');
    
    // Czekamy na request logowania
    cy.wait('@postLogin');

    // Czekamy na przekierowanie na URL domowy
    cy.location('hash', { timeout: 10000 }).should('match', /home|^\/$/);

    // Czekamy na załadowanie danych Dashboardu (potwierdzenie że jesteśmy zalogowani i na właściwej stronie)
    cy.wait('@getWeeklySummary'); 

    // Weryfikacja widoku Home
    cy.contains('h2', 'Witaj w aplikacji').should('be.visible');
    cy.contains('Ostatnie treningi').should('be.visible');
    
    // Upewniamy się, że formularz zniknął
    cy.get('input[name="username"]').should('not.exist');
  });
});