# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> Sign-in page >> sign-up link is present
- Location: tests/smoke.spec.ts:32:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('link', { name: /sign up/i })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('link', { name: /sign up/i })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - heading "404" [level=1] [ref=e4]
    - heading "This page could not be found." [level=2] [ref=e6]
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e12] [cursor=pointer]:
    - img [ref=e13]
  - alert [ref=e16]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | /**
  4  |  * LogiTrak Smoke Tests — Sprint 1
  5  |  *
  6  |  * These tests verify the app shell loads correctly.
  7  |  * They run against a live dev server (started automatically by playwright.config.ts).
  8  |  *
  9  |  * To run:
  10 |  *   npx playwright test
  11 |  *   npx playwright test --ui   (interactive mode)
  12 |  */
  13 | 
  14 | test.describe('Root redirect', () => {
  15 |   test('homepage redirects to sign-in', async ({ page }) => {
  16 |     await page.goto('/');
  17 |     await expect(page).toHaveURL(/.*sign-in/);
  18 |   });
  19 | });
  20 | 
  21 | test.describe('Sign-in page', () => {
  22 |   test('page title contains LogiTrak', async ({ page }) => {
  23 |     await page.goto('/sign-in');
  24 |     await expect(page).toHaveTitle(/LogiTrak/);
  25 |   });
  26 | 
  27 |   test('email input is visible', async ({ page }) => {
  28 |     await page.goto('/sign-in');
  29 |     await expect(page.getByPlaceholder('you@studio.com').first()).toBeVisible();
  30 |   });
  31 | 
  32 |   test('sign-up link is present', async ({ page }) => {
  33 |     await page.goto('/sign-in');
> 34 |     await expect(page.getByRole('link', { name: /sign up/i })).toBeVisible();
     |                                                                ^ Error: expect(locator).toBeVisible() failed
  35 |   });
  36 | });
  37 | 
  38 | test.describe('Sign-up page', () => {
  39 |   test('page title contains LogiTrak', async ({ page }) => {
  40 |     await page.goto('/sign-up');
  41 |     await expect(page).toHaveTitle(/LogiTrak/);
  42 |   });
  43 | });
  44 | 
```