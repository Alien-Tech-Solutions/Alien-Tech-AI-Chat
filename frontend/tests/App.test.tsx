import React from 'react';
import { render, screen } from '@testing-library/react';
import App from '../src/App';

describe('App', () => {
  it('renders Lackadaisical AI Chat title', () => {
    render(<App />);
    expect(screen.getByText(/Lackadaisical AI Chat/i)).toBeInTheDocument();
  });
});
