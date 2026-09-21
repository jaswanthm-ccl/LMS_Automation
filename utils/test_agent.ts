/**
 * Canonical agent used across LMS automation.
 *
 * Credentials belong in .env and must not be committed with this metadata.
 * Use only this agent for assign / follow-up / disposition / report filters.
 */
export const TEST_AGENT = {
  /**
   * Display name in LMS dropdowns / reports / agent lookup.
   * Users list may show a login-style id; UI filters use this spaced label.
   */
  name: 'Automate user',
  email: 'automateuser@gmail.com',
  phone: '0987654321',
  /** Loose match for agent lookup dropdowns / APIs */
  labelMatch: 'Automate',
} as const;
