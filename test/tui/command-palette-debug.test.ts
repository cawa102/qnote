import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from 'ink-testing-library';
import { Box, Text, useInput } from 'ink';
import { TextInput } from '@inkjs/ui';

const ARROW_DOWN = '\x1b[B';
const BACKSPACE = '\x7f';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

afterEach(() => {
  cleanup();
});

describe('TextInput + useInput interaction debug', () => {
  it('MINIMAL: arrow keys stop working after type+delete', async () => {
    // Track every useInput invocation
    const calls: string[] = [];

    function TestComp() {
      const [selected, setSelected] = React.useState(0);
      const [query, setQuery] = React.useState('');

      useInput((input, key) => {
        calls.push(`input="${input}" down=${key.downArrow} up=${key.upArrow} bs=${key.backspace}`);
        if (key.downArrow) {
          setSelected((i) => i + 1);
        }
      });

      return React.createElement(
        Box,
        { flexDirection: 'column' as const },
        React.createElement(TextInput, {
          placeholder: 'type...',
          onChange: (v: string) => {
            setQuery(v);
            setSelected(0);
          },
        }),
        React.createElement(Text, null, `selected: ${selected} query: "${query}"`),
      );
    }

    const { stdin, lastFrame } = render(React.createElement(TestComp));
    await delay(50);

    // Verify initial state
    expect(lastFrame()).toContain('selected: 0 query: ""');

    // Test 1: arrow works initially
    calls.length = 0;
    stdin.write(ARROW_DOWN);
    await delay(50);
    expect(lastFrame()).toContain('selected: 1');
    expect(calls.some((c) => c.includes('down=true'))).toBe(true);

    // Reset
    calls.length = 0;

    // Type 'a'
    stdin.write('a');
    await delay(50);
    expect(lastFrame()).toContain('query: "a"');

    // Delete 'a'
    stdin.write(BACKSPACE);
    await delay(50);
    expect(lastFrame()).toContain('query: ""');

    // Test 2: arrow after type+delete
    calls.length = 0;
    stdin.write(ARROW_DOWN);
    await delay(50);

    // Check: was the handler called at all?
    const arrowCalls = calls.filter((c) => c.includes('down=true'));
    expect(arrowCalls.length).toBeGreaterThan(0);
  });

  it('TRACE: check rawModeEnabledCount via multiple arrows', async () => {
    function TestComp() {
      const [selected, setSelected] = React.useState(0);
      const [, setQuery] = React.useState('');

      useInput((_input, key) => {
        if (key.downArrow) {
          setSelected((i) => i + 1);
        }
      });

      // useCallback keeps onChange reference stable, preventing
      // @inkjs/ui useEffect from re-firing onChange on every render
      const handleChange = React.useCallback((v: string) => {
        setQuery(v);
        setSelected(0);
      }, []);

      return React.createElement(
        Box,
        { flexDirection: 'column' as const },
        React.createElement(TextInput, {
          placeholder: 'type...',
          onChange: handleChange,
        }),
        React.createElement(Text, null, `selected: ${selected}`),
      );
    }

    const { stdin, lastFrame } = render(React.createElement(TestComp));
    await delay(50);

    // Type single char and delete
    stdin.write('x');
    await delay(50);
    stdin.write(BACKSPACE);
    await delay(50);

    // Now try multiple arrows with increasing delays
    stdin.write(ARROW_DOWN);
    await delay(100);
    const frame1 = lastFrame()!;

    stdin.write(ARROW_DOWN);
    await delay(100);
    const frame2 = lastFrame()!;

    stdin.write(ARROW_DOWN);
    await delay(100);
    const frame3 = lastFrame()!;

    // At least one should show selected > 0
    const anyMoved =
      frame1.includes('selected: 1') ||
      frame2.includes('selected: 2') ||
      frame3.includes('selected: 3');
    expect(anyMoved).toBe(true);
  });

  it('ISOLATE: does raw mode get disabled?', async () => {
    // Use a simpler approach: check if stdin events reach the handler
    let handlerCallCount = 0;

    function TestComp() {
      const [query, setQuery] = React.useState('');

      useInput(() => {
        handlerCallCount++;
      });

      return React.createElement(
        Box,
        { flexDirection: 'column' as const },
        React.createElement(TextInput, {
          placeholder: 'type...',
          onChange: (v: string) => setQuery(v),
        }),
        React.createElement(Text, null, `query: "${query}"`),
      );
    }

    const { stdin, lastFrame } = render(React.createElement(TestComp));
    await delay(50);

    // Before typing: handler should receive input
    handlerCallCount = 0;
    stdin.write(ARROW_DOWN);
    await delay(50);
    const countBefore = handlerCallCount;

    // Type and delete
    stdin.write('x');
    await delay(50);
    stdin.write(BACKSPACE);
    await delay(50);

    // After type+delete: does handler still receive input?
    handlerCallCount = 0;
    stdin.write(ARROW_DOWN);
    await delay(50);
    const countAfter = handlerCallCount;

    expect(countAfter).toBeGreaterThan(0);
  });
});
