import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const buildPath = join(process.cwd(), 'build');
if (!existsSync(buildPath)) {
	throw new Error('Production build not found. Run `bun --bun run build` before smoke testing.');
}

const port = String(45000 + Math.floor(Math.random() * 10000));
const dbPath = join(mkdtempSync(join(tmpdir(), 'blockquiz-smoke-')), 'smoke.sqlite');
const baseUrl = `http://127.0.0.1:${port}`;
const env = {
	...process.env,
	DATABASE_URL: `file:${dbPath}`,
	HOST: '127.0.0.1',
	PORT: port,
	NODE_ENV: 'production',
	BETTER_AUTH_URL: baseUrl,
	ORIGIN: baseUrl,
	AUTH_SECRET: `${crypto.randomUUID()}${crypto.randomUUID()}`
};

async function runStep(command: string[], label: string) {
	const proc = Bun.spawn(command, {
		env,
		stdout: 'pipe',
		stderr: 'pipe'
	});

	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited
	]);

	if (exitCode !== 0) {
		throw new Error(`${label} failed with exit code ${exitCode}\n${stdout}\n${stderr}`);
	}
}

async function waitForServer() {
	const deadline = Date.now() + 15_000;
	let lastError: unknown;

	while (Date.now() < deadline) {
		try {
			const response = await fetch(`${baseUrl}/login`, { redirect: 'manual' });
			if (response.status === 200) {
				return;
			}
			lastError = new Error(`Unexpected readiness status ${response.status}`);
		} catch (error) {
			lastError = error;
		}

		await Bun.sleep(250);
	}

	throw new Error(`Server did not become ready: ${String(lastError)}`);
}

async function expectStatus(path: string, expected: number) {
	const response = await fetch(`${baseUrl}${path}`, { redirect: 'manual' });
	if (response.status !== expected) {
		throw new Error(`${path} returned ${response.status}, expected ${expected}`);
	}
	return response;
}

await runStep(['bun', '--bun', 'run', 'db:push'], 'Schema setup');
await runStep(['bun', '--bun', 'run', 'db:seed'], 'Seed setup');

const server = Bun.spawn(['bun', './build'], {
	env,
	stdout: 'inherit',
	stderr: 'inherit'
});

try {
	await waitForServer();

	const login = await expectStatus('/login', 200);
	const germanLogin = await fetch(`${baseUrl}/login`, {
		headers: { 'accept-language': 'de-AT,de;q=0.9,en;q=0.8' },
		redirect: 'manual'
	});
	if (germanLogin.status !== 200) {
		throw new Error(`/login with German Accept-Language returned ${germanLogin.status}`);
	}
	const germanLoginHtml = await germanLogin.text();
	if (!germanLoginHtml.includes('<html lang="de"')) {
		throw new Error('Expected German /login response to render <html lang="de">');
	}
	await expectStatus('/demo', 200);
	await expectStatus('/privacy', 200);

	const home = await expectStatus('/', 303);
	const courses = await expectStatus('/courses', 303);
	const test = await expectStatus('/test', 303);

	if (home.headers.get('location') !== '/login') {
		throw new Error(`Expected / to redirect to /login, got ${home.headers.get('location')}`);
	}
	if (courses.headers.get('location') !== '/login') {
		throw new Error(
			`Expected /courses to redirect to /login, got ${courses.headers.get('location')}`
		);
	}
	if (test.headers.get('location') !== '/login') {
		throw new Error(`Expected /test to redirect to /login, got ${test.headers.get('location')}`);
	}
	if (!login.headers.get('content-security-policy')) {
		throw new Error('Missing Content-Security-Policy header on /login');
	}

	console.log(`Smoke passed on ${baseUrl}`);
} finally {
	server.kill();
	await server.exited.catch(() => undefined);
}
