import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Workouts from '../Workouts';

describe('Workouts Strava FIT upload', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  test('success: uploads Strava .fit file and shows success message', async () => {
    const initial = { workouts: [] };
    const after = { workouts: [{ id: 11, source: 'strava' }] };
    let calls = 0;
    const mockFetch = jest.fn((url, opts) => {
      if (url.endsWith('/api/workouts/')) {
        calls += 1;
        return Promise.resolve({ ok: true, json: async () => (calls === 1 ? initial : after) });
      }
      if (url.endsWith('/api/workouts/upload/')) {
        const fd = opts.body;
        expect(fd).toBeInstanceOf(FormData);
        const f = fd.get('file');
        expect(f.name).toBe('activity.fit');
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    global.fetch = mockFetch;
    await act(async () => render(<Workouts />));

    const input = document.getElementById('workout-upload-strava');
    expect(input).toBeTruthy();
    const fitFile = new File(['FITDATA'], 'activity.fit', { type: 'application/octet-stream' });

    await act(async () => userEvent.upload(input, fitFile));

    await waitFor(() => expect(screen.getByText(/Zaimportowano trening ze Stravy \(.fit\)\./i)).toBeInTheDocument());
  });

  test('error: shows message when Strava .fit upload fails', async () => {
    const mockErr = jest.fn((url, opts) => {
      if (url.endsWith('/api/workouts/')) return Promise.resolve({ ok: true, json: async () => ({ workouts: [] }) });
      if (url.endsWith('/api/workouts/upload/')) return Promise.resolve({ ok: false, json: async () => ({ error: 'Bad file' }) });
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    global.fetch = mockErr;
    await act(async () => render(<Workouts />));
    const input2 = document.getElementById('workout-upload-strava');
    const badFit = new File(['NOTFIT'], 'bad.fit', { type: 'application/octet-stream' });
    await act(async () => userEvent.upload(input2, badFit));

    await waitFor(() => expect(screen.getByText(/Nie udało się zaimportować/)).toBeInTheDocument());
  });
});
