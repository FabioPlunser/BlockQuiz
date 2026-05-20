import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		allowedHosts: ['.ngrok-free.app', '.ngrok.app', '.ngrok.io']
	},
	build: {
		chunkSizeWarningLimit: 700,
		rollupOptions: {
			onwarn(warning, defaultHandler) {
				if (
					warning.code === 'UNUSED_EXTERNAL_IMPORT' &&
					warning.exporter?.includes('@better-auth/core/api')
				) {
					return;
				}

				defaultHandler(warning);
			},
			output: {
				manualChunks(id) {
					if (id.includes('node_modules/blockly/core')) {
						return 'blockly-core';
					}

					if (id.includes('node_modules/blockly/blocks')) {
						return 'blockly-blocks';
					}

					if (id.includes('node_modules/blockly/javascript')) {
						return 'blockly-javascript';
					}
				}
			}
		}
	}
});
