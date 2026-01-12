/**
 * Sandbox execution types for secure student code execution.
 * Uses postMessage protocol between parent window and iframe sandbox.
 */

// =============================================================================
// Command Types (shared with canvas engine)
// =============================================================================

export interface SandboxCommand {
	type: string;
	args: (string | number)[];
	timestamp: number;
}

// =============================================================================
// Message Types - Parent to Sandbox
// =============================================================================

export interface ExecuteMessage {
	type: 'execute';
	id: string;
	code: string;
	apiMethods: string[];
	timeout?: number; // ms, default 2000
	maxCommands?: number; // default 10000
	maxIterations?: number; // default 10000
}

export interface ResetMessage {
	type: 'reset';
	id: string;
}

export type ParentToSandboxMessage = ExecuteMessage | ResetMessage;

// =============================================================================
// Message Types - Sandbox to Parent
// =============================================================================

export interface ResultMessage {
	type: 'result';
	id: string;
	success: boolean;
	commands: SandboxCommand[];
	error?: string;
	errorType?: 'timeout' | 'loop' | 'command_limit' | 'runtime' | 'security';
}

export interface ReadyMessage {
	type: 'ready';
}

export interface LogMessage {
	type: 'log';
	level: 'log' | 'warn' | 'error';
	args: unknown[];
}

export type SandboxToParentMessage = ResultMessage | ReadyMessage | LogMessage;

// =============================================================================
// Execution Result (returned to caller)
// =============================================================================

export interface SandboxExecutionResult {
	success: boolean;
	commands: SandboxCommand[];
	error?: string;
	errorType?: 'timeout' | 'loop' | 'command_limit' | 'runtime' | 'security';
}

// =============================================================================
// Executor Options
// =============================================================================

export interface SandboxExecutorOptions {
	/** Sandbox HTML URL (default: /sandbox.html) */
	sandboxUrl?: string;
	/** Execution timeout in ms (default: 2000) */
	timeout?: number;
	/** Max API commands before stopping (default: 10000) */
	maxCommands?: number;
	/** Max loop iterations before stopping (default: 10000) */
	maxIterations?: number;
	/** Whether to log sandbox console output (default: false) */
	debug?: boolean;
}

// =============================================================================
// API Definition for Sandbox
// =============================================================================

export interface SandboxApiMethod {
	name: string;
	/** Optional validation for arguments */
	validate?: (args: unknown[]) => boolean;
}

