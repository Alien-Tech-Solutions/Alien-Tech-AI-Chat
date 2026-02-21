import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { useAppStore } from '../../src/store';
import ChatInterface from '../../src/components/Chat/ChatInterface';

jest.mock('../../src/store', () => {
  const actual = jest.requireActual('../../src/store');
  return {
    ...actual,
    useAppStore: jest.fn(() => ({
      currentSession: { id: '1', name: 'Test Session' },
      messages: [],
      isStreaming: false,
      setCurrentSession: jest.fn(),
      addMessage: jest.fn(),
      setIsStreaming: jest.fn(),
      sidebarOpen: false,
      setSidebarOpen: jest.fn(),
      updateAssistantMessage: jest.fn(),
    })),
  };
});

describe('ChatInterface', () => {
  it('renders welcome message when no messages', () => {
    render(<ChatInterface />);
    expect(screen.getByText('Welcome to Lackadaisical AI Chat')).toBeInTheDocument();
  });
});
