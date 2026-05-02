import { describe, expect, it } from 'vitest';
import { validateAttemptActorFields } from './invariants';

describe('validateAttemptActorFields', () => {
	it('accepts valid user and guest actors', () => {
		expect.assertions(2);

		expect(() =>
			validateAttemptActorFields({ actorType: 'user', userId: 'user-1', clientId: null })
		).not.toThrow();
		expect(() =>
			validateAttemptActorFields({ actorType: 'guest', userId: null, clientId: 'guest-1' })
		).not.toThrow();
	});

	it('rejects missing or ambiguous actors', () => {
		expect.assertions(4);

		expect(() =>
			validateAttemptActorFields({ actorType: 'user', userId: null, clientId: null })
		).toThrow('exactly one');
		expect(() =>
			validateAttemptActorFields({ actorType: 'guest', userId: 'user-1', clientId: 'guest-1' })
		).toThrow('exactly one');
		expect(() =>
			validateAttemptActorFields({ actorType: 'user', userId: null, clientId: 'guest-1' })
		).toThrow('User attempts');
		expect(() =>
			validateAttemptActorFields({ actorType: 'guest', userId: 'user-1', clientId: null })
		).toThrow('Guest attempts');
	});
});
