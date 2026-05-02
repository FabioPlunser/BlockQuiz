import type { PositionState } from '$lib/canvas/types';
import type { ExerciseType } from '$lib/types/exercise';

export type SandboxErrorType = 'timeout' | 'loop' | 'command_limit' | 'runtime' | 'security';

export interface SandboxCommand {
	type: string;
	args: Array<string | number>;
	timestamp: number;
}

export interface SandboxVisualTraceConfig {
	initialState: PositionState;
	stepSize: number;
}

export interface ExecutionTrace {
	durationMs: number;
	commands?: SandboxCommand[];
	finalState?: PositionState;
	stdout?: string;
	stderr?: string;
	prints?: string[];
}

export interface SandboxExecutionRequest {
	code: string;
	exerciseType: ExerciseType;
	apiMethods: string[];
	timeout?: number;
	maxCommands?: number;
	maxIterations?: number;
	seed?: string | number;
	stdin?: string;
	visual?: SandboxVisualTraceConfig;
}

export interface ExecuteMessage extends SandboxExecutionRequest {
	type: 'execute';
	channelId: string;
	id: string;
}

export interface ResetMessage {
	type: 'reset';
	channelId: string;
	id: string;
}

export type ParentToSandboxMessage = ExecuteMessage | ResetMessage;

export interface ResultMessage {
	type: 'result';
	channelId: string;
	id: string;
	success: boolean;
	trace: ExecutionTrace;
	error?: string;
	errorType?: SandboxErrorType;
}

export interface ReadyMessage {
	type: 'ready';
	channelId: string;
}

export interface LogMessage {
	type: 'log';
	channelId: string;
	level: 'log' | 'warn' | 'error';
	args: unknown[];
}

export type SandboxToParentMessage = ResultMessage | ReadyMessage | LogMessage;

export interface SandboxConnectMessage {
	type: 'connect';
	channelId: string;
	parentOrigin: string;
}

export interface SandboxExecutionResult {
	success: boolean;
	trace: ExecutionTrace;
	error?: string;
	errorType?: SandboxErrorType;
}

export interface SandboxExecutorOptions {
	sandboxUrl?: string;
	timeout?: number;
	maxCommands?: number;
	maxIterations?: number;
	debug?: boolean;
}

export interface SandboxApiMethod {
	name: string;
	validate?: (args: unknown[]) => boolean;
}
