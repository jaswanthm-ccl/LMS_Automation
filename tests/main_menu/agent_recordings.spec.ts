import { test, expect } from '../../fixtures/agent.fixture';
import { RecordingsPage } from '../../pages/main_menu/recordings.page';

async function ensureAgentSession(page: import('@playwright/test').Page) {
  await page.goto('/my-leads');
  await expect(page.getByRole('heading', { name: /My Assigned Leads/i })).toBeVisible({
    timeout: 15_000,
  });
}

test.describe('Recordings (agent)', () => {
  test('should open recordings and show table shell', async ({ page }) => {
    await ensureAgentSession(page);
    const recordings = new RecordingsPage(page);
    const { allowed } = await recordings.goto();
    expect(allowed, 'Agent should access /recording').toBeTruthy();
    await recordings.expectTableShell();
  });

  test('should show recording rows or an explicit empty state', async ({ page }) => {
    await ensureAgentSession(page);
    const recordings = new RecordingsPage(page);
    await recordings.goto();
    await recordings.expectTableShell();

    const empty = page.getByText(/No data available/i);
    const anyRow = page.getByRole('row').nth(1);
    await expect
      .poll(async () => (await anyRow.isVisible()) || (await empty.isVisible()), {
        message: 'Recordings should show rows or an explicit empty state',
      })
      .toBe(true);
  });
});
