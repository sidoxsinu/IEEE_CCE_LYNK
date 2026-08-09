import * as React from "react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-alt/80 p-4">
      {/* Stark background overlay */}
      <div 
        className="absolute inset-0 bg-text/40" 
        onClick={onClose} 
        aria-label="Close modal background"
        role="button"
      />
      
      {/* Modal Content */}
      <div 
        className="neo-card relative z-10 w-full max-w-md max-h-[90dvh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="flex items-center justify-between border-b-4 border-text p-4 bg-primary text-white">
          <h2 id="modal-title" className="text-xl font-bold font-heading m-0 text-white">
            {title}
          </h2>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center border-2 border-text bg-white text-text rounded-sm hover:bg-bg-alt active:translate-y-1 active:translate-x-1 transition-transform"
            aria-label="Close modal"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto bg-bg">
          {children}
        </div>
      </div>
    </div>
  );
}
