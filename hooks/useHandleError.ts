import { useErrorModal } from '@/context/ErrorModalContext';
import { normalizeAppError, NormalizeAppErrorOptions } from '@/utils/normalizeAppError';
import { isApiError } from '@/lib/apiError';

/**
 * Custom hook to provide a generic error handling function.
 * This function will log the error to the console and display a global error modal.
 * 
 * @returns A function to handle errors, taking a title and the error itself.
 */
type UIOptions = {
  onDismissCallback?: () => void;
  onButtonPress?: () => void;
  primaryButtonLabel?: string;
  secondButtonLabel?: string;
  onSecondButtonPress?: () => void;
};

export function useHandleError(defaultOptions?: NormalizeAppErrorOptions) {
  const { showError } = useErrorModal();

  return (
    fallbackTitle: string,
    error: unknown,
    options?: NormalizeAppErrorOptions,
    ui?: UIOptions,
  ) => {
    // A request we cancelled ourselves (unmount / user cancel) is not an error to show.
    if (isApiError(error, 'aborted')) return;

    const normalized = normalizeAppError(error, { ...defaultOptions, ...options });

    console.error(`[Error] ${normalized.code} ${normalized.title}:`, normalized.message);

    // For now wire into the existing modal API. We could extend the modal to support secondary actions later.
    const title = normalized.title || fallbackTitle;
    const message = normalized.message;
    showError(
      title,
      message,
      ui?.onDismissCallback,
      ui?.onButtonPress,
      ui?.primaryButtonLabel,
      ui?.secondButtonLabel,
      ui?.onSecondButtonPress,
    );
  };
} 