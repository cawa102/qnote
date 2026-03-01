# FindFileScreen ボーダー height=3 描画崩れ

## ステータス: 未解決

## 概要

FindFileScreen の検索ボックス (`<Box borderStyle="bold" height={3}>`) が、実端末で描画崩れを起こす。
同一構造の SearchScreen では height=3 で正常に描画される。

## 再現手順

1. `npm run build && npx qnote` でTUIを起動
2. コマンドパレットから FindFile (ファイル検索) を開く
3. 検索ボックスのボーダーが崩れている（上ボーダーの水平線とコンテンツ行がマージされ、下ボーダーが消失）

## 症状

height=3 の場合:
```
┌ ファイル検索 > Search files...━━━━━━━━━━━━━━━━━━━━━━━┐   ← 上ボーダーとコンテンツが1行にマージ
  66 件                                                      ← 下ボーダー消失
● daily/daily-2026-02-28.md
```

height=4 の場合（正常）:
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ ファイル検索 > Search files...                           ┃
┃                                                          ┃   ← 空行が入る
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
  66 件
```

## 現在のワークアラウンド

```tsx
// FindFileScreen.tsx:125
height={query === '' ? 4 : 3}
```

プレースホルダー表示時は height=4、入力中は height=3。
これで動作するが、空の時にボーダー内に余分な空行が入る。

## 調査で排除された仮説

### 1. ラベルテキスト長の差異 → 否定

| 画面 | ラベル | visualWidth |
|------|--------|-------------|
| FindFile | ` ファイル検索 > ` | 16 |
| Search | ` 検索 > ` | 8 |

FindFileScreen のラベルを `検索 >` に短縮しても崩れた。

### 2. marginTop による干渉 → 否定

ボーダーBox に `marginTop={1}` を追加しても変化なし。

### 3. ボーダー内の幅不足（折り返し） → 否定

string-width 計算:
- contentWidth=72、内側=70列
- ラベル+プレースホルダー合計: 最大31列（余白39列）
- 幅不足で折り返しが起きる余地はない

### 4. TextInput のプレースホルダー描画 → 否定

@inkjs/ui の TextInput は、空の状態でも単一行のインラインテキストを描画:
```js
// use-text-input.js:10-12
chalk.inverse(placeholder[0]) + chalk.dim(placeholder.slice(1))
```

### 5. コード構造の差異 → 否定

FindFileScreen を SearchScreen と完全に同じ構造にしても（同じラベル、同じ height、marginTop なし）、FindFileScreen だけ崩れる。

## 両画面の差異（コード構造以外）

FindFileScreen と SearchScreen のボーダー Box は完全に同一だが、以下の差異がある:

### App.tsx での配置順序

```tsx
// App.tsx:209-224
{currentEntry.screen === 'findFile' && (
  <FindFileScreen ... />        // ← 先に定義
)}
{currentEntry.screen === 'search' && (
  <SearchScreen ... />          // ← 後に定義
)}
```

### ボーダー直下の要素

```tsx
// FindFileScreen: 常に表示
<Text dimColor>  {fileCount}</Text>

// SearchScreen: 条件付き表示（初期状態では非表示）
{hint.length > 0 && (<Text dimColor>  {hint}</Text>)}
```

### マウント時の副作用

- FindFileScreen: `scanNoteFiles()` の非同期呼び出し → `setIsLoading(false)` → 再レンダリング
- SearchScreen: 非同期処理なし、即座に描画完了

## テスト環境での再現

**再現不可。** ink-testing-library では両画面とも height=3 で正常描画される。

```
=== FindFile-like, width=72, height=3 ===
  [0] visualW=72 |┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓|
  [1] visualW=72 |┃ ファイル検索 > search files...                                       ┃|
  [2] visualW=72 |┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛|

=== Search-like, width=72, height=3 ===
  [0] visualW=72 |┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓|
  [1] visualW=72 |┃ 検索 > search notes...                                               ┃|
  [2] visualW=72 |┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛|
```

## 未検証の仮説

### A. 非同期再レンダリングとInk描画パイプラインの競合

FindFileScreen は `scanNoteFiles()` → `setIsLoading(false)` → `setAllFiles(files)` で再レンダリングが発生する。
初回描画時に height=3 のボーダーが描画された後、非同期完了で再レンダリングされる際に
Ink のターミナル差分更新が正しく機能していない可能性。

SearchScreen は初回描画で完結し、再レンダリングが発生しない。

### B. Ink の Yoga レイアウトとターミナル差分更新の不整合

Ink は Yoga でレイアウト計算を行い、前回のフレームとの差分を ANSI エスケープで端末に出力する。
`height={3}` + `borderStyle="bold"` の組み合わせで、Yoga が計算するレイアウトと
実際のターミナル文字幅に不一致がある場合、差分更新が壊れる可能性。

### C. ボーダー直下の常時表示テキスト

FindFileScreen はボーダー直下に常に `<Text dimColor>  {fileCount}</Text>` がある。
SearchScreen は条件付き表示で、初期状態では非表示。
この差がレイアウト計算に影響している可能性。

## 推奨する次の調査ステップ

1. **仮説C の検証**: FindFileScreen の `{fileCount}` 表示を条件付き（SearchScreen と同じパターン）にして、実端末で確認
2. **仮説A の検証**: `scanNoteFiles` のモックで即座に空配列を返し、非同期再レンダリングを排除して確認
3. **Ink のデバッグ出力**: `DEBUG="ink*"` 環境変数で Ink の内部ログを確認し、レイアウト計算の差分を特定

## 環境

- macOS Darwin 25.2.0
- Terminal: iTerm2 (推定)
- Node.js: (要確認)
- Ink: 5.x
- @inkjs/ui: (要確認)

## 関連ファイル

- `src/tui/screens/FindFileScreen.tsx` (問題のコンポーネント)
- `src/tui/screens/SearchScreen.tsx` (正常に動作する同構造のコンポーネント)
- `src/tui/hooks/use-layout.ts` (contentWidth 計算)
- `src/tui/App.tsx` (画面配置)
- `node_modules/@inkjs/ui/build/components/text-input/use-text-input.js` (TextInput 描画ロジック)
