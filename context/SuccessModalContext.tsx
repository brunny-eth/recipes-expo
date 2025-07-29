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
import SuccessModal from '@/components/SuccessModal';

interface ModalData {
  message: string;
  title: string;
  autoCloseDelay?: number;
}

interface SuccessModalContextType {
  showSuccess: (
    title: string,
    message: string,
    autoCloseDelay?: number,
  ) => void;
  hideSuccess: () => void;
}

const SuccessModalContext = createContext<SuccessModalContextType | undefined>(
  undefined,
);

export const SuccessModalProvider: React.FC<{ children: ReactNode }> = ({
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

  const showSuccess = useCallback(
    (
      title: string,
      message: string,
      autoCloseDelay?: number,
    ) => {
      if (!isMountedRef.current) {
        console.warn(
          '[SuccessModal] Tried to show after unmount – skipping',
        );
        return;
      }

      setModalData({ title, message, autoCloseDelay });
    },
    [],
  );

  const hideSuccess = useCallback(() => {
    setVisible(false);
    setModalData(null);
  }, []);

  const value = useMemo(() => {
    const contextValue = {
      showSuccess,
      hideSuccess,
    };

    return contextValue;
  }, [showSuccess, hideSuccess]);

  return (
    <SuccessModalContext.Provider value={value}>
      {children}
      <SuccessModal
        visible={visible}
        title={modalData?.title ?? ''}
        message={modalData?.message ?? ''}
        onClose={hideSuccess}
        autoCloseDelay={modalData?.autoCloseDelay}
      />
    </SuccessModalContext.Provider>
  );
};

export const useSuccessModal = () => {
  const context = useContext(SuccessModalContext);
  if (context === undefined) {
    throw new Error('useSuccessModal must be used within a SuccessModalProvider');
  }
  return context;
}; 