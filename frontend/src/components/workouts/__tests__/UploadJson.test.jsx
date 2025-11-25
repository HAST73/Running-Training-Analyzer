import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Workouts from '../Workouts';

describe('Workouts Adidas JSON upload', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  test('uploads Adidas .json file and shows success message', async () => {
    const initial = { workouts: [] };
    const after = { workouts: [{ id: 10, source: 'json' }] };
    let calls = 0;
    const mockFetch = jest.fn((url, opts) => {
      if (url.endsWith('/api/workouts/')) {
        calls += 1;
        return Promise.resolve({ ok: true, json: async () => (calls === 1 ? initial : after) });
      }
      if (url.endsWith('/api/workouts/upload/')) {
        expect(opts).toBeDefined();
        expect(opts.body).toBeInstanceOf(FormData);
        const fd = opts.body;
        const file = fd.get('file');
        expect(file).toBeDefined();
        expect(file.name).toBe('adidas.json');
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    global.fetch = mockFetch;

    await act(async () => render(<Workouts />));

    const input = document.getElementById('workout-upload-adidas');
    expect(input).toBeTruthy();

    const file = new File([JSON.stringify({ fake: true })], 'adidas.json', { type: 'application/json' });

    await act(async () => userEvent.upload(input, file));

    await waitFor(() => expect(screen.getByText(/Zaimportowano trening z Adidas Running \(.json\)\./i)).toBeInTheDocument());
  });
});
