/// <reference types="@testing-library/jest-native" />
// jest-setup.js

// Import helpful matchers for React Native Testing Library
// Note: If using @testing-library/react-native v12.4+, these matchers are built-in
// and this specific import might not be strictly necessary, but adding it 
// doesn't hurt and ensures compatibility if versions change slightly.
// Ensure this line is active:
import '@testing-library/jest-native/extend-expect';

// --- Global Mocks --- 

// Mock react-native-reanimated
// This is often needed because animations can interfere with tests.
// See: https://docs.swmansion.com/react-native-reanimated/docs/guides/testing/
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');

  // The mock for `call` immediately calls the callback which is incorrect
  // So we override it with a no-op
  Reanimated.default.call = () => {};

  return Reanimated;
});

// Mock lucide-react-native icons
jest.mock('lucide-react-native', () => ({
  // Provide simple mock components for icons used
  ArrowLeft: 'ArrowLeft',
  ChevronRight: 'ChevronRight',
  X: 'X',
  // Add other icons used by the component if any
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 }
  return {
    SafeAreaProvider: jest.fn().mockImplementation(({ children }) => children),
    SafeAreaConsumer: jest
      .fn()
      .mockImplementation(({ children }) => children(inset)),
    useSafeAreaInsets: jest.fn().mockImplementation(() => inset),
    useSafeAreaFrame: jest.fn().mockImplementation(() => ({ x: 0, y: 0, width: 390, height: 844 })),
  }
})

// You might need to add mocks for other libraries here, e.g.:
// jest.mock('@/constants/theme'); // If theme causes issues 