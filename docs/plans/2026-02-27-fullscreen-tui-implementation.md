# Fullscreen TUI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make qnote TUI launch in fullscreen mode (alternate screen buffer) like LazyVim, with crash recovery and editor unmount/remount flow.

**Architecture:** Use Ink's built-in `fullScreen: true` render option for alternate screen management. Add signal handlers for crash recovery. Refactor editor spawning from inside App.tsx to bin/qnote.ts so Ink can be unmounted before $EDITOR runs and re-rendered after.

**Tech Stack:** Ink 6.8.0, React 19, commander, node:child_process

---

- [ ] Task 1: Create terminal restore utility

**Files:**
- Create: `src/tui/utils/restore-terminal.ts`
- Test: `test/tui/restore-terminal.test.ts`

**What:** A small utility that writes ANSI escape sequences to restore terminal state (exit alternate screen buffer, show cursor). Also provides a function to register SIGINT/SIGTERM/uncaughtException handlers that call restore before exiting.

**Interface:**
- `restoreTerminal(): void` — writes `\x1b[?1049l\x1b[?25h` to stdout
- `registerCrashHandlers(): void` — registers process signal/exception handlers that call restoreTerminal then exit with appropriate codes (SIGINT→130, SIGTERM→143, uncaughtException→1)

**Test scenarios:**
- restoreTerminal writes correct escape sequence to stdout
- registerCrashHandlers registers handlers for SIGINT, SIGTERM, uncaughtException

**Dependencies:** None (pure Node.js process/stdout)

**Notes:** Exit codes follow UNIX convention: 128 + signal number. The `restoreTerminal` function is idempotent — safe to call multiple times.

**Commit:** `feat: add terminal restore utility for crash recovery`

---

- [ ] Task 2: Extend NavigationStore to accept initial screen

**Files:**
- Modify: `src/tui/hooks/use-navigation.ts:17-18` (createNavigationStore signature)
- Modify: `test/tui/use-navigation.test.ts` (add test cases)

**What:** Allow `createNavigationStore()` to accept an optional initial `ScreenEntry` so the TUI can restart on a specific screen after editor exit (e.g., notePreview for the edited note).

**Interface:**
- `createNavigationStore(initialEntry?: ScreenEntry): NavigationStore` — defaults to `{ screen: 'palette' }` if not provided (backward compatible)

**Test scenarios:**
- Default behavior unchanged: starts at palette
- Custom initial entry: starts at the provided screen
- Custom initial entry with params: params are preserved
- All existing navigation tests still pass

**Dependencies:** `ScreenEntry` from `use-navigation.ts`

**Notes:** This is backward compatible — existing call sites that pass no args continue to work.

**Commit:** `feat: support initial screen entry in NavigationStore`

---

- [ ] Task 3: Add onRequestEditor prop to App and refactor handleEdit

**Files:**
- Modify: `src/tui/App.tsx:18-22` (AppProps interface)
- Modify: `src/tui/App.tsx:24-25` (store creation — accept initialScreen)
- Modify: `src/tui/App.tsx:54-68` (handleEdit callback)

**What:** Add `onRequestEditor` and `initialScreen`/`initialParams` props to App. When `onRequestEditor` is provided, `handleEdit` delegates to it instead of calling spawnSync directly. The NavigationStore is initialized with the provided initial screen.

**Interface:**
```typescript
interface AppProps {
  readonly noteService: NoteService;
  readonly searchIndex: SearchIndex;
  readonly captureDir: string;
  readonly onRequestEditor?: (filePath: string) => void;
  readonly initialScreen?: ScreenName;
  readonly initialParams?: Record<string, unknown>;
}
```

**Behavior:**
- `onRequestEditor` provided → handleEdit calls it (bin/qnote.ts will unmount Ink, spawn editor, re-render)
- `onRequestEditor` not provided → handleEdit falls back to current direct spawnSync behavior (for `qnote new`, testing, etc.)
- `initialScreen` provided → NavigationStore starts at that screen instead of palette
- Module-level navStore/inputModeStore moved inside component or re-created with initial screen

**Test scenarios:**
- App renders with default props (palette screen)
- App renders with initialScreen='search' (starts at search)
- handleEdit calls onRequestEditor when provided
- handleEdit falls back to spawnSync when onRequestEditor not provided
- handleSpawnEditor (capture flow) also uses onRequestEditor

**Dependencies:** Task 2 (NavigationStore initial screen support)

**Notes:** Moving navStore inside the component (or using a factory) is needed because the module-level singleton won't reset between unmount/remount cycles. Use `useMemo` or `useRef` to avoid re-creation on every render.

**Commit:** `feat: add onRequestEditor prop and initialScreen support to App`

---

- [ ] Task 4: Refactor bin/qnote.ts with startTui and fullScreen

**Files:**
- Modify: `bin/qnote.ts` (entire file restructure)

**What:** Introduce a `startTui()` function that renders App with `{ fullScreen: true }`, registers crash handlers, and wires up the `onRequestEditor` callback for the unmount→editor→remount cycle. TUI commands (no-arg, search, capture) use `startTui()`. Non-TUI commands (new, daily, list, tags, init, reindex) remain unchanged.

**Interface:**
- `startTui(initialScreen: ScreenName, initialParams?: Record<string, unknown>): void` — renders App in fullscreen, blocks with waitUntilExit

**Behavior:**
- `qnote` (no args) → `startTui('palette')`
- `qnote search` → `startTui('search')`
- `qnote capture` → `startTui('capture')`
- `onRequestEditor` callback: `instance.unmount()` → `spawnSync(editor, [filePath])` → `startTui('notePreview', { filePath })`
- Signal handlers registered inside `startTui` only
- Non-TUI commands untouched

**Test scenarios:**
- startTui passes fullScreen: true to render
- onRequestEditor unmounts instance before spawning editor
- onRequestEditor re-renders with notePreview screen after editor exits
- Non-TUI commands do not use fullScreen
- Signal handlers registered only when TUI starts

**Dependencies:** Task 1 (restoreTerminal), Task 3 (App props)

**Notes:**
- `search` CLI subcommand currently takes a `<query>` arg and outputs to stdout. The TUI `search` screen is interactive — these are different. Check if `qnote search` without args should launch TUI search screen vs requiring query arg.
- `capture` CLI subcommand takes `<text>` arg. TUI capture screen is interactive. Same consideration.
- `spawnSync` with `stdio: 'inherit'` is synchronous — no async needed in the callback despite the design doc showing async.

**Commit:** `feat: launch TUI in fullscreen with editor unmount/remount`

---

- [ ] Task 5: Update barrel export and verify build

**Files:**
- Modify: `src/index.ts` (add restore-terminal export if needed)

**What:** Ensure the new utility is exported, run `npm run build` and `npm run typecheck` to verify everything compiles. Run full test suite to confirm no regressions.

**Test scenarios:**
- `npm run build` succeeds
- `npm run typecheck` reports zero errors
- `npm run test` all tests pass
- Manual smoke test: `node dist/bin/qnote.js` launches in alternate screen, Esc exits back to normal terminal

**Dependencies:** Tasks 1-4

**Commit:** `chore: verify build and tests for fullscreen TUI`
