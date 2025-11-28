import { mdsvex } from 'mdsvex';
import adapter from 'svelte-adapter-bun';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: [vitePreprocess(), mdsvex()],
	kit: {
		experimental: { remoteFunctions: true },
		adapter: adapter(),
		alias: {
			$db: 'src/lib/server/db',
			$server: 'src/lib/server',
			$remote: 'src/lib/remote',
			$cp: 'src/lib/components'
		}
	},
	extensions: ['.svelte', '.svx'],
	compilerOptions: {
		experimental: {
			async: true
		}
	},
	vitePlugin: {
		inspector: true
	}
};

export default config;
