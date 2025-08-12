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
  onButtonPress?: () => void;
  primaryButtonLabel?: string;
  secondButtonLabel?: string;
  onSecondButtonPress?: () => void;
}

interface ErrorModalContextType {
  showError: (
    title: string,
    message: string,
    onDismissCallback?: () => void,
    onButtonPress?: () => void,
    primaryButtonLabel?: string,
    secondButtonLabel?: string,
    onSecondButtonPress?: () => void,
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
    (
      title: string,
      message: string,
      onDismissCallback?: () => void,
      onButtonPress?: () => void,
      primaryButtonLabel?: string,
      secondButtonLabel?: string,
      onSecondButtonPress?: () => void,
    ) => {
      // Add granular logging for useCallback recreation
      console.log('[ErrorModalContext] showError useCallback recreated. Empty dependencies array - should be stable.');
      
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
      console.log('[ErrorModalContext] State update: setModalData() called with new modal data');
      setModalData({ title, message, onDismissCallback, onButtonPress, primaryButtonLabel, secondButtonLabel, onSecondButtonPress });
    },
    [], // Empty dependency array - function is now truly stable
  );

  const hideError = useCallback(() => {
    // Add granular logging for useCallback recreation
    console.log('[ErrorModalContext] hideError useCallback recreated. Empty dependencies array - should be stable.');
    
    // Prevent multiple rapid calls
    if (!visibleRef.current) {
      console.log('[ErrorModalContext] hideError called but modal already hidden - ignoring');
      return;
    }
    
    // Immediately mark as hidden to prevent duplicate calls
    visibleRef.current = false;
    
    requestAnimationFrame(() => {
      console.log('[ErrorModalContext] State update: setVisible(false)');
      setVisible(false);

      // Store callback reference before clearing data
      const callbackToExecute = modalDataRef.current?.onDismissCallback;

      // Defer clearing modal data until after the hide animation finishes (~220ms)
      setTimeout(() => {
        console.log('[ErrorModalContext] Clearing modal data after fade-out');
        setModalData(null);
        try {
          if (callbackToExecute) {
            callbackToExecute();
          }
        } catch (error) {
          console.error('[ErrorModalContext] Error in onDismissCallback:', error);
        }
      }, 220);
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
        onButtonPress={modalData?.onButtonPress}
        primaryButtonLabel={modalData?.primaryButtonLabel}
        secondButtonLabel={modalData?.secondButtonLabel}
        onSecondButtonPress={modalData?.onSecondButtonPress}
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
