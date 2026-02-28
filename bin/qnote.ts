#!/usr/bin/env node

import React from 'react';
import { withFullScreen } from 'fullscreen-ink';
import { Command } from 'commander';
import { App } from '../src/tui/App.js';
import { NoteService } from '../src/core/note-service.js';
import { ConfigService } from '../src/core/config-service.js';
import { createCommands } from '../src/cli/commands.js';
import { restoreTerminal } from '../src/tui/utils/terminal.js';
import { join } from 'node:path';

const program = new Command();

const homeDir = process.env.HOME ?? '';
const configDir = join(homeDir, '.qnote');

function resolveNotesDir(): string {
  const config = ConfigService.load(configDir);
  return ConfigService.resolveNotesDir(config.notesDir);
}

// --- Fullscreen TUI launcher ---

async function startTui(notesDir: string): Promise<void> {
  // Signal handlers — safety net for abnormal termination
  // (fullscreen-ink handles normal alternate screen lifecycle)
  const handleSigInt = (): void => {
    restoreTerminal();
    process.exit(130);
  };
  const handleSigTerm = (): void => {
    restoreTerminal();
    process.exit(143);
  };
  const handleUncaughtException = (err: Error): void => {
    restoreTerminal();
    console.error('Fatal:', err.message);
    process.exit(1);
  };

  process.once('SIGINT', handleSigInt);
  process.once('SIGTERM', handleSigTerm);
  process.once('uncaughtException', handleUncaughtException);

  const noteService = new NoteService(notesDir);

  const ink = withFullScreen(
    React.createElement(App, {
      noteService,
      searchIndex: noteService.getSearchIndex(),
      captureDir: join(notesDir, 'inbox'),
      notesDir,
    }),
  );

  await ink.start();
  await ink.waitUntilExit();

  // Cleanup after TUI exits
  noteService.close();
  process.removeListener('SIGINT', handleSigInt);
  process.removeListener('SIGTERM', handleSigTerm);
  process.removeListener('uncaughtException', handleUncaughtException);
}

// --- CLI setup ---

program
  .name('qnote')
  .version('0.1.0')
  .description('AI-friendly terminal-native note-taking app');

// Default action (no subcommand) → launch fullscreen TUI
program.action(async () => {
  const notesDir = resolveNotesDir();
  ConfigService.ensureDirectories(notesDir);
  await startTui(notesDir);
});

program
  .command('new [title]')
  .description('Create a new note and open in $EDITOR')
  .action(async (title?: string) => {
    const cmds = createCommands(resolveNotesDir(), configDir);
    await cmds.newNote(title);
  });

program
  .command('search <query>')
  .description('Full-text search notes')
  .option('--tag <tag>', 'Filter results by tag')
  .action(async (query: string, options: { tag?: string }) => {
    const cmds = createCommands(resolveNotesDir(), configDir);
    await cmds.search(query, options);
  });

program
  .command('list')
  .description('List notes')
  .option('--tag <tag>', 'Filter by tag')
  .option('--sort <field>', 'Sort field (modified, created, title)')
  .option('--format <format>', 'Output format (text, json)')
  .action(async (options: { tag?: string; sort?: string; format?: string }) => {
    const cmds = createCommands(resolveNotesDir(), configDir);
    await cmds.list(options);
  });

program
  .command('daily')
  .description('Open or create today\'s daily note')
  .action(async () => {
    const cmds = createCommands(resolveNotesDir(), configDir);
    await cmds.daily();
  });

program
  .command('capture <text>')
  .description('Quick-capture text to inbox')
  .action(async (text: string) => {
    const cmds = createCommands(resolveNotesDir(), configDir);
    await cmds.capture(text);
  });

program
  .command('tags')
  .description('List all tags with note counts')
  .action(async () => {
    const cmds = createCommands(resolveNotesDir(), configDir);
    await cmds.tags();
  });

program
  .command('init [path]')
  .description('Initialize qnote in a directory (optional — auto-creates on first use)')
  .action(async (path?: string) => {
    const cmds = createCommands(resolveNotesDir(), configDir);
    await cmds.init(path);
  });

program
  .command('reindex')
  .description('Rebuild the search index from Markdown files')
  .action(async () => {
    const cmds = createCommands(resolveNotesDir(), configDir);
    await cmds.reindex();
  });

program.parse();
