'use client';

import React from 'react';
import Modal from '@/components/shared/Modal';
import { VerifiableCredential } from '@/utils/indexedDB';
import { formatDate } from '@/utils/dateUtils';

interface UploadVCModalProps {
  isOpen: boolean;
  onClose: () => void;
  isValidating: boolean;
  uploadValidation: {
    isValid: boolean;
    errors: string[];
    stage?: 'structure' | 'api' | 'duplicate';
  } | null;
  uploadedVC: VerifiableCredential | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSave: () => void;
}

export const UploadVCModal: React.FC<UploadVCModalProps> = ({
  isOpen,
  onClose,
  isValidating,
  uploadValidation,
  uploadedVC,
  fileInputRef,
  onFileUpload,
  onSave,
}) => {
  const [isDragOver, setIsDragOver] = React.useState(false);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];

      // Check if file is JSON
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        // Create a synthetic event to pass to onFileUpload
        const syntheticEvent = {
          target: {
            files: files,
          },
        } as React.ChangeEvent<HTMLInputElement>;

        onFileUpload(syntheticEvent);
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Upload Verifiable Credential" minHeight="600px">
      <div className="px-8 py-6">
        <div className="mb-6">
          <label className="block mb-3">
            <p className="text-sm font-semibold text-gray-900">Select JSON File</p>
          </label>

          <div className="relative">
            <div
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer transition-colors duration-200 ${
                isDragOver
                  ? 'border-blue-500 bg-blue-100'
                  : 'border-blue-300 bg-blue-50 hover:bg-blue-100'
              }`}
            >
              <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <svg
                    className="w-10 h-10 mb-3 text-blue-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <p className="mb-2 text-sm text-blue-600 font-medium">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-blue-500">JSON files only</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={onFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isValidating && (
          <div className="mb-6 flex items-center gap-3 text-blue-700 bg-blue-50 px-4 py-3 rounded-lg">
            <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-blue-700"></div>
            <span className="text-sm">Validating credential...</span>
          </div>
        )}

        {/* Validation Message */}
        {!isValidating && uploadValidation && (
          <div className="mb-6">
            {uploadValidation.isValid ? (
              <div className="flex items-center gap-2 text-green-700 bg-green-50 px-4 py-3 rounded-lg">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="grid grid-rows-2">
                  <span className="text-sm">All validations passed</span>
                  <span className="text-green-600 mt-1">
                    Structure validated → API validated → No duplicates found
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-red-700 bg-red-50 px-4 py-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <span className="text-sm">
                      Validation failed
                      {uploadValidation.stage && ` at ${uploadValidation.stage} stage`}
                    </span>
                  </div>
                </div>
                <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                  {uploadValidation.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Preview VC */}
        {uploadValidation?.isValid && uploadedVC && (
          <div>
            <p className="text-base font-semibold text-gray-900 mb-4">Credential Preview</p>
            <div className="border border-gray-200 rounded-lg bg-gray-50 max-h-96 overflow-y-auto">
              <div className="p-6 space-y-6">
                <div className="bg-white rounded-lg p-4 border border-gray-200 grid grid-cols-2">
                  <span className="text-gray-500 mb-2">ID</span>
                  <span className="text-gray-900 break-all leading-relaxed text-right">
                    {uploadedVC.id}
                  </span>
                </div>

                <div className="bg-white rounded-lg p-4 border border-gray-200 grid grid-cols-2">
                  <span className="text-gray-500 mb-2">Type</span>
                  <span className="text-sm text-gray-900 text-right">
                    {uploadedVC.type.join(', ')}
                  </span>
                </div>

                <div className="bg-white rounded-lg p-4 border border-gray-200 grid grid-cols-2">
                  <span className="text-gray-500 mb-2">Issuer</span>
                  <span className="text-gray-900 break-all leading-relaxed text-right">
                    {uploadedVC.issuer}
                  </span>
                </div>

                <div className="bg-white rounded-lg p-4 border border-gray-200 grid grid-cols-2">
                  <span className="text-gray-500 mb-2">Issuer Name</span>
                  <span className="text-sm text-gray-900 text-right">{uploadedVC.issuerName}</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg p-4 border border-gray-200 grid grid-cols-2">
                    <span className="text-gray-500 mb-2">Valid From</span>
                    <span className="text-sm text-gray-900 text-right">
                      {formatDate(uploadedVC.validFrom)}
                    </span>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-gray-200 grid grid-cols-2">
                    <span className="text-gray-500 mb-2">Expired At</span>
                    <span className="text-sm text-gray-900 text-right">
                      {uploadedVC.expiredAt ? formatDate(uploadedVC.expiredAt) : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <span className="text-gray-500 mb-2">Credential Subject</span>
                  <div className="bg-gray-50 rounded-lg p-4 mt-2">
                    <pre className="whitespace-pre-wrap break-all text-gray-700 text-sm leading-relaxed">
                      {JSON.stringify(uploadedVC.credentialSubject, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium cursor-pointer"
              >
                CANCEL
              </button>
              <button
                onClick={onSave}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium cursor-pointer"
              >
                SAVE TO INDEXEDDB
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
