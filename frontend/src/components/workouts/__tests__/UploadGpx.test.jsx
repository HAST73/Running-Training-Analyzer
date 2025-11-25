import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Workouts from '../Workouts';

describe('Workouts GPX upload', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  test('success: uploads GPX file (multipart) and shows success message', async () => {
    let workoutsCallCount = 0;
    const workoutsInitial = { workouts: [{ id: 1, gpx_file: null, hr_stats: null, source: 'json' }] };
    const workoutsAfter = { workouts: [{ id: 1, gpx_file: 'sample.gpx', hr_stats: null, source: 'json' }] };

    const mockFetch = jest.fn((url, opts) => {
      if (url.endsWith('/api/workouts/')) {
        workoutsCallCount += 1;
        const payload = workoutsCallCount === 1 ? workoutsInitial : workoutsAfter;
        return Promise.resolve({ ok: true, json: async () => payload });
      }

      if (url.match(/\/api\/workouts\/\d+\/gpx\//) && opts && (!opts.method || opts.method === 'POST')) {
        expect(opts.body).toBeInstanceOf(FormData);
        const fd = opts.body;
        const file = fd.get('file');
        expect(file).toBeDefined();
        expect(file.name).toBe('sample.gpx');
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }

      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    global.fetch = mockFetch;

    await act(async () => {
      render(<Workouts />);
    });

    const fileInput = document.querySelector('input[type="file"][accept*="gpx"]');
    expect(fileInput).toBeTruthy();

    const file = new File(['<gpx></gpx>'], 'sample.gpx', { type: 'application/gpx+xml' });

    await act(async () => {
      userEvent.upload(fileInput, file);
    });

    await waitFor(() => expect(screen.getByText(/Dołączono plik GPX do treningu\./i)).toBeInTheDocument());

    expect(mockFetch.mock.calls.some(c => String(c[0]).includes('/gpx/'))).toBe(true);
    expect(mockFetch.mock.calls.some(c => String(c[0]).endsWith('/api/workouts/'))).toBe(true);
  });

  test('error: shows message when GPX upload fails (bad format)', async () => {
    const workoutsInitial = { workouts: [{ id: 2, gpx_file: null, hr_stats: null, source: 'json' }] };

    const mockFetch = jest.fn((url, opts) => {
      if (url.endsWith('/api/workouts/')) {
        return Promise.resolve({ ok: true, json: async () => workoutsInitial });
      }
      if (url.match(/\/api\/workouts\/\d+\/gpx\//) && opts && (!opts.method || opts.method === 'POST')) {
        return Promise.resolve({ ok: false, json: async () => ({ error: 'Nieprawidłowy plik GPX' }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    global.fetch = mockFetch;

    await act(async () => {
      render(<Workouts />);
    });

    const fileInput = document.querySelector('input[type="file"][accept*="gpx"]');
    expect(fileInput).toBeTruthy();

    const badFile = new File(['notxml'], 'bad.gpx', { type: 'application/gpx+xml' });

    await act(async () => {
      userEvent.upload(fileInput, badFile);
    });

    await waitFor(() => expect(screen.getByText(/Nie udało się dołączyć pliku GPX\./i)).toBeInTheDocument());
  });
});
