import React from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CombinedParsedRecipe, StructuredIngredient, IngredientGroup } from '@/common/types';

// Mock the router for testing
export const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
  navigate: jest.fn(),
};

// Mock for useRouter hook
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({}),
  useFocusEffect: (callback: () => void) => {
    // Execute callback immediately for testing
    callback();
  },
}));

// Mock for useAuth context
export const mockAuthContext = {
  session: {
    user: { id: 'test-user-id' },
    access_token: 'test-token',
  } as any,
  signOut: jest.fn(),
  isLoading: false,
};

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => mockAuthContext,
}));

// Mock for error modal context
export const mockErrorModalContext = {
  showError: jest.fn(),
  hideError: jest.fn(),
  error: null,
};

jest.mock('@/context/ErrorModalContext', () => ({
  useErrorModal: () => mockErrorModalContext,
}));

// Mock for free usage context
export const mockFreeUsageContext = {
  hasUsedFreeRecipe: false,
  markFreeRecipeAsUsed: jest.fn(),
};

jest.mock('@/context/FreeUsageContext', () => ({
  useFreeUsage: () => mockFreeUsageContext,
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

// Mock Supabase client
export const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
  })),
} as any;

jest.mock('@/lib/supabaseClient', () => ({
  supabase: mockSupabaseClient,
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native/Libraries/Components/View/View');
  return {
    Swipeable: View,
    DrawerLayout: View,
    State: {},
    PanGestureHandler: View,
    BaseButton: View,
    TouchableOpacity: View,
    FlatList: View,
    gestureHandlerRootHOC: jest.fn((component) => component),
    Directions: {},
  };
});

// Mock FastImage
jest.mock('@d11/react-native-fast-image', () => {
  const { Image } = require('react-native');
  return Image;
});

// Mock MaterialCommunityIcons
jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

// Mock fetch
global.fetch = jest.fn();

// Mock InteractionManager
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    InteractionManager: {
      runAfterInteractions: (callback: () => void) => {
        callback();
      },
    },
  };
});

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <SafeAreaProvider>
    {children}
  </SafeAreaProvider>
);

// Custom render function
const customRender = (ui: React.ReactElement, options?: RenderOptions) => {
  return render(ui, { wrapper: TestWrapper, ...options });
};

// Test data factories
export const createMockRecipe = (overrides?: Partial<CombinedParsedRecipe>): CombinedParsedRecipe => ({
  id: 1,
  title: 'Test Recipe',
  description: 'A test recipe description',
  shortDescription: 'Quick test recipe',
  image: 'https://example.com/image.jpg',
  thumbnailUrl: 'https://example.com/thumb.jpg',
  sourceUrl: 'https://example.com/recipe',
  recipeYield: '4 servings',
  prepTime: '15 min',
  cookTime: '30 min',
  totalTime: '45 min',
  substitutions_text: null,
  ingredientGroups: [
    {
      name: 'Main',
      ingredients: [
        {
          name: 'flour',
          amount: '2',
          unit: 'cups',
          preparation: null,
          suggested_substitutions: null,
        },
        {
          name: 'eggs',
          amount: '3',
          unit: null,
          preparation: null,
          suggested_substitutions: [
            {
              name: 'egg substitute',
              amount: '3/4',
              unit: 'cup',
              description: 'Use for egg-free version',
            },
          ],
        },
      ],
    },
  ],
  instructions: ['Mix ingredients', 'Cook for 30 minutes'],
  tips: null,
  nutrition: null,
  ...overrides,
});

export const createMockIngredient = (overrides?: Partial<StructuredIngredient>): StructuredIngredient => ({
  name: 'test ingredient',
  amount: '1',
  unit: 'cup',
  preparation: null,
  suggested_substitutions: null,
  ...overrides,
});

export const createMockIngredientGroup = (overrides?: Partial<IngredientGroup>): IngredientGroup => ({
  name: 'Main',
  ingredients: [
    createMockIngredient({ name: 'flour', amount: '2', unit: 'cups' }),
    createMockIngredient({ name: 'sugar', amount: '1', unit: 'cup' }),
  ],
  ...overrides,
});

// Helper functions for testing
export const resetAllMocks = () => {
  jest.clearAllMocks();
  mockRouter.push.mockClear();
  mockRouter.replace.mockClear();
  mockRouter.back.mockClear();
  mockRouter.navigate.mockClear();
  mockErrorModalContext.showError.mockClear();
  mockErrorModalContext.hideError.mockClear();
  mockFreeUsageContext.markFreeRecipeAsUsed.mockClear();
  (global.fetch as jest.Mock).mockClear();
};

// Export everything
export * from '@testing-library/react-native';
export { customRender as render }; 