# Find File（ファイル検索）Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** コマンドパレットから起動するファジーファイル名検索画面を追加し、`.md` ファイルを名前で素早く探して開けるようにする

**Architecture:** `src/storage/file-scanner.ts` が notesDir を再帰走査して `.md` ファイル一覧を返し、`FindFileScreen` が fuse.js でリアルタイムにファジーフィルタリングする。既存の SearchScreen パターン（TextInput + useDebounce + useInput + 選択リスト）を踏襲。

**Tech Stack:** TypeScript, React 18, Ink 5, fuse.js, fs/promises

**Discussion:** `docs/discussions/2026-02-28-find-file-discussion.md` のレビュー結果を反映済み

---

## Design Decisions（ディスカッション結果）

| 決定事項 | 内容 |
|----------|------|
| 表示対象 | `.md` ファイルのみ（ディレクトリ非表示） |
| アイコン | `●`/`○` 選択インジケーターのみ（CommandPalette と同パターン） |
| ソート順 | アルファベット順（相対パスの辞書順） |
| 表示上限 | 100 件（初期表示・検索結果ともに） |
| 空ディレクトリ確認 | MVP から除外（YAGNI） |
| file-scanner 配置 | `src/storage/`（ファイルシステム I/O 操作は storage 層の責務） |
| シンボリックリンク | `realpath` + `startsWith` チェック（file-tree-builder.ts と同パターン） |
| fuse.js threshold | 0.4（CommandPalette と同値、CJK テストで調整） |
| excludeDirs | パラメータで受け取る設計。MVP ではハードコード定数を渡す |
| ローディング | 走査中は「読み込み中...」メッセージ表示 |
| 空の notesDir | 「ノートがありません」メッセージ表示 |
| fuse.js null ガード | loading 中は検索無効（空配列を返す） |
| SearchScreen との差別化 | CommandPalette の description で明示（`ファイル名で検索` / `全文検索`） |

---

- [ ] Task 1: types.ts — ScreenName + ScreenEntry に 'findFile' 追加

**Files:**
- Modify: `src/types.ts:137-145`

**What:** `ScreenName` 型に `'findFile'` を追加し、`ScreenEntry` discriminated union に対応する型を追加する。Footer.tsx の `Record<ScreenName, string>` が網羅性チェックで自然に型エラーを出すため、変更漏れの検出ポイントになる。

**Interface:**
- `ScreenName` に `'findFile'` リテラルを追加
- `ScreenEntry` に `{ readonly screen: 'findFile' }` を追加

**Test scenarios:**
- 型レベルの変更のみ。既存テストが引き続きパスすることを確認
- Footer.tsx の `HINTS` レコードが型エラーになることを確認（Task 3 で修正）

**Dependencies:** なし

**Notes:** この変更により Footer.tsx でコンパイルエラーが発生するが、Task 3 で修正する。型エラーが出ること自体が正しい動作確認。

**Commit:** `feat: add findFile to ScreenName and ScreenEntry types`

---

- [ ] Task 2: file-scanner.ts — notesDir 走査ユーティリティ（Task 1 完了後、Task 3 と並行可能）

**Files:**
- Create: `src/storage/file-scanner.ts`
- Create: `test/storage/file-scanner.test.ts`

**What:** notesDir を再帰走査して `.md` ファイルの相対パス一覧を返すユーティリティ。シンボリックリンク保護（`file-tree-builder.ts:42-59` と同パターン）、除外ディレクトリ、パーミッションエラーのスキップを含む。

**Interface:**
```typescript
interface ScanOptions {
  readonly excludeDirs?: readonly string[];
}

interface ScannedFile {
  readonly relativePath: string;  // notesDir からの相対パス（例: "projects/todo-app.md"）
  readonly absolutePath: string;  // フルパス（editor 遷移用）
}

function scanNoteFiles(notesDir: string, options?: ScanOptions): Promise<readonly ScannedFile[]>
```

**Test scenarios:**
- 単一ディレクトリ内の `.md` ファイルを検出する
- サブディレクトリ内の `.md` ファイルを再帰的に検出する
- `.md` 以外のファイルを除外する
- ドット始まりの隠しディレクトリ（`.git/`, `.qnote/`）を除外する
- `excludeDirs` で指定したディレクトリを除外する
- 相対パスがアルファベット順にソートされている
- シンボリックリンクが notesDir 外を指す場合はスキップする
- 循環シンボリックリンクでクラッシュしない
- 空のディレクトリで空配列を返す
- CJK ファイル名（`日本語ノート.md`）を正しく検出する
- パーミッションエラーのディレクトリをスキップして読めた分だけ返す

**Dependencies:** なし（`fs/promises`, `path` のみ）

**Notes:**
- `file-tree-builder.ts` と走査ロジックが重複する。コメント `// NOTE: file-tree-builder.ts と走査ロジックが重複。シンボリックリンク保護は同パターンを適用` を明記。P1 で `src/storage/fs-scanner.ts` への共通化を検討
- `node_modules/` は除外対象に含めること（ドット始まりでないため明示的に除外が必要）
- デフォルトの excludeDirs: `['.git', '.qnote', 'node_modules']`
- 結果は `relativePath` のアルファベット順（`localeCompare`）でソート

**Commit:** `feat: add file-scanner for recursive .md file discovery`

---

- [ ] Task 3: Footer.tsx + CommandPalette.tsx 更新（Task 1 完了後、Task 2 と並行可能）

**Files:**
- Modify: `src/tui/components/Footer.tsx:5-12`
- Modify: `src/tui/screens/CommandPalette.tsx:18-25`

**What:** Footer の HINTS レコードに `findFile` エントリを追加し、CommandPalette の PALETTE_COMMANDS に `find file` コマンドを追加する。

**Interface:**
- `HINTS` に `findFile: '↑↓ select   Enter open   Esc cancel'` を追加
- `PALETTE_COMMANDS` の `new note` と `search` の間に `{ label: 'find file', description: 'ファイル名で検索', action: 'findFile' }` を挿入
- `search` の description を `'全文検索'` → `'本文の全文検索'` に変更（SearchScreen との差別化）

**Test scenarios:**
- `getHintsForScreen('findFile')` が正しいヒント文字列を返す
- `filterCommands(PALETTE_COMMANDS, '')` に `find file` が含まれる
- `find file` が `new note` と `search` の間に表示される
- `filterCommands(PALETTE_COMMANDS, 'find')` で `find file` がマッチする
- `filterCommands(PALETTE_COMMANDS, 'file')` で `find file` がマッチする

**Dependencies:** Task 1（`ScreenName` 型更新）

**Notes:** `PALETTE_COMMANDS` 配列の順序は表示順序に直結する。`new note` の直後に挿入すること。fuse.js のモジュールレベルインスタンス（`CommandPalette.tsx:27-30`）は配列コピーで初期化されるため、挿入位置の変更だけで対応可能。

**Commit:** `feat: add find file command to palette and footer hints`

---

- [ ] Task 4: FindFileScreen.tsx — ファイル検索画面（Task 2, 3 完了後）

**Files:**
- Create: `src/tui/screens/FindFileScreen.tsx`
- Create: `test/tui/find-file-screen.test.ts`

**What:** ファイル名でファジー検索する画面コンポーネント。SearchScreen のパターン（TextInput + useDebounce + useInput + 選択リスト）を踏襲。マウント時に `scanNoteFiles()` で走査し、fuse.js でリアルタイムフィルタリングする。

**Interface:**
```typescript
interface FindFileScreenProps {
  readonly notesDir: string;
  readonly nav: NavigationStore;
  readonly inputMode: InputModeStore;
}

function FindFileScreen(props: FindFileScreenProps): React.ReactElement
```

**State:**
- `query: string` — テキスト入力値
- `selectedIndex: number` — 選択中のインデックス
- `allFiles: readonly ScannedFile[]` — 走査結果の全ファイル
- `isLoading: boolean` — 走査中フラグ

**動作フロー:**
1. マウント時に `inputMode.set('text')` + `scanNoteFiles(notesDir)` を実行
2. 走査中は `isLoading: true` で「読み込み中...」表示
3. 走査完了後、fuse.js インスタンスを `allFiles` で初期化
4. 入力なし → `allFiles` の先頭100件を表示
5. 入力あり → 150ms デバウンス後に `fuse.search()` → 結果の先頭100件を表示
6. `↑`/`↓` で選択移動、`Enter` で `nav.push('editor', { filePath })`
7. アンマウント時に `inputMode.set('navigation')`

**レイアウト:**
```
  ファイル検索 > {query}
  ────────────────────────
  {件数} files
  ● projects/todo-app.md
  ○ daily/2026-02-20-todo.md
  ○ notes/todo-list.md
```

**Test scenarios:**
- テスト対象として `scanNoteFiles` を export し、テストでは純粋関数のテストと `buildDisplayEntries`（表示用エントリ構築）のような抽出可能なロジックのテストを行う
- 空のファイルリスト（isLoading=false）で「ノートがありません」が表示される
- ファイルリストが100件で切り詰められる
- 検索結果が100件で切り詰められる
- `●`/`○` のインジケーターが正しく表示される

**Dependencies:** `fuse.js`, `src/storage/file-scanner.ts`, `src/tui/hooks/use-debounce.ts`, `src/tui/hooks/layout-context.tsx`, `src/tui/hooks/use-navigation.ts`, `src/tui/hooks/use-input-mode.ts`, `src/theme/colors.ts`, `src/theme/format.ts`

**Notes:**
- fuse.js の設定: `{ keys: ['relativePath'], threshold: 0.4 }`
- `MAX_DISPLAY = 100` を定数で定義
- fuse が未初期化（loading 中）の場合は空配列を返すガードを入れること
- `useDebounce` フックは既存のもの（`src/tui/hooks/use-debounce.ts:34-43`）を再利用
- SearchScreen（`src/tui/screens/SearchScreen.tsx`）を実装テンプレートとして参照

**Commit:** `feat: add FindFileScreen with fuzzy file name search`

---

- [ ] Task 5: App.tsx ルーティング + handleAction（Task 4 完了後）

**Files:**
- Modify: `src/tui/App.tsx:1-15` (import 追加)
- Modify: `src/tui/App.tsx:74-150` (handleAction に findFile case 追加)
- Modify: `src/tui/App.tsx:169-234` (画面レンダリング追加)

**What:** App.tsx に FindFileScreen のインポート、ルーティング、handleAction の `findFile` ケースを追加する最終統合ステップ。

**Interface:**
- `handleAction` に `case 'findFile': navStore.push('findFile'); break;` を追加
- レンダリング部に `{currentEntry.screen === 'findFile' && <FindFileScreen ... />}` を追加

**変更内容:**
1. `import { FindFileScreen } from './screens/FindFileScreen.js';` を追加
2. `handleAction` の `case 'search':` の前に `case 'findFile': navStore.push('findFile'); break;` を追加
3. `{currentEntry.screen === 'search' && ...}` の前に FindFileScreen のレンダリングブロックを追加:
```tsx
{currentEntry.screen === 'findFile' && (
  <FindFileScreen
    notesDir={notesDir}
    nav={navStore}
    inputMode={inputModeStore}
  />
)}
```

**Test scenarios:**
- CommandPalette で `find file` を選択すると FindFileScreen に遷移する
- FindFileScreen でファイルを選択すると editor 画面に遷移する
- FindFileScreen で Esc を押すと前画面に戻る

**Dependencies:** Task 4（FindFileScreen）

**Notes:** `notesDir` は `AppProps` から既に destructure 済み（`App.tsx:41`）。FindFileScreen に直接 props で渡す。NoteService や SearchIndex は不要（file-scanner が直接 fs を走査するため）。

**Commit:** `feat: integrate FindFileScreen into app routing`

---

## Task Dependency Graph

```
Task 1 (types.ts)
  ├──→ Task 2 (file-scanner.ts)  ──┐
  └──→ Task 3 (Footer + Palette)  ──┤
                                     └──→ Task 4 (FindFileScreen) ──→ Task 5 (App.tsx)
```

Task 2 と Task 3 は並行実行可能。
