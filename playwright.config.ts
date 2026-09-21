import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '.env') });

const authFile = path.resolve(__dirname, 'playwright/.auth/user.json');
const agentAuthFile = path.resolve(__dirname, 'playwright/.auth/agent.json');
const agentSpecs = /main_menu[\\/](my_leads|agent_.*)\.spec\.ts/;
const diagnosticSpecs =
  /(?:^|[\\/])(?:(?:_probe_|agent_probe_|agent_doocti_call_demo).*|regression[\\/]agent_follow_up_flow)\.spec\.ts$/;
const adminProjectIgnore = [agentSpecs, /auth\.agent\.setup\.ts/, diagnosticSpecs];


/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Stateful LMS flows share rate limits and master data; keep each spec file sequential. */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* The shared LMS dev API rate-limits stateful CRUD flows. */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [['list'], ['html', { open: 'never' }]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL: process.env.BASE_URL,
    trace: 'on-first-retry',
  },
  /* Configure projects for major browsers */
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'setup-agent',
      testMatch: /auth\.agent\.setup\.ts/,
    },

    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        storageState: authFile,
        
       },
      dependencies: ['setup'],
      testIgnore: adminProjectIgnore,
    },

    {
      name: 'chromium-agent',
      testMatch: /main_menu[\\/](my_leads|agent_.*)\.spec\.ts/,
      testIgnore: diagnosticSpecs,
      use: {
        ...devices['Desktop Chrome'],
        storageState: agentAuthFile,
      },
      // Admin setup is required so demos can seed a lead for Automate_user when inbox is empty.
      dependencies: ['setup', 'setup-agent'],
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: authFile,
       },
      dependencies: ['setup'],
      testIgnore: adminProjectIgnore,
    },

    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        storageState: authFile,
      },
      dependencies: ['setup'],
      testIgnore: adminProjectIgnore,
    },
  ],
});
