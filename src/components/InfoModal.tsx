'use client';

import { ThemedText } from './ThemedText';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  buttonText?: string;
  buttonColor?: 'blue' | 'green' | 'red' | 'yellow';
}

export default function InfoModal({
  isOpen,
  onClose,
  title,
  message,
  buttonText = 'OK',
  buttonColor = 'blue',
}: InfoModalProps) {
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
            <ThemedText className="text-gray-700 whitespace-pre-line break-words overflow-wrap-anywhere">
              {message}
            </ThemedText>
          </div>

          {/* Actions */}
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className={`px-5 py-2 text-white rounded-lg transition-colors text-sm font-medium cursor-pointer ${getButtonColorClasses(buttonColor)}`}
            >
              {buttonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
