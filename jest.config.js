module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['./jest-setup.js'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$/': 'babel-jest', // Ensure babel-jest handles JS/TS/JSX/TSX
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-reanimated|@react-native-community|expo-.*|@expo/.*|@expo-google-fonts/.*|@react-navigation/.*|lucide-react-native)/)',
  ],
  // Module name mapper to handle assets and specific modules if needed
  moduleNameMapper: {
    // Mock assets is good practice if needed, keep commented for now
    // '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$' : '<rootDir>/__mocks__/fileMock.js',
    // Add mapping for the @/ alias
    '^@/(.*)$': '<rootDir>/$1' // Maps @/something to rootDir/something
  },
  // Clear mocks between tests
  clearMocks: true,
}; 