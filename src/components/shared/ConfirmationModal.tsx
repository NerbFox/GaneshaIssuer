'use client';

import { useState, useEffect } from 'react';
import { ThemedText } from '@/components/shared/ThemedText';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonColor?: 'blue' | 'green' | 'red' | 'yellow';
  isLoading?: boolean;
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmButtonColor = 'blue',
  isLoading: externalLoading = false,
}: ConfirmationModalProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const isLoading = externalLoading || internalLoading;

  // Reset internal loading state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setInternalLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getButtonColorClasses = (color: string) => {
    switch (color) {
      case 'green':
        return 'bg-green-500 hover:bg-green-600';
      case 'red':
        return 'bg-red-500 hover:bg-red-600';
      case 'yellow':
        return 'bg-yellow-500 hover:bg-yellow-600';
      case 'blue':
      default:
        return 'bg-blue-500 hover:bg-blue-600';
    }
  };

  const handleConfirm = async () => {
    setInternalLoading(true);
    try {
      await onConfirm();
    } finally {
      setInternalLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          {/* Header */}
          <div className="mb-4">
            <ThemedText fontSize={20} fontWeight={600} className="text-gray-900">
              {title}
            </ThemedText>
          </div>

          {/* Message */}
          <div className="mb-6">
            <ThemedText className="text-gray-700 whitespace-pre-line">{message}</ThemedText>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-5 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelText}
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading}
              className={`px-5 py-2 text-white rounded-lg transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${getButtonColorClasses(confirmButtonColor)}`}
            >
              {isLoading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
