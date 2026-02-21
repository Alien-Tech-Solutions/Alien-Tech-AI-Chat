import { renderHook, act } from '@testing-library/react-hooks';
import { useAppStore } from '../src/store';

describe('Zustand Store', () => {
  it('should add and update messages', () => {
    const { result } = renderHook(() => useAppStore());
    act(() => {
      result.current.addMessage({
        id: '1',
        content: 'Hello',
        role: 'user',
        timestamp: new Date().toISOString(),
      });
    });
    expect(result.current.messages.length).toBe(1);
    expect(result.current.messages[0].content).toBe('Hello');
    act(() => {
      result.current.updateMessage('1', { content: 'Hi' });
    });
    expect(result.current.messages[0].content).toBe('Hi');
  });

  it('should set and clear context window', () => {
    const { result } = renderHook(() => useAppStore());
    act(() => {
      result.current.updateContext('test-session', [{ foo: 'bar' }]);
    });
    expect(result.current.contextWindow).toEqual([{ foo: 'bar' }]);
    act(() => {
      result.current.clearContext('test-session');
    });
    expect(result.current.contextWindow).toEqual([]);
  });
});
