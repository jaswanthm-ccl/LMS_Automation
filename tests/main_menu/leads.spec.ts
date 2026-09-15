


import { test, expect } from '../../fixtures/auth.fixture';
import { LeadsPage } from '../../pages/main_menu/leads.page';
import { getRandomLetters, getRandomNumber } from '../../utils/common';

test.describe('Leads Module - Creation & Lifecycle', () => {
    test('should create, search, view, and edit a lead', async ({ page }) => {
        test.setTimeout(60000);
        const leadsPage = new LeadsPage(page);

        const uniqueSuffix = getRandomLetters(4);
        const leadName = `Lead${uniqueSuffix}`;
        const phone = `9${getRandomNumber(9)}`;
        const email = `lead.${uniqueSuffix.toLowerCase()}${getRandomNumber(3)}@example.com`;
        const updatedLeadName = `${leadName}Edit`;

        // 1. Navigate to Leads page
        await leadsPage.gotoLeadsPage();

        // 2. Add New Lead
        await leadsPage.addLead({
            name: leadName,
            phone,
            email,
            remarks: 'Automated test lead',
        });
        await expect(page.getByText(/Lead created successfully/i)).toBeVisible();

        // 3. Search and verify in table
        await leadsPage.searchLead(leadName);
        await expect(page.getByRole('cell', { name: leadName })).toBeVisible();

        // 4. View Lead details
        await leadsPage.viewLead(leadName);

        // 5. Edit Lead
        await leadsPage.editLead(leadName, updatedLeadName);
        await expect(page.getByText(/Lead updated successfully/i)).toBeVisible();

        // 6. Search and verify updated lead in table
        await leadsPage.searchLead(updatedLeadName);
        await expect(page.getByRole('cell', { name: updatedLeadName })).toBeVisible();
    });
});
