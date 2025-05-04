const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Customizations for SVG transformer
config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer');
config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'svg');
config.resolver.sourceExts.push('svg');

// Explicitly block test files to be sure
// Default Expo config should do this, but let's be explicit
const defaultBlockList = config.resolver.blockList || [];
config.resolver.blockList = [
  ...defaultBlockList,
  /.*\.test\.tsx?$/,
];

module.exports = config; 