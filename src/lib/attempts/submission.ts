import * as z from 'zod';
import type { Exercise } from '$lib/types/exercise';

const submittedGradingResultSchema = z.object({
	passed: z.boolean(),
	score: z.number().min(0).max(100),
	totalTests: z.number().int().nonnegative(),
	passedTests: z.number().int().nonnegative(),
	testResults: z.array(
		z.object({
			id: z.string(),
			description: z.string(),
			visible: z.boolean(),
			passed: z.boolean(),
			message: z.string(),
			expected: z.unknown().optional(),
			actual: z.unknown().optional()
		})
	)
});

type SubmittedGradingResult = z.infer<typeof submittedGradingResultSchema>;

export class SubmittedResultValidationError extends Error {
	constructor(message = 'Invalid grading payload') {
		super(message);
		this.name = 'SubmittedResultValidationError';
	}
}

function collectCanonicalTests(exercise: Exercise) {
	return exercise.type === 'io' ? exercise.io.tests : exercise.grader.testCases;
}

export function validateSubmittedVisibleResultShape(
	exercise: Exercise,
	resultJson: string
): SubmittedGradingResult {
	let submittedPayload: unknown;
	try {
		submittedPayload = JSON.parse(resultJson);
	} catch {
		throw new SubmittedResultValidationError();
	}

	const parsed = submittedGradingResultSchema.safeParse(submittedPayload);
	if (!parsed.success) {
		throw new SubmittedResultValidationError();
	}

	const submitted = parsed.data;
	const visibleCanonicalTests = collectCanonicalTests(exercise).filter((test) => test.visible);
	const visibleCanonicalById = new Map(visibleCanonicalTests.map((test) => [test.id, test]));

	if (
		submitted.totalTests !== visibleCanonicalTests.length ||
		submitted.testResults.length !== visibleCanonicalTests.length
	) {
		throw new SubmittedResultValidationError('Submitted results do not match the visible test set');
	}

	const submittedIds = new Set<string>();
	for (const testResult of submitted.testResults) {
		if (submittedIds.has(testResult.id)) {
			throw new SubmittedResultValidationError('Submitted results contain duplicate tests');
		}
		submittedIds.add(testResult.id);

		const canonical = visibleCanonicalById.get(testResult.id);
		if (!canonical || !testResult.visible) {
			throw new SubmittedResultValidationError(
				'Submitted results do not match the visible test definitions'
			);
		}
	}

	return submitted;
}
