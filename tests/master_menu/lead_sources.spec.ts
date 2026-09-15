import { test, expect } from "../../fixtures/auth.fixture";
import { LeadSourcesPage } from "../../pages/master_menu/lead_sources.page";
import { getRandomLetters } from "../../utils/common";

test.describe('Lead Sources Module - CRUD & Lifecycle', () => {
    test('should create, search, view, edit, and deactivate a lead source', async ({ page }) => {
        const leadSourcesPage = new LeadSourcesPage(page);
        const uniqueLeadSourceName = `lead source ${getRandomLetters(4)}`;
        const updatedLeadSourceName = `${uniqueLeadSourceName} updated`;
        // 1. Navigate to the lead sources page
        await leadSourcesPage.gotoLeadSourcesPage();
        await leadSourcesPage.addLeadSource(uniqueLeadSourceName);
        await expect(page.getByText('Lead source created successfully')).toBeVisible();
        // 2. Search for the lead source
        await leadSourcesPage.searchLeadSource(uniqueLeadSourceName);
        await expect(page.getByRole('cell', { name: uniqueLeadSourceName })).toBeVisible();
        // 3. View the lead source
        await leadSourcesPage.viewLeadSource(uniqueLeadSourceName);
        const viewDialog = page.getByRole('dialog', { name: 'View Lead Source' });
        await expect(viewDialog).toContainText(uniqueLeadSourceName);
        await viewDialog.getByRole('button', { name: 'Close modal' }).click();
        // 4. Edit the lead source
        await leadSourcesPage.editLeadSource(uniqueLeadSourceName, updatedLeadSourceName);
        await expect(page.getByText('Lead source updated successfully')).toBeVisible();
        // 5. Deactivate the lead source
        await leadSourcesPage.searchLeadSource(updatedLeadSourceName);
        await expect(leadSourcesPage.leadSourceRow(updatedLeadSourceName)).toBeVisible();
        await leadSourcesPage.deactivateLeadSource(updatedLeadSourceName);
        await expect(page.getByText('Lead source deactivated successfully')).toBeVisible();
        // 6. Restore the lead source
        await leadSourcesPage.filterByStatus('Inactive');
        await expect(leadSourcesPage.leadSourceRow(updatedLeadSourceName)).toBeVisible();
        await leadSourcesPage.restoreLeadSource(updatedLeadSourceName);
        await expect(leadSourcesPage.leadSourceRow(updatedLeadSourceName)).toBeHidden();
        await leadSourcesPage.filterByStatus('Active');
        await expect(leadSourcesPage.leadSourceRow(updatedLeadSourceName)).toBeVisible();
    });
});
