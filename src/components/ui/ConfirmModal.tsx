import * as React from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { Input } from "./Input";

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: React.ReactNode;
  onConfirm: () => void;
  confirmText?: string;
  isDanger?: boolean;
  expectedInput?: string; // If provided, behaves like a prompt
}

export function ConfirmModal({
  isOpen,
  onClose,
  title,
  message,
  onConfirm,
  confirmText = "Confirm",
  isDanger = false,
  expectedInput,
}: ConfirmModalProps) {
  const [inputValue, setInputValue] = React.useState("");

  // Reset input when opened
  React.useEffect(() => {
    if (isOpen) {
      setInputValue("");
    }
  }, [isOpen]);

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const isConfirmDisabled = expectedInput ? inputValue !== expectedInput : false;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-6">
        <div className="text-text font-medium leading-relaxed whitespace-pre-wrap">
          {message}
        </div>

        {expectedInput && (
          <div className="space-y-2">
            <label className="text-sm font-bold uppercase tracking-widest text-text">
              Type "{expectedInput}" to confirm
            </label>
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={expectedInput}
            />
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" className="flex-1 justify-center" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className={`flex-1 justify-center ${isDanger ? "!bg-error border-2 border-text shadow-[4px_4px_0px_#000] text-white" : ""}`}
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
