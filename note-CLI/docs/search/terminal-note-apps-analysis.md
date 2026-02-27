# ターミナルベースのノートアプリ・CLIツール分析

## 概要

本ドキュメントでは、既存のターミナルベースのノートアプリおよびCLIツールを包括的に調査・分析する。対象ツールの機能、強み・弱み、共通パターン、エコシステムのギャップ、そして技術的アプローチを整理する。

---

## 1. 既存ツールの詳細分析

### 1.1 nb (xwmx/nb)

**概要**: Bashスクリプト1本で動作する、CLIおよびローカルWebベースのプレーンテキストノート管理ツール。

**主な機能**:
- Markdown、Org、LaTeX、AsciiDocなど複数フォーマット対応
- ブックマーク機能（Webページのローカルキャッシュ・全文検索）
- AES-256暗号化（OpenSSL）およびGPG対応
- Git連携によるバージョン管理・同期（orphanブランチで複数ノートブック同期可能）
- タグ付け（ドキュメント内にハッシュタグを記述し検索）
- Pandocによるフォーマット変換
- プラグインシステムによる拡張性
- ローカルWebサーバーでのブラウジング

**強み**:
- 単一スクリプトでポータブル、依存関係が少ない
- 機能が非常に豊富（ノート、ブックマーク、暗号化、同期が一体）
- Git連携が深く、バージョン管理が自然

**弱み**:
- Bashスクリプトのため、大規模化やUI拡張が困難
- TUI（Terminal UI）がなく、インタラクティブ性が限定的
- 機能が多すぎて学習コストが高い
- パフォーマンスが大量ノートで低下する可能性

**参考**: [GitHub - xwmx/nb](https://github.com/xwmx/nb)

---

### 1.2 jrnl

**概要**: コマンドラインから素早くジャーナルエントリを記録するPython製ツール。

**主な機能**:
- タイムスタンプ付きエントリの自動作成
- キーワード・日付・タグによる検索
- AES暗号化対応
- 複数ジャーナルの管理
- スター付きエントリ
- システムデフォルトエディタとの連携

**強み**:
- 極めてシンプルで高速な入力ワークフロー
- 思考の妨げにならないミニマルな設計
- 暗号化が組み込み

**弱み**:
- 機能が限定的（Evernoteなどと比較すると不足）
- ハッシュタグ・ブラケットなどの特殊文字のエスケープが必要
- パスワード強度の強制がない
- リンク機能やグラフビューがない
- ノートの構造化（フォルダ・カテゴリ）が弱い

**参考**: [jrnl.sh](https://jrnl.sh/)

---

### 1.3 zk (zk-org/zk)

**概要**: Zettelkasten方式のプレーンテキストノート管理をサポートするGo製CLIツール。

**主な機能**:
- テンプレートからのノート作成
- 高度な検索・フィルタリング（タグ、リンク、メンション）
- LSP（Language Server Protocol）サーバー内蔵
  - `[[wiki links]]`と`#tags`の自動補完
- エディタ統合（Neovim、VS Code、Emacs）
- fzfによるインタラクティブブラウザ
- YAML frontmatter対応
- Gitスタイルのコマンドエイリアスと名前付きフィルタ
- Markdown互換（Obsidianなどとの相互運用性）

**強み**:
- LSP統合により既存エディタとシームレスに連携
- Zettelkasten方式に特化した設計
- Obsidianフォーマットとの互換性が高い
- Go製で高速

**弱み**:
- Zettelkasten以外のワークフローには不向き
- スタンドアロンTUIがない（エディタ依存）
- ノートの暗号化機能がない
- ブックマーク等の付加機能がない

**参考**: [GitHub - zk-org/zk](https://github.com/zk-org/zk)

---

### 1.4 Dnote

**概要**: ターミナルベースのシンプルなノートツール。依存関係なしで動作。

**主な機能**:
- 全文検索
- セルフホスト可能なサーバー（API付き）
- コマンド・スニペット・インサイトの保存
- ダウンロードするだけで動作（依存関係なし）

**強み**:
- セットアップが極めて簡単
- サーバー機能でWeb UIも可能
- 開発者向けのスニペット管理に強い

**弱み**:
- Markdown連携が限定的
- リンク機能・タグ体系が弱い
- エコシステムが小さい

**参考**: [getdnote.com](https://www.getdnote.com/)

---

### 1.5 Taskwarrior + Vimwiki（統合ワークフロー）

**概要**: タスク管理ツール（Taskwarrior）とWiki型ノートシステム（Vimwiki）の統合。

**主な機能**:
- Taskwikiプラグインによるタスク-ノート統合
- VimwikiのチェックボックスをTaskwarriorタスクに変換
- 期限・タグ・プロジェクト・優先度の管理
- バーンダウンチャート・サマリーレポート
- 双方向同期

**強み**:
- タスクとノートの統合が深い
- Vim/Neovimユーザーに最適
- Taskwarriorの強力なフィルタリング・レポート機能

**弱み**:
- Vim依存で汎用性が低い
- セットアップの複雑さが高い
- 非Vimユーザーにはアプローチ困難
- モバイル・Web対応がない

**参考**: [Taskwiki](https://github.com/tbabej/taskwiki)

---

### 1.6 notes-cli (rhysd/notes-cli)

**概要**: シンプルなMarkdownノート管理CLIツール（Go製）。

**主な機能**:
- エディタ連携（`$EDITOR`）でのノート作成・編集
- カテゴリベースの整理
- grepやfzfなどの外部コマンドとの連携

**強み**:
- Unix哲学に忠実（パイプ・組み合わせ可能）
- 軽量で高速

**弱み**:
- 機能がミニマル
- 検索・リンク機能が限定的

**参考**: [GitHub - rhysd/notes-cli](https://github.com/rhysd/notes-cli)

---

### 1.7 その他のツール

| ツール | 言語 | 特徴 |
|--------|------|------|
| **neuron** | Haskell | Zettelkasten + 静的サイト生成、Pandocベース |
| **tnote** | Python | 全文検索、タグ管理、シンプルなCLI |
| **Joplin CLI** | JavaScript | 同期・暗号化・Markdown対応のフル機能ノートアプリのCLI版 |
| **Snip** | - | 開発者向けの高速ノートツール |
| **Terminal Velocity** | Python | Notational Velocityのターミナル版 |

---

## 2. 共通パターンと設計原則

### 2.1 ファイルフォーマット

**主流**: Markdownがデファクトスタンダード
- YAML frontmatterによるメタデータ管理が標準的
  ```markdown
  ---
  title: ノートタイトル
  tags: [tag1, tag2]
  created: 2025-01-15T10:30:00
  ---
  本文...
  ```
- プレーンテキストとしての可読性・可搬性が最重要視される
- Obsidian互換の`[[wikilinks]]`形式が広まりつつある

### 2.2 ストレージ

- **ファイルシステムベース**: 大多数のツールがプレーンテキストファイルをそのまま保存
- **ディレクトリ構造**: ノートブック/カテゴリ単位でフォルダ分け
- **Git連携**: バージョン管理と同期の標準手段
- **SQLite**: 一部ツールがメタデータ管理や全文検索インデックスに使用

### 2.3 コマンド体系

典型的なCLIコマンドパターン:
```
note new [title]       # 新規作成
note edit [id/title]   # 編集
note list              # 一覧表示
note search [query]    # 検索
note tag [id] [tags]   # タグ付け
note delete [id]       # 削除
note sync              # 同期
```

### 2.4 ワークフロー

1. **クイックキャプチャ**: コマンドラインから即座にメモを取る
2. **エディタ連携**: `$EDITOR`環境変数でお好みのエディタを使用
3. **検索→絞り込み→操作**: fzfなどによるインタラクティブ選択
4. **パイプライン**: Unix哲学に基づくツール間の連携

---

## 3. エコシステムのギャップと課題

### 3.1 現状のギャップ

1. **リッチなTUI体験の欠如**
   - 多くのツールはシンプルなCLI（コマンド→出力）であり、インタラクティブなTUIを提供していない
   - Obsidianのような視覚的なナビゲーション・プレビューがターミナル内で実現されていない

2. **ノート間リンクの弱さ**
   - ObsidianやRoam Researchのような双方向リンク・バックリンクを持つCLIツールが少ない
   - グラフビュー（ノートの関連性の可視化）がターミナルで実現されていない

3. **統合的なワークフローの不在**
   - ノート、タスク、ジャーナル、ブックマークが別々のツールに分散
   - nbは統合を試みているが、TUI体験が欠如

4. **日本語対応の不足**
   - 多くのツールが英語圏中心の設計
   - 日本語の全文検索・形態素解析への対応が不十分
   - CJK文字の表示幅の問題

5. **AI連携の未成熟**
   - LLMによるノート要約、関連ノート推薦、自動タグ付けなどの機能が組み込まれていない
   - AI時代のナレッジ管理ワークフローに対応したCLIツールがない

6. **モバイル・クロスデバイス同期**
   - CLI中心のため、モバイルからのアクセスが困難
   - 同期機能があっても設定が複雑

7. **初回体験（First Run Experience）の貧弱さ**
   - 多くのツールが設定ファイルの手動編集を前提
   - インタラクティブなセットアップウィザードがない

### 3.2 既存ツールの二極化

```
シンプル寄り                          高機能寄り
jrnl ← notes-cli ← Dnote ← zk ← nb → Joplin CLI
  ↓                                    ↓
 速い入力                            多機能だが複雑
 限定的な構造                        学習コスト高
 検索が弱い                          TUIなし
```

中間的なポジション（シンプルさを保ちつつ、リッチなTUI体験とリンク機能を提供するツール）が不足している。

---

## 4. 技術的アプローチの分析

### 4.1 TUIフレームワーク

#### Ink（JavaScript/TypeScript）
- **設計**: Reactコンポーネントモデルをターミナルに適用
- **言語**: JavaScript/TypeScript
- **特徴**:
  - JSXでUI定義
  - React Hooksによる状態管理
  - `useInput`フックでキーボード入力処理
  - `@inkjs/ui`でプリビルトコンポーネント（TextInput、Select、Spinner、ProgressBarなど）
  - テーマシステム
  - TypeScript完全対応
- **適用例**: `create-ink-app`でプロジェクトスキャフォールド可能
- **利点**: React経験者にとって学習コストが低い、コンポーネント再利用性が高い
- **課題**: Node.js依存、blessed比でウィジェットが少ない（ただし自作は容易）

#### Blessed / Neo-Blessed
- **設計**: 伝統的なウィジェットベースTUIライブラリ
- **特徴**: 豊富なウィジェット（ボックス、ボタン、フォーム、テーブル）
- **課題**: オリジナルのblessedはメンテナンス停滞。neo-blessedが後継だが更新頻度は低い

#### BubbleTea（Go）
- **設計**: Elm Architecture（Model-View-Update）ベース
- **特徴**: 関心の分離が明確、Go製で高速
- **課題**: JavaScript/TypeScriptエコシステムとの統合が困難

#### 推奨
TypeScript/Node.jsプロジェクトの場合、**Ink**が最適。Reactの知見を活かし、`@inkjs/ui`の豊富なコンポーネントを利用できる。

### 4.2 検索実装

| アプローチ | 特徴 | 適用場面 |
|-----------|------|---------|
| **ripgrep** | ファイルシステム直接検索、超高速 | 少〜中規模ノート（〜数千件） |
| **fzf** | インタラクティブファジー検索 | ノート選択・絞り込み |
| **SQLite FTS5** | 全文検索インデックス、ランキング | 大規模ノート、メタデータ検索 |
| **ripgrep + fzf** | 組み合わせ | コンテンツ検索 + インタラクティブ選択 |

**推奨**:
- メタデータ管理にSQLite（FTS5で全文検索インデックス）
- ファイル内容の高速検索にripgrep
- インタラクティブ選択にfzf統合

### 4.3 ストレージフォーマット

**推奨構成**:
```
notes/
├── .note-cli/
│   ├── config.json       # 設定ファイル
│   └── index.db          # SQLiteメタデータ/検索インデックス
├── daily/
│   ├── 2025-01-15.md
│   └── 2025-01-16.md
├── projects/
│   └── my-project/
│       ├── overview.md
│       └── meeting-notes.md
└── inbox/
    └── quick-note.md
```

**ノートフォーマット**:
```markdown
---
id: unique-uuid
title: ノートタイトル
tags: [tag1, tag2]
created: 2025-01-15T10:30:00+09:00
modified: 2025-01-15T14:00:00+09:00
links: []
---

ノート本文（Markdown）
```

### 4.4 同期・バージョン管理

- **Git**: 最も普及した手段。自動コミット + リモートプッシュ
- **ファイル同期サービス**: iCloud/Dropbox/Google Drive上のフォルダ
- **独自サーバー**: Dnoteのようなセルフホスト型

---

## 5. まとめと示唆

### 5.1 エコシステムの現状

ターミナルベースのノートアプリエコシステムは成熟しているが、以下の二極化が顕著:
- **シンプルだが機能不足**（jrnl、notes-cli）
- **高機能だがTUI体験なし・複雑**（nb、Joplin CLI）

### 5.2 差別化のポイント

新規ツールが差別化できる領域:

1. **リッチなTUI体験** - Inkを活用したインタラクティブなターミナルUI
2. **双方向リンクとグラフ** - Obsidianのコアコンセプトをターミナルで実現
3. **シンプルさと高機能の両立** - 段階的な複雑さ（Progressive Disclosure）
4. **AI統合** - LLMによるノート管理の知能化
5. **日本語ネイティブ対応** - CJK対応、日本語全文検索
6. **優れた初回体験** - インタラクティブセットアップ、チュートリアル

### 5.3 技術スタックの推奨

| 領域 | 推奨技術 | 理由 |
|------|---------|------|
| TUIフレームワーク | Ink + React + TypeScript | React知見活用、型安全、コンポーネント再利用 |
| UIコンポーネント | @inkjs/ui | プリビルトコンポーネント、テーマシステム |
| ストレージ | Markdownファイル + SQLite | 可搬性 + 高速検索 |
| 検索 | SQLite FTS5 + ripgrep | 全文検索 + ファイル検索 |
| バージョン管理 | Git | 標準的、既存エコシステムとの親和性 |
| メタデータ | YAML frontmatter | 業界標準、Obsidian互換 |

---

## 出典

- [GitHub - xwmx/nb](https://github.com/xwmx/nb) - nbリポジトリ
- [jrnl.sh](https://jrnl.sh/) - jrnl公式サイト
- [GitHub - zk-org/zk](https://github.com/zk-org/zk) - zkリポジトリ
- [Dnote](https://www.getdnote.com/) - Dnote公式サイト
- [GitHub - tbabej/taskwiki](https://github.com/tbabej/taskwiki) - Taskwikiプラグイン
- [GitHub - rhysd/notes-cli](https://github.com/rhysd/notes-cli) - notes-cliリポジトリ
- [GitHub - vadimdemedes/ink](https://github.com/vadimdemedes/ink) - Inkフレームワーク
- [npm - @inkjs/ui](https://www.npmjs.com/package/@inkjs/ui) - Ink UIコンポーネント
- [Top 5 Terminal Note-Taking Apps (DEV Community)](https://dev.to/jianzcar/top-5-open-source-terminal-note-taking-applications-mhh)
- [7 TUI libraries (LogRocket)](https://blog.logrocket.com/7-tui-libraries-interactive-terminal-apps/)
- [zk vs vimwiki (LibHunt)](https://www.libhunt.com/compare-zk-vs-vimwiki)
- [awesome-tuis](https://github.com/rothgar/awesome-tuis)
