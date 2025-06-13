import React, { createContext, useContext, useState, ReactNode } from 'react';
import GlobalErrorModal from '@/components/GlobalErrorModal';

interface ErrorModalState {
  visible: boolean;
  message: string;
  title: string | null;
}

interface ErrorModalContextType {
  showError: (details: { message: string; title?: string }) => void;
  hideError: () => void;
}

const ErrorModalContext = createContext<ErrorModalContextType | undefined>(undefined);

export const ErrorModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [errorState, setErrorState] = useState<ErrorModalState>({
    visible: false,
    message: '',
    title: null,
  });

  const showError = ({ message, title }: { message: any; title?: string }) => {
    const safeMessage = typeof message === 'string' ? message : String(message);
    setErrorState({ visible: true, message: safeMessage, title: title === undefined ? null : title });
  };

  const hideError = () => {
    setErrorState({ visible: false, message: '', title: null });
  };

  return (
    <ErrorModalContext.Provider value={{ showError, hideError }}>
      {children}
      <GlobalErrorModal
        visible={errorState.visible}
        title={errorState.title}
        message={errorState.message}
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