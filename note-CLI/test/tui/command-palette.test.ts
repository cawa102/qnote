import { describe, it, expect } from 'vitest';
import {
  filterCommands,
  PALETTE_COMMANDS,
} from '../../src/tui/screens/CommandPalette.js';

describe('filterCommands', () => {
  it('returns all commands when query is empty', () => {
    const results = filterCommands(PALETTE_COMMANDS, '');
    expect(results).toHaveLength(PALETTE_COMMANDS.length);
  });

  it('fuzzy matches commands by label', () => {
    const results = filterCommands(PALETTE_COMMANDS, 'da');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.label).toBe('daily');
  });

  it('fuzzy matches commands by Japanese description', () => {
    const results = filterCommands(PALETTE_COMMANDS, 'ノート');
    expect(results.length).toBeGreaterThan(0);
  });

  it('returns empty for non-matching query', () => {
    const results = filterCommands(PALETTE_COMMANDS, 'zzzzz');
    expect(results).toHaveLength(0);
  });
});
