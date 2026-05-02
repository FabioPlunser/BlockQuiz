import { expect, test } from '@playwright/test';

test('guest can open the seeded demo course in the learner player', async ({ page }) => {
	await page.goto('/demo');
	await expect(page.getByText('BlockQuiz Demo')).toBeVisible();

	await page.getByRole('button', { name: 'Start as guest' }).first().click();

	await expect(page.getByRole('button', { name: 'Try it' })).toBeVisible({ timeout: 20_000 });
	await expect(page.getByRole('button', { name: 'Check my answer' })).toBeVisible();
	await expect(page.getByText('Make the computer say the right thing')).toBeVisible();
});
