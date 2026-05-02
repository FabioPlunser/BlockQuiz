import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const port = String(46000 + Math.floor(Math.random() * 10000));
const baseUrl = `http://127.0.0.1:${port}`;
const tempRoot = mkdtempSync(join(tmpdir(), 'blockquiz-docker-smoke-'));
const dataDir = join(tempRoot, 'data');
const logsDir = join(tempRoot, 'logs');

mkdirSync(dataDir, { recursive: true });
mkdirSync(logsDir, { recursive: true });

const composeArgs = ['compose', '-f', 'docker-compose.prod.yml'];
const env = {
	...process.env,
	APP_PORT: port,
	AUTH_SECRET: `${crypto.randomUUID()}${crypto.randomUUID()}`,
	BETTER_AUTH_URL: baseUrl,
	COMPOSE_PROJECT_NAME: `blockquiz-smoke-${Date.now()}`,
	DATA_DIR: dataDir,
	LOGS_DIR: logsDir
};

async function runDocker(args: string[], label: string) {
	const proc = Bun.spawn(['docker', ...args], {
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

	return stdout.trim();
}

async function waitForServer() {
	const deadline = Date.now() + 120_000;
	let lastError: unknown;

	while (Date.now() < deadline) {
		try {
			const response = await fetch(`${baseUrl}/login`, { redirect: 'manual' });
			if (response.status === 200) return;
			lastError = new Error(`Unexpected readiness status ${response.status}`);
		} catch (error) {
			lastError = error;
		}

		await Bun.sleep(1_000);
	}

	throw new Error(`Docker app did not become ready: ${String(lastError)}`);
}

async function expectStatus(path: string, expected: number) {
	const response = await fetch(`${baseUrl}${path}`, { redirect: 'manual' });
	if (response.status !== expected) {
		throw new Error(`${path} returned ${response.status}, expected ${expected}`);
	}
	return response;
}

try {
	await runDocker([...composeArgs, 'up', '--build', '-d'], 'Docker Compose startup');
	await waitForServer();

	await expectStatus('/login', 200);
	await expectStatus('/demo', 200);
	const guarded = await expectStatus('/test', 303);
	if (guarded.headers.get('location') !== '/login') {
		throw new Error(`Expected /test to redirect to /login, got ${guarded.headers.get('location')}`);
	}

	await runDocker(
		[...composeArgs, 'exec', '-T', 'app', 'test', '-f', '/app/data/prod.db'],
		'DB volume check'
	);
	await runDocker(
		[...composeArgs, 'exec', '-T', 'app', 'test', '-d', '/app/logs'],
		'Log volume check'
	);

	console.log(`Docker smoke passed on ${baseUrl}`);
} finally {
	await runDocker([...composeArgs, 'down', '--remove-orphans'], 'Docker Compose cleanup').catch(
		(error) => {
			console.error(error);
		}
	);

	if (existsSync(tempRoot)) {
		rmSync(tempRoot, { recursive: true, force: true });
	}
}
