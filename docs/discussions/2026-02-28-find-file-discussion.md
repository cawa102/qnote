# Discussion Report: Find File（ファイル検索）機能

> **Date:** 2026-02-28
> **Design:** docs/plans/2026-02-28-find-file-design.md
> **Reviewers:** Devil's Advocate, Failure Analyst, Implementation Architect
> **Rounds:** 3

## Summary

Find File 設計書に対する3ラウンドの構造化レビューにより、設計の大幅な簡略化が合意された。主な変更点: (1) ディレクトリ表示を完全に除外し `.md` ファイルのみフラット表示、(2) 空ディレクトリ確認フローの削除（YAGNI）、(3) 絵文字アイコンの ASCII 記号への変更、(4) 表示件数上限の導入（100件）。これにより設計の複雑度が約40%削減され、障害シナリオも半減する。noteList 遷移のデータフロー破綻（Critical）の回避も実現。

## Findings

### Critical（設計変更必須）

- **[Devil's Advocate] ディレクトリ選択 → noteList 遷移のデータフロー破綻**
  - Issue: `App.tsx` の `NoteList` は `setNoteListItems` でデータをセットしてから push する設計だが、`FindFileScreen` からは `setNoteListItems` にアクセスできない。ディレクトリ選択で noteList に遷移してもデータが空になる
  - Impact: ディレクトリ選択機能が完全に動作しない
  - Recommendation: ディレクトリ表示を除外し `.md` ファイルのみフラット表示にする
  - Consensus: 3/3 合意

- **[Failure Analyst] シンボリックリンクの未処理**
  - Issue: 設計書にシンボリックリンク処理の記載なし。循環シンボリックリンクで無限再帰 → スタックオーバーフロー。パストラバーサルのセキュリティリスク
  - Impact: アプリクラッシュ、セキュリティ脆弱性
  - Recommendation: `file-tree-builder.ts:42-59` の既存パターン（realpath + startsWith チェック）を適用
  - Consensus: 3/3 合意

- **[Failure Analyst] 大量ファイル時の UI ブロッキングとレンダリング上限**
  - Issue: 5,000+ ファイルで非同期走査完了まで UI 応答なし。Ink に仮想スクロールがなく全件レンダリングでフレームドロップ
  - Impact: ユーザーがフリーズと誤認、フレームドロップ
  - Recommendation: (1) ローディングインジケーター表示、(2) 表示件数上限100件（`entries.slice(0, MAX_DISPLAY)` で初期表示・検索結果両方に適用）
  - Consensus: 3/3 合意

### Important（計画で対応必須）

- **[全員] 空ディレクトリ確認フローの削除（YAGNI）**
  - Issue: 空ディレクトリ検出、確認UI、ノート作成フローで実装量・状態管理・障害シナリオが大幅増加。使用頻度はほぼゼロ
  - Recommendation: MVP から完全に除外

- **[Failure Analyst] CJK ファイル名と fuse.js のファジーマッチ**
  - Issue: fuse.js はラテン文字向け最適化。日本語ファイル名での部分検索精度に懸念
  - Recommendation: threshold を 0.3〜0.4 に設定、CJK ファイル名のテストケース必須

- **[Devil's Advocate] 絵文字アイコンのターミナル互換性**
  - Issue: 📁📄 の表示幅がターミナル依存。既存コードベースは絵文字不使用
  - Recommendation: ASCII 記号（`●`/`○` 等、既存パターンに合わせる）に変更

- **[Devil's Advocate] SearchScreen との UX 混乱**
  - Issue: 「search」と「find file」の違いが不明確
  - Recommendation: CommandPalette の description で差別化（`find file — ファイル名で検索` / `search — 本文の全文検索`）

- **[全員] ScreenEntry 型の具体的定義**
  - Issue: 設計書に `findFile` の ScreenEntry 型定義が未記載
  - Recommendation: `{ readonly screen: 'findFile' }` を設計書に明記

- **[Failure Analyst] 空の notesDir（初回起動）時の表示**
  - Issue: ファイルが存在しない場合の空状態メッセージが設計書にない
  - Recommendation: 「ノートがありません」メッセージを表示

- **[Failure Analyst] fuse.js 初期化とローディング状態の競合**
  - Issue: 走査完了前にユーザーがテキスト入力 → fuse インスタンスが null で TypeError
  - Recommendation: loading 中は検索を無効化、または fuse が null の場合は空配列を返すガード

### Minor（実装時に留意）

- **[Devil's Advocate] 走査結果のキャッシュ**: マウントごとの再取得で十分。App.tsx の条件分岐レンダリングにより画面切替時に re-mount される
- **[Failure Analyst] 非 `.md` ファイル**: 検索結果に表示されないことの UX 的影響は低い（設計書通り `.md` のみでOK）
- **[Failure Analyst] 極端に長いファイルパス**: 再帰深度制限は OS の PATH_MAX で自然に制約される。パスの表示切り詰めは contentWidth で対応
- **[Failure Analyst] デバウンスのクリーンアップ**: 既存の `useDebounce` フックが cleanup 済み。同じフックを再利用すれば問題なし
- **[Impl Architect] notesDir の props 受け渡し**: App.tsx で既に destructure 済み。FindFileScreen に直接 props で渡す

## 論争事項の解決

### 1. file-scanner.ts の配置場所 → `src/storage/`
- DA: `src/storage/`（MAINTAIN）、FA: `src/storage/`（ACCEPT）、IA: `src/core/` だが受け入れ可能（COMPROMISE）
- **決定**: `src/storage/file-scanner.ts` に配置。ファイルシステム I/O 操作であり storage 層の責務

### 2. file-scanner.ts と file-tree-builder.ts の共通化 → MVP では共通化しない
- DA: 共通化すべき（MAINTAIN）、FA: MVP では共通化しないがコメント明記（COMPROMISE）、IA: 共通化不要（MAINTAIN）
- **決定**: MVP では共通化しない。IA の指摘（`tui/editor` → `storage` の逆方向依存）が正当。走査ロジックの重複箇所にコメント（`// NOTE: file-tree-builder.ts と走査ロジックが重複。シンボリックリンク保護は同パターンを適用`）を明記。P1 で `src/storage/fs-scanner.ts` への共通化を検討

### 3. 選択時のファイル消失レースコンディション対策 → 不要
- 3/3 ACCEPT。TOCTOU 問題で根本的解決にならない。遷移先の既存エラーハンドリング（`NoteNotFoundError`）で十分

### 4. config.search.excludeDirs との整合性 → パラメータ設計で将来対応
- DA: 定数切り出し（COMPROMISE）、FA: config 参照すべき（MAINTAIN）、IA: パラメータで受け取り MVP ではハードコード渡し（COMPROMISE）
- **決定**: `scanNoteFiles(notesDir, { excludeDirs })` のようにパラメータで受け取る設計。MVP ではハードコード定数を渡し、P1 で `config.search.excludeDirs` に差し替え。FA の懸念（設定の一貫性）と IA の現実解（MVP のシンプルさ）を両立

## Recommended Implementation Order

1. **types.ts** — `ScreenName` + `ScreenEntry` に `'findFile'` 追加（2行）
   - Reason: Footer.tsx の `Record<ScreenName, string>` が網羅性チェックで自然な検証ポイントになる
2. **file-scanner.ts + テスト**（Phase 2A、並行可能）
   - Reason: FindFileScreen のデータソース。シンボリックリンク保護、excludeDirs パラメータ、CJK ファイル名テスト含む
3. **Footer.tsx + CommandPalette.tsx 更新**（Phase 2B、Phase 2A と並行可能）
   - Reason: types.ts 変更後の型エラー修正 + コマンド追加
4. **FindFileScreen.tsx + テスト**（Phase 3）
   - Reason: file-scanner 完成後。State: query, selectedIndex, entries, isLoading の4つ。SearchScreen パターン踏襲
5. **App.tsx ルーティング + handleAction**（Phase 4）
   - Reason: 最終統合ステップ

## Edge Cases & Failure Scenarios

| Scenario | Likelihood | Impact | Mitigation |
|----------|-----------|--------|------------|
| シンボリックリンク循環 | M | H | realpath + startsWith チェック |
| 大量ファイル（5,000+） | M | H | ローディング表示 + 表示100件上限 |
| CJK ファイル名の検索精度 | H | M | fuse.js threshold 0.3-0.4 + テスト |
| 空の notesDir（初回起動） | H | L | 空状態メッセージ表示 |
| fuse.js 未初期化時の入力 | H | M | null ガード or loading 中は入力無効化 |
| ファイル選択後の消失 | L | H | 遷移先の NoteNotFoundError で処理 |
| 走査中のパーミッションエラー | M | M | スキップして読めた分だけ返す |

## Open Questions

- **アイコンの具体的なデザイン**: 絵文字を ASCII に変更するが、具体的にどの記号を使うか未決定（`●`/`○`、`▸`/`·`、`[D]`/`[F]` など）。既存パレットの `●`/`○` に合わせてファイルアイコンなしでパス表示のみが最もシンプル
- **初期表示の表示順**: 全件を表示上限100件で切る場合のソート順（アルファベット順 or 更新日時順）。LazyVim 準拠ならアルファベット順
