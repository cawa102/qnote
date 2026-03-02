import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { QnoteConfig } from '../types.js';

const DEFAULT_CONFIG: QnoteConfig = {
  notesDir: '~/notes',
  daily: { directory: 'daily', template: 'daily' },
  capture: { directory: 'quick' },
  search: { excludeDirs: ['.git', 'node_modules', '.qnote'] },
};

export class ConfigService {
  static load(configDir: string): QnoteConfig {
    const configPath = join(configDir, 'config.json');

    if (!existsSync(configPath)) {
      return { ...DEFAULT_CONFIG };
    }

    try {
      const raw = readFileSync(configPath, 'utf-8');
      const partial = JSON.parse(raw) as Partial<QnoteConfig>;
      return {
        ...DEFAULT_CONFIG,
        ...partial,
      };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  static save(configDir: string, partial: Partial<QnoteConfig>): void {
    mkdirSync(configDir, { recursive: true });
    const configPath = join(configDir, 'config.json');

    let existing: Partial<QnoteConfig> = {};
    try {
      if (existsSync(configPath)) {
        existing = JSON.parse(readFileSync(configPath, 'utf-8')) as Partial<QnoteConfig>;
      }
    } catch {
      // Malformed existing config — start fresh
    }

    const merged = { ...DEFAULT_CONFIG, ...existing, ...partial };
    writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf-8');
  }

  static ensureDirectories(notesDir: string): void {
    mkdirSync(join(notesDir, '.qnote'), { recursive: true });
  }

  static resolveNotesDir(notesDir: string): string {
    if (notesDir.startsWith('~/')) {
      return join(process.env.HOME ?? '', notesDir.slice(2));
    }
    return notesDir;
  }
}
