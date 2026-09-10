import { expect, test, type Page } from '@playwright/test';

const teacherEmail = 'seed-teacher@example.com';
const teacherPassword = 'BlockQuiz123!';

async function signInAsSeedTeacher(page: Page) {
	const diagnostics: string[] = [];
	page.on('console', (message) => diagnostics.push(`${message.type()}: ${message.text()}`));
	page.on('pageerror', (error) => diagnostics.push(`pageerror: ${error.message}`));
	page.on('requestfailed', (request) =>
		diagnostics.push(
			`requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText}`
		)
	);
	page.on('response', (response) => {
		if (response.status() >= 400) {
			const headers = response.request().headers();
			diagnostics.push(
				`response: ${response.status()} ${response.url()} origin=${headers.origin ?? '<missing>'}`
			);
		}
	});

	await page.goto('/login');
	await page.getByLabel('Email').fill(teacherEmail);
	await page.getByLabel('Password').fill(teacherPassword);
	await page.getByRole('button', { name: 'Sign In' }).click();
	try {
		await expect(page).toHaveURL(/\/courses$/, { timeout: 15_000 });
	} catch (error) {
		throw new Error(
			`${error instanceof Error ? error.message : String(error)}\n${diagnostics.join('\n')}`,
			{ cause: error }
		);
	}
}

test('seed teacher can sign in and access CMS', async ({ page }) => {
	await signInAsSeedTeacher(page);

	await page.goto('/cms');
	await expect(page).toHaveURL(/\/cms$/);
	await expect(page.getByRole('tab', { name: 'Courses' })).toBeVisible();
	await expect(page.getByRole('tab', { name: 'Exercises' })).toBeVisible();
	await expect(page.getByText('Intro to Programming')).toBeVisible({ timeout: 15_000 });
});
