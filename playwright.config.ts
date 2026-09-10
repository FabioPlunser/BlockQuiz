import { defineConfig } from '@playwright/test';

const port = 4173;
const baseURL = `http://localhost:${port}`;

export default defineConfig({
	testDir: 'tests/e2e',
	fullyParallel: false,
	workers: 1,
	timeout: 30_000,
	expect: {
		timeout: 10_000
	},
	reporter: [['list']],
	use: {
		baseURL,
		trace: 'on-first-retry'
	},
	webServer: {
		command: 'bun --bun run scripts/setup-e2e.ts && bun --bun run dev --host localhost --port 4173',
		url: `${baseURL}/login`,
		timeout: 120_000,
		reuseExistingServer: false,
		env: {
			AUTH_SECRET: 'playwright-auth-secret-change-me-32-characters',
			BETTER_AUTH_URL: baseURL,
			DATABASE_URL: 'file:./data/e2e.sqlite',
			HOST: 'localhost',
			NODE_ENV: 'development',
			PORT: String(port),
			SEED_TEACHER_PASSWORD: 'BlockQuiz123!'
		}
	}
});
