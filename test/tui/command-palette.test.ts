import { describe, it, expect } from 'vitest';
import { PALETTE_COMMANDS } from '../../src/tui/screens/CommandPalette.js';

describe('PALETTE_COMMANDS', () => {
  it('contains the expected number of commands', () => {
    expect(PALETTE_COMMANDS).toHaveLength(7);
  });

  it('each command has label, description, and action', () => {
    for (const cmd of PALETTE_COMMANDS) {
      expect(cmd.label).toBeTruthy();
      expect(cmd.description).toBeTruthy();
      expect(cmd.action).toBeTruthy();
    }
  });

  it('has unique action values', () => {
    const actions = PALETTE_COMMANDS.map((c) => c.action);
    expect(new Set(actions).size).toBe(actions.length);
  });
});
