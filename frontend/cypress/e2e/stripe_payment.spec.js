describe('Stripe checkout unlock (Odblokuj PRO)', () => {
  it('creates a checkout session and confirms payment, unlocking PRO', () => {
    // --- 1. Przygotowanie Mocków ---

    const user = { id: 42, username: 'stripeuser' };
    
    // Zmienna stanu - na początku użytkownik nie ma PRO
    let isProUnlocked = false;

    // Intercept Sesji: Zwraca pro_unlocked w zależności od zmiennej isProUnlocked
    cy.intercept('GET', '/api/session/', (req) => {
      req.reply({ 
        statusCode: 200, 
        body: { 
          authenticated: true, 
          user: user, 
          pro_unlocked: isProUnlocked // Dynamiczna wartość
        } 
      });
    }).as('getSession');

    // Intercept Tworzenia Sesji (POST):
    // Zamiast wysyłać nas na prawdziwy URL Stripe (checkout.stripe.com),
    // serwer "kłamie" i odsyła nas od razu na URL sukcesu w naszej aplikacji.
    const fakeSessionId = 'cs_test_mock_12345';
    const successRedirectUrl = `http://localhost:3000/#plans?success=1&session_id=${fakeSessionId}`;

    cy.intercept('POST', '/api/payments/create-checkout-session/', { 
      statusCode: 200, 
      body: { url: successRedirectUrl } 
    }).as('createCheckout');

    // Intercept Potwierdzenia Płatności (GET):
    // React wywoła to, gdy zobaczy ?success=1 w URL
    cy.intercept('GET', `/api/payments/confirm/?session_id=${fakeSessionId}`, (req) => {
      // W tym momencie "płatność" weszła, więc zmieniamy stan sesji na PRO
      isProUnlocked = true;
      req.reply({ statusCode: 200, body: { status: 'paid' } });
    }).as('confirmPayment');

    // --- 2. Scenariusz Testowy ---

    // Wejście na stronę planów (Stan zablokowany)
    cy.visit('/#plans');
    cy.wait('@getSession');

    // Weryfikacja: Treść powinna być zablokowana (widoczna kłódka/overlay ze zdjęcia)
    // Szukamy tekstu z Twojego komponentu TrainingPlans.jsx / zdjęcia
    cy.contains('Treść zablokowana (PRO)').should('be.visible');
    
    // Kliknięcie przycisku odblokowania (używamy klasy, żeby było stabilne)
    cy.get('button.btn-pro-unlock').click();

    // Poczekaj na utworzenie checkout session
    cy.wait('@createCheckout');

    // --- 3. Powrót ze "Stripe" (Symulowany) ---
    // Zamiast polegać na automatycznym przekierowaniu aplikacji, odwiedzamy explicite URL sukcesu,
    // żeby deterministycznie wywołać kod obsługi parametru success=1
    cy.visit(`/#plans?success=1&session_id=${fakeSessionId}`);

    // Komponent TrainingPlans.jsx wykryje parametry w URL i wywoła confirmPayment.
    cy.wait('@confirmPayment');

    // Po potwierdzeniu płatności, React wywołuje refreshSession(), więc czekamy na nową sesję
    cy.wait('@getSession');

    // --- 4. Weryfikacja Odblokowania ---

    // Kłódka powinna zniknąć
    cy.contains('Treść zablokowana (PRO)', { timeout: 6000 }).should('not.exist');

    // Lock overlay element should be gone and plans visible
    cy.get('.plans-lock-overlay', { timeout: 6000 }).should('not.exist');
    cy.contains('Od chodu do biegu', { timeout: 6000 }).should('be.visible');
    
    // Opcjonalnie: Sprawdź czy zniknął parametr z URL (jeśli czyścisz URL) lub czy jest komunikat
    // Twój kod TrainingPlans.jsx pokazuje tabelę po odblokowaniu.
  });
});