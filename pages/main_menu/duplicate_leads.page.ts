import { Locator, Page, expect } from "@playwright/test";

export class DuplicateLeadsPage {
    readonly page: Page;
    readonly searchInput: Locator;

    constructor(page: Page) {
        this.page = page;
        this.searchInput = page.getByRole('searchbox', { name: 'Search' });
    }

    // 1. Navigation
    async gotoDuplicateLeadsPage() {
        await this.page.goto('/duplicate-leads');
        await this.page.waitForLoadState('domcontentloaded');
        const loadingIndicator = this.page.getByText('Loading', { exact: true });
        if (await loadingIndicator.isVisible().catch(() => false)) {
            await loadingIndicator.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
        }
    }

    // 2. Search
    async searchDuplicate(term: string) {
        await this.searchInput.fill(term);
        await this.searchInput.press('Enter');
        await this.page.waitForTimeout(1000);
    }

    // 3. Row locator
    duplicateRow(identifier: string): Locator {
        return this.page.getByRole('row').filter({
            has: this.page.getByRole('cell').filter({ hasText: identifier }),
        });
    }

    // 4. Resolve Duplicate Action (Ignore or Merge)
    async resolveDuplicate(identifier: string, options: { action: 'ignore' | 'merge'; reason: string }) {
        const row = this.duplicateRow(identifier);
        
        // Find action button on the row (Resolve / Action button or icon in action column)
        const actionBtn = row.getByRole('button', { name: /resolve|action|review/i })
            .or(row.getByTitle(/resolve|action|review/i))
            .or(row.getByRole('cell').last().locator('button, [role="button"], .action-icon, i'))
            .or(row.getByRole('button'))
            .first();
        await actionBtn.click();

        const modal = this.page.getByRole('dialog', { name: 'Duplicate Lead Review' })
            .or(this.page.locator('ccl-modal:visible, [role="dialog"]:visible, app-custom-model:visible, .modal:visible'))
            .first();
        await expect(modal).toBeVisible({ timeout: 5000 });

        // 1. Fill Resolution Reason
        const reasonInput = modal.getByRole('textbox', { name: /reason/i })
            .or(modal.getByPlaceholder(/reason/i))
            .or(modal.locator('textarea, input[formcontrolname="reason"]'));
        await reasonInput.first().fill(options.reason);

        // 2. Click Resolution Action (Merge or Ignore)
        const actionBtnModal = modal.getByRole('button', { name: new RegExp(`^${options.action}$`, 'i') })
            .or(modal.getByRole('button', { name: new RegExp(options.action, 'i') }))
            .first();
        await actionBtnModal.click();

        // 3. The confirmation dialog opens asynchronously after the action.
        const confirmDialog = this.page.getByRole('dialog', {
            name: new RegExp(`Confirm ${options.action}`, 'i'),
        });
        await expect(confirmDialog).toBeVisible({ timeout: 5_000 });
        await confirmDialog.getByRole('button', { name: /^Yes$|^Confirm$/i }).click();
        await expect(confirmDialog).toBeHidden();
    }

    // 5. Filter by Status (pending, merged, ignored)
    async filterByStatus(status: 'pending' | 'merged' | 'ignored') {
        const filterButton = this.page.getByRole('button', { name: /filters/i });
        if (await filterButton.isVisible().catch(() => false)) {
            await filterButton.click();
        }
        const statusWrapper = this.page.locator('ccl-form-field-wrapper').filter({ hasText: /status/i });
        if (await statusWrapper.isVisible().catch(() => false)) {
            await statusWrapper.locator('.ccl-dropdown__trigger').click();
            await this.page.locator('.ccl-dropdown__option').filter({ hasText: new RegExp(`^${status}$`, 'i') }).first().click();
            await this.page.waitForTimeout(500);
        }
    }
}
