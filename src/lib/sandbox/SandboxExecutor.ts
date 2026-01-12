/**
 * SandboxExecutor - Manages iframe sandbox for secure code execution.
 * 
 * Creates an iframe with sandbox="allow-scripts" to isolate student code.
 * Communicates via postMessage protocol.
 */

import type {
	SandboxExecutionResult,
	SandboxExecutorOptions,
	ExecuteMessage,
	ResultMessage,
	SandboxToParentMessage
} from './types';

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_OPTIONS: Required<SandboxExecutorOptions> = {
	sandboxUrl: '/sandbox.html',
	timeout: 2000,
	maxCommands: 10000,
	maxIterations: 10000,
	debug: false
};

// =============================================================================
// SandboxExecutor Class
// =============================================================================

export class SandboxExecutor {
	private iframe: HTMLIFrameElement | null = null;
	private isReady = false;
	private readyPromise: Promise<void> | null = null;
	private pendingRequests = new Map<string, {
		resolve: (result: SandboxExecutionResult) => void;
		reject: (error: Error) => void;
		timeoutId: ReturnType<typeof setTimeout>;
	}>();
	private options: Required<SandboxExecutorOptions>;
	private messageHandler: ((event: MessageEvent) => void) | null = null;

	constructor(options: SandboxExecutorOptions = {}) {
		this.options = { ...DEFAULT_OPTIONS, ...options };
	}

	// ===========================================================================
	// Public API
	// ===========================================================================

	/**
	 * Initialize the sandbox iframe.
	 * Call this before executing code.
	 */
	async initialize(): Promise<void> {
		if (this.isReady) return;
		if (this.readyPromise) return this.readyPromise;

		this.readyPromise = this.createSandbox();
		await this.readyPromise;
	}

	/**
	 * Execute code in the sandbox.
	 * Returns commands recorded during execution.
	 */
	async execute(code: string, apiMethods: string[]): Promise<SandboxExecutionResult> {
		// Ensure sandbox is ready
		await this.initialize();

		if (!this.iframe?.contentWindow) {
			return {
				success: false,
				commands: [],
				error: 'Sandbox not initialized',
				errorType: 'runtime'
			};
		}

		return new Promise((resolve, reject) => {
			const id = this.generateId();
			
			// Set up timeout
			const timeoutId = setTimeout(() => {
				this.pendingRequests.delete(id);
				resolve({
					success: false,
					commands: [],
					error: `Execution timed out after ${this.options.timeout}ms`,
					errorType: 'timeout'
				});
			}, this.options.timeout + 500); // Add buffer for message passing

			// Store pending request
			this.pendingRequests.set(id, { resolve, reject, timeoutId });

			// Send execute message
			const message: ExecuteMessage = {
				type: 'execute',
				id,
				code,
				apiMethods,
				timeout: this.options.timeout,
				maxCommands: this.options.maxCommands,
				maxIterations: this.options.maxIterations
			};

			this.iframe!.contentWindow!.postMessage(message, '*');
		});
	}

	/**
	 * Destroy the sandbox and clean up resources.
	 */
	destroy(): void {
		// Clear all pending requests
		for (const [id, { timeoutId, reject }] of this.pendingRequests) {
			clearTimeout(timeoutId);
			reject(new Error('Sandbox destroyed'));
		}
		this.pendingRequests.clear();

		// Remove message listener
		if (this.messageHandler) {
			window.removeEventListener('message', this.messageHandler);
			this.messageHandler = null;
		}

		// Remove iframe
		if (this.iframe) {
			this.iframe.remove();
			this.iframe = null;
		}

		this.isReady = false;
		this.readyPromise = null;
	}

	/**
	 * Check if sandbox is ready.
	 */
	get ready(): boolean {
		return this.isReady;
	}

	// ===========================================================================
	// Private Methods
	// ===========================================================================

	private createSandbox(): Promise<void> {
		return new Promise((resolve, reject) => {
			// Create iframe
			this.iframe = document.createElement('iframe');
			this.iframe.style.display = 'none';
			this.iframe.style.width = '0';
			this.iframe.style.height = '0';
			this.iframe.style.border = 'none';
			
			// Set sandbox attributes - only allow scripts, nothing else
			this.iframe.sandbox.add('allow-scripts');
			
			// Set source
			this.iframe.src = this.options.sandboxUrl;

			// Set up message handler
			this.messageHandler = (event: MessageEvent) => {
				this.handleMessage(event);
			};
			window.addEventListener('message', this.messageHandler);

			// Handle load errors
			this.iframe.onerror = () => {
				reject(new Error('Failed to load sandbox'));
			};

			// Wait for ready message with timeout
			const readyTimeout = setTimeout(() => {
				reject(new Error('Sandbox initialization timed out'));
			}, 5000);

			const readyHandler = (event: MessageEvent) => {
				const message = event.data as SandboxToParentMessage;
				if (message?.type === 'ready') {
					clearTimeout(readyTimeout);
					this.isReady = true;
					resolve();
				}
			};
			window.addEventListener('message', readyHandler, { once: true });

			// Append to document
			document.body.appendChild(this.iframe);
		});
	}

	private handleMessage(event: MessageEvent): void {
		const message = event.data as SandboxToParentMessage;
		
		if (!message || typeof message !== 'object') return;

		switch (message.type) {
			case 'result': {
				const result = message as ResultMessage;
				const pending = this.pendingRequests.get(result.id);
				
				if (pending) {
					clearTimeout(pending.timeoutId);
					this.pendingRequests.delete(result.id);
					
					pending.resolve({
						success: result.success,
						commands: result.commands,
						error: result.error,
						errorType: result.errorType
					});
				}
				break;
			}

			case 'log': {
				if (this.options.debug) {
					const logMessage = message as { level: 'log' | 'warn' | 'error'; args: unknown[] };
					console[logMessage.level]('[Sandbox]', ...logMessage.args);
				}
				break;
			}

			case 'ready': {
				// Handled in createSandbox
				break;
			}
		}
	}

	private generateId(): string {
		return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}
}

// =============================================================================
// Singleton Instance
// =============================================================================

let sandboxInstance: SandboxExecutor | null = null;

/**
 * Get the singleton sandbox executor instance.
 * Creates one if it doesn't exist.
 */
export function getSandboxExecutor(options?: SandboxExecutorOptions): SandboxExecutor {
	if (!sandboxInstance) {
		sandboxInstance = new SandboxExecutor(options);
	}
	return sandboxInstance;
}

/**
 * Destroy the singleton sandbox executor.
 */
export function destroySandboxExecutor(): void {
	if (sandboxInstance) {
		sandboxInstance.destroy();
		sandboxInstance = null;
	}
}

