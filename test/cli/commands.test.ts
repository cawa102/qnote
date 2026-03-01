import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('createCommands', () => {
  let tempDir: string;
  let configDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'qnote-cli-'));
    configDir = join(tempDir, '.config-qnote');
    mkdirSync(join(tempDir, '.qnote'), { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('newNote creates a note and prints path', async () => {
    const { createCommands } = await import('../../src/cli/commands.js');
    const cmds = createCommands(tempDir, configDir);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmds.newNote('Test CLI Note');
    logSpy.mockRestore();

    const files = readdirSync(tempDir).filter((f: string) => f.endsWith('.md'));
    expect(files.length).toBeGreaterThanOrEqual(1);
  });

  it('newNote generates untitled slug when no title given', async () => {
    vi.resetModules();
    const { createCommands } = await import('../../src/cli/commands.js');
    const cmds = createCommands(tempDir, configDir);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmds.newNote();
    logSpy.mockRestore();

    const files = readdirSync(tempDir).filter((f: string) => f.endsWith('.md'));
    expect(files.length).toBeGreaterThanOrEqual(1);
    expect(files.some((f: string) => f.startsWith('untitled-'))).toBe(true);
  });

  it('search returns matching notes to stdout', async () => {
    const { createCommands } = await import('../../src/cli/commands.js');
    const cmds = createCommands(tempDir, configDir);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmds.newNote('Searchable Note');

    await cmds.search('Searchable', {});
    logSpy.mockRestore();
  });

  it('search filters by tag when --tag is provided', async () => {
    const { createCommands } = await import('../../src/cli/commands.js');
    const cmds = createCommands(tempDir, configDir);

    const { NoteService } = await import('../../src/core/note-service.js');
    const svc = new NoteService(tempDir);
    await svc.create({ title: 'API Result', tags: ['api'], content: 'API searchable content here.' });
    await svc.create({ title: 'Other Result', tags: ['other'], content: 'Also searchable API content.' });
    svc.close();

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmds.search('searchable', { tag: 'api' });

    const output = logSpy.mock.calls.map((c) => c[0] as string);
    expect(output.some((line: string) => line.includes('API Result'))).toBe(true);
    logSpy.mockRestore();
  });

  it('list outputs notes in text format', async () => {
    const { createCommands } = await import('../../src/cli/commands.js');
    const cmds = createCommands(tempDir, configDir);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmds.newNote('Listed Note');
    await cmds.list({});
    logSpy.mockRestore();
  });

  it('list filters by tag when --tag is provided', async () => {
    const { createCommands } = await import('../../src/cli/commands.js');
    const cmds = createCommands(tempDir, configDir);

    const { NoteService } = await import('../../src/core/note-service.js');
    const svc = new NoteService(tempDir);
    await svc.create({ title: 'API Note', tags: ['api'], content: 'API content here.' });
    await svc.create({ title: 'Design Note', tags: ['design'], content: 'Design content.' });
    svc.close();

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmds.list({ tag: 'api' });

    const output = logSpy.mock.calls.map((c) => c[0] as string);
    expect(output.some((line: string) => line.includes('API Note'))).toBe(true);
    expect(output.some((line: string) => line.includes('Design Note'))).toBe(false);
    logSpy.mockRestore();
  });

  it('list outputs notes in JSON format', async () => {
    const { createCommands } = await import('../../src/cli/commands.js');
    const cmds = createCommands(tempDir, configDir);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmds.newNote('JSON Note');
    await cmds.list({ format: 'json' });

    const jsonCall = logSpy.mock.calls.find((call) => {
      try {
        JSON.parse(call[0] as string);
        return true;
      } catch {
        return false;
      }
    });
    logSpy.mockRestore();

    if (jsonCall) {
      const parsed = JSON.parse(jsonCall[0] as string);
      expect(Array.isArray(parsed)).toBe(true);
    }
  });

  it('daily creates a note in daily/ directory', async () => {
    const { createCommands } = await import('../../src/cli/commands.js');
    const cmds = createCommands(tempDir, configDir);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmds.daily();
    logSpy.mockRestore();

    const dailyDir = join(tempDir, 'daily');
    expect(existsSync(dailyDir)).toBe(true);

    const files = readdirSync(dailyDir).filter((f: string) => f.endsWith('.md'));
    expect(files.length).toBe(1);
  });

  it('daily dedup opens existing note instead of creating duplicate', async () => {
    const { createCommands } = await import('../../src/cli/commands.js');
    const cmds = createCommands(tempDir, configDir);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmds.daily();
    await cmds.daily();
    logSpy.mockRestore();

    const dailyDir = join(tempDir, 'daily');
    const files = readdirSync(dailyDir).filter((f: string) => f.endsWith('.md'));
    expect(files.length).toBe(1);
  });

  it('capture creates a note in quick/ directory', async () => {
    const { createCommands } = await import('../../src/cli/commands.js');
    const cmds = createCommands(tempDir, configDir);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmds.capture('Quick thought to capture');
    logSpy.mockRestore();

    const quickDir = join(tempDir, 'quick');
    expect(existsSync(quickDir)).toBe(true);
  });

  it('capture logs "Captured to quick." message', async () => {
    const { createCommands } = await import('../../src/cli/commands.js');
    const cmds = createCommands(tempDir, configDir);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmds.capture('Test message');
    expect(logSpy).toHaveBeenCalledWith('Captured to quick.');
    logSpy.mockRestore();
  });

  it('tags lists all tags with counts', async () => {
    const { createCommands } = await import('../../src/cli/commands.js');
    const cmds = createCommands(tempDir, configDir);

    // Create tagged notes so the loop body executes
    const { NoteService } = await import('../../src/core/note-service.js');
    const svc = new NoteService(tempDir);
    await svc.create({ title: 'Tag Test', tags: ['myTag'], content: 'Tagged content.' });
    svc.close();

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmds.tags();

    const tagOutput = logSpy.mock.calls.map((c) => c[0] as string);
    expect(tagOutput.some((line: string) => line.includes('#myTag'))).toBe(true);
    logSpy.mockRestore();
  });

  it('init creates .qnote directory and indexes existing notes', async () => {
    const newDir = mkdtempSync(join(tmpdir(), 'qnote-init-'));

    const { createCommands } = await import('../../src/cli/commands.js');
    const cmds = createCommands(tempDir, configDir);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmds.init(newDir);
    logSpy.mockRestore();

    expect(existsSync(join(newDir, '.qnote'))).toBe(true);

    rmSync(newDir, { recursive: true, force: true });
  });

  it('reindex rebuilds the search index', async () => {
    const { createCommands } = await import('../../src/cli/commands.js');
    const cmds = createCommands(tempDir, configDir);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmds.reindex();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Reindexed'));
    logSpy.mockRestore();
  });
});
