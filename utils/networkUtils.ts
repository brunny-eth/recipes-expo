import NetInfo from '@react-native-community/netinfo';

/**
 * Simple function to check if the device is offline
 */
export function isOfflineError(error: Error | string): boolean {
  const errorMessage = typeof error === 'string' ? error : error.message;
  
  return errorMessage.includes('Network request failed') || 
         errorMessage.includes('Failed to fetch') ||
         errorMessage.includes('network error') ||
         errorMessage.includes('ERR_NETWORK');
}

/**
 * Get current network status
 */
export async function getNetworkStatus(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected ?? false;
} 