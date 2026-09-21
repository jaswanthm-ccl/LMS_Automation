import { expect, type Frame, type Page, type Response } from '@playwright/test';

export class DooctiDialerPage {
  private frame: Frame | null = null;

  constructor(private readonly page: Page) {}

  private async currentFrame(): Promise<Frame> {
    await expect
      .poll(() => this.page.frames().find((candidate) => /doocti/i.test(candidate.url()))?.url(), {
        message: 'Doocti iframe should load',
        timeout: 30_000,
      })
      .toBeTruthy();

    this.frame = this.page.frames().find((candidate) => /doocti/i.test(candidate.url())) ?? null;
    if (!this.frame) throw new Error('Doocti iframe disappeared after loading');
    return this.frame;
  }

  private async isDialerShellReady(frame: Frame): Promise<boolean> {
    const body = (await frame.locator('body').innerText()).replace(/\s+/g, ' ');
    const stillSelectingQueue = /Select Queues/i.test(body);
    const agentStatus = await frame.evaluate(() => localStorage.getItem('liveagentdata'));
    const hasActiveAgentSession = ['READY', 'PAUSE', 'DISPO', 'CONNECT'].includes(
      agentStatus ?? '',
    );
    return !stillSelectingQueue && hasActiveAgentSession;
  }

  private async ensureAgentReady(frame: Frame): Promise<void> {
    const readStatus = () => frame.evaluate(() => localStorage.getItem('liveagentdata'));
    if ((await readStatus()) === 'READY') return;

    const agentStatus = frame.locator('img[title="Agent Status"]');
    await expect(agentStatus, 'Doocti Agent Status control should be available').toBeVisible();
    await agentStatus.click();

    const online = frame.locator('.option').filter({ hasText: /^\s*Online\s*$/i });
    await expect(online, 'Paused Doocti agent should offer Online status').toBeVisible();
    await online.click();

    await expect.poll(readStatus, {
      message: 'Doocti agent status should become READY',
      timeout: 30_000,
    }).toBe('READY');
  }

  private async selectQueue(frame: Frame, queueName?: string): Promise<Response> {
    const proceed = frame.locator('button.queue-button', { hasText: /Proceed/i });
    await expect(proceed).toBeVisible({ timeout: 20_000 });

    const selectedQueues = frame.locator('.select__multi-value__remove');
    while ((await selectedQueues.count()) > 0) {
      await selectedQueues.nth(0).click();
    }

    await frame.locator('.select__control').click();
    const options = frame.locator('.select__option:not(.select__option--is-disabled)');
    const option = queueName
      ? options.filter({ hasText: new RegExp(`^${queueName}$`, 'i') })
      : options.nth(0);
    await expect(option, `Doocti queue ${queueName ?? '(first available)'} should exist`).toBeVisible();
    await option.click();

    const responsePromise = this.page.waitForResponse(
      (response) => /\/crm\/login/i.test(response.url()) && response.request().method() === 'POST',
      { timeout: 30_000 },
    );
    await proceed.click();
    return responsePromise;
  }

  private async logoutFrom(frame: Frame): Promise<boolean> {
    const logoutButton = () =>
      frame.locator('button.userlogout').or(frame.getByRole('button', { name: /Logout/i }));
    const logout = logoutButton();
    if (!(await logout.isVisible())) return false;
    await logout.click();
    await expect.poll(
      async () =>
        (await frame.locator('input[type="password"]').isVisible()) ||
        (await frame.locator('button.queue-button', { hasText: /Proceed/i }).isVisible()),
      { message: 'Doocti should leave the active dialer session', timeout: 20_000 },
    ).toBe(true);
    return true;
  }

  async enterDialer(queueName?: string): Promise<void> {
    let frame = await this.currentFrame();

    const agentStatus = await frame.evaluate(() => localStorage.getItem('liveagentdata'));
    if (/homepage/i.test(frame.url()) && !agentStatus) {
      // LMS has just sent Doocti its automatic OAuth message. The iframe can still
      // show its previous route briefly, so let that login settle without reloading
      // and accidentally sending the OAuth message a second time.
      await expect.poll(
        async () =>
          (await frame.locator('button.queue-button', { hasText: /Proceed/i }).isVisible()) ||
          (await this.isDialerShellReady(frame)),
        { message: 'Doocti automatic login should reach queue selection', timeout: 30_000 },
      ).toBe(true);
    }

    if (await this.isDialerShellReady(frame)) {
      await this.ensureAgentReady(frame);
      return;
    }

    const response = await this.selectQueue(frame, queueName);
    if (response.status() === 409) {
      throw new Error(
        'Doocti CRM login returned HTTP 409: this agent already has an active Live Agents session. ' +
          'The automation will not repeat login automatically.',
      );
    }

    expect(response.ok(), `Doocti CRM login failed with HTTP ${response.status()}`).toBeTruthy();
    await expect.poll(() => this.isDialerShellReady(frame), {
      message: 'Doocti dialer shell should load after queue selection',
      timeout: 30_000,
    }).toBe(true);
    await this.ensureAgentReady(frame);
  }

  async tryForceLogout(email: string): Promise<boolean> {
    const apiBase = process.env.API_BASE_URL!;
    const response = await this.page.context().request.post(
      `${apiBase}/api/v1/auth/doocti-logout`,
      { data: { user: email } },
    );
    if (response.ok()) return true;

    const body = await response.text();
    if (response.status() === 500 && /logout token not configured/i.test(body)) {
      console.warn('Doocti force logout is unavailable in this environment; using iframe session cleanup.');
      return false;
    }
    throw new Error(`Doocti force logout failed with HTTP ${response.status()}: ${body}`);
  }

  async minimize(): Promise<void> {
    const minimize = this.page.getByRole('button', { name: /Minimize phone panel/i });
    await expect(minimize).toBeVisible({ timeout: 10_000 });
    await minimize.click();
  }

  async restore(): Promise<void> {
    if (this.page.isClosed()) return;
    const restore = this.page.getByRole('button', {
      name: /Maximize phone panel|Expand phone panel|Open phone panel/i,
    });
    if (await restore.isVisible()) await restore.click();
  }

  async logout(): Promise<void> {
    const frame = await this.currentFrame();
    await this.logoutFrom(frame);
  }
}
