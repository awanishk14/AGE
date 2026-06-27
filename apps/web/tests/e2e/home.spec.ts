import { expect, test } from '@playwright/test';

test('home page renders the AGE heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'AGE' })).toBeVisible();
});
