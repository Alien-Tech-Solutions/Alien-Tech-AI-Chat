import '@testing-library/jest-dom';

// Set up environment variables for tests (used after babel transforms import.meta.env to process.env)
process.env.VITE_API_URL = 'http://localhost:3001';
process.env.MODE = 'test';
process.env.DEV = 'false';
process.env.PROD = 'false';
