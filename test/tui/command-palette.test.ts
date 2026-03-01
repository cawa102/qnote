import { describe, it, expect } from 'vitest';
import {
  PALETTE_COMMANDS,
} from '../../src/tui/screens/CommandPalette.js';
import {
  computePaletteGridLayout,
} from '../../src/theme/format.js';

describe('PALETTE_COMMANDS', () => {
  it('has 6 commands (Recent removed)', () => {
    expect(PALETTE_COMMANDS).toHaveLength(6);
  });

  it('each command has label, key, action, and icon fields', () => {
    for (const cmd of PALETTE_COMMANDS) {
      expect(typeof cmd.label).toBe('string');
      expect(typeof cmd.key).toBe('string');
      expect(cmd.key).toHaveLength(1);
      expect(typeof cmd.action).toBe('string');
      expect(typeof cmd.icon).toBe('string');
      expect(cmd.icon.length).toBeGreaterThan(0);
    }
  });

  it('all keys are unique', () => {
    const keys = PALETTE_COMMANDS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('no command has action "recent"', () => {
    const actions = PALETTE_COMMANDS.map((c) => c.action);
    expect(actions).not.toContain('recent');
  });
});

describe('computePaletteGridLayout', () => {
  it('width 80 → 3 columns', () => {
    const layout = computePaletteGridLayout(80);
    expect(layout.columns).toBe(3);
  });

  it('width 60 → 3 columns', () => {
    const layout = computePaletteGridLayout(60);
    expect(layout.columns).toBe(3);
  });

  it('width 50 → 2 columns', () => {
    const layout = computePaletteGridLayout(50);
    expect(layout.columns).toBe(2);
  });

  it('width 40 → 2 columns', () => {
    const layout = computePaletteGridLayout(40);
    expect(layout.columns).toBe(2);
  });

  it('width 35 → 1 column (vertical fallback)', () => {
    const layout = computePaletteGridLayout(35);
    expect(layout.columns).toBe(1);
  });

  it('width 20 → 1 column', () => {
    const layout = computePaletteGridLayout(20);
    expect(layout.columns).toBe(1);
  });

  it('cellWidth accounts for columnGap in multi-column layouts', () => {
    // 3 columns: available = 80 - 2*2 = 76, cellWidth = floor(76/3) = 25
    const layout3 = computePaletteGridLayout(80);
    expect(layout3.cellWidth).toBe(Math.floor((80 - 2 * 2) / 3));
    expect(layout3.columnGap).toBe(2);

    // 2 columns: available = 50 - 2*1 = 48, cellWidth = floor(48/2) = 24
    const layout2 = computePaletteGridLayout(50);
    expect(layout2.cellWidth).toBe(Math.floor((50 - 2 * 1) / 2));
    expect(layout2.columnGap).toBe(2);
  });

  it('cellWidth equals contentWidth for 1 column (no gap)', () => {
    const layout = computePaletteGridLayout(35);
    expect(layout.cellWidth).toBe(35);
    expect(layout.columnGap).toBe(0);
  });

  it('leftPad centers the grid including gaps', () => {
    const layout = computePaletteGridLayout(80);
    const totalGridWidth = layout.columns * layout.cellWidth + layout.columnGap * (layout.columns - 1);
    const expectedLeftPad = Math.floor((80 - totalGridWidth) / 2);
    expect(layout.leftPad).toBe(expectedLeftPad);
  });

  it('rowGap is always 1', () => {
    expect(computePaletteGridLayout(30).rowGap).toBe(1);
    expect(computePaletteGridLayout(80).rowGap).toBe(1);
  });

  it('separatorGap is always 2', () => {
    expect(computePaletteGridLayout(30).separatorGap).toBe(2);
    expect(computePaletteGridLayout(80).separatorGap).toBe(2);
  });
});
