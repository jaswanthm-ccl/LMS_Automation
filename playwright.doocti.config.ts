import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const agentAuthFile = path.resolve(__dirname, 'playwright/.auth/agent.json');

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL,
    trace: 'retain-on-failure',
  },
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
      name: 'doocti-real',
      testMatch: /main_menu[\\/]agent_doocti_call_demo\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: agentAuthFile,
        headless: false,
        launchOptions: {
          slowMo: Number(process.env.PLAYWRIGHT_SLOW_MO ?? 0),
        },
      },
      dependencies: ['setup', 'setup-agent'],
    },
  ],
});
