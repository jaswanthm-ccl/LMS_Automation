import { test, expect } from "@playwright/test"

import { LoginPage } from "../../pages/auth/login.page";

test.use({ storageState: { cookies: [], origins: [] } });


test('loginPage', async ({page}) => {
   const login = new LoginPage(page)
   await login.gotoLoginPage();
   await login.Login(process.env.EMAIL! , process.env.PASSWORD!);
   await expect(page).toHaveURL(/.*dashboard-component/);


});



test ('should show error with invalid credentials', async ({page}) => {
   const login = new LoginPage(page);
   await login.gotoLoginPage();
   await login.Login(process.env.INVALID_EMAIL! , process.env.INVALID_PASSWORD!);
   await expect(page.locator('.alert-danger')).toContainText('Invalid email address');
});

test ('should show validation error when email is empty', async ({page}) => {
   const login = new LoginPage(page);
   await login.gotoLoginPage();
   await login.Login('' , process.env.INVALID_PASSWORD!);
   await expect(page.getByText('Email is required')).toBeVisible();
});
