import type { AttemptActorType } from '$lib/types/attempt';

export interface AttemptActorFields {
	actorType: AttemptActorType;
	userId?: string | null;
	clientId?: string | null;
}

export function validateAttemptActorFields(fields: AttemptActorFields) {
	const hasUserId = typeof fields.userId === 'string' && fields.userId.length > 0;
	const hasClientId = typeof fields.clientId === 'string' && fields.clientId.length > 0;

	if (hasUserId === hasClientId) {
		throw new Error('Attempt must have exactly one actor identifier.');
	}

	if (fields.actorType === 'user' && !hasUserId) {
		throw new Error('User attempts require userId and no clientId.');
	}

	if (fields.actorType === 'guest' && !hasClientId) {
		throw new Error('Guest attempts require clientId and no userId.');
	}
}
