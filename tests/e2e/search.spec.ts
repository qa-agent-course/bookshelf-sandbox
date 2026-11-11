import { test, expect } from '@playwright/test';

test('search finds a book by title, ignoring case', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('searchbox', { name: 'Search books' }).fill('frankenstein');
  await expect(page.getByRole('heading', { name: 'Frankenstein' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dracula' })).toBeHidden();
});
