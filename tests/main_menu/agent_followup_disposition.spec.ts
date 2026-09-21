import { test, expect } from '../../fixtures/agent.fixture';
import { MyLeadsPage } from '../../pages/main_menu/my_leads.page';
import { CallbackQueuePage } from '../../pages/main_menu/callback_queue.page';

test.describe('Agent lead follow-up queue', () => {
  test('should load My Leads and each standard callback queue filter', async ({ page }) => {
    const myLeads = new MyLeadsPage(page);
    const callbackQueue = new CallbackQueuePage(page);

    await myLeads.goto();
    await expect(page.getByRole('columnheader', { name: /Lead Name/i })).toBeVisible();

    await callbackQueue.goto();
    for (const filter of ['Today', 'Overdue', 'Upcoming'] as const) {
      await callbackQueue.selectQueueType(filter);
    }

    await expect(
      page.getByRole('heading', { name: /Follow-Up\s*\/\s*Callback Queue/i }),
    ).toBeVisible();
  });
});
