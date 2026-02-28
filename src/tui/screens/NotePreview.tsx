import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../../theme/colors.js';
import {
  formatTag,
  formatDate,
  formatBacklinks,
  formatRuler,
} from '../../theme/format.js';
import { renderMarkdown, numberWikiLinks } from '../utils/render-markdown.js';
import type { Note } from '../../types.js';
import type { NavigationStore } from '../hooks/use-navigation.js';
import type { NoteService } from '../../core/note-service.js';

/** 5 MB refuse threshold */
const SIZE_REFUSE_BYTES = 5_000_000;

interface NotePreviewProps {
  readonly note: Note;
  readonly backlinkCount: number;
  readonly nav: NavigationStore;
  readonly noteService: NoteService;
  readonly onEdit: (filePath: string) => void;
}

export function NotePreview({
  note,
  backlinkCount,
  nav,
  noteService,
  onEdit,
}: NotePreviewProps): React.ReactElement {
  const [showRaw, setShowRaw] = useState(false);

  const contentSize = Buffer.byteLength(note.content, 'utf-8');
  const isTooLarge = contentSize >= SIZE_REFUSE_BYTES;

  const { renderedContent, linkStatuses } = useMemo(() => {
    if (isTooLarge) {
      return { renderedContent: '', linkStatuses: [] };
    }

    const { links: extractedLinks } = numberWikiLinks(note.content);
    const html = showRaw ? note.content : renderMarkdown(note.content);

    const statuses = extractedLinks.map((link) => {
      const resolved = noteService.resolveWikiLink(link.target);
      return {
        ...link,
        isLive: resolved !== null,
        resolvedFilePath: resolved?.filePath ?? null,
      };
    });

    return { renderedContent: html, linkStatuses: statuses };
  }, [note.content, showRaw, isTooLarge, noteService]);

  useInput((input, key) => {
    // e — open in $EDITOR
    if (input === 'e') {
      onEdit(note.filePath);
      return;
    }

    // p — toggle raw/rendered
    if (input === 'p') {
      setShowRaw((prev) => !prev);
      return;
    }

    // 1-9 — Vimium-style jump to numbered wikilink
    const num = Number(input);
    if (num >= 1 && num <= 9) {
      const link = linkStatuses.find((l) => l.number === num);
      if (link && link.resolvedFilePath) {
        nav.push('notePreview', { filePath: link.resolvedFilePath });
      }
    }
  });

  if (isTooLarge) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>{theme.error(`Note too large (${Math.round(contentSize / 1_000_000)}MB). Max: 5MB.`)}</Text>
        <Text dimColor>Press Esc to go back, e to open in $EDITOR.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Text>{theme.heading(note.meta.title)}</Text>
      <Text>
        {'  '}
        {note.meta.tags.map((t) => formatTag(t)).join('  ')}
        {'  '}{formatDate(note.meta.modified)}
        {'  '}{formatBacklinks(backlinkCount)}
      </Text>
      <Text>{formatRuler(40)}</Text>

      {/* Content */}
      <Box flexDirection="column" marginTop={1}>
        <Text>{renderedContent}</Text>
      </Box>

      {/* Wikilinks legend */}
      {linkStatuses.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text>{formatRuler(40)}</Text>
          <Text dimColor>Links:</Text>
          {linkStatuses
            .filter((l) => l.number !== null)
            .map((l) => (
              <Text key={l.target}>
                {'  '}
                {l.isLive
                  ? theme.link(`[${l.number}] ${l.displayText}`)
                  : theme.dim(`[${l.number}] ${l.displayText} (not found)`)}
              </Text>
            ))}
        </Box>
      )}
    </Box>
  );
}
