import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ConfigService } from '../../src/core/config-service.js';

describe('ConfigService', () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), 'qnote-cfg-'));
  });

  afterEach(() => {
    rmSync(tempHome, { recursive: true, force: true });
  });

  describe('load', () => {
    it('returns default config when no file exists', () => {
      const config = ConfigService.load(join(tempHome, '.qnote'));
      expect(config.notesDir).toBe('~/notes');
      expect(config.editor).toBe('$EDITOR');
      expect(config.daily.directory).toBe('daily');
      expect(config.daily.template).toBe('daily');
      expect(config.capture.directory).toBe('inbox');
      expect(config.search.excludeDirs).toEqual(['.git', 'node_modules', '.qnote']);
    });

    it('reads config from file', () => {
      const configDir = join(tempHome, '.qnote');
      mkdirSync(configDir, { recursive: true });
      writeFileSync(
        join(configDir, 'config.json'),
        JSON.stringify({ notesDir: '/custom/notes' }),
      );

      const config = ConfigService.load(configDir);
      expect(config.notesDir).toBe('/custom/notes');
    });

    it('merges partial config with defaults', () => {
      const configDir = join(tempHome, '.qnote');
      mkdirSync(configDir, { recursive: true });
      writeFileSync(
        join(configDir, 'config.json'),
        JSON.stringify({ editor: 'nvim' }),
      );

      const config = ConfigService.load(configDir);
      expect(config.editor).toBe('nvim');
      // Other defaults preserved
      expect(config.notesDir).toBe('~/notes');
      expect(config.daily.directory).toBe('daily');
    });

    it('returns a new object each time (no shared mutation)', () => {
      const configDir = join(tempHome, '.qnote');
      const config1 = ConfigService.load(configDir);
      const config2 = ConfigService.load(configDir);
      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });

  describe('save', () => {
    it('saves config to file', () => {
      const configDir = join(tempHome, '.qnote');
      ConfigService.save(configDir, { notesDir: '/my/notes' });

      const config = ConfigService.load(configDir);
      expect(config.notesDir).toBe('/my/notes');
    });

    it('creates config directory if it does not exist', () => {
      const configDir = join(tempHome, 'nested', '.qnote');
      ConfigService.save(configDir, { editor: 'code' });

      const config = ConfigService.load(configDir);
      expect(config.editor).toBe('code');
    });

    it('merges with existing config on disk', () => {
      const configDir = join(tempHome, '.qnote');
      ConfigService.save(configDir, { notesDir: '/first' });
      ConfigService.save(configDir, { editor: 'vim' });

      const config = ConfigService.load(configDir);
      expect(config.notesDir).toBe('/first');
      expect(config.editor).toBe('vim');
    });

    it('writes valid JSON to disk', () => {
      const configDir = join(tempHome, '.qnote');
      ConfigService.save(configDir, { notesDir: '/test' });

      const raw = readFileSync(join(configDir, 'config.json'), 'utf-8');
      const parsed = JSON.parse(raw);
      expect(parsed.notesDir).toBe('/test');
    });
  });

  describe('resolveNotesDir', () => {
    it('expands ~ to home directory', () => {
      const resolved = ConfigService.resolveNotesDir('~/notes');
      expect(resolved).not.toContain('~');
      expect(resolved.endsWith('/notes')).toBe(true);
    });

    it('returns absolute paths unchanged', () => {
      const resolved = ConfigService.resolveNotesDir('/absolute/path');
      expect(resolved).toBe('/absolute/path');
    });

    it('returns relative paths unchanged', () => {
      const resolved = ConfigService.resolveNotesDir('relative/path');
      expect(resolved).toBe('relative/path');
    });
  });
});
