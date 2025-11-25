// Optionally add global hooks or commands here
Cypress.on('uncaught:exception', (err, runnable) => {
  // ignore errors thrown by app during tests that we intentionally stub
  return false;
});
