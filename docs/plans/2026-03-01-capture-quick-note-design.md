# Capture Quick Note Design

## Overview

Captureをquick note機能として拡張する。タイトルに加えて1行のメモ（body）を入力できるようにし、デフォルトタグを`quick`に変更する。

## 入力フロー

```
┌─ CaptureScreen ──────────────────────────────┐
│                                               │
│  タイトル: [___________________________]      │
│                    ↓ Enter                     │
│  メモ:    [___________________________]       │
│                    ↓ Enter                     │
│  保存しました → quick/                        │
│                                               │
│  Enter:次へ/保存  Tab:$EDITOR  Esc:戻る       │
└───────────────────────────────────────────────┘
```

### 状態遷移

1. **title入力** → Enter → **body入力**にフォーカス移動
2. **body入力** → Enter → 保存（bodyは空でもOK）
3. **どちらの状態でも** Tab → ノートを作成して$EDITORで開く
4. **どちらの状態でも** Esc → 保存せず戻る

## 仕様

| 項目 | 変更前 | 変更後 |
|------|--------|--------|
| デフォルトタグ | `inbox` | `quick` |
| 保存ディレクトリ | `inbox/` | `quick/` |
| config key | `capture.directory` | `capture.directory`（デフォルト値変更） |
| 入力フィールド | タイトルのみ | タイトル + ボディ（1行） |
| ボディ入力 | なし | 単一行TextInput、空も許可 |

## 保存されるノートの形式

```yaml
---
title: My Quick Note
tags: [quick]
created: 2026-03-01T12:00:00+09:00
modified: 2026-03-01T12:00:00+09:00
---
API の仕様変更あり。明日確認する
```

bodyが空の場合はfrontmatterのみ（現行動作と同じ）。

## 変更対象ファイル

| ファイル | 変更内容 |
|----------|----------|
| `src/tui/screens/CaptureScreen.tsx` | body入力フィールド追加、Enter遷移ロジック、保存時にbodyをcontentに含める |
| `src/types.ts` | `QnoteConfig.capture.directory` のデフォルト値確認・変更 |
| `test/tui/capture-screen.test.ts` | 新しいフロー（title→body→save）のテスト追加 |
| `src/tui/components/Footer.tsx` | capture画面のヒント更新（必要なら） |

## 実装方針

### CaptureScreen状態管理

```
phase: 'title' | 'body'  — 現在どちらの入力にフォーカスがあるか
title: string
body: string
```

- `phase === 'title'` のとき Enter → `phase = 'body'` に遷移
- `phase === 'body'` のとき Enter → 保存処理実行
- Tab → どのphaseでも現在の title/body でノート作成 + $EDITOR起動
- 保存時の content: bodyが空なら空文字列、bodyがあればそのままbody文字列

### タグ・ディレクトリ変更

- `CaptureScreen.tsx` で `tags: ['inbox']` → `tags: ['quick']` に変更
- デフォルトの `capture.directory` を `'inbox'` → `'quick'` に変更
