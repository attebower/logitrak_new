import { test, expect } from '@playwright/test';

/**
 * LogiTrak Equipment Management E2E Tests — Sprint 2
 *
 * Prerequisites:
 * - Test workspace with at least one equipment category
 * - Admin/Manager user for add flow
 */

test.describe('Equipment add flow', () => {
  test.beforeEach(async ({ page }) => {
    // TODO: sign in as admin
    await page.goto('/equipment');
  });

  test('fill form → save → item appears in equipment list', async ({ page }) => {
    await page.getByRole('button', { name: /add equipment/i }).click();

    // Fill required fields
    await page.getByLabel(/serial/i).fill('00099');
    await page.getByLabel(/name/i).fill('Test LED Panel');
    await page.getByLabel(/category/i).selectOption({ index: 1 });

    // Optional fields
    await page.getByLabel(/notes/i).fill('E2E test item');

    // Save
    await page.getByRole('button', { name: /save/i }).click();

    // Item appears in list
    await expect(page.getByText('00099')).toBeVisible();
    await expect(page.getByText('Test LED Panel')).toBeVisible();
  });

  test('serial must be 5 digits', async ({ page }) => {
    await page.getByRole('button', { name: /add equipment/i }).click();

    await page.getByLabel(/serial/i).fill('123');
    await page.getByRole('button', { name: /save/i }).click();

    await expect(page.getByText(/5.digit/i).or(page.getByText(/invalid serial/i))).toBeVisible();
  });

  test('duplicate serial within workspace is rejected', async ({ page }) => {
    await page.getByRole('button', { name: /add equipment/i }).click();

    // Use a serial that already exists (seeded)
    await page.getByLabel(/serial/i).fill('00001');
    await page.getByLabel(/name/i).fill('Duplicate test');
    await page.getByRole('button', { name: /save/i }).click();

    await expect(page.getByText(/already exists/i)).toBeVisible();
  });
});

test.describe('Equipment list', () => {
  test.beforeEach(async ({ page }) => {
    // TODO: sign in as operator
    await page.goto('/equipment');
  });

  test('equipment list page loads', async ({ page }) => {
    await expect(page).toHaveTitle(/LogiTrak/);
    await expect(page.getByRole('heading', { name: /equipment/i })).toBeVisible();
  });
});
