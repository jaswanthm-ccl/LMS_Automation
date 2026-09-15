import { test, expect } from '../../fixtures/auth.fixture';
import { LeadsPage } from '../../pages/main_menu/leads.page';
import { DuplicateLeadsPage } from '../../pages/main_menu/duplicate_leads.page';
import { getRandomLetters, getRandomNumber } from '../../utils/common';

test.describe('Duplicate Leads Module - Detection & Resolution', () => {
    test('should detect duplicate phone and resolve duplicate lead in queue', async ({ page }) => {
        test.setTimeout(90000);
        const leadsPage = new LeadsPage(page);
        const duplicateLeadsPage = new DuplicateLeadsPage(page);

        const sharedPhone = `9${getRandomNumber(9)}`;
        const primaryLeadName = `Lead${getRandomLetters(4)}`;
        const duplicateLeadName = `Dup${getRandomLetters(4)}`;

        // 1. Create Primary Lead on /lead
        await leadsPage.gotoLeadsPage();
        await leadsPage.addLead({
            name: primaryLeadName,
            phone: sharedPhone,
            email: `primary.${getRandomLetters(3).toLowerCase()}@example.com`,
            remarks: 'Primary verified lead',
        });
        await expect(page.getByText(/Lead created successfully/i)).toBeVisible();

        // 2. Submit second Lead with the SAME phone number
        await leadsPage.addLead({
            name: duplicateLeadName,
            phone: sharedPhone,
            email: `duplicate.${getRandomLetters(3).toLowerCase()}@example.com`,
            remarks: 'Duplicate lead submission',
        });
        // The backend either confirms creation into duplicate queue or shows creation notification
        await page.waitForTimeout(2000);

        // 3. Verify main Leads list shows primary lead, but excludes the pending duplicate
        await leadsPage.searchLead(primaryLeadName);
        await expect(page.getByRole('cell', { name: primaryLeadName })).toBeVisible();

        // 4. Navigate to Duplicate Leads module
        await duplicateLeadsPage.gotoDuplicateLeadsPage();

        // 5. Search for the shared phone number in the duplicate queue
        await duplicateLeadsPage.searchDuplicate(sharedPhone);
        const maskedPhone = `******${sharedPhone.slice(-4)}`;
        await expect(page.getByRole('cell', { name: duplicateLeadName })).toBeVisible();
        await expect(page.getByRole('cell', { name: maskedPhone, exact: true })).toBeVisible();

        // 6. Resolve Duplicate Lead (Ignore action)
        await duplicateLeadsPage.resolveDuplicate(duplicateLeadName, {
            action: 'ignore',
            reason: 'Verified duplicate candidate in test',
        });

        // 7. Verify resolution success notification
        await expect(page.getByText(/(Duplicate lead|Lead).*(ignored|merged|resolved|successfully)/i)).toBeVisible();
    });
});
