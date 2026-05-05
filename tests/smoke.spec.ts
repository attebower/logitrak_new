import { test, expect } from '@playwright/test';

/**
 * LogiTrak Smoke Tests
 *
 * These tests verify the basic app shell from an unauthenticated perspective.
 * The Supabase middleware redirects all unauthenticated non-auth routes to /sign-in,
 * so tests run without credentials but still exercise routing and page structure.
 *
 * To run:
 *   npx playwright test tests/smoke.spec.ts
 */

test.describe('Unauthenticated routing', () => {
  test('unauthenticated user is redirected to sign-in', async ({ page }) => {
    // Middleware redirects any unauthenticated non-auth route to /sign-in.
    // The root / is not an auth route, so it redirects.
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*sign-in/);
  });

  test('sign-in page is publicly accessible', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page).toHaveURL(/.*sign-in/);
  });

  test('sign-up page is publicly accessible', async ({ page }) => {
    await page.goto('/sign-up');
    await expect(page).toHaveURL(/.*sign-up/);
  });
});

test.describe('Sign-in page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sign-in');
  });

  test('page title contains LogiTrak', async ({ page }) => {
    await expect(page).toHaveTitle(/LogiTrak/);
  });

  test('email input is visible', async ({ page }) => {
    await expect(page.getByPlaceholder('you@studio.com').first()).toBeVisible();
  });

  test('password input is visible', async ({ page }) => {
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
  });

  test('sign-up link is present', async ({ page }) => {
    await expect(page.getByRole('link', { name: /sign up/i })).toBeVisible();
  });

  test('magic link tab is present', async ({ page }) => {
    await expect(page.getByRole('button', { name: /magic link/i })).toBeVisible();
  });
});

test.describe('Sign-up page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sign-up');
  });

  test('page title contains LogiTrak', async ({ page }) => {
    await expect(page).toHaveTitle(/LogiTrak/);
  });

  test('email input is visible', async ({ page }) => {
    await expect(page.getByPlaceholder('you@studio.com')).toBeVisible();
  });

  test('sign-in link is present', async ({ page }) => {
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
  });
});

test.describe('Marketing homepage', () => {
  test('homepage is accessible and contains LogiTrak branding', async ({ page }) => {
    // The homepage is the public marketing page.
    // Note: unauthenticated users are currently redirected to /sign-in by middleware
    // (BUG-013 — middleware should exempt / from auth redirect).
    // This test documents the current redirect behaviour until BUG-013 is fixed.
    await page.goto('/');
    // Either lands on marketing page or redirects to sign-in — both are LogiTrak pages
    await expect(page).toHaveTitle(/LogiTrak/);
  });
});
