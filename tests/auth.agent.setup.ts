import { test as setup, expect } from '@playwright/test';
import { LoginPage } from '../pages/auth/login.page';
import { writeFile } from 'fs/promises';
import path from 'path';
import { TEST_AGENT } from '../utils/test_agent';

const authFile = path.resolve(__dirname, '../playwright/.auth/agent.json');
const sessionFile = path.resolve(__dirname, '../playwright/.auth/agent-session.json');

setup('Authenticate agent', async ({ page }) => {
  const email = process.env.AGENT_EMAIL || TEST_AGENT.email;
  const password = process.env.AGENT_PASSWORD;
  expect(email, 'AGENT_EMAIL / TEST_AGENT.email must be set').toBeTruthy();
  expect(
    password,
    'Set AGENT_PASSWORD in .env to the LMS password for automateuser@gmail.com (not the Doocti dialer password)',
  ).toBeTruthy();

  const loginPage = new LoginPage(page);
  await loginPage.gotoLoginPage();
  await loginPage.Login(email, password);

  // Agents may land on dashboard or my-leads depending on role defaults.
  await expect(page).toHaveURL(/dashboard|my-leads|agent/i, { timeout: 30_000 });
  await page.context().storageState({ path: authFile });

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
