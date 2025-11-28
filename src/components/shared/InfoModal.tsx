'use client';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  buttonText?: string;
  buttonColor?: 'blue' | 'green' | 'red' | 'yellow' | 'orange';
  showCancelButton?: boolean;
  cancelButtonText?: string;
  onConfirm?: () => void;
  confirmButtonText?: string;
  hideActions?: boolean;
}

export default function InfoModal({
  isOpen,
  onClose,
  title,
  message,
  buttonText = 'OK',
  buttonColor = 'blue',
  showCancelButton = false,
  cancelButtonText = 'Cancel',
  onConfirm,
  confirmButtonText,
  hideActions = false,
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
      case 'orange':
        return 'bg-orange-500 hover:bg-orange-600';
      case 'blue':
      default:
        return 'bg-blue-500 hover:bg-blue-600';
    }
  };

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50" onClick={hideActions ? undefined : onClose} />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          {/* Header */}
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          </div>

          {/* Message */}
          <div className={hideActions ? '' : 'mb-6'}>
            {hideActions && (
              <div className="flex items-center justify-center mb-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            )}
            <p className="text-gray-700 whitespace-pre-line break-words overflow-wrap-anywhere">
              {message}
            </p>
          </div>

          {/* Actions */}
          {!hideActions && (
            <div className="flex justify-end gap-3">
              {showCancelButton && (
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium cursor-pointer"
                >
                  {cancelButtonText}
                </button>
              )}
              <button
                onClick={handleConfirm}
                className={`px-6 py-2.5 text-white rounded-lg transition-colors text-sm font-medium cursor-pointer ${getButtonColorClasses(buttonColor)}`}
              >
                {confirmButtonText || buttonText}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
