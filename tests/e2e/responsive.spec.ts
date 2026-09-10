import { expect, test, type Page } from '@playwright/test';

async function expectNoHorizontalOverflow(page: Page) {
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - window.innerWidth
	);
	expect(overflow).toBeLessThanOrEqual(2);
}

const publicPages = ['/login', '/demo'];
const viewports = [
	{ name: 'mobile', width: 390, height: 844 },
	{ name: 'tablet', width: 768, height: 1024 },
	{ name: 'desktop', width: 1280, height: 900 }
];

for (const viewport of viewports) {
	test(`public pages avoid horizontal overflow on ${viewport.name}`, async ({ page }) => {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });

		for (const path of publicPages) {
			await page.goto(path);
			await expectNoHorizontalOverflow(page);
		}
	});
}
