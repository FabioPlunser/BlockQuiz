import {
	DEFAULT_SANDBOX_MAX_COMMANDS,
	DEFAULT_SANDBOX_MAX_ITERATIONS,
	DEFAULT_SANDBOX_TIMEOUT,
	createSandboxChannelId
} from './runtime';
import type {
	ExecuteMessage,
	LogMessage,
	ParentToSandboxMessage,
	ReadyMessage,
	ResultMessage,
	SandboxConnectMessage,
	SandboxExecutionRequest,
	SandboxExecutionResult,
	SandboxExecutorOptions,
	SandboxToParentMessage
} from './types';

const DEFAULT_OPTIONS: Required<SandboxExecutorOptions> = {
	sandboxUrl: '/sandbox.html',
	timeout: DEFAULT_SANDBOX_TIMEOUT,
	maxCommands: DEFAULT_SANDBOX_MAX_COMMANDS,
	maxIterations: DEFAULT_SANDBOX_MAX_ITERATIONS,
	debug: false
};

type PendingRequest = {
	resolve: (result: SandboxExecutionResult) => void;
	reject: (error: Error) => void;
	timeoutId: ReturnType<typeof setTimeout>;
};

export class SandboxExecutor {
	private iframe: HTMLIFrameElement | null = null;
	private controlPort: MessagePort | null = null;
	private isReady = false;
	private readyPromise: Promise<void> | null = null;
	private channelId = createSandboxChannelId();
	private pendingRequests = new Map<string, PendingRequest>();
	private options: Required<SandboxExecutorOptions>;
	private messageHandler: ((event: MessageEvent) => void) | null = null;

	constructor(options: SandboxExecutorOptions = {}) {
		this.options = { ...DEFAULT_OPTIONS, ...options };
	}

	async initialize(): Promise<void> {
		if (this.isReady) {
			return;
		}
		if (!this.readyPromise) {
			this.readyPromise = this.createSandbox();
		}
		await this.readyPromise;
	}

	async execute(request: SandboxExecutionRequest): Promise<SandboxExecutionResult> {
		await this.initialize();

		if (!this.controlPort) {
			return {
				success: false,
				trace: { durationMs: 0, commands: [] },
				error: 'Sandbox control channel is unavailable.',
				errorType: 'runtime'
			};
		}

		return new Promise((resolve, reject) => {
			const id = this.generateId();
			const timeoutMs = request.timeout ?? this.options.timeout;
			const timeoutId = setTimeout(() => {
				this.pendingRequests.delete(id);
				resolve({
					success: false,
					trace: { durationMs: timeoutMs, commands: [] },
					error: `Execution timed out after ${timeoutMs}ms.`,
					errorType: 'timeout'
				});
			}, timeoutMs + 250);

			this.pendingRequests.set(id, {
				resolve,
				reject,
				timeoutId
			});

			const message: ExecuteMessage = {
				type: 'execute',
				channelId: this.channelId,
				id,
				code: request.code,
				exerciseType: request.exerciseType,
				apiMethods: request.apiMethods,
				timeout: request.timeout ?? this.options.timeout,
				maxCommands: request.maxCommands ?? this.options.maxCommands,
				maxIterations: request.maxIterations ?? this.options.maxIterations,
				seed: request.seed,
				stdin: request.stdin,
				visual: request.visual
			};

			this.controlPort?.postMessage(message);
		});
	}

	async reset(): Promise<void> {
		await this.initialize();

		if (!this.controlPort) {
			return;
		}

		await new Promise<void>((resolve, reject) => {
			const id = this.generateId();
			const timeoutId = setTimeout(() => {
				this.pendingRequests.delete(id);
				reject(new Error('Sandbox reset timed out.'));
			}, 1000);

			this.pendingRequests.set(id, {
				resolve: () => resolve(),
				reject,
				timeoutId
			});

			const message: ParentToSandboxMessage = {
				type: 'reset',
				channelId: this.channelId,
				id
			};

			this.controlPort?.postMessage(message);
		});
	}

	destroy(): void {
		for (const [id, pending] of this.pendingRequests) {
			clearTimeout(pending.timeoutId);
			pending.reject(new Error('Sandbox destroyed.'));
			this.pendingRequests.delete(id);
		}

		if (this.messageHandler) {
			window.removeEventListener('message', this.messageHandler);
			this.messageHandler = null;
		}

		if (this.controlPort) {
			this.controlPort.onmessage = null;
			this.controlPort.close();
			this.controlPort = null;
		}

		if (this.iframe) {
			this.iframe.remove();
			this.iframe = null;
		}

		this.isReady = false;
		this.readyPromise = null;
		this.channelId = createSandboxChannelId();
	}

	get ready(): boolean {
		return this.isReady;
	}

	private createSandbox(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.iframe = document.createElement('iframe');
			this.iframe.style.display = 'none';
			this.iframe.style.width = '0';
			this.iframe.style.height = '0';
			this.iframe.style.border = 'none';
			this.iframe.sandbox.add('allow-scripts');
			this.iframe.src = this.options.sandboxUrl;

			const channel = new MessageChannel();
			this.controlPort = channel.port1;
			this.controlPort.onmessage = (event) => {
				this.handlePortMessage(event);
			};
			this.controlPort.start();

			const readyTimeout = setTimeout(() => {
				reject(new Error('Sandbox initialization timed out.'));
			}, 5000);

			this.messageHandler = (event: MessageEvent) => {
				if (!this.iframe?.contentWindow) {
					return;
				}

				if (event.source !== this.iframe.contentWindow) {
					return;
				}

				const message = event.data as Partial<SandboxToParentMessage> | undefined;
				if (!message || typeof message !== 'object') {
					return;
				}

				if (event.origin !== 'null') {
					return;
				}

				if (message.type === 'ready') {
					const readyMessage = message as ReadyMessage;
					if (readyMessage.channelId !== this.channelId) {
						return;
					}

					clearTimeout(readyTimeout);
					this.isReady = true;
					resolve();
				}
			};

			window.addEventListener('message', this.messageHandler);

			this.iframe.onload = () => {
				if (!this.iframe?.contentWindow) {
					reject(new Error('Sandbox window is unavailable.'));
					return;
				}

				const connectMessage: SandboxConnectMessage = {
					type: 'connect',
					channelId: this.channelId,
					parentOrigin: window.location.origin
				};

				this.iframe.contentWindow.postMessage(connectMessage, '*', [channel.port2]);
			};

			this.iframe.onerror = () => {
				clearTimeout(readyTimeout);
				reject(new Error('Failed to load sandbox.'));
			};

			document.body.appendChild(this.iframe);
		});
	}

	private handlePortMessage(event: MessageEvent): void {
		const message = event.data as SandboxToParentMessage | undefined;
		if (!message || typeof message !== 'object') {
			return;
		}

		if ('channelId' in message && message.channelId !== this.channelId) {
			return;
		}

		switch (message.type) {
			case 'result': {
				const result = message as ResultMessage;
				const pending = this.pendingRequests.get(result.id);
				if (!pending) {
					return;
				}

				clearTimeout(pending.timeoutId);
				this.pendingRequests.delete(result.id);
				pending.resolve({
					success: result.success,
					trace: result.trace,
					error: result.error,
					errorType: result.errorType
				});
				return;
			}

			case 'log': {
				if (!this.options.debug) {
					return;
				}

				const logMessage = message as LogMessage;
				console[logMessage.level]('[Sandbox]', ...logMessage.args);
				return;
			}

			default:
				return;
		}
	}

	private generateId(): string {
		return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
	}
}

let sandboxInstance: SandboxExecutor | null = null;

export function getSandboxExecutor(options?: SandboxExecutorOptions): SandboxExecutor {
	if (!sandboxInstance) {
		sandboxInstance = new SandboxExecutor(options);
	}
	return sandboxInstance;
}

export function destroySandboxExecutor(): void {
	if (sandboxInstance) {
		sandboxInstance.destroy();
		sandboxInstance = null;
	}
}
