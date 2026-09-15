import { readFileSync } from 'fs';
import path from 'path';
import { test as base, expect } from '@playwright/test';

type SessionState = {
    origin: string;
    values: Record<string, string>;
};

const sessionFile = path.resolve(__dirname, '../playwright/.auth/session.json');

export const test = base.extend({
    page: async ({ page }, use) => {
        const sessionState = JSON.parse(readFileSync(sessionFile, 'utf-8')) as SessionState;

        await page.addInitScript(({ origin, values }: SessionState) => {
            if (window.location.origin === origin) {
                for (const [key, value] of Object.entries(values)) {
                    window.sessionStorage.setItem(key, value);
                }
            }
        }, sessionState);

        await use(page);
    },
});

export { expect };
