// --- MUST BE FIRST ---
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

// Pure-JS WebCrypto subtle.digest (SHA-256) shim so Supabase PKCE works in dev client
import { sha256 } from 'js-sha256';

(function ensureWebCrypto() {
  const g = globalThis;

  // Ensure global crypto exists
  if (!g.crypto) g.crypto = {};

  // Guarantee getRandomValues (react-native-get-random-values provides it)
  if (typeof g.crypto.getRandomValues !== 'function') {
    throw new Error('getRandomValues missing (react-native-get-random-values not loaded)');
  }

  // Provide a minimal subtle with digest('SHA-256', ArrayBuffer)
  if (!g.crypto.subtle) {
    g.crypto.subtle = {
      async digest(algorithm, data) {
        const algo = typeof algorithm === 'string' ? algorithm : algorithm?.name;
        if (algo !== 'SHA-256') throw new Error(`Unsupported algorithm: ${algo}`);
        // Normalize to Uint8Array
        let bytes;
        if (data instanceof ArrayBuffer) {
          bytes = new Uint8Array(data);
        } else if (ArrayBuffer.isView(data)) {
          bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        } else {
          throw new Error('subtle.digest expects ArrayBuffer or TypedArray');
        }
        const buf = sha256.arrayBuffer(bytes); // returns ArrayBuffer
        return buf;
      },
    };
  }
})();

// Sanity log: subtle MUST be true now
console.log('[polyfills]', {
  hasCrypto: !!globalThis.crypto,
  hasGetRandomValues: !!globalThis.crypto?.getRandomValues,
  hasSubtle: !!globalThis.crypto?.subtle,
  URLType: typeof URL,
});

// Buffer polyfill for React Native (needed for base64url encoding)
if (typeof global.Buffer === 'undefined') {
  global.Buffer = require('buffer').Buffer;
}

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
  Asset.fromModule(require('./assets/images/splash.png')).downloadAsync();
} catch (e) {
  // Non-fatal: continue app startup even if preloading fails
}

// Note: maybeCompleteAuthSession is now called in AuthContext.tsx
// to ensure it runs after the Linking listener is set up

import 'expo-router/entry';
