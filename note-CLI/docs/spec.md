# qnote — Statement of Work (SOW)

> ターミナル上で動作するAIフレンドリーなオールインワンノートアプリ

---

## 1. プロジェクト概要

### 1.1 プロダクト名

**qnote** (Queen Note)

### 1.2 ビジョン

Claude Code や Codex の普及により、ターミナル上での開発ワークフローが主流になりつつある。qnote は**AIフレンドリーを第一の設計原則**として、ターミナルネイティブなナレッジ管理体験を提供する。

### 1.3 コアバリュー

| 原則 | 説明 |
|------|------|
| **AIフレンドリー** | 1ノート=1 Markdownファイル。AIが直接Read/Grep/Globでアクセス可能。MCPサーバーで構造化されたCRUD+検索APIも提供 |
| **知識のナビゲーター** | 単なるエディタではなく、双方向リンク・バックリンク検出で知識の文脈を可視化 |
| **ローカルファースト** | 全データはローカルのMarkdownファイル。ベンダーロックインなし。Git同期はオプトイン |

### 1.4 ターゲットユーザー

ターミナルで作業する開発者・パワーユーザー（macOSでテスト済み。クロスプラットフォーム対応）

### 1.5 ユースケース

- 開発プロジェクトの知識管理（設計メモ、ADR、技術的判断の記録）
- 個人のナレッジベース（学習メモ、読書ノート、アイデア管理）
- 日常のジャーナリング + タスク管理（デイリーノート、ToDo）

---

## 2. 技術アーキテクチャ

### 2.1 技術スタック

| 領域 | 技術 | 理由 |
|------|------|------|
| 言語 | TypeScript (ESM, target ES2022) | 型安全性、エコシステムの充実 |
| TUI | Ink 5 + React 18 + @inkjs/ui | Reactの知見活用、コンポーネントモデル |
| メタデータDB | SQLite (better-sqlite3) + FTS5 (trigram) | 軽量、全文検索、日本語対応 |
| SQLiteフォールバック | sql.js (wasm) | better-sqlite3のネイティブモジュールビルド失敗時の公式代替 |
| Markdownレンダリング | marked + marked-terminal | TUI内でMarkdownをリッチに表示 |
| ファジー検索 | fuse.js | コマンドパレットのファジーマッチ |
| ビルド | tsup | 高速バンドル、ESM対応 |
| テスト | Vitest + @vitest/coverage-v8 | 高速、TypeScriptネイティブ |
| CLI | commander | サブコマンド解析 |
| パッケージ管理 | npm | 広く普及、安定 |
| 配布 | npm + Homebrew | `npm install -g qnote` + `brew install qnote` |

### 2.2 アーキテクチャ層

```
CLI Layer     → commander.js — サブコマンド解析、$EDITOR起動、パイプライン
TUI Layer     → Ink 5 + React 18 + @inkjs/ui — 5画面（palette, noteList, notePreview, search, capture）
Core Layer    → NoteService, LinkService, SearchService, TemplateService
Storage Layer → FileSystem(Markdown + YAML frontmatter) + SQLite FTS5(Index/検索) + links テーブル(バックリンク)
MCP Layer     → MCPサーバー（CRUD + 検索）— P1
```

### 2.3 ストレージ設計

**1ノート = 1 Markdownファイル（YAML frontmatter付き）**

- ディレクトリ構成はユーザー自由（qnoteは構造を強制しない）
- SQLiteはあくまで検索インデックス。ソースオブトゥルースは常にMarkdownファイル
- SQLiteインデックスはいつでも再構築可能（`qnote reindex`）
- WALモード有効、`busy_timeout = 5000` で並行アクセス対応

**フロントマター形式:**

```yaml
---
title: APIの設計方針
tags: [api, design, project-x]
created: 2026-02-27T10:30:00+09:00
modified: 2026-02-27T14:00:00+09:00
---
```

**SQLiteテーブル構成:**

- `notes` — メタデータ（title, path, tags, created, modified）
- `notes_fts` — FTS5仮想テーブル（`tokenize='trigram'` で日本語対応）
- `links` — リンクテーブル（`source_path`, `target_slug`, `target_text`）— バックリンク検出用

**ファイル書き込み:**

- 原子的書き込み（temp file → `rename()`）でデータ損失を防止
- NFC正規化 (`String.prototype.normalize('NFC')`) を書き込み前に適用

### 2.4 CJK対応スラグ生成

ノートのファイル名はタイトルからスラグを生成:

```typescript
title
  .normalize('NFC')
  .replace(/[^\p{L}\p{N}\s-]/gu, '')  // Unicode文字・数字・空白・ハイフンを保持
  .replace(/[\s]+/g, '-')
  .toLowerCase()
```

- CJK文字（漢字・ひらがな・カタカナ・ハングル）をファイル名に保持
- スラグ衝突時は数字サフィックス付与（`api-design-2.md`）
- 空スラグ時はタイムスタンプにフォールバック
- 200文字で切り詰め（ファイルシステム制限対応）

### 2.5 ターゲットプラットフォーム

macOS でテスト済み（Node.js 20+環境であればクロスプラットフォーム動作可能）

### 2.6 エラーハンドリングアーキテクチャ

```
Storage Layer  → AppError サブクラスを throw
Core Layer     → catch してコンテキスト追加、re-throw または Result 返却
TUI Layer      → グローバルエラーバウンダリでキャッチ、ユーザーフレンドリーなメッセージ表示
CLI Layer      → コマンドレベルで catch、stderr に出力、exit code 設定
```

**エラー型（`types.ts` で定義）:**

- `NoteNotFoundError`
- `SlugCollisionError`
- `FileWriteError`
- `FtsQueryError`
- `EditorNotFoundError`
- `FrontmatterParseError`
- `NoteSizeLimitError`

**TUI異常終了対策:** `process.on('uncaughtException')` でターミナル状態を復元（raw mode解除、カーソル復元）してから exit。

---

## 3. 機能仕様

### 3.1 P0: Must-Have（MVP）

#### 3.1.1 Markdownノート作成・編集

- `qnote new` でフロントマター付きMarkdownファイルを生成
- `$EDITOR` を起動して編集（フォールバックチェーン: `$VISUAL` → `$EDITOR` → `vi` → `nano`）
- $EDITOR 終了後にファイルの mtime を検査し、変更があれば `modified` フィールドを自動更新しインデックスを再構築

#### 3.1.2 YAML Frontmatter

- `title`, `tags`, `created`, `modified` を自動管理
- ノート作成時に `title`, `tags`, `created` を自動設定
- $EDITOR終了後の mtime 変更検知で `modified` を自動更新
- 不正なYAMLは空メタデータにフォールバック（クラッシュしない、ファイルをスキップしない）
- frontmatterがないファイルは最初の `# 見出し` をタイトルに、なければファイル名をタイトルに使用

#### 3.1.3 全文検索

- SQLite FTS5（`tokenize='trigram'`）による全文検索インデックス
- trigram トークナイザーにより日本語を含む全言語を正しく検索可能
- TUI内でインクリメンタル検索（150msデバウンス、入力に応じてリアルタイム絞り込み）
- 最小クエリ長: CJK文字 ≥ 2文字、ラテン文字 ≥ 3文字（閾値未満はヒント表示）
- FTS5クエリ構文のサニタイズ（`*`, `"`, `AND`, `OR` 等の特殊文字をエスケープ）
- CLIモードでは結果をstdoutに出力

#### 3.1.4 タグシステム

- フロントマターの `tags` フィールドのみを正規のタグソースとする
- ~~本文中の `#tag` も認識しインデックスに格納~~ → MVPではフロントマターのみ（本文中の `#tag` 抽出はP1でMarkdown AST解析により実装）
- タグ一覧表示（使用数付き）
- タグによるフィルタリング

#### 3.1.5 双方向リンク

- `[[note-title]]` 構文でノート間リンクを作成
- バックリンク自動検出 — 専用 `links` テーブルで管理（FTS5はブラケットを除去するため、FTSによるバックリンク検索は不可）
- ~~未リンク言及検出~~ → P1に延期
- Wikilink解決関数: `resolveWikiLink(target: string): string | null`
  - 解決順序: (1) タイトル完全一致（大文字小文字区別）→ (2) スラグ一致（大文字小文字無視）→ (3) null（デッドリンク）
  - MVPではフラット解決のみ（パス構文 `[[project-x/api-design]]` は非対応）
- デッドリンク表示: dim/グレーで表示、ジャンプ時に「ノートが見つかりません。作成しますか？」のY/N確認
- リンク情報はSQLiteの `links` テーブルに格納（`source_path`, `target_slug`, `target_text`）

#### 3.1.6 ノート一覧・フィルタリング

- タグ、日付範囲、キーワードでフィルタ
- ソート順指定（更新日、作成日、タイトル）
- TUI内ではインタラクティブなリスト表示

#### 3.1.7 デイリーノート

- `qnote daily` で今日のノートを作成または開く
- 既存ファイル検出: `daily/YYYY-MM-DD.md` が存在すれば $EDITOR で開く（重複作成防止）
- テンプレート適用（`daily.md` テンプレート）
- 日付ベースの自動ファイル名生成

#### 3.1.8 TUI

- `qnote` (引数なし) でフルスクリーンTUI起動
- **シングルペイン・スタック型ナビゲーション** — 1画面に1機能を全画面表示、`Esc` で戻る
- **コマンドパレットがホーム画面** — 起動直後に表示、全操作の起点
- 5画面構成: コマンドパレット、ノートリスト、ノートプレビュー、検索、キャプチャー
- Markdownプレビュー（`marked` + `marked-terminal` でレンダリング）がデフォルト表示
  - 見出し: bold + アクセントカラー
  - コードブロック: dim背景
  - リスト: インデント + `●` / `1.`
  - `[[wikilink]]`: Vimiumスタイル番号付与（`[1]`〜`[9]`）、数字キーでジャンプ
  - レンダリング失敗時は raw Markdown にフォールバック（`[rendering failed — showing raw]` 通知）
- `p` キーで raw Markdown ↔ レンダリングプレビューをトグル
- `e` キーで $EDITOR での編集を起動
- **ノートサイズ制限**: 1MB以上で警告表示、5MB以上でTUIプレビュー拒否（$EDITORでの閲覧を案内）
- **モーダル入力システム**: テキスト入力中はグローバルショートカット(`q`, `c`, `/` 等)を無効化。`Esc` と `Ctrl+` コンボのみ動作
- **空状態UX**: ノートがない場合「No notes yet. Press `n` to create your first note.」を表示

#### 3.1.9 クイックキャプチャ

- **CLIモード**: `qnote capture "メモ内容"` でTUI起動なしに即座に記録
- **TUIモード**: ハイブリッドアプローチ
  - 単一行テキスト入力（タイトルのみ）
  - `Enter`: inbox ディレクトリにタイトル付きfrontmatterで保存（本文は空）
  - `Tab`: inbox にノート作成後、$EDITORで編集を開始（長文メモ用）
  - `Esc`: キャンセルして前画面に戻る
- **ファイル命名**: タイトルありなら `inbox/{slugified-title}.md`、なしなら `inbox/YYYY-MM-DD-HHmmss.md`

#### 3.1.10 ローカルファースト

- 全データはローカルのMarkdownファイル
- ネットワーク接続不要で完全動作
- ベンダーロックインなし

#### 3.1.11 自動初期化

- `qnote` を `qnote init` なしで実行してもクラッシュしない
- `.qnote/` ディレクトリとノートディレクトリを自動作成
- `qnote init` は明示的なカスタマイズ用（必須ではない）

### 3.2 P1: Should-Have（v1.1目標）

| 機能 | 概要 |
|------|------|
| MCPサーバー | CRUD + 検索のMCPツール提供。`qnote mcp` で起動（stdioトランスポート） |
| `qnote edit <query>` | ファジーマッチでノート検索 → 選択 → $EDITOR で編集。パイプライン検出（`process.stdin.isTTY`） |
| Git同期 | `qnote sync` で自動commit + push/pull。デフォルト無効、オプトイン |
| グラフビュー | ノート間の関係性をTUI内で可視化 |
| エクスポート/インポート | JSON形式でのバルク操作。Obsidian Vaultからの移行サポート |
| 本文内 #tag 抽出 | Markdown AST解析による正確なインラインタグ抽出 |
| 未リンク言及検出 | リンク構文なしでノートタイトルが本文に出現する箇所の検出 |
| `qnote links <note>` | バックリンク・リンク先のCLI出力 |

### 3.3 P2: Nice-to-Have（将来拡張）

| 機能 | 概要 |
|------|------|
| AI統合 | LLM APIでノート要約・自動タグ付け・関連ノート推薦 |
| タスク管理 | チェックリスト `- [ ]` の集約・ステータス管理 |
| 暗号化 | AES-256によるノート単位の暗号化 |
| プラグインシステム | フックベースの最小限API |
| コードブロック構文ハイライト | |
| テーブルレンダリング | |

### 3.4 スコープ外

- リアルタイムコラボレーション
- リッチメディア埋め込み（画像・動画のインライン表示）
- WYSIWYG編集（$EDITORに委任）
- Web UI / モバイルアプリ
- クラウドストレージ（ローカルファースト原則）

---

## 4. コマンド体系

### 4.1 動作モード

- **TUIモード**: `qnote` (引数なし) でフルスクリーンTUI起動
- **CLIモード**: サブコマンドで個別操作。スクリプト・パイプラインから利用可能

### 4.2 MVPコマンド一覧

| コマンド | 説明 | 例 |
|---------|------|-----|
| `qnote` | TUI起動 | `qnote` |
| `qnote new [title]` | ノート作成 → $EDITOR | `qnote new "API設計"` |
| `qnote daily` | 今日のデイリーノート作成/編集 | `qnote daily` |
| `qnote capture <text>` | クイックメモをinboxに追記 | `qnote capture "TODO: 認証見直す"` |
| `qnote search <query>` | 全文検索（結果をstdoutに出力） | `qnote search "認証" --tag api` |
| `qnote list` | ノート一覧 | `qnote list --tag project --sort modified` |
| `qnote tags` | 全タグ一覧（使用数付き） | `qnote tags` |
| `qnote reindex` | SQLiteインデックス再構築 | `qnote reindex` |
| `qnote init` | ノートディレクトリ初期化（任意） | `qnote init ~/notes` |

### 4.3 P1コマンド

| コマンド | 説明 | 例 |
|---------|------|-----|
| `qnote edit <query>` | ノート検索 → 選択 → $EDITOR | `qnote edit api-design` |
| `qnote links <note>` | バックリンク・リンク先一覧 | `qnote links api-design` |
| `qnote sync` | Git commit + push/pull | `qnote sync` |
| `qnote mcp` | MCPサーバー起動 | `qnote mcp` |

### 4.4 パイプライン対応

```bash
qnote search "API" | grep "認証"        # 検索結果をフィルタ
qnote list --format json | jq '.[]'     # JSON出力でスクリプト連携
cat draft.md | qnote new --stdin        # stdinからノート作成
```

---

## 5. UXデザイン

> 詳細は `docs/plans/2026-02-27-ui-ux-design.md` を参照。

### 5.1 デザイン原則

1. **ボーダーレス** — 罫線ではなく余白とインデントで構造を表現
2. **ソフトアクセント** — dim/bold/色のグラデーションで視覚的階層を作る
3. **余白優先** — 情報密度よりも可読性を重視

### 5.2 カラーシステム: セマンティックカラー（ANSI + True Color）

| 役割 | True Color | ANSI フォールバック |
|------|-----------|-------------------|
| アクセント | シアン系 | ANSI cyan (bold) |
| タグ | マゼンタ系 | ANSI magenta |
| リンク | ブルー系 | ANSI blue (underline) |
| 日付・補助 | グレー | dim |
| エラー | レッド | ANSI red |
| 警告 | イエロー | ANSI yellow |
| 選択中 | グリーン/リバース | ANSI green / reverse |

### 5.3 画面構成（5画面・シングルペイン）

| 画面 | 役割 | 到達方法 |
|------|------|---------|
| コマンドパレット | ホーム。全操作の起点。入力が空の時は最近のノート5件を表示 | 起動時 / 任意画面で `:` |
| ノートリスト | 検索結果・一覧表示 | パレットから `recent`, `search`, `tags` 等 |
| ノートプレビュー | ノート閲覧（Markdownレンダリング済み） | リストからEnter |
| 検索 | インクリメンタル全文検索（150msデバウンス） | パレットから `search` / 任意画面で `/` |
| キャプチャー | クイックメモ（単一行タイトル入力 + $EDITOR委任） | パレットから `capture` / 任意画面で `c` |

### 5.4 キーバインド

**コマンドパレット中心**: 覚えるキーは最小限。`:` から全操作にファジー検索でアクセス可能。

| キー | 操作 | 有効画面 |
|------|------|---------|
| `:` | コマンドパレット | 全画面 |
| `/` | 検索 | 全画面 |
| `c` | キャプチャー | 全画面 |
| `q` | 終了 | 全画面 |
| `j/k` or `↑/↓` | リスト移動 | リスト・検索結果 |
| `Enter` | 選択/決定 | リスト・検索結果・パレット |
| `Esc` | 戻る/キャンセル | 全画面 |
| `e` | $EDITOR起動 | プレビュー |
| `p` | raw/preview切替 | プレビュー |
| `n` | 新規ノート | リスト |
| `1-9` | Wikiリンクジャンプ | プレビュー |

> 注: テキスト入力中（検索、キャプチャー、パレット）は単一キーショートカットが無効化される（モーダル入力システム）。

### 5.5 フッター: コンテキストヒント

各画面で使えるキーのみ表示:

| 画面 | フッター表示 |
|------|-------------|
| コマンドパレット | `Enter select   Esc quit` |
| ノートリスト | `: cmd   / search   n new   q quit` |
| ノートプレビュー | `e edit   p raw   : cmd   Esc back` |
| 検索 | `↑↓ select   Enter open   Esc cancel` |
| キャプチャー | `Enter save   Tab $EDITOR   Esc cancel` |

### 5.6 ターミナルサイズ対応

| 条件 | 対応 |
|------|------|
| 幅 < 40カラム | 警告メッセージ表示 |
| 幅 40-79カラム | タグ・日付を省略、タイトルのみ表示 |
| 幅 80カラム以上（推奨） | 全情報表示 |

---

## 6. MCPサーバー仕様（P1）

### 6.1 提供ツール

| ツール名 | 操作 | 説明 |
|---------|------|------|
| `qnote_create` | Create | タイトル・タグ・本文を指定してノート作成 |
| `qnote_read` | Read | タイトルまたはパスでノートの全文を取得 |
| `qnote_update` | Update | 既存ノートの本文・タグ・タイトルを更新 |
| `qnote_delete` | Delete | ノートを削除 |
| `qnote_search` | Search | 全文検索。タグ・日付範囲でのフィルタも可能 |
| `qnote_list` | List | ノート一覧取得。フィルタ・ソート対応 |

### 6.2 設計方針

- `qnote mcp` コマンドで起動（stdioトランスポート）
- Claude Codeの `.mcp.json` に登録して使用
- TUIとMCPは同じCore Layerを共有（ロジックの重複なし）
- ファイル直接アクセスとの使い分け: MCPは**構造化されたメタデータ検索**（タグ絞り込み、バックリンク取得、日付範囲検索など）に強みを持つ

### 6.3 利用例

```
ユーザー: 「先週のAPIに関するノートをまとめて」
→ Claude Code が qnote_search(query="API", date_from="2026-02-20", tags=["api"]) を呼び出し
→ 関連ノートを取得して要約
```

---

## 7. 設定

### 7.1 ファイル構成

```
~/.qnote/
  config.json          # グローバル設定
  templates/           # テンプレートファイル
    daily.md
    default.md
```

### 7.2 config.json

```json
{
  "notesDir": "~/notes",
  "editor": "$EDITOR",
  "daily": {
    "directory": "daily",
    "template": "daily"
  },
  "capture": {
    "directory": "inbox"
  },
  "search": {
    "excludeDirs": [".git", "node_modules"]
  }
}
```

> 注: `sync` 設定はP1で追加予定。MVPには含まない。

**設定ファイル破損対策:** JSON検証を行い、不正な場合はデフォルト値にフォールバックしてユーザーに警告。

### 7.3 ノートディレクトリ内の管理ファイル

```
~/notes/                       # ユーザーのノート（自由な構成）
  .qnote/
    index.db                   # SQLite FTS5 インデックス
  inbox/                       # クイックキャプチャの保存先
  daily/                       # デイリーノートの保存先
  (ユーザーが自由にフォルダ・ファイルを配置)
```

### 7.4 テンプレート

- `~/.qnote/templates/` にMarkdownテンプレートファイルを配置
- 変数展開: `{{date}}`, `{{title}}`（`string.replace()` による最小限の展開。テンプレートエンジンは不使用）
- `qnote new` 時にテンプレートを選択して適用

### 7.5 初回体験

- `qnote` を実行すると、必要なディレクトリ（`.qnote/`, ノートディレクトリ）を自動作成
- `qnote init` はカスタマイズ用（パス指定、テンプレート生成など）。必須ではない
- 既存Markdownファイルがあればインデックスに自動取り込み

---

## 8. 成功基準

### 8.1 MVP完了条件

- [ ] P0の11機能がすべて動作する
- [ ] テストカバレッジ80%以上
- [ ] `qnote` → `qnote new` → `qnote search` → `qnote daily` の基本フローが動作
- [ ] `[[wikilink]]` のバックリンク検出が `links` テーブル経由で正しく機能
- [ ] 日本語タイトルのノート作成・検索が正常に動作
- [ ] TUIのコマンドパレットから全操作にアクセス可能
- [ ] Markdownプレビューが `marked` + `marked-terminal` でターミナル内で正しくレンダリング
- [ ] npm install -g で配布可能
- [ ] `qnote init` なしでも初回起動が正常に動作

### 8.2 品質要件

- 起動時間: 500ms以内
- 検索応答: 1000ノートで100ms以内
- インデックス再構築: 1000ノートで5秒以内（トランザクションで原子的に実行）

---

## 9. UI/UXデザイン

> **設計完了。** 詳細仕様は `docs/plans/2026-02-27-ui-ux-design.md` を参照。

### 9.1 概要

- **ビジュアルスタイル**: Charmbracelet系ツール（gh CLI, gum, glamour）に倣ったモダン・ボーダーレスデザイン
- **レイアウト**: シングルペイン・スタック型ナビゲーション（1画面=1機能、`Esc`で戻る）
- **ホーム画面**: コマンドパレット直起動（Spotlight/Raycastライクなランチャー体験）
- **カラー**: セマンティックカラーシステム（True Color + ANSI 16色フォールバック）
- **アニメーション**: なし（画面切替は即時。Inkはフェード・トランジション非対応）

### 9.2 設計判断の根拠

| 判断 | 選択 | 根拠 |
|------|------|------|
| レイアウト | シングルペイン | MVP最適。Inkとの相性◎。後からアダプティブに拡張可能 |
| ホーム画面 | コマンドパレット直起動 | 「何をしたいか」から始まるアクション志向 |
| ナビゲーション | スタック型 | ブラウザの「戻る」と同じ直感的モデル |
| Wikiリンク | Vimiumスタイル番号（1-9のみ） | 数字キー1打でジャンプ。タイムアウト不要 |
| キャプチャー | 単一行入力 + $EDITOR委任 | TUI内マルチラインエディタの過剰設計を回避 |
| 入力モード | モーダル（navigation/text） | テキスト入力中のショートカット誤爆を防止 |

### 9.3 関連ドキュメント

- UI/UX詳細仕様: `docs/plans/2026-02-27-ui-ux-design.md`
- 設計判断記録: `docs/plans/2026-02-27-design-decisions.md`
- レビュー議事録: `docs/discussions/2026-02-27-spec-ui-ux-discussion.md`
- 実装計画: `docs/plans/2026-02-27-qnote-mvp-implementation.md`
