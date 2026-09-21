


import { test, expect } from '../../fixtures/lead-flow.fixture';
import { LeadsPage } from '../../pages/main_menu/leads.page';
import { getRandomLetters, getRandomNumber } from '../../utils/common';

test.describe('Leads Module - Creation & Lifecycle', () => {
    test.describe.configure({ mode: 'serial' });

    let createdLeadId = 0;

    test('should create, search, view, and edit a lead', async ({ page, leadFlowCleanup }) => {
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
        const createdLead = await leadsPage.addLead({
            name: leadName,
            phone,
            email,
            remarks: 'Automated test lead',
        });
        createdLeadId = createdLead.id;
        leadFlowCleanup.registerLead(createdLead.id);
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

    test('should archive the created lead during automatic cleanup', async ({ page }) => {
        const apiOrigin = new URL(process.env.API_BASE_URL!).origin;
        const response = await page.request.get(`${apiOrigin}/api/v1/leads/${createdLeadId}`);
        expect(response.ok()).toBeTruthy();

        const body = await response.json();
        expect(body.data.deleted_at).not.toBeNull();
        expect(body.data.status).toBe('ARCHIVED');
    });
});
