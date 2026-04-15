# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> Root redirect >> homepage redirects to sign-in
- Location: tests/smoke.spec.ts:15:7

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /.*sign-in/
Received string:  "http://localhost:3000/"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    8 × unexpected value "http://localhost:3000/"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e3]:
    - img "Next.js logo" [ref=e4]
    - generic [ref=e5]:
      - heading "To get started, edit the page.tsx file." [level=1] [ref=e6]
      - paragraph [ref=e7]:
        - text: Looking for a starting point or more instructions? Head over to
        - link "Templates" [ref=e8] [cursor=pointer]:
          - /url: https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app
        - text: or the
        - link "Learning" [ref=e9] [cursor=pointer]:
          - /url: https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app
        - text: center.
    - generic [ref=e10]:
      - link "Vercel logomark Deploy Now" [ref=e11] [cursor=pointer]:
        - /url: https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app
        - img "Vercel logomark" [ref=e12]
        - text: Deploy Now
      - link "Documentation" [ref=e13] [cursor=pointer]:
        - /url: https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e19] [cursor=pointer]:
    - img [ref=e20]
  - alert [ref=e23]
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
> 17 |     await expect(page).toHaveURL(/.*sign-in/);
     |                        ^ Error: expect(page).toHaveURL(expected) failed
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
  34 |     await expect(page.getByRole('link', { name: /sign up/i })).toBeVisible();
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