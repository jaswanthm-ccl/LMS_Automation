import { test as authenticatedTest, expect } from './auth.fixture';
import type { CreatedRole } from '../pages/master_menu/roles.page';

type RoleCleanup = {
    register(role: CreatedRole): void;
};

export const test = authenticatedTest.extend<{ roleCleanup: RoleCleanup }>({
    roleCleanup: async ({ page }, use) => {
        const createdRoles: CreatedRole[] = [];

        await use({
            register: (role) => createdRoles.push(role),
        });

        if (createdRoles.length === 0) {
            return;
        }

        for (const role of createdRoles.reverse()) {
            const response = await page.context().request.delete(role.deleteUrl);

            if (response.ok()) {
                continue;
            }

            const responseBody = await response.text();
            if (response.status() === 422 && /already inactive/i.test(responseBody)) {
                continue;
            }

            throw new Error(
                `Role cleanup failed for ID ${role.id}: ${response.status()} ${responseBody}`,
            );
        }
    },
});

export { expect };
