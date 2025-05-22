import { useErrorModal } from '@/context/ErrorModalContext';

/**
 * Custom hook to provide a generic error handling function.
 * This function will log the error to the console and display a global error modal.
 * 
 * @returns A function to handle errors, taking an error object and an optional context string.
 */
export function useHandleError() {
  const { showError } = useErrorModal();

  return (err: unknown, context: string = "Unknown context") => {
    // Determine the message from the error object
    let message: string;
    if (err instanceof Error) {
      message = err.message;
    } else if (typeof err === 'string') {
      message = err;
    } else {
      message = 'An unexpected error occurred.';
    }

    console.error(`[${context}] Error:`, err); // Log the full error object for more details

    showError({
      title: "Something went wrong", // Generic title
      message, // Extracted message
    });
  };
} 