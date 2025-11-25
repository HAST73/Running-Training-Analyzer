import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Login from '../Login';

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('Login component', () => {
  test('translates invalid credentials to Polish', async () => {
    const afterAuth = jest.fn();
    // Mock failed login response
    global.fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Invalid credentials' }) });

    render(<Login afterAuth={afterAuth} />);

    fireEvent.change(screen.getByLabelText(/Nazwa użytkownika/i), { target: { value: 'user1' } });
    fireEvent.change(screen.getByLabelText(/Hasło/i), { target: { value: 'bad' } });
    fireEvent.click(screen.getByText(/Zaloguj się/i));

    expect(await screen.findByText(/Nieprawidłowa nazwa użytkownika lub hasło/)).toBeInTheDocument();
    expect(afterAuth).not.toHaveBeenCalled();
  });

  test('calls afterAuth on successful login', async () => {
    const afterAuth = jest.fn();
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'ok' }) });

    render(<Login afterAuth={afterAuth} />);
    fireEvent.change(screen.getByLabelText(/Nazwa użytkownika/i), { target: { value: 'user1' } });
    fireEvent.change(screen.getByLabelText(/Hasło/i), { target: { value: 'GoodP@ss1' } });
    fireEvent.click(screen.getByText(/Zaloguj się/i));

    await waitFor(() => expect(afterAuth).toHaveBeenCalled());
  });
});
