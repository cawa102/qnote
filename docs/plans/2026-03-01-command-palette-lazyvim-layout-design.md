# Command Palette LazyVim風レイアウト設計

作成日: 2026-03-01
対象: CommandPalette の全面改修（レイアウト + テキスト入力削除）

## 概要

CommandPaletteをLazyVimダッシュボード風の2カラムレイアウトに改修する。
テキスト入力を削除し、カーソル操作 + ショートカットキー直押しに変更する。

## データモデル

```typescript
export interface PaletteCommand {
  readonly label: string;
  readonly key: string;    // ショートカットキー (1文字)
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
```

### 削除するもの

- `description` フィールド
- `filterCommands` 関数
- `fuse.js` import（CommandPaletteからのみ。FindFileScreenでは継続使用）
- `TextInput` コンポーネントと検索ボックスUI
- `query` state、`handleChange`
- `inputMode.set('text')` の effect

## レイアウト

### メニューブロック幅の計算

```
menuWidth = clamp(contentWidth - 8, 44, 72)
leftPad = floor((contentWidth - menuWidth) / 2)
```

- 画面幅80 → menuWidth = 72
- 画面幅60 → menuWidth = 52
- 画面幅48 → menuWidth = 44 (最小値)

### 各行のレイアウト（Box-based）

```
<Box width={menuWidth}>
  <Text>● new note</Text>     ← 左揃え
  <Box flexGrow={1} />         ← スペーサー
  <Text>n</Text>               ← 右揃え
</Box>
```

### 狭幅フォールバック (contentWidth < 50)

ショートカットキーの表示を非表示にし、labelのみ表示。
キーボード入力自体は幅に関係なく常に有効。

## 入力方式

- カーソル上下 + Enter で選択
- ショートカットキー（n, f, s, d, r, c, t）直押しでアクション発火
- `onAction` シグネチャ: `(action: string) => void`（queryパラメータ削除）

## 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/tui/screens/CommandPalette.tsx` | データモデル変更、TextInput削除、Box-based 2カラムレイアウト、ショートカットキー入力 |
| `src/theme/format.ts` | `computePaletteLayout` をmenuWidthベースに書き換え |
| `src/tui/App.tsx` | `onAction` シグネチャから `query` 削除 |
| `src/tui/index.ts` | `filterCommands` のexport削除 |
| `test/tui/command-palette.test.ts` | データモデルテスト更新、filterCommandsテスト削除 |
| `test/tui/command-palette-input.test.ts` | ショートカットキー入力テスト + カーソル操作テスト |

## テスト観点

- ショートカットキー直押し（n, f, s, d, r, c, t）でアクション発火
- 上下カーソル + Enter で選択
- `contentWidth >= 50` で2カラム表示（label + key）
- `contentWidth < 50` でlabelのみ表示
- menuWidthがclamp(contentWidth - 8, 44, 72)の範囲内
