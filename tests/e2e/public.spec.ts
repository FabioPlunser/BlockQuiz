import { expect, test } from '@playwright/test';

test('public pages load and protected test route redirects', async ({ page }) => {
	await page.goto('/login');
	await expect(page).toHaveTitle(/Login \| BlockQuiz/);
	await expect(page.getByRole('heading', { name: 'Welcome to BlockQuiz' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Explore as guest' })).toBeVisible();

	await page.goto('/demo');
	await expect(
		page.getByRole('heading', { name: 'Play published courses as a guest' })
	).toBeVisible();
	await expect(page.getByText('BlockQuiz Demo')).toBeVisible();

	await page.goto('/test');
	await expect(page).toHaveURL(/\/login$/);
});

test('German browser language is reflected in SSR markup', async ({ browser }) => {
	const context = await browser.newContext({
		extraHTTPHeaders: {
			'Accept-Language': 'de-AT,de;q=0.9,en;q=0.8'
		},
		locale: 'de-DE'
	});
	const page = await context.newPage();

	await page.goto('/login');
	await expect(page.locator('html')).toHaveAttribute('lang', 'de');
	await expect(page.getByRole('heading', { name: 'Willkommen bei BlockQuiz' })).toBeVisible();

	await context.close();
});
