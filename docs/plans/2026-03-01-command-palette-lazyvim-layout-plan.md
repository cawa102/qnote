# Command Palette LazyVim風レイアウト Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** CommandPaletteをLazyVim風2カラムレイアウトに改修し、テキスト入力をショートカットキー直押し + カーソル操作に置き換える。

**Architecture:** `computePaletteLayout`をmenuWidthベースに書き換え、CommandPaletteからTextInput/fuse.js/filterCommandsを削除。各行はBox flexboxで左揃えlabel + 右揃えショートカットキーの2カラム。狭幅端末ではキー表示を非表示にする。

**Tech Stack:** Ink 5 (Box/Text), React 18, string-width, Vitest

---

- [ ] Task 1: Rewrite `computePaletteLayout` to menuWidth-based calculation

**Files:**
- Modify: `src/theme/format.ts:31-55`
- Test: `test/tui/command-palette.test.ts`

**What:** レイアウト計算関数をコンテンツ依存からmenuWidthベースに書き換える。古い `PaletteLayout` インターフェースを新しいものに置き換え、`computePaletteLayout` のシグネチャを簡素化する（commandsパラメータ不要になる）。

**Interface:**
```typescript
export interface PaletteLayout {
  readonly menuWidth: number;
  readonly leftPad: number;
  readonly showKeys: boolean;
}

export function computePaletteLayout(contentWidth: number): PaletteLayout
```

**Calculation rules:**
- `menuWidth = Math.max(44, Math.min(contentWidth - 8, 72))`
- `leftPad = Math.max(0, Math.floor((contentWidth - menuWidth) / 2))`
- `showKeys = contentWidth >= 50`

**Test scenarios:**
- contentWidth=80 → menuWidth=72, leftPad=4
- contentWidth=60 → menuWidth=52, leftPad=4
- contentWidth=48 → menuWidth=44 (最小値でクランプ), leftPad=2
- contentWidth=30 → menuWidth=44 (最小値), leftPad=0 (負数にならない)
- contentWidth=100 → menuWidth=72 (最大値でクランプ)
- contentWidth >= 50 → showKeys=true
- contentWidth < 50 → showKeys=false

**Dependencies:** `string-width` (既存)

**Notes:**
- 旧テスト (`filterCommands` テスト、旧 `computePaletteLayout` テスト) はこのタスクで削除する
- `formatIndicator` は変更なし（そのまま使用）
- `PALETTE_GAP` 定数は不要になるので削除

**Commit:** `refactor: rewrite computePaletteLayout to menuWidth-based calculation`

---

- [ ] Task 2: Rewrite CommandPalette component (data model + input + layout)

**Files:**
- Modify: `src/tui/screens/CommandPalette.tsx` (全面書き換え)
- Test: `test/tui/command-palette-input.test.ts`

**What:** CommandPaletteのデータモデルを変更し（description削除、key追加）、TextInput/fuse.js/filterCommandsを削除、ショートカットキー直押し入力を追加、Box-based 2カラムレイアウトに変更する。

**Interface:**
```typescript
export interface PaletteCommand {
  readonly label: string;
  readonly key: string;
  readonly action: string;
}

export const PALETTE_COMMANDS: readonly PaletteCommand[] = [
  { label: 'new note',  key: 'n', action: 'new' },
  { label: 'find file', key: 'f', action: 'findFile' },
  { label: 'search',    key: 's', action: 'search' },
  { label: 'daily',     key: 'd', action: 'daily' },
  { label: 'recent',    key: 'r', action: 'recent' },
  { label: 'capture',   key: 'c', action: 'capture' },
  { label: 'tags',      key: 't', action: 'tags' },
];

interface CommandPaletteProps {
  readonly nav: NavigationStore;
  readonly inputMode: InputModeStore;
  readonly onAction: (action: string) => void;  // queryパラメータ削除
}
```

**Remove:**
- `import { TextInput } from '@inkjs/ui'`
- `import Fuse from 'fuse.js'`
- `filterCommands` 関数
- `fuse` インスタンス
- `query` state, `handleChange`
- `inputMode.set('text')` の useEffect
- 検索ボックスUI (`<Text>{'  > '}</Text>` + `<TextInput>`)

**Add — input handling:**
- `useInput` でショートカットキー入力を処理: input が PALETTE_COMMANDS のいずれかの `key` に一致したら `onAction(cmd.action)` を呼ぶ
- 上下カーソル + Enter は既存ロジムを維持

**Add — layout:**
- 各行: `<Box width={layout.menuWidth}>` + 左テキスト + `<Box flexGrow={1} />` + 右テキスト（showKeysの時のみ）
- 外側コンテナ: `paddingLeft={layout.leftPad}`
- ショートカットキーは `theme.accent()` でハイライト表示

**Test scenarios:**
- ショートカットキー `n` 押下 → onAction('new') が呼ばれる
- ショートカットキー `f` 押下 → onAction('findFile') が呼ばれる
- 全7キー（n, f, s, d, r, c, t）が正しいアクションを発火
- 未定義キー `x` 押下 → onAction が呼ばれない
- 上下カーソル + Enter でアクション選択
- 選択インジケーター `●/○` が全行同じカラム位置
- 全行が同じ表示幅（右端が揃う）
- メニューブロックが中央に配置（circle位置 > 2）

**Dependencies:** Task 1 (新しい `computePaletteLayout`)

**Notes:**
- `inputMode` は props で受け取るがテキストモードには設定しない（ナビゲーションモードのまま）
- `key-dispatch.ts` は変更不要: palette画面では `q`→quit, `Esc`→exit, `/`→search が動作し、CommandPaletteのショートカットと競合しない
- `nav` props は interface に残す（他画面との一貫性のため）が、CommandPalette内では未使用

**Commit:** `feat: rewrite CommandPalette with LazyVim-style 2-column layout`

---

- [ ] Task 3: Update call sites (App.tsx, index.ts)

**Files:**
- Modify: `src/tui/App.tsx:75-155` (`handleAction` コールバック)
- Modify: `src/tui/index.ts:6` (export行)

**What:** `handleAction` のシグネチャから `query` パラメータを削除し、`new` アクションの挙動を修正する。`index.ts` から `filterCommands` のexportを削除する。

**Changes in App.tsx:**
- `handleAction` の型: `(action: string, query: string) => void` → `(action: string) => void`
- `case 'new'`: `query.trim() || 'untitled'` → 常に `'untitled'` をタイトルに使用

**Changes in index.ts:**
- `export { CommandPalette, filterCommands, PALETTE_COMMANDS }` → `export { CommandPalette, PALETTE_COMMANDS }`

**Test scenarios:**
- TypeScript コンパイルが通ること (`npm run typecheck`)
- 既存テストスイートが全パスすること (`npm run test`)

**Dependencies:** Task 2

**Notes:**
- `PaletteCommand` 型のexportは維持（外部で使用される可能性）
- `handleAction` の他のcase（recent, findFile, search, capture, daily, tags）は `query` を使っていないので変更不要

**Commit:** `refactor: remove query parameter from handleAction and clean up exports`
