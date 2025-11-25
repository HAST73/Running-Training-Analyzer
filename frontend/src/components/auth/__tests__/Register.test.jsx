import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Register from '../Register';

describe('Register component', () => {
  test('shows validation errors for invalid email and weak password', async () => {
    const afterAuth = jest.fn();
    render(<Register afterAuth={afterAuth} />);

    // Fill form with invalid email and weak password
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'invalid-email' } });
    fireEvent.change(screen.getByLabelText(/Hasło/i), { target: { value: 'short' } });

    fireEvent.click(screen.getByText(/Zarejestruj się/i));

    // Expect validation messages
    expect(await screen.findByText(/Podaj poprawny adres email/)).toBeInTheDocument();
    expect(screen.getByText(/Hasło: min. 8 znaków/)).toBeInTheDocument();
    expect(afterAuth).not.toHaveBeenCalled();
  });
});
