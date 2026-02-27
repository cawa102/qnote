import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import { NoteService } from '../core/note-service.js';
import { ConfigService } from '../core/config-service.js';
import { resolveEditor } from './resolve-editor.js';

function updateMtimeAfterEdit(
  service: NoteService,
  filePath: string,
  mtimeBefore: number,
): void {
  const mtimeAfter = statSync(filePath).mtimeMs;
  if (mtimeAfter <= mtimeBefore) return;

  const raw = readFileSync(filePath, 'utf-8');
  const parsed = matter(raw);
  const now = new Date().toISOString();

  parsed.data = {
    ...parsed.data,
    modified: now,
  };

  const updated = matter.stringify(parsed.content, parsed.data);
  writeFileSync(filePath, updated, 'utf-8');

  service.reindex();
}

function openInEditor(service: NoteService, filePath: string): void {
  const editor = resolveEditor();
  const mtimeBefore = statSync(filePath).mtimeMs;

  spawnSync(editor, [filePath], { stdio: 'inherit' });

  updateMtimeAfterEdit(service, filePath, mtimeBefore);
}

export function createCommands(notesDir: string, configDir?: string) {
  const resolvedConfigDir = configDir ?? join(process.env.HOME ?? '', '.qnote');

  function getService(): NoteService {
    ConfigService.ensureDirectories(notesDir);
    return new NoteService(notesDir);
  }

  return {
    async newNote(title?: string) {
      const service = getService();
      try {
        const noteTitle = title ?? `untitled-${Date.now()}`;
        const note = await service.create({
          title: noteTitle,
          tags: [],
          content: `# ${noteTitle}\n\n`,
        });

        openInEditor(service, note.filePath);
      } finally {
        service.close();
      }
    },

    async search(query: string, options: { tag?: string }) {
      const service = getService();
      try {
        let results = service.search(query);

        if (options.tag) {
          const tagResults = new Set(
            service.listByTag(options.tag).map((r) => r.filePath),
          );
          results = results.filter((r) => tagResults.has(r.filePath));
        }

        for (const r of results) {
          console.log(`${r.title}\t${r.filePath}`);
          if (r.snippet) console.log(`  ${r.snippet}`);
        }
      } finally {
        service.close();
      }
    },

    async list(options: { tag?: string; sort?: string; format?: string }) {
      const service = getService();
      try {
        const items = options.tag
          ? service.listByTag(options.tag)
          : service.listRecent(50);

        if (options.format === 'json') {
          console.log(JSON.stringify(items, null, 2));
        } else {
          for (const item of items) {
            console.log(
              `${item.title}\t${item.tags.join(',')}\t${item.modified}`,
            );
          }
        }
      } finally {
        service.close();
      }
    },

    async daily() {
      const service = getService();
      try {
        const config = ConfigService.load(resolvedConfigDir);
        const today = new Date().toISOString().slice(0, 10);
        const dailyDir = config.daily.directory;
        const dailySlug = today;
        const expectedPath = join(notesDir, dailyDir, `${dailySlug}.md`);

        if (existsSync(expectedPath)) {
          openInEditor(service, expectedPath);
          return;
        }

        const note = await service.create({
          title: today,
          tags: ['daily'],
          content: `# ${today}\n\n`,
          directory: dailyDir,
        });

        openInEditor(service, note.filePath);
      } finally {
        service.close();
      }
    },

    async capture(text: string) {
      const service = getService();
      try {
        const config = ConfigService.load(resolvedConfigDir);
        const timestamp = new Date()
          .toISOString()
          .replace(/[:.]/g, '-')
          .slice(0, 16);

        await service.create({
          title: `capture-${timestamp}`,
          tags: ['inbox'],
          content: text,
          directory: config.capture.directory,
        });

        console.log('Captured to inbox.');
      } finally {
        service.close();
      }
    },

    async tags() {
      const service = getService();
      try {
        const allTags = service.listTags();
        for (const t of allTags) {
          console.log(`#${t.tag} (${t.count})`);
        }
      } finally {
        service.close();
      }
    },

    async init(path?: string) {
      const targetDir = path ?? notesDir;
      const resolvedDir = ConfigService.resolveNotesDir(targetDir);

      mkdirSync(join(resolvedDir, '.qnote'), { recursive: true });
      ConfigService.save(resolvedConfigDir, { notesDir: targetDir });

      const service = new NoteService(resolvedDir);
      try {
        const count = await service.reindex();
        console.log(`Initialized qnote at ${resolvedDir}`);
        console.log(`Indexed ${count} existing notes.`);
      } finally {
        service.close();
      }
    },

    async reindex() {
      const service = getService();
      try {
        const count = await service.reindex();
        console.log(`Reindexed ${count} notes.`);
      } finally {
        service.close();
      }
    },
  };
}
