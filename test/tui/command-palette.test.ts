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
  it('contentWidth=80 → menuWidth=48, leftPad=16', () => {
    const layout = computePaletteLayout(80);
    expect(layout.menuWidth).toBe(48);
    expect(layout.leftPad).toBe(16);
  });

  it('contentWidth=60 → menuWidth=48, leftPad=6', () => {
    const layout = computePaletteLayout(60);
    expect(layout.menuWidth).toBe(48);
    expect(layout.leftPad).toBe(6);
  });

  it('contentWidth=48 → menuWidth=40, leftPad=4', () => {
    const layout = computePaletteLayout(48);
    expect(layout.menuWidth).toBe(40);
    expect(layout.leftPad).toBe(4);
  });

  it('contentWidth=30 → menuWidth=30 (min), leftPad=0 (non-negative)', () => {
    const layout = computePaletteLayout(30);
    expect(layout.menuWidth).toBe(30);
    expect(layout.leftPad).toBe(0);
  });

  it('contentWidth=100 → menuWidth=48 (max clamp)', () => {
    const layout = computePaletteLayout(100);
    expect(layout.menuWidth).toBe(48);
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

  it('rowGap is always 1', () => {
    expect(computePaletteLayout(30).rowGap).toBe(1);
    expect(computePaletteLayout(80).rowGap).toBe(1);
    expect(computePaletteLayout(100).rowGap).toBe(1);
  });
});
