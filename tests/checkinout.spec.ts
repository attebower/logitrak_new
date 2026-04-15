import { test, expect } from '@playwright/test';

/**
 * LogiTrak Check In / Check Out E2E Tests — Sprint 2
 *
 * Prerequisites:
 * - Supabase seeded with test workspace + users
 * - At least one equipment item with status: available (serial "00001")
 * - At least one equipment item with status: checked_out (serial "00002")
 * - Test user signed in as Operator role
 *
 * TODO: Replace manual navigation with auth helper once Supabase is wired up.
 */

test.describe('Check-out happy path', () => {
  test.beforeEach(async ({ page }) => {
    // TODO: sign in as operator test user
    await page.goto('/checkinout');
  });

  test('scan item → add to batch → fill location → confirm → status becomes checked_out', async ({ page }) => {
    // Select check-out mode
    await page.getByRole('button', { name: /check out/i }).click();

    // Enter serial manually (QR scan fallback)
    await page.getByPlaceholder(/serial/i).fill('00001');
    await page.keyboard.press('Enter');

    // Item appears in batch
    await expect(page.getByTestId('batch-item-00001')).toBeVisible();

    // Fill location details
    await page.getByLabel(/production/i).fill('Test Production');
    await page.getByLabel(/studio/i).selectOption({ index: 1 });
    await page.getByLabel(/stage/i).selectOption({ index: 1 });

    // Confirm check-out
    await page.getByRole('button', { name: /confirm check.?out/i }).click();

    // Success state
    await expect(page.getByText(/checked out/i)).toBeVisible();

    // TODO: verify status change via API / database check
  });

  test('duplicate serial in same batch is rejected', async ({ page }) => {
    await page.getByRole('button', { name: /check out/i }).click();

    await page.getByPlaceholder(/serial/i).fill('00001');
    await page.keyboard.press('Enter');

    // Scan same serial again
    await page.getByPlaceholder(/serial/i).fill('00001');
    await page.keyboard.press('Enter');

    await expect(page.getByText(/already in batch/i)).toBeVisible();
  });

  test('damaged item cannot be checked out', async ({ page }) => {
    await page.getByRole('button', { name: /check out/i }).click();

    // Serial "00003" is seeded as damaged
    await page.getByPlaceholder(/serial/i).fill('00003');
    await page.keyboard.press('Enter');

    await expect(page.getByText(/damaged/i)).toBeVisible();
    await expect(page.getByTestId('batch-item-00003')).not.toBeVisible();
  });
});

test.describe('Check-in happy path', () => {
  test.beforeEach(async ({ page }) => {
    // TODO: sign in as operator test user
    await page.goto('/checkinout');
  });

  test('scan checked-out item → confirm → status returns to available', async ({ page }) => {
    // Select check-in mode
    await page.getByRole('button', { name: /check in/i }).click();

    // Scan item that is checked out
    await page.getByPlaceholder(/serial/i).fill('00002');
    await page.keyboard.press('Enter');

    await expect(page.getByTestId('batch-item-00002')).toBeVisible();

    // Confirm check-in
    await page.getByRole('button', { name: /confirm check.?in/i }).click();

    await expect(page.getByText(/returned/i)).toBeVisible();

    // TODO: verify status change via API
  });

  test('manager can force check-in on already-available item', async ({ page }) => {
    // TODO: sign in as manager test user (override beforeEach)

    await page.getByRole('button', { name: /check in/i }).click();

    // Serial "00001" is available — normal users would be blocked
    await page.getByPlaceholder(/serial/i).fill('00001');
    await page.keyboard.press('Enter');

    // Manager should see a force check-in option
    await expect(page.getByRole('button', { name: /force check.?in/i })).toBeVisible();
  });
});
