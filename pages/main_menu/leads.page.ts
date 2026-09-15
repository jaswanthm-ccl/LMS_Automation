import { Locator, Page, expect } from "@playwright/test";
import { EXISTING_CITY, EXISTING_COUNTRY, EXISTING_STATE } from "../../utils/common";

export class LeadsPage {
    readonly page: Page;
    readonly addLeadButton: Locator;
    readonly nameInput: Locator;
    readonly phoneInput: Locator;
    readonly emailInput: Locator;
    readonly remarksInput: Locator;
    readonly saveButton: Locator;
    readonly searchInput: Locator;

    constructor(page: Page) {
        this.page = page;
        this.addLeadButton = page.getByRole('button', { name: '+ Add' }).or(page.getByRole('button', { name: 'Add' }));
        this.nameInput = page.locator('ccl-input[formcontrolname="name"] input').or(page.getByRole('textbox', { name: /name/i }));
        this.phoneInput = page.locator('ccl-input[formcontrolname="primary_phone"] input').or(page.getByRole('textbox', { name: /phone/i }));
        this.emailInput = page.locator('ccl-input[formcontrolname="email"] input').or(page.getByRole('textbox', { name: /email/i }));
        this.remarksInput = page.locator('textarea[formcontrolname="remarks"]').or(page.getByRole('textbox', { name: /remarks/i }));
        this.saveButton = page.getByRole('button', { name: 'Save' });
        this.searchInput = page.getByRole('searchbox', { name: 'Search' });
    }

    // 1. Navigation
    async gotoLeadsPage() {
        await this.page.goto('/lead');
    }

    // 2. Search
    async searchLead(term: string) {
        await this.searchInput.fill(term);
        await this.searchInput.press('Enter');
        await this.page.waitForTimeout(1000);
    }

    // 3. Helper to locate a specific lead's row
    leadRow(identifier: string): Locator {
        return this.page.getByRole('row').filter({
            has: this.page.getByRole('cell', { name: identifier }),
        });
    }

    private dropdownTrigger(modal: Locator, placeholder: string): Locator {
        return modal
            .locator(`ccl-dropdown[placeholder="${placeholder}"]`)
            .locator('.ccl-dropdown__trigger');
    }

    private async selectDropdownOption(
        trigger: Locator,
        optionName: string,
        fieldName: string,
        dependentRequest?: RegExp,
    ) {
        await expect(trigger, `${fieldName} dropdown should be visible`).toBeVisible();
        await expect(
            trigger,
            `${fieldName} dropdown should be enabled`,
        ).not.toHaveClass(/ccl-dropdown__trigger--disabled/, { timeout: 10_000 });

        if ((await trigger.innerText()).trim().includes(optionName)) {
            return;
        }

        await trigger.click();
        const option = this.page
            .locator('.ccl-dropdown__option:not(.disabled)')
            .filter({ hasText: optionName })
            .first();

        await expect(
            option,
            `${fieldName} option "${optionName}" should be available`,
        ).toBeVisible({ timeout: 10_000 });

        const dependentResponse = dependentRequest
            ? this.page.waitForResponse(
                (response) => dependentRequest.test(response.url()),
                { timeout: 10_000 },
            )
            : undefined;

        await option.click();

        if (dependentResponse) {
            const response = await dependentResponse;
            expect(
                response.ok(),
                `${fieldName} dependent options request should succeed`,
            ).toBeTruthy();
        }

        await expect(trigger).toContainText(optionName);
    }

    // 4. Create Lead
    async addLead(options: {
        name: string;
        phone: string;
        sourceName?: string;
        countryName?: string;
        stateName?: string;
        cityName?: string;
        email?: string;
        remarks?: string;
    }) {
        await this.addLeadButton.click();
        await this.nameInput.fill(options.name);
        await this.phoneInput.fill(options.phone);

        if (options.email) {
            await this.emailInput.fill(options.email);
        }

        if (options.remarks && (await this.remarksInput.isVisible())) {
            await this.remarksInput.fill(options.remarks);
        }

        const modal = this.page.locator('app-custom-model');

        // 1. Lead Source (if not already selected)
        const sourceWrapper = modal.locator('ccl-form-field-wrapper').filter({ hasText: /Lead Source/i });
        const sourceTrigger = sourceWrapper.locator('.ccl-dropdown__trigger');
        if (await sourceTrigger.isVisible()) {
            const sourceText = await sourceTrigger.innerText();
            if (sourceText.includes('Select') || !sourceText.trim()) {
                await sourceTrigger.click();
                if (options.sourceName) {
                    await this.page.locator('.ccl-dropdown__option').filter({ hasText: options.sourceName }).first().click();
                } else {
                    await this.page.locator('.ccl-dropdown__option:not(.disabled)').first().click();
                }
            }
        }

        // 2. Select the complete dependent location chain. Changing a parent
        // clears and reloads its child dropdown, so the order is important.
        const countryTrigger = this.dropdownTrigger(modal, 'Select country');
        const stateTrigger = this.dropdownTrigger(modal, 'Select state');
        const cityTrigger = this.dropdownTrigger(modal, 'Select city');

        // The form applies default masters asynchronously after opening. Wait
        // for that initialization so it cannot overwrite our selections.
        await expect(countryTrigger).not.toContainText('Select country', { timeout: 15_000 });

        await this.selectDropdownOption(
            countryTrigger,
            options.countryName ?? EXISTING_COUNTRY,
            'Country',
            /\/states(?:\?|$)/,
        );
        await this.selectDropdownOption(
            stateTrigger,
            options.stateName ?? EXISTING_STATE,
            'State',
            /\/cities(?:\?|$)/,
        );
        await this.selectDropdownOption(
            cityTrigger,
            options.cityName ?? EXISTING_CITY,
            'City',
        );
        await expect(stateTrigger).toContainText(options.stateName ?? EXISTING_STATE);

        // 3. Area Value (required if a default Area is pre-selected)
        const areaValueInput = modal.getByPlaceholder('Enter Value').or(modal.locator('input[placeholder*="Value"]'));
        if (await areaValueInput.first().isVisible().catch(() => false)) {
            await areaValueInput.first().fill('1000');
        }

        await this.saveButton.click();
    }

    // 5. View Lead
    async viewLead(name: string) {
        await this.leadRow(name).getByTitle('View', { exact: true }).click();
        const viewDialog = this.page.getByRole('dialog', { name: 'View Lead' });
        await expect(viewDialog).toBeVisible();
        await expect(viewDialog).toContainText(name);
        await viewDialog.getByRole('button', { name: 'Close modal' }).click();
    }

    // 6. Edit Lead
    async editLead(name: string, updatedName: string) {
        await this.leadRow(name).getByTitle('Edit', { exact: true }).click();
        const editDialog = this.page.getByRole('dialog', { name: 'Edit Lead' }).or(this.page.locator('app-custom-model'));
        await expect(this.nameInput).not.toHaveValue('');
        await this.nameInput.fill(updatedName);

        const areaValueInput = editDialog.getByPlaceholder('Enter Value').or(editDialog.locator('input[placeholder*="Value"]'));
        if (await areaValueInput.first().isVisible().catch(() => false)) {
            const currentVal = await areaValueInput.first().inputValue();
            if (!currentVal) {
                await areaValueInput.first().fill('1000');
            }
        }

        await this.saveButton.click();
    }
}
