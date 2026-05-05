import { spawn } from 'node:child_process';
import { join } from 'node:path';
import * as z from 'zod';
import type { Command } from '$lib/canvas/types';
import {
	DEFAULT_SANDBOX_MAX_COMMANDS,
	DEFAULT_SANDBOX_MAX_ITERATIONS,
	DEFAULT_SANDBOX_TIMEOUT,
	type SandboxErrorType
} from '$lib/sandbox';
import type { Exercise, IoTestCase } from '$lib/types/exercise';
import { gradeIoExercise, gradeVisualExercise, type GradingResult } from '$lib/graders';

type AuthoritativeExecutionResult = {
	success: boolean;
	commands: Command[];
	stdout?: string;
	stderr?: string;
	error?: string;
	errorType?: SandboxErrorType;
};

type AuthoritativeSubmissionResult = {
	grading: GradingResult;
	resultJson: string;
};

type WorkerInput = {
	exerciseType: string;
	code: string;
	stdin?: string;
	seed?: string | number;
	maxCommands: number;
	maxIterations: number;
	timeout: number;
};

const workerOutputSchema = z.object({
	success: z.boolean(),
	commands: z.array(
		z.object({
			type: z.string(),
			args: z.array(z.union([z.string(), z.number()])),
			timestamp: z.number()
		})
	),
	stdout: z.string().optional(),
	stderr: z.string().optional(),
	error: z.string().optional(),
	errorType: z.enum(['timeout', 'loop', 'command_limit', 'runtime', 'security']).optional()
});

const WORKER_PATH = join(process.cwd(), 'scripts', 'authoritative-worker.mjs');
const HARD_TIMEOUT_BUFFER_MS = 2000;
const MAX_OUTPUT_BYTES = 1024 * 1024;

function runWorker(input: WorkerInput): Promise<AuthoritativeExecutionResult> {
	const hardTimeout = input.timeout + HARD_TIMEOUT_BUFFER_MS;

	return new Promise((resolve) => {
		const proc = spawn('bun', [WORKER_PATH], { stdio: ['pipe', 'pipe', 'pipe'] });

		let stdout = '';
		let settled = false;

		function settle(result: AuthoritativeExecutionResult) {
			if (settled) return;
			settled = true;
			resolve(result);
		}

		const timer = setTimeout(() => {
			proc.kill('SIGKILL');
			settle({
				success: false,
				commands: [],
				error: 'Execution exceeded the configured time limit.',
				errorType: 'timeout'
			});
		}, hardTimeout);

		proc.stdout.on('data', (chunk: Buffer) => {
			stdout += chunk.toString();
			if (stdout.length > MAX_OUTPUT_BYTES) {
				proc.kill('SIGKILL');
				clearTimeout(timer);
				settle({
					success: false,
					commands: [],
					error: 'Worker output exceeded size limit.',
					errorType: 'runtime'
				});
			}
		});

		proc.on('close', () => {
			clearTimeout(timer);
			try {
				const parsed = JSON.parse(stdout);
				const validated = workerOutputSchema.parse(parsed);
				settle(validated as AuthoritativeExecutionResult);
			} catch {
				settle({
					success: false,
					commands: [],
					error: 'Worker returned invalid output.',
					errorType: 'runtime'
				});
			}
		});

		proc.on('error', () => {
			clearTimeout(timer);
			settle({
				success: false,
				commands: [],
				error: 'Failed to spawn worker process.',
				errorType: 'runtime'
			});
		});

		proc.stdin.write(JSON.stringify(input));
		proc.stdin.end();
	});
}

async function executeGeneratedCode(
	exerciseType: string,
	code: string,
	options: { stdin?: string; seed?: string | number } = {}
): Promise<AuthoritativeExecutionResult> {
	return runWorker({
		exerciseType,
		code,
		stdin: options.stdin,
		seed: options.seed,
		maxCommands: DEFAULT_SANDBOX_MAX_COMMANDS,
		maxIterations: DEFAULT_SANDBOX_MAX_ITERATIONS,
		timeout: DEFAULT_SANDBOX_TIMEOUT
	});
}

async function executeIoTests(exercise: Exercise, code: string) {
	const ioExercise = exercise.type === 'io' ? exercise : null;
	if (!ioExercise) {
		throw new Error('Expected an IO exercise');
	}

	const results = [];
	for (const test of ioExercise.io.tests as IoTestCase[]) {
		const execution = await executeGeneratedCode(ioExercise.type, code, {
			stdin: test.stdin,
			seed: test.seed
		});
		results.push({ test, execution });
	}
	return results;
}

export async function gradeExerciseAuthoritatively(
	exercise: Exercise,
	generatedCode: string
): Promise<AuthoritativeSubmissionResult> {
	const code = generatedCode.trim();
	if (!code) {
		throw new Error('No generated code provided for authoritative grading.');
	}

	if (exercise.type === 'io') {
		const runs = await executeIoTests(exercise, code);
		const grading = gradeIoExercise(exercise, runs);
		return {
			grading,
			resultJson: JSON.stringify(grading)
		};
	}

	const execution = await executeGeneratedCode(exercise.type, code);
	const grading = gradeVisualExercise(exercise, execution);
	return {
		grading,
		resultJson: JSON.stringify(grading)
	};
}
