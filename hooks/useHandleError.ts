import { useErrorModal } from '@/context/ErrorModalContext';
import { normalizeError } from '@/utils/normalizeError';

/**
 * Custom hook to provide a generic error handling function.
 * This function will log the error to the console and display a global error modal.
 * 
 * @returns A function to handle errors, taking a title and the error itself.
 */
export function useHandleError() {
  const { showError } = useErrorModal();

  return (title: string, error: unknown) => {
    const message = normalizeError(error);
    
    console.error(`[Error] ${title}:`, message); 

    showError(title, message);
  };
} 