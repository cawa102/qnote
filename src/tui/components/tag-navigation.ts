export type TagAction =
  | { readonly type: 'select'; readonly index: number }
  | { readonly type: 'delete'; readonly index: number }
  | { readonly type: 'noop' };

/**
 * Pure function: given a key name, tag count, current cursor position,
 * and whether the text input is empty, return the action to perform.
 *
 * Cursor index ranges from 0..tagCount-1 (tag selected) to tagCount (TextInput active).
 */
export function handleTagKey(
  keyName: string,
  tagCount: number,
  cursorIndex: number,
  inputEmpty: boolean,
): TagAction {
  const atInput = cursorIndex === tagCount;

  if (keyName === 'left') {
    if (atInput && tagCount > 0) {
      return { type: 'select', index: tagCount - 1 };
    }
    if (!atInput && cursorIndex > 0) {
      return { type: 'select', index: cursorIndex - 1 };
    }
    return { type: 'noop' };
  }

  if (keyName === 'right') {
    if (!atInput && cursorIndex < tagCount) {
      return { type: 'select', index: cursorIndex + 1 };
    }
    return { type: 'noop' };
  }

  if (keyName === 'backspace') {
    // On a selected tag → delete it
    if (!atInput) {
      return { type: 'delete', index: cursorIndex };
    }
    // At input with empty text → select last tag
    if (inputEmpty && tagCount > 0) {
      return { type: 'select', index: tagCount - 1 };
    }
    return { type: 'noop' };
  }

  return { type: 'noop' };
}

/**
 * Immutably delete a tag at the given index.
 * Returns new tags array and adjusted cursor clamped to min(index, newTags.length).
 */
export function deleteTag(
  tags: readonly string[],
  index: number,
): { readonly tags: readonly string[]; readonly cursor: number } {
  const newTags = [...tags.slice(0, index), ...tags.slice(index + 1)];
  const cursor = Math.min(index, newTags.length);
  return { tags: newTags, cursor };
}
