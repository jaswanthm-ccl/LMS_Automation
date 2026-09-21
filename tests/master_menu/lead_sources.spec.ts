import { test, expect } from "../../fixtures/lead-sources.fixture";
import { LeadSourcesPage } from "../../pages/master_menu/lead_sources.page";
import { getRandomLetters } from "../../utils/common";

test.describe('Lead Sources Module - CRUD & Lifecycle', () => {
    test.describe.configure({ mode: 'serial' });

    let cleanedUpLeadSourceName = '';

    test('should create, search, view, edit, and deactivate a lead source', async ({ page, leadSourceCleanup }) => {
        const leadSourcesPage = new LeadSourcesPage(page);
        const uniqueLeadSourceName = `lead source ${getRandomLetters(4)}`;
        const updatedLeadSourceName = `${uniqueLeadSourceName} updated`;
        cleanedUpLeadSourceName = updatedLeadSourceName;

        // 1. Navigate to the lead sources page
        await leadSourcesPage.gotoLeadSourcesPage();

        // 2. Create the lead source, then register it for teardown immediately.
        // Anything that fails from here on still leaves the record cleaned up.
        const createdLeadSource = await leadSourcesPage.addLeadSource(uniqueLeadSourceName);
        leadSourceCleanup.register(createdLeadSource);
        await expect(page.getByText('Lead source created successfully')).toBeVisible();

        // 3. Search and confirm the row is there
        await leadSourcesPage.searchLeadSource(uniqueLeadSourceName);
        await expect(leadSourcesPage.leadSourceRow(uniqueLeadSourceName)).toBeVisible();

        // 4. View it
        await leadSourcesPage.viewLeadSource(uniqueLeadSourceName);
        const viewDialog = page.getByRole('dialog', { name: 'View Lead Source' });
        await expect(viewDialog).toContainText(uniqueLeadSourceName);
        await viewDialog.getByRole('button', { name: 'Close modal' }).click();

        // 5. Edit it
        await leadSourcesPage.editLeadSource(uniqueLeadSourceName, updatedLeadSourceName);
        await expect(page.getByText('Lead source updated successfully')).toBeVisible();

        // 6. Confirm the rename landed
        await leadSourcesPage.searchLeadSource(updatedLeadSourceName);
        await expect(leadSourcesPage.leadSourceRow(updatedLeadSourceName)).toBeVisible();

        // 7. Deactivate it
        await leadSourcesPage.deactivateLeadSource(updatedLeadSourceName);
        await expect(page.getByText('Lead source deactivated successfully')).toBeVisible();

        // 8. It should now appear under the Inactive filter
        await leadSourcesPage.filterByStatus('Inactive');
        await expect(leadSourcesPage.leadSourceRow(updatedLeadSourceName)).toBeVisible();

        // 9. Restore it, and confirm it leaves the Inactive list.
        // No toast assertion here: the restore message is rendered by the
        // frontend and its exact wording is not verifiable from this repo.
        // restoreLeadSource already fails if the activate call is not a 200,
        // and the row moving between filters is the outcome that matters.
        await leadSourcesPage.restoreLeadSource(updatedLeadSourceName);
        await expect(leadSourcesPage.leadSourceRow(updatedLeadSourceName)).toBeHidden();

        // 10. And it should be back under Active
        await leadSourcesPage.filterByStatus('Active');
        await expect(leadSourcesPage.leadSourceRow(updatedLeadSourceName)).toBeVisible();
    });

    test('should leave the created lead source inactive after automatic cleanup', async ({ page }) => {
        const leadSourcesPage = new LeadSourcesPage(page);

        await leadSourcesPage.gotoLeadSourcesPage();
        await leadSourcesPage.filterByStatus('Inactive');
        await leadSourcesPage.searchLeadSource(cleanedUpLeadSourceName);

        const cleanedUpLeadSource = leadSourcesPage.leadSourceRow(cleanedUpLeadSourceName);
        await expect(cleanedUpLeadSource).toBeVisible();
        await expect(cleanedUpLeadSource.getByText('Inactive', { exact: true })).toBeVisible();
    });
});
