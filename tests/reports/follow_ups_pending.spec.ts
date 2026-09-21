import { test, expect } from '../../fixtures/auth.fixture';
import { FollowUpsPendingReportPage } from '../../pages/reports/follow_ups_pending.page';
import { TEST_AGENT } from '../../utils/test_agent';

test.describe('Follow-Up Pending Report', () => {
  test('should open the follow-up pending report', async ({ page }) => {
    const reportPage = new FollowUpsPendingReportPage(page);

    await reportPage.gotoFollowUpsPendingReport();

    await expect(page.getByRole('heading', { name: /Follow-Up Pending Report/i })).toBeVisible();
    await expect(reportPage.exportButton).toBeVisible();
    await expect(reportPage.filtersButton).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Lead Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
  });

  test('should filter overdue follow-ups and open a lead profile', async ({ page }) => {
    test.setTimeout(60_000);
    const reportPage = new FollowUpsPendingReportPage(page);

    await reportPage.gotoFollowUpsPendingReport();
    await reportPage.filterOverdueOnly('Yes');

    const firstDataRow = page
      .getByRole('row')
      .filter({ has: page.getByTitle('View Lead', { exact: true }) })
      .first();
    await expect(firstDataRow).toBeVisible();
    await expect(firstDataRow).toContainText(/Overdue/i);

    const headers = await page.getByRole('columnheader').allTextContents();
    const leadNameIndex = headers.findIndex((h) => /Lead Name/i.test(h.trim()));
    expect(leadNameIndex, 'Lead Name column should exist').toBeGreaterThanOrEqual(0);

    const leadName = (
      await firstDataRow.getByRole('cell').nth(leadNameIndex).innerText()
    ).trim();
    expect(leadName.length, 'Lead name cell should not be empty').toBeGreaterThan(0);

    const profile = await reportPage.viewLead(leadName);
    await expect(profile).toContainText(/Lead Profile/i);
    await expect(profile).toContainText(leadName);
    await profile.getByRole('button', { name: 'Close modal' }).click();
    await expect(profile).toBeHidden();
  });

  test('should filter by status Pending and by agent', async ({ page }) => {
    test.setTimeout(60_000);
    const reportPage = new FollowUpsPendingReportPage(page);

    await reportPage.gotoFollowUpsPendingReport();
    await reportPage.filterByStatus('Pending');

    const pendingRow = page
      .getByRole('row')
      .filter({ has: page.getByTitle('View Lead', { exact: true }) })
      .first();
    await expect(pendingRow).toBeVisible();
    await expect(pendingRow).toContainText(/Pending|Overdue/i);

    // Fresh navigation so agent filter is independent of prior Status selection.
    await reportPage.gotoFollowUpsPendingReport();
    await reportPage.filterByAgent(TEST_AGENT.name);
    // Staging may have no pending FUs for this agent — assert filter applied.
    await expect(reportPage.filterTrigger('Agent')).toContainText(new RegExp(TEST_AGENT.name, 'i'));
  });
});
