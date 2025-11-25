// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows: expect(element).toBeInTheDocument()
import '@testing-library/jest-dom';
// Silence specific noisy or expected errors in the test environment.
// We still forward all other errors to the original console.error.
const _origConsoleError = console.error;
const _IGNORE_PATTERNS = [
	/The current testing environment is not configured to support act/,
	/Bad file/, // expected error message from simulated .fit upload failure
	/Nieprawidłowy plik/ // expected error message from simulated GPX failure
];
console.error = (...args) => {
	try {
		const joined = args
			.map((a) => {
				if (typeof a === 'string') return a;
				if (a && a.message) return a.message;
				try {
					return String(a);
				} catch (e) {
					return '';
				}
			})
			.join(' ');
		for (const rx of _IGNORE_PATTERNS) {
			if (rx.test(joined)) return;
		}
	} catch (e) {
		// fallthrough to original
	}
	_origConsoleError.apply(console, args);
};
