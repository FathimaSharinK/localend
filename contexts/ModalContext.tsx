"use client";

import { createContext, useContext, useState, ReactNode } from 'react';
import CreateRequestModal from '../components/requests/CreateRequestModal';
import { HelpRequest } from '../types';

interface ModalContextType {
  openCreateRequest: (request?: HelpRequest) => void;
  closeCreateRequest: () => void;
}

const ModalContext = createContext<ModalContextType>({
  openCreateRequest: () => {},
  closeCreateRequest: () => {},
});

export const useModal = () => useContext(ModalContext);

export const ModalProvider = ({ children }: { children: ReactNode }) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<HelpRequest | undefined>(undefined);

  return (
    <ModalContext.Provider value={{
      openCreateRequest: (request) => {
        setEditingRequest(request);
        setIsCreateOpen(true);
      },
      closeCreateRequest: () => {
        setIsCreateOpen(false);
        setEditingRequest(undefined);
      },
    }}>
      {children}
      {isCreateOpen && (
        <CreateRequestModal 
          onClose={() => {
            setIsCreateOpen(false);
            setEditingRequest(undefined);
          }} 
          editRequest={editingRequest} 
        />
      )}
    </ModalContext.Provider>
  );
};
