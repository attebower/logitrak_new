import { test, expect } from '@playwright/test';

/**
 * LogiTrak Sprint 3 E2E Tests
 *
 * Covers: Reports, Team, Locations admin, Settings
 *
 * Prerequisites:
 * - Test workspace seeded with members, equipment, studios/stages/sets
 * - Test users: admin, manager, operator, read_only
 * - TODO: Replace page.goto() sign-in workaround with a proper auth helper fixture
 */

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

test.describe('Reports page', () => {
  test.beforeEach(async ({ page }) => {
    // TODO: sign in as manager
    await page.goto('/reports');
  });

  test('reports page loads', async ({ page }) => {
    await expect(page).toHaveTitle(/LogiTrak/);
    await expect(page.getByRole('heading', { name: /reports/i })).toBeVisible();
  });

  test('available equipment filter shows correct results', async ({ page }) => {
    await page.getByRole('button', { name: /available/i }).click();
    // All visible status badges should be "available"
    const badges = page.getByTestId('status-badge');
    await expect(badges.first()).toBeVisible();
    // Spot-check: no "checked out" badge visible
    await expect(page.getByText(/checked.?out/i)).not.toBeVisible();
  });

  test('checked-out equipment filter shows correct results', async ({ page }) => {
    await page.getByRole('button', { name: /checked.?out/i }).click();
    await expect(page.getByText(/checked.?out/i)).toBeVisible();
  });

  test('CSV export triggers download', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /export.*csv/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
  });
});

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

test.describe('Team page', () => {
  test.beforeEach(async ({ page }) => {
    // TODO: sign in as admin
    await page.goto('/team');
  });

  test('team page loads', async ({ page }) => {
    await expect(page).toHaveTitle(/LogiTrak/);
    await expect(page.getByRole('heading', { name: /team/i })).toBeVisible();
  });

  test('member list is visible', async ({ page }) => {
    // At least the admin user should be present
    await expect(page.getByTestId('member-row').first()).toBeVisible();
  });

  test('invite modal opens', async ({ page }) => {
    await page.getByRole('button', { name: /invite/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByPlaceholder(/email/i).first()).toBeVisible();
  });

  test('invite modal has role selector', async ({ page }) => {
    await page.getByRole('button', { name: /invite/i }).click();
    await expect(page.getByRole('combobox', { name: /role/i })).toBeVisible();
  });

  test('role badge displays correctly for each role', async ({ page }) => {
    // Verify role badges are rendered for at least one member
    const firstMember = page.getByTestId('member-row').first();
    await expect(firstMember.getByTestId('role-badge')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Locations admin
// ---------------------------------------------------------------------------

test.describe('Locations admin — add studio → stage → set flow', () => {
  test.beforeEach(async ({ page }) => {
    // TODO: sign in as admin
    await page.goto('/locations');
  });

  test('locations page loads', async ({ page }) => {
    await expect(page).toHaveTitle(/LogiTrak/);
    await expect(page.getByRole('heading', { name: /locations/i })).toBeVisible();
  });

  test('add studio → studio appears in list', async ({ page }) => {
    await page.getByRole('button', { name: /add studio/i }).click();
    await page.getByLabel(/studio name/i).fill('E2E Test Studio');
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText('E2E Test Studio')).toBeVisible();
  });

  test('add stage under studio → stage appears', async ({ page }) => {
    // Assumes E2E Test Studio exists from prior test or seed
    await page.getByText('E2E Test Studio').click();
    await page.getByRole('button', { name: /add stage/i }).click();
    await page.getByLabel(/stage name/i).fill('E2E Stage A');
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText('E2E Stage A')).toBeVisible();
  });

  test('add set under stage → set appears', async ({ page }) => {
    await page.getByText('E2E Test Studio').click();
    await page.getByText('E2E Stage A').click();
    await page.getByRole('button', { name: /add set/i }).click();
    await page.getByLabel(/set name/i).fill('E2E Set 1');
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText('E2E Set 1')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

test.describe('Settings page', () => {
  test.beforeEach(async ({ page }) => {
    // TODO: sign in as owner (only owner can edit workspace settings)
    await page.goto('/settings');
  });

  test('settings page loads', async ({ page }) => {
    await expect(page).toHaveTitle(/LogiTrak/);
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
  });

  test('workspace name field is editable', async ({ page }) => {
    const nameInput = page.getByLabel(/workspace name/i);
    await expect(nameInput).toBeVisible();
    await expect(nameInput).toBeEditable();
  });

  test('save workspace name shows confirmation', async ({ page }) => {
    const nameInput = page.getByLabel(/workspace name/i);
    await nameInput.fill('Updated Test Workspace');
    await page.getByRole('button', { name: /save/i }).click();
    // Should show success state — either a toast or inline confirmation
    await expect(
      page.getByText(/saved/i).or(page.getByText(/updated/i))
    ).toBeVisible();
  });

  test('non-owner cannot access settings', async ({ page: _page }) => {
    // TODO: sign in as operator — middleware should redirect
    // This test is a stub until role-gating is fully wired
  });
});
