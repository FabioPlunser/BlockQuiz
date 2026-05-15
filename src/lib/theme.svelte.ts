export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

function readInitial(): Theme {
	if (typeof document === 'undefined') return 'light';
	const current = document.documentElement.getAttribute('data-theme');
	return current === 'dark' ? 'dark' : 'light';
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
			apply(value === 'dark' ? 'light' : 'dark');
		},
		sync() {
			value = readInitial();
		}
	};
}

export const theme = createTheme();
