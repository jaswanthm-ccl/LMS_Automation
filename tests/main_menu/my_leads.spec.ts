import { test, expect } from '../../fixtures/agent.fixture';
import { MyLeadsPage } from '../../pages/main_menu/my_leads.page';
import { CallbackQueuePage } from '../../pages/main_menu/callback_queue.page';

test.describe('My Assigned Leads (agent)', () => {
  test('should open my assigned leads', async ({ page }) => {
    const myLeads = new MyLeadsPage(page);
    await myLeads.goto();
    await expect(page.getByRole('heading', { name: /My Assigned Leads/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Lead Name/i })).toBeVisible();
  });
});

test.describe('Callback Queue (agent)', () => {
  test('should open the follow-up / callback queue', async ({ page }) => {
    const queue = new CallbackQueuePage(page);
    await queue.goto();
    await expect(page.getByRole('columnheader', { name: /Lead Name|Callback Date|Note/i }).first()).toBeVisible();
  });
});
