import { describe, it, expect } from 'vitest';
import {
  PALETTE_COMMANDS,
} from '../../src/tui/screens/CommandPalette.js';
import {
  computePaletteLayout,
} from '../../src/theme/format.js';

describe('PALETTE_COMMANDS', () => {
  it('has 7 commands', () => {
    expect(PALETTE_COMMANDS).toHaveLength(7);
  });

  it('each command has label, key, and action', () => {
    for (const cmd of PALETTE_COMMANDS) {
      expect(typeof cmd.label).toBe('string');
      expect(typeof cmd.key).toBe('string');
      expect(cmd.key).toHaveLength(1);
      expect(typeof cmd.action).toBe('string');
    }
  });

  it('all keys are unique', () => {
    const keys = PALETTE_COMMANDS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('computePaletteLayout', () => {
  it('contentWidth=80 → menuWidth=72, leftPad=4', () => {
    const layout = computePaletteLayout(80);
    expect(layout.menuWidth).toBe(72);
    expect(layout.leftPad).toBe(4);
  });

  it('contentWidth=60 → menuWidth=52, leftPad=4', () => {
    const layout = computePaletteLayout(60);
    expect(layout.menuWidth).toBe(52);
    expect(layout.leftPad).toBe(4);
  });

  it('contentWidth=48 → menuWidth=44 (min clamp), leftPad=2', () => {
    const layout = computePaletteLayout(48);
    expect(layout.menuWidth).toBe(44);
    expect(layout.leftPad).toBe(2);
  });

  it('contentWidth=30 → menuWidth=44 (min), leftPad=0 (non-negative)', () => {
    const layout = computePaletteLayout(30);
    expect(layout.menuWidth).toBe(44);
    expect(layout.leftPad).toBe(0);
  });

  it('contentWidth=100 → menuWidth=72 (max clamp)', () => {
    const layout = computePaletteLayout(100);
    expect(layout.menuWidth).toBe(72);
  });

  it('contentWidth >= 50 → showKeys=true', () => {
    expect(computePaletteLayout(50).showKeys).toBe(true);
    expect(computePaletteLayout(80).showKeys).toBe(true);
    expect(computePaletteLayout(100).showKeys).toBe(true);
  });

  it('contentWidth < 50 → showKeys=false', () => {
    expect(computePaletteLayout(49).showKeys).toBe(false);
    expect(computePaletteLayout(30).showKeys).toBe(false);
  });
});
