# Fullscreen TUI Design

Date: 2026-02-27

## Goal

qnote の TUI を LazyVim のように全画面で起動する。ターミナルの直前のコマンド履歴とは分離された画面で動作し、終了時に元のターミナルに戻る。

## Approach

Ink の `fullScreen: true` オプションを使用。クラッシュ時のターミナル復元はシグナルハンドラで保証する。

## Changes

### 1. bin/qnote.ts — fullScreen render + シグナルハンドラ

TUI を起動するコマンドのみ `render(App, { fullScreen: true })` を使用。

```typescript
let instance: Instance;

function startTui(initialScreen, initialParams) {
  instance = render(
    React.createElement(App, {
      initialScreen,
      initialParams,
      onRequestEditor: async (filePath: string) => {
        instance.unmount();
        spawnEditor(filePath);
        startTui('notePreview', { slug: extractSlug(filePath) });
      },
    }),
    { fullScreen: true }
  );
  instance.waitUntilExit();
}
```

シグナルハンドラで SIGINT/SIGTERM/uncaught exception 時にターミナル状態を復元：

```typescript
function restoreTerminal(): void {
  process.stdout.write('\x1b[?1049l\x1b[?25h');
}

process.on('SIGINT', () => { restoreTerminal(); process.exit(130); });
process.on('SIGTERM', () => { restoreTerminal(); process.exit(143); });
process.on('uncaughtException', (err) => {
  restoreTerminal();
  console.error('Fatal:', err.message);
  process.exit(1);
});
```

### 2. エディタ起動時の unmount/remount フロー

エディタ起動前に Ink を unmount して alternate screen を抜ける。エディタ終了後に再 render する。

- `instance.unmount()` → alternate screen exit
- `spawnSync(editor, [filePath], { stdio: 'inherit' })` → エディタがターミナルを直接制御
- `startTui('notePreview', { slug })` → 編集したノートの preview 画面で再開

エディタの検出は既存のフォールバックチェーン: `$VISUAL` → `$EDITOR` → `vi`

### 3. TUI / 非TUI コマンドの分離

| コマンド | fullScreen | 理由 |
|---------|-----------|------|
| `qnote`（引数なし） | Yes | palette 画面を起動 |
| `qnote search` | Yes | search 画面を起動 |
| `qnote capture` | Yes | capture 画面を起動 |
| `qnote new` | No | エディタを直接起動 |
| `qnote daily` | No | エディタを直接起動 |
| `qnote list` | No | stdout に一覧出力 |
| `qnote tags` | No | stdout にタグ出力 |
| `qnote init` | No | ディレクトリ作成のみ |
| `qnote reindex` | No | SQLite 再構築のみ |

非TUI コマンドは変更なし。シグナルハンドラも `startTui()` 内でのみ登録。

### 4. App.tsx の変更

`onRequestEditor` prop を受け取り、`e` キー押下時にコールバックを呼ぶ。ナビゲーションスタックは再起動時にリセットされるが、編集したノートの preview 画面から再開するので自然なUX。

## Files Modified

- `bin/qnote.ts` — startTui 関数、シグナルハンドラ、コマンド分離
- `src/tui/App.tsx` — onRequestEditor prop 追加
- `src/tui/hooks/use-global-keys.ts` — e キーのハンドラ変更（onRequestEditor 呼び出し）

## Not Changed

- 非TUI コマンド（list, tags, init, reindex, new, daily）
- スクリーンコンポーネント（palette, noteList, notePreview, search, capture）
- ストレージ層、コア層
