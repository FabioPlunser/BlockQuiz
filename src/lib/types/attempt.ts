export type AttemptLocale = 'de' | 'en';
export type AttemptActorType = 'user' | 'guest';
export type HintRevealTrigger = 'click' | 'time';

export interface AttemptAnalytics {
	exerciseType: 'io' | 'turtle' | 'robot';
	totalTests: number;
	passedTests: number;
	hintUsageCount: number;
	submittedAt: number;
	workspaceBlockCount?: number;
	generatedCodeLength?: number;
	importedFromGuest?: {
		clientId: string;
		importedAt: number;
	};
}

export interface HintRevealEvent {
	hintId: string;
	revealedAt: number;
	trigger: HintRevealTrigger;
}

export interface AttemptSnapshot {
	id: string;
	exerciseId: string;
	userId?: string;
	clientId?: string;
	actorType: AttemptActorType;
	workspaceXml: string;
	generatedCode: string;
	resultJson: string;
	locale: AttemptLocale;
	startedAt: number;
	endedAt: number;
	score: number;
	passed: boolean;
	hintEventsJson: string;
	analyticsJson: string;
	createdAt: number;
}

export interface AttemptSubmission {
	exerciseId: string;
	workspaceXml: string;
	generatedCode: string;
	resultJson: string;
	locale: AttemptLocale;
	startedAt: number;
	endedAt: number;
	score: number;
	passed: boolean;
	hintEventsJson: string;
	analyticsJson: string;
}

export interface AttemptCapture {
	workspaceXml: string;
	generatedCode: string;
	locale: AttemptLocale;
	hintEventsJson: string;
	analyticsJson: string;
}
