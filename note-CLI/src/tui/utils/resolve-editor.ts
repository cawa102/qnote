import { execSync } from 'node:child_process';
import { EditorNotFoundError } from '../../types.js';

/**
 * Resolve the user's preferred editor.
 * Priority: $VISUAL > $EDITOR > vi > nano.
 * Throws EditorNotFoundError if none are available.
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
