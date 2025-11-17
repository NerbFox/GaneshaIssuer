'use client';

import React from 'react';
import Modal from '@/components/Modal';
import { ThemedText } from '@/components/ThemedText';
import { VerifiableCredential } from '@/utils/indexedDB';

interface UpdateCredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  updatingCredential: VerifiableCredential | null;
  updatedAttributes: { [key: string]: string | number | boolean };
  onAttributeChange: (key: string, value: string) => void;
  updateReason: string;
  onReasonChange: (reason: string) => void;
  isUpdating: boolean;
  onSubmit: () => void;
}

export const UpdateCredentialModal: React.FC<UpdateCredentialModalProps> = ({
  isOpen,
  onClose,
  updatingCredential,
  updatedAttributes,
  onAttributeChange,
  updateReason,
  onReasonChange,
  isUpdating,
  onSubmit,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Update Credential" maxWidth="900px">
      {updatingCredential && (
        <div className="px-8 py-6">
          {/* Credential Information Grid */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Credential ID */}
            <div className="col-span-2">
              <label className="block mb-2">
                <ThemedText className="text-sm font-medium text-gray-700">Credential ID</ThemedText>
              </label>
              <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
                {updatingCredential.id}
              </div>
            </div>

            {/* Credential Type */}
            <div>
              <label className="block mb-2">
                <ThemedText className="text-sm font-medium text-gray-700">
                  Credential Type
                </ThemedText>
              </label>
              <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                {Array.isArray(updatingCredential.type)
                  ? updatingCredential.type.find((t) => t !== 'VerifiableCredential') || 'Unknown'
                  : updatingCredential.type}
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block mb-2">
                <ThemedText className="text-sm font-medium text-gray-700">Status</ThemedText>
              </label>
              <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  Active
                </span>
              </div>
            </div>

            {/* Valid From */}
            <div>
              <label className="block mb-2">
                <ThemedText className="text-sm font-medium text-gray-700">Valid From</ThemedText>
              </label>
              <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                {new Date(updatingCredential.validFrom).toLocaleString('en-US', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false,
                })}
              </div>
            </div>

            {/* Expired At */}
            <div>
              <label className="block mb-2">
                <ThemedText className="text-sm font-medium text-gray-700">Expired At</ThemedText>
              </label>
              <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                {updatingCredential.expiredAt
                  ? new Date(updatingCredential.expiredAt).toLocaleString('en-US', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false,
                    })
                  : 'Never'}
              </div>
            </div>

            {/* Issuer Name */}
            <div>
              <label className="block mb-2">
                <ThemedText className="text-sm font-medium text-gray-700">Issuer Name</ThemedText>
              </label>
              <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                {updatingCredential.issuerName}
              </div>
            </div>

            {/* Issuer DID */}
            <div className="col-span-2">
              <label className="block mb-2">
                <ThemedText className="text-sm font-medium text-gray-700">Issuer DID</ThemedText>
              </label>
              <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
                {updatingCredential.issuer}
              </div>
            </div>

            {/* Holder DID */}
            <div className="col-span-2">
              <label className="block mb-2">
                <ThemedText className="text-sm font-medium text-gray-700">Holder DID</ThemedText>
              </label>
              <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
                {updatingCredential.credentialSubject.id}
              </div>
            </div>
          </div>

          {/* Credential Image */}
          {updatingCredential.imageLink && (
            <div className="mb-6">
              <label className="block mb-3">
                <ThemedText className="text-sm font-semibold text-gray-900">
                  VC Background Image
                </ThemedText>
              </label>
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={updatingCredential.imageLink}
                  alt="VC Background"
                  className="w-full h-auto max-h-96 object-contain rounded-xl border-2 border-gray-200 shadow-md block bg-gray-50"
                />
              </div>
            </div>
          )}

          {/* Editable Credential Attributes Section */}
          {Object.keys(updatedAttributes).length > 0 && (
            <div className="mb-6">
              <div className="mb-4">
                <ThemedText className="text-sm font-semibold text-gray-900">
                  Credential Attributes ({Object.keys(updatedAttributes).length}) - Editable
                </ThemedText>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="space-y-4">
                  {Object.entries(updatedAttributes).map(([key, value], index) => (
                    <div key={index} className="grid grid-cols-2 gap-4">
                      <div className="flex items-center">
                        <label className="block">
                          <ThemedText className="text-xs font-medium text-gray-600">
                            {key}
                          </ThemedText>
                        </label>
                      </div>
                      <div>
                        <input
                          type="text"
                          value={String(value)}
                          onChange={(e) => onAttributeChange(key, e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          disabled={isUpdating}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Update Reason Input */}
          <div className="mb-6">
            <label className="block mb-2">
              <ThemedText className="text-sm font-medium text-gray-700">
                Reason for Update <span className="text-red-500">*</span>
              </ThemedText>
            </label>
            <textarea
              value={updateReason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="Please provide a detailed reason for updating this credential..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none min-h-[150px] text-sm text-gray-900"
              disabled={isUpdating}
            />
            {updateReason.trim() === '' && (
              <ThemedText className="text-xs text-gray-500 mt-1">This field is required</ThemedText>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              disabled={isUpdating}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              CANCEL
            </button>
            <button
              onClick={onSubmit}
              disabled={isUpdating || !updateReason.trim()}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px]"
            >
              {isUpdating ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Submitting...
                </span>
              ) : (
                'UPDATE VC'
              )}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
