import { test as setup , expect} from "@playwright/test";
import { LoginPage } from "../pages/auth/login.page";
import { writeFile } from 'fs/promises';
import path from 'path';

const authFile = path.resolve(__dirname, '../playwright/.auth/user.json');
const sessionFile = path.resolve(__dirname, '../playwright/.auth/session.json');

setup('Authenticate user' , async ({page}) => {
    const loginPage = new LoginPage(page);
    await loginPage.gotoLoginPage();
    await loginPage.Login(process.env.EMAIL! , process.env.PASSWORD!);
    await expect(page).toHaveURL(/.*dashboard-component/);
    await page.context().storageState({ path : authFile});

    const sessionState = await page.evaluate(() => ({
        origin: window.location.origin,
        values: Object.fromEntries(
            Array.from({ length: sessionStorage.length }, (_, index) => {
                const key = sessionStorage.key(index)!;
                return [key, sessionStorage.getItem(key)!];
            }),
        ),
    }));
    await writeFile(sessionFile, JSON.stringify(sessionState), 'utf-8');
});
