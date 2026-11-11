import { test, expect } from '@playwright/test';

test('cart badge shows 1 after adding a book', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Continue as guest' }).click();
  await page.goto('/book/1');
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByRole('status')).toHaveText('Added to cart');
  const count = await page.getByTestId('cart-count').textContent();
  expect(count).toBe('1');
});
