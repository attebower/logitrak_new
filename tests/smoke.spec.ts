import { test, expect } from '@playwright/test';

/**
 * LogiTrak Smoke Tests — Sprint 1
 *
 * These tests verify the app shell loads correctly.
 * They run against a live dev server (started automatically by playwright.config.ts).
 *
 * To run:
 *   npx playwright test
 *   npx playwright test --ui   (interactive mode)
 */

test.describe('Root redirect', () => {
  test('homepage redirects to sign-in', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/.*sign-in/);
  });
});

test.describe('Sign-in page', () => {
  test('page title contains LogiTrak', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page).toHaveTitle(/LogiTrak/);
  });

  test('email input is visible', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.getByPlaceholder('you@studio.com').first()).toBeVisible();
  });

  test('sign-up link is present', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.getByRole('link', { name: /sign up/i })).toBeVisible();
  });
});

test.describe('Sign-up page', () => {
  test('page title contains LogiTrak', async ({ page }) => {
    await page.goto('/sign-up');
    await expect(page).toHaveTitle(/LogiTrak/);
  });
});
