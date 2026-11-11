import { test, expect } from '@playwright/test';

// Seed test for Playwright test agents (planner and generator):
// it opens the app and leaves the page ready on the catalogue.
test('seed', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Catalogue', level: 1 })).toBeVisible();
  await expect(page.locator('#book-list').getByRole('heading')).toHaveCount(8);
});
