export type Theme = 'light' | 'dark' | 'warm';
export const THEMES: readonly Theme[] = ['light', 'dark', 'warm'];

const STORAGE_KEY = 'theme';

function isTheme(value: unknown): value is Theme {
	return value === 'light' || value === 'dark' || value === 'warm';
}

function readInitial(): Theme {
	if (typeof document === 'undefined') return 'warm';
	const current = document.documentElement.getAttribute('data-theme');
	return isTheme(current) ? current : 'warm';
}

function createTheme() {
	let value = $state<Theme>(readInitial());

	const apply = (next: Theme) => {
		value = next;
		if (typeof document !== 'undefined') {
			document.documentElement.setAttribute('data-theme', next);
			try {
				localStorage.setItem(STORAGE_KEY, next);
			} catch {
				// ignore
			}
		}
	};

	return {
		get current() {
			return value;
		},
		get isDark() {
			return value === 'dark';
		},
		set(next: Theme) {
			apply(next);
		},
		toggle() {
			const order: Theme[] = ['light', 'dark', 'warm'];
			const idx = order.indexOf(value);
			apply(order[(idx + 1) % order.length]);
		},
		sync() {
			value = readInitial();
		}
	};
}

export const theme = createTheme();
