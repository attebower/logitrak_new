import { test, expect } from '@playwright/test';

/**
 * LogiTrak Damage Report & Repair Log E2E Tests — Sprint 2
 *
 * Prerequisites:
 * - Test workspace seeded with equipment
 * - Serial "00001" = available/normal
 * - Serial "00004" = damaged (for repair flow)
 * - Test users: operator, manager
 */

test.describe('Damage report flow', () => {
  test.beforeEach(async ({ page }) => {
    // TODO: sign in as operator
    await page.goto('/damage');
  });

  test('enter serial → submit report → item status becomes damaged', async ({ page }) => {
    await page.getByPlaceholder(/serial/i).fill('00001');
    await page.keyboard.press('Enter');

    // Item details visible
    await expect(page.getByText(/00001/)).toBeVisible();

    // Fill damage description
    await page.getByLabel(/description/i).fill('Cracked lens mount');

    // Optionally fill damage location on item
    await page.getByLabel(/damage location/i).fill('Front mounting bracket');

    // Submit
    await page.getByRole('button', { name: /report damage/i }).click();

    // Confirmation
    await expect(page.getByText(/damage reported/i)).toBeVisible();

    // TODO: verify equipment status = damaged via API
  });

  test('already-damaged item shows existing damage report', async ({ page }) => {
    await page.getByPlaceholder(/serial/i).fill('00004');
    await page.keyboard.press('Enter');

    await expect(page.getByText(/already damaged/i).or(page.getByText(/existing damage report/i))).toBeVisible();
  });
});

test.describe('Repair log flow', () => {
  test.beforeEach(async ({ page }) => {
    // TODO: sign in as manager (operators cannot log repairs)
    await page.goto('/damage');
  });

  test('find damaged item → log repair → item status returns to available', async ({ page }) => {
    // Navigate to damaged items list or search for serial
    await page.getByPlaceholder(/serial/i).fill('00004');
    await page.keyboard.press('Enter');

    // Log repair button (visible to manager+)
    await page.getByRole('button', { name: /log repair/i }).click();

    // Fill repair details
    await page.getByLabel(/repair description/i).fill('Replaced mounting bracket');
    await page.getByLabel(/repaired by/i).fill('Workshop Team');

    // Submit
    await page.getByRole('button', { name: /save repair/i }).click();

    // Confirmation
    await expect(page.getByText(/repair logged/i)).toBeVisible();

    // TODO: verify equipment damage_status = repaired, status = available
  });

  test('operator cannot see log repair button', async ({ page }) => {
    // TODO: sign in as operator
    await page.getByPlaceholder(/serial/i).fill('00004');
    await page.keyboard.press('Enter');

    await expect(page.getByRole('button', { name: /log repair/i })).not.toBeVisible();
  });
});
