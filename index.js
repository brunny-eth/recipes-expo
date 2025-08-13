// Global Error Handling - MUST be before expo-router/entry
// This will catch all unhandled JavaScript exceptions in production builds
const originalErrorHandler = global.ErrorUtils?.getGlobalHandler?.();

if (global.ErrorUtils?.setGlobalHandler) {
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    // Log comprehensive error details for TestFlight debugging
    console.error('*** UNHANDLED JS EXCEPTION ***');
    console.error('Error Name:', error?.name || 'Unknown');
    console.error('Error Message:', error?.message || 'No message');
    console.error('Is Fatal:', isFatal);
    console.error('Error Type:', typeof error);
    console.error('Stack Trace:', error?.stack || 'No stack trace available');
    
    // Additional error properties that might be useful
    if (error?.componentStack) {
      console.error('Component Stack:', error.componentStack);
    }
    
    // Log the full error object
    try {
      console.error('Full Error Object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    } catch (e) {
      console.error('Could not stringify error object:', e);
    }

    // Call the original error handler to maintain normal error behavior
    if (originalErrorHandler) {
      originalErrorHandler(error, isFatal);
    } else {
      // Fallback if no original handler exists
      throw error;
    }
  });
}

// Enhanced console.error for additional debugging
const originalConsoleError = console.error;
console.error = (...args) => {
  // Check for specific error patterns
  const message = args[0];
  if (typeof message === 'string') {
    if (message.includes('undefined is not a function')) {
      console.log('🔍 DETECTED: "undefined is not a function" error pattern');
      console.log('🔍 Full arguments:', args);
      console.log('🔍 Stack trace at detection:', new Error().stack);
    }
    if (message.includes('TypeError')) {
      console.log('🔍 DETECTED: TypeError pattern');
      console.log('🔍 Full arguments:', args);
    }
  }
  
  // Call original console.error
  originalConsoleError(...args);
};

// Preload critical images (Meez logo) before app entry
import { Asset } from 'expo-asset';
try {
  Asset.fromModule(require('./assets/images/meezblue_underline.png')).downloadAsync();
} catch (e) {
  // Non-fatal: continue app startup even if preloading fails
}

import 'expo-router/entry';
