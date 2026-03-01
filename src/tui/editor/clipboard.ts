let clipboardContent = '';

export function getClipboard(): string {
  return clipboardContent;
}

export function setClipboard(text: string): void {
  clipboardContent = text;
}

export function resetClipboard(): void {
  clipboardContent = '';
}
