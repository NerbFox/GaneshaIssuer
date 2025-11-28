'use client';

import { useState } from 'react';

interface InputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  title: string;
  message: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonColor?: 'blue' | 'green' | 'red' | 'yellow';
  inputType?: 'text' | 'textarea';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
}

export default function InputModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  placeholder = '',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmButtonColor = 'blue',
  inputType = 'textarea',
  required = true,
  minLength = 1,
  maxLength = 500,
}: InputModalProps) {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setInputValue('');
    setError(null);
    onClose();
  };

  const handleConfirm = () => {
    const trimmedValue = inputValue.trim();

    // Validation
    if (required && trimmedValue === '') {
      setError('This field is required');
      return;
    }

    if (minLength && trimmedValue.length < minLength) {
      setError(`Minimum length is ${minLength} characters`);
      return;
    }

    if (maxLength && trimmedValue.length > maxLength) {
      setError(`Maximum length is ${maxLength} characters`);
      return;
    }

    setError(null);
    setInputValue('');
    onConfirm(trimmedValue);
  };

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && inputType === 'text') {
      e.preventDefault();
      handleConfirm();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          {/* Header */}
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          </div>

          {/* Message */}
          <div className="mb-4">
            <span className="text-gray-700 whitespace-pre-line">{message}</span>
          </div>

          {/* Input Field */}
          <div className="mb-4">
            {inputType === 'textarea' ? (
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-black"
                rows={4}
                maxLength={maxLength}
              />
            ) : (
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                maxLength={maxLength}
              />
            )}
            {maxLength && (
              <div className="mt-1 text-xs text-gray-500 text-right">
                {inputValue.length}/{maxLength}
              </div>
            )}
            {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              onClick={handleClose}
              className="px-5 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium cursor-pointer"
            >
              {cancelText}
            </button>
            <button
              onClick={handleConfirm}
              className={`px-5 py-2 text-white rounded-lg transition-colors text-sm font-medium cursor-pointer ${getButtonColorClasses(confirmButtonColor)}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
