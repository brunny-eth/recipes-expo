declare module '*.svg' {
  import * as React from 'react';
  import { SvgProps } from 'react-native-svg';
  const content: React.FC<SvgProps>;
  export default content;
}

declare module '*.png'

// Type augmentation for Supabase to allow 'clientId' for Apple Sign-In.
// This patches the type definition locally to resolve TypeScript errors
// when the runtime library supports a parameter that the types do not yet reflect.
declare module '@supabase/gotrue-js' {
  interface SignInWithIdTokenCredentials {
    clientId?: string;
  }
} 