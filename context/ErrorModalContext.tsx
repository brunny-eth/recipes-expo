import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useRef,
  useEffect,
  useMemo,
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

  // Use refs to access the latest state values without causing function re-creation
  const modalDataRef = useRef(modalData);
  const visibleRef = useRef(visible);

  // Update refs whenever state changes
  useEffect(() => {
    modalDataRef.current = modalData;
  }, [modalData]);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

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
      // Use ref.current to access latest visible and modalData state
      if (visibleRef.current && modalDataRef.current) {
        // Prevent duplicate flashes if the same error is shown rapidly
        if (
          modalDataRef.current.title === title &&
          modalDataRef.current.message === message
        ) {
          console.warn('[GlobalErrorModal] Attempted to show duplicate error.');
          return;
        }
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
    [], // Empty dependency array - function is now truly stable
  );

  const hideError = useCallback(() => {
    requestAnimationFrame(() => {
      setVisible(false);
      // Use ref.current to access the latest modalData
      if (modalDataRef.current?.onDismissCallback) {
        console.log('[GlobalErrorModal] Executing onDismissCallback.');
        modalDataRef.current.onDismissCallback();
      }

      // Safely clear data after the hide animation is complete
      setTimeout(() => {
        setModalData(null);
      }, 500);
    });
  }, []); // Empty dependency array - function is now truly stable

  const value = useMemo(() => {
    // Strategic logging: Track when useMemo recalculates
    console.log('[ErrorModalContext] 🔄 useMemo RECALCULATING. Dependencies changed:', {
      'showError reference': showError,
      'hideError reference': hideError,
    });

    const contextValue = {
      showError,
      hideError,
    };

    // Log the final value object reference
    console.log('[ErrorModalContext] 📦 Provider value object created:', {
      reference: contextValue,
      hasShowError: !!contextValue.showError,
      hasHideError: !!contextValue.hideError,
    });

    return contextValue;
  }, [showError, hideError]);

  return (
    <ErrorModalContext.Provider value={value}>
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
