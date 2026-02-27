import { execSync } from 'node:child_process';
import { EditorNotFoundError } from '../types.js';

/**
 * Resolve the user's preferred editor using a fallback chain:
 * $VISUAL → $EDITOR → vi → nano
 *
 * Verifies the editor binary exists via `which`.
 * Throws EditorNotFoundError if no usable editor is found.
 */
export function resolveEditor(): string {
  const candidates = [
    process.env.VISUAL,
    process.env.EDITOR,
    'vi',
    'nano',
  ];

  for (const editor of candidates) {
    if (!editor) continue;
    try {
      execSync(`which ${editor}`, { stdio: 'ignore' });
      return editor;
    } catch {
      continue;
    }
  }

  throw new EditorNotFoundError();
}
