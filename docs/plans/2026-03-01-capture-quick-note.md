# Capture Quick Note Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance CaptureScreen to accept a single-line body in addition to the title, change default tag from `inbox` to `quick`, and change default directory from `inbox/` to `quick/`.

**Architecture:** Add a `phase` state (`'title' | 'body'`) to CaptureScreen so Enter advances from title to body input, then saves. Update default config and CLI command to use `quick` tag and `quick/` directory.

**Tech Stack:** React (Ink 5), @inkjs/ui TextInput, Vitest

---

- [ ] Task 1: Update default capture config and CLI command

**Files:**
- Modify: `src/core/config-service.ts:8` (DEFAULT_CONFIG)
- Modify: `src/cli/commands.ts:111-116` (capture command handler)
- Modify: `test/core/config-service.test.ts:24` (default config assertion)
- Modify: `test/cli/commands.test.ts:157-167` (capture CLI test)

**What:** Change the default capture directory from `inbox` to `quick` and the default tag from `inbox` to `quick` across config and CLI.

**Interface:**
- `DEFAULT_CONFIG.capture.directory` — change value from `'inbox'` to `'quick'`
- `commands.capture()` — change `tags: ['inbox']` to `tags: ['quick']`, change log message from `'Captured to inbox.'` to `'Captured to quick.'`

**Test scenarios:**
- Default config returns `capture.directory === 'quick'`
- CLI `capture()` creates note in `quick/` directory
- CLI `capture()` log message says `'Captured to quick.'`

**Notes:** The `captureDir` prop passed to App in `bin/qnote.ts:52` is computed from config, so it will automatically pick up the new default. However, the hardcoded `join(notesDir, 'inbox')` in `bin/qnote.ts:52` must also be updated to use the config value or change to `'quick'`.

**Commit:** `feat: change capture default from inbox to quick`

---

- [ ] Task 2: Update bin/qnote.ts captureDir wiring

**Files:**
- Modify: `bin/qnote.ts:52`

**What:** Change the hardcoded `join(notesDir, 'inbox')` to `join(notesDir, config.capture.directory)` (using the loaded config) or simply `join(notesDir, 'quick')`.

**Interface:**
- `captureDir` prop passed to `App` — now derived from config instead of hardcoded `'inbox'`

**Test scenarios:**
- Covered by existing integration behavior (no dedicated unit test needed; the config test from Task 1 validates the default)

**Notes:** Check how `config` is loaded in `bin/qnote.ts` — it may already be available in scope, or you may need to load it.

**Commit:** `feat: derive captureDir from config in TUI entry`

---

- [ ] Task 3: Add body input phase to CaptureScreen

**Files:**
- Modify: `src/tui/screens/CaptureScreen.tsx:46-136`
- Modify: `test/tui/capture-screen.test.ts` (add new test cases)

**What:** Add a `phase` state (`'title' | 'body'`) and a `body` state to CaptureScreen. When `phase === 'title'`, Enter advances to `'body'` phase. When `phase === 'body'`, Enter saves the note with body as content. A second TextInput for body is rendered when phase is `'body'`. Change `tags: ['inbox']` to `tags: ['quick']` in both save paths.

**Interface:**
- `phase: 'title' | 'body'` — internal state tracking which input is active
- `body: string` — internal state for body text
- Enter in title phase → sets `phase = 'body'` (does NOT save)
- Enter in body phase → saves note with `content: body` (empty body allowed)
- Tab in either phase → creates note with current title/body and opens editor
- Esc in either phase → nav.pop() without saving

**Test scenarios:**
- `buildCaptureSlug` tests remain unchanged (existing)
- Enter in title phase does not immediately save (phase advances to body)
- Enter in body phase saves note with body content
- Enter with empty body saves note with empty content
- Tab from title phase creates note and navigates to editor
- Tab from body phase creates note with body and navigates to editor
- Saved note has `tags: ['quick']` (not `inbox`)

**Notes:**
- The `useInput` handler needs to check `phase` to decide behavior on Enter
- The title TextInput should be read-only or visually distinct once phase advances to body
- Body TextInput placeholder: `"メモを入力... (空でもOK)"`
- Footer hint text changes: `'Enter: 次へ'` in title phase, `'Enter: 保存'` in body phase

**Commit:** `feat: add body input to capture screen for quick notes`

---

- [ ] Task 4: Update Footer hints for capture screen

**Files:**
- Modify: `src/tui/components/Footer.tsx:36-39` (capture hints)
- Modify: `test/tui/footer.test.ts` (if capture hint tests exist)

**What:** Update the capture screen hints to reflect the two-phase input. The current hints `{ key: '^S', desc: 'save' }` should change to `{ key: 'Enter', desc: 'next/save' }` since Enter is now the primary action key (not Ctrl+S).

**Interface:**
- `HINTS.capture` — update entries to: `[{ key: 'Enter', desc: 'next' }, { key: 'Tab', desc: '$EDITOR' }, { key: 'Esc', desc: 'cancel' }]`

**Test scenarios:**
- Capture screen footer shows Enter, Tab, Esc hints
- No Ctrl+S hint for capture screen

**Notes:** The inline hint text in CaptureScreen.tsx (`Enter: 保存  Tab: エディタで編集  Esc: 戻る`) is rendered directly in the component. This should be updated to match the new flow or removed in favor of the Footer component's hints.

**Commit:** `feat: update capture footer hints for two-phase input`
