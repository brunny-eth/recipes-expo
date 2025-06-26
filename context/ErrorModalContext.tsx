import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import GlobalErrorModal from '@/components/GlobalErrorModal';

interface ModalData {
  message: string;
  title: string | null;
  onDismissCallback?: () => void;
}

interface ErrorModalContextType {
  showError: (
    title: string,
    message: string,
    onDismissCallback?: () => void,
  ) => void;
  hideError: () => void;
}

const ErrorModalContext = createContext<ErrorModalContextType | undefined>(
  undefined,
);

export const ErrorModalProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [modalData, setModalData] = useState<ModalData | null>(null);
  const [visible, setVisible] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (modalData) {
      const timeout = setTimeout(() => {
        setVisible(true);
      }, 50); // small debounce delay helps avoid flash
      return () => clearTimeout(timeout);
    } else {
      setVisible(false);
    }
  }, [modalData]);

  const showError = useCallback(
    (title: string, message: string, onDismissCallback?: () => void) => {
      // prevent duplicate flashes if the same error is already showing
      if (
        visible &&
        modalData?.title === title &&
        modalData?.message === message &&
        modalData?.onDismissCallback === onDismissCallback
      ) {
        console.warn('[GlobalErrorModal] Duplicate error suppressed:', title);
        return;
      }

      if (!isMountedRef.current) {
        console.warn(
          '[GlobalErrorModal] Tried to show after unmount – skipping',
        );
        return;
      }

      console.log(`[GlobalErrorModal] Showing with: ${title} ${message}`);
      console.log('[DEBUG] ErrorModalContext: showError called with:', {
        title,
        message,
        onDismissCallback: !!onDismissCallback,
      });
      console.trace('[DEBUG] Trace for showError');
      setModalData({ title, message, onDismissCallback });
    },
    [visible, modalData],
  );

  const hideError = useCallback(() => {
    requestAnimationFrame(() => {
      setVisible(false);
      // NEW: Execute the stored callback BEFORE clearing the modal data
      // This ensures the action is performed when the modal is visually hiding
      if (modalData?.onDismissCallback) {
        console.log('[GlobalErrorModal] Executing onDismissCallback.');
        modalData.onDismissCallback();
      }

      // Safely clear data after the hide animation is complete
      setTimeout(() => {
        setModalData(null);
      }, 500);
    });
  }, [modalData]);

  return (
    <ErrorModalContext.Provider value={{ showError, hideError }}>
      {children}
      <GlobalErrorModal
        visible={visible}
        title={modalData?.title ?? null}
        message={modalData?.message ?? ''}
        onClose={hideError}
      />
    </ErrorModalContext.Provider>
  );
};

export const useErrorModal = () => {
  const context = useContext(ErrorModalContext);
  if (context === undefined) {
    throw new Error('useErrorModal must be used within an ErrorModalProvider');
  }
  return context;
};
