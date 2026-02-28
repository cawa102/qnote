import { describe, it, expect } from 'vitest';
import { yamlQuote } from '../../../src/tui/screens/EditorScreen.js';

describe('EditorScreen', () => {
  it('exports EditorScreen component', async () => {
    const mod = await import('../../../src/tui/screens/EditorScreen.js');
    expect(typeof mod.EditorScreen).toBe('function');
  });
});

describe('EditorScreen module structure', () => {
  it('EditorScreen is a React function component', async () => {
    const mod = await import('../../../src/tui/screens/EditorScreen.js');
    expect(mod.EditorScreen.name).toBe('EditorScreen');
  });
});

describe('yamlQuote', () => {
  it('returns plain string as-is when no special characters', () => {
    expect(yamlQuote('hello world')).toBe('hello world');
  });

  it('returns simple alphanumeric strings as-is', () => {
    expect(yamlQuote('mytag')).toBe('mytag');
    expect(yamlQuote('tag123')).toBe('tag123');
  });

  it('wraps strings with colons in double quotes', () => {
    expect(yamlQuote('key: value')).toBe('"key: value"');
  });

  it('wraps strings with brackets in double quotes', () => {
    expect(yamlQuote('[array]')).toBe('"[array]"');
    expect(yamlQuote('{object}')).toBe('"{object}"');
  });

  it('wraps strings with YAML special characters in double quotes', () => {
    expect(yamlQuote('a & b')).toBe('"a & b"');
    expect(yamlQuote('a * b')).toBe('"a * b"');
    expect(yamlQuote('a ? b')).toBe('"a ? b"');
    expect(yamlQuote('a | b')).toBe('"a | b"');
    expect(yamlQuote('a > b')).toBe('"a > b"');
    expect(yamlQuote('a ! b')).toBe('"a ! b"');
    expect(yamlQuote('a % b')).toBe('"a % b"');
    expect(yamlQuote('#comment')).toBe('"#comment"');
    expect(yamlQuote('@mention')).toBe('"@mention"');
  });

  it('escapes internal double quotes', () => {
    expect(yamlQuote('say "hello"')).toBe('"say \\"hello\\""');
  });

  it('escapes backslashes', () => {
    expect(yamlQuote('path\\to')).toBe('"path\\\\to"');
  });

  it('escapes newlines', () => {
    expect(yamlQuote('line1\nline2')).toBe('"line1\\nline2"');
  });

  it('escapes carriage returns', () => {
    expect(yamlQuote('line1\rline2')).toBe('"line1\\rline2"');
  });

  it('wraps strings with leading/trailing whitespace', () => {
    expect(yamlQuote(' leading')).toBe('" leading"');
    expect(yamlQuote('trailing ')).toBe('"trailing "');
  });

  it('handles single quotes', () => {
    expect(yamlQuote("it's")).toBe('"it\'s"');
  });

  it('handles backticks', () => {
    expect(yamlQuote('`code`')).toBe('"`code`"');
  });

  it('prevents YAML injection with crafted title', () => {
    // An attacker might try to inject YAML keys
    const malicious = 'title: injected\ntags: [evil]';
    const result = yamlQuote(malicious);
    expect(result).toBe('"title: injected\\ntags: [evil]"');
    // The result should be a single quoted string, not multiple YAML lines
    expect(result).not.toContain('\n');
  });

  it('quotes strings with commas (YAML flow sequence separators)', () => {
    // Commas are significant in YAML flow sequences, so they get quoted
    expect(yamlQuote('a, b')).toBe('"a, b"');
  });

  it('handles empty string', () => {
    expect(yamlQuote('')).toBe('');
  });
});
