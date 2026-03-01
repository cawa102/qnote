# Find File（ファイル検索）機能 設計書

**Date:** 2026-02-28

## 概要

ノートディレクトリ全体からファイル名・ディレクトリ名でファジー検索する画面。LazyVim の `<leader>ff` に相当する機能。

既存の「全文検索（search）」がノート本文の中身を FTS5 で検索するのに対し、Find File はファイル名・パス名で探す機能として住み分ける。

## コマンドパレットでの位置

```
new note    → ノート作成
find file   → ★新規追加★
search      → 全文検索（本文の中身で検索）
daily       → デイリーノート
recent      → 最近のノート
capture     → クイックメモ
tags        → タグ一覧
```

## ユーザーフロー

1. パレットで `find file` を選択 → `findFile` 画面に遷移
2. **初期状態で全ファイル・ディレクトリを表示**（LazyVim と同じ挙動）
3. テキスト入力でリアルタイムにファジーフィルタリング（fuse.js、150ms デバウンス）
4. 上下矢印で選択、Enter で確定、Esc で前画面に戻る

### 選択時の遷移

| 選択対象 | 遷移先 |
|----------|--------|
| ファイル（`.md`） | `editor` 画面で直接開く |
| ディレクトリ（非空） | `noteList` で中のファイル一覧を表示 |
| ディレクトリ（空） | インライン確認 → 新規ノート作成 |

## 画面レイアウト

### 初期表示（入力なし）

```
  ファイル検索 > _
  ────────────────────────────────
  📁 daily/
  📁 projects/
  📄 getting-started.md
  📄 daily/2026-02-28.md
  📄 projects/todo-app.md
```

- ディレクトリが先、ファイルが後（アルファベット順）
- 相対パス表示（notesDir からの相対）
- `📁` でディレクトリ、`📄` でファイルを区別

### フィルタリング中

```
  ファイル検索 > todo
  ────────────────────────────────
  ● 📄 projects/todo-app.md
  ○ 📄 daily/2026-02-20-todo.md
```

### 空ディレクトリ選択時

```
  ファイル検索 > daily
  ────────────────────────────────
  ● 📁 daily/

  このフォルダは空です。新しいノートを作成しますか？

  [Enter] 作成  [Esc] 戻る
```

## 検索ロジック

- **エンジン:** fuse.js（既にプロジェクトで使用中）
- **検索対象:** 各エントリの相対パス文字列
- **タイミング:** 150ms デバウンス（既存 SearchScreen と同じ）
- **入力なし:** 全エントリを表示

## ファイル走査

- `notesDir` を再帰走査
- `.md` ファイルと非空ディレクトリを取得
- 除外: `.qnote/`、`.git/`、`node_modules/`、ドット始まりの隠しディレクトリ
- 画面マウント時に一度だけ収集し、メモ化

## コンポーネント設計

### 新規ファイル

| ファイル | 役割 |
|----------|------|
| `src/tui/screens/FindFileScreen.tsx` | Find File 画面コンポーネント |
| `src/core/file-scanner.ts` | notesDir を再帰走査してエントリ一覧を返すユーティリティ |
| `test/tui/find-file-screen.test.ts` | 画面のユニットテスト |
| `test/core/file-scanner.test.ts` | ファイル走査のユニットテスト |

### 既存ファイルの変更

| ファイル | 変更内容 |
|----------|----------|
| `src/types.ts` | `ScreenName` に `'findFile'` 追加、`ScreenEntry` に対応する型追加 |
| `src/tui/screens/CommandPalette.tsx` | `PALETTE_COMMANDS` に `find file` 追加 |
| `src/tui/App.tsx` | `FindFileScreen` のルーティング追加 |
| `src/tui/components/Footer.tsx` | `findFile` 画面のキーヒント追加 |

### データフロー

```
CommandPalette → onAction('findFile')
  → nav.push('findFile')
  → FindFileScreen マウント
  → file-scanner が notesDir を走査（async、一度だけ）
  → fuse.js インスタンスを結果で初期化
  → 全エントリを表示
  → ユーザー入力 → fuse.search() → フィルタリング表示
  → ファイル選択 → nav.push('editor', { filePath })
  → ディレクトリ選択（空） → インライン確認 → 新規ノート作成
  → ディレクトリ選択（非空） → nav.push('noteList', { filter: dirPath })
```

## エラーハンドリング

- ファイルシステム走査失敗 → 空リスト表示 + エラーメッセージ
- ノート作成失敗 → 既存の AppError 体系で処理

## テスト方針

- **file-scanner.ts:** tmpdir にファイルを作成して走査結果を検証。隠しディレクトリ除外、再帰走査、空ディレクトリ検出
- **FindFileScreen.tsx:** ink-testing-library でレンダリング検証。初期表示、フィルタリング、ファイル選択遷移、空ディレクトリ確認フロー
