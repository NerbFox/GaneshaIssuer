'use client';

import React from 'react';
import Modal from '@/components/shared/Modal';
import { ThemedText } from '@/components/shared/ThemedText';
import { formatDateTime } from '@/utils/dateUtils';
import { VerifiableCredential } from '@/utils/indexedDB';

interface RevokeCredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  revokingCredential: VerifiableCredential | null;
  revocationReason: string;
  onReasonChange: (reason: string) => void;
  isRevoking: boolean;
  onSubmit: () => void;
}

export const RevokeCredentialModal: React.FC<RevokeCredentialModalProps> = ({
  isOpen,
  onClose,
  revokingCredential,
  revocationReason,
  onReasonChange,
  isRevoking,
  onSubmit,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Revoke Credential" maxWidth="900px">
      {revokingCredential && (
        <div className="px-8 py-6">
          {/* Credential Information Grid */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Credential ID */}
            <div className="col-span-2">
              <label className="block mb-2">
                <ThemedText className="text-sm font-medium text-gray-700">Credential ID</ThemedText>
              </label>
              <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
                {revokingCredential.id}
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
                {Array.isArray(revokingCredential.type)
                  ? revokingCredential.type.find((t) => t !== 'VerifiableCredential') || 'Unknown'
                  : revokingCredential.type}
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
                {formatDateTime(new Date(revokingCredential.validFrom))}
              </div>
            </div>

            {/* Expired At */}
            <div>
              <label className="block mb-2">
                <ThemedText className="text-sm font-medium text-gray-700">Expired At</ThemedText>
              </label>
              <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                {revokingCredential.expiredAt
                  ? formatDateTime(new Date(revokingCredential.expiredAt))
                  : 'Never'}
              </div>
            </div>

            {/* Issuer Name */}
            <div>
              <label className="block mb-2">
                <ThemedText className="text-sm font-medium text-gray-700">Issuer Name</ThemedText>
              </label>
              <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                {revokingCredential.issuerName}
              </div>
            </div>

            {/* Issuer DID */}
            <div className="col-span-2">
              <label className="block mb-2">
                <ThemedText className="text-sm font-medium text-gray-700">Issuer DID</ThemedText>
              </label>
              <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
                {revokingCredential.issuer}
              </div>
            </div>

            {/* Holder DID */}
            <div className="col-span-2">
              <label className="block mb-2">
                <ThemedText className="text-sm font-medium text-gray-700">Holder DID</ThemedText>
              </label>
              <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
                {revokingCredential.credentialSubject.id}
              </div>
            </div>
          </div>

          {/* Credential Image */}
          {revokingCredential.imageLink && (
            <div className="mb-6">
              <label className="block mb-3">
                <ThemedText className="text-sm font-semibold text-gray-900">
                  VC Background Image
                </ThemedText>
              </label>
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={revokingCredential.imageLink}
                  alt="VC Background"
                  className="w-full h-auto max-h-96 object-contain rounded-xl border-2 border-gray-200 shadow-md block bg-gray-50"
                />
              </div>
            </div>
          )}

          {/* Credential Attributes Section */}
          {Object.keys(revokingCredential.credentialSubject).filter((key) => key !== 'id').length >
            0 && (
            <div className="mb-6">
              <div className="mb-4">
                <ThemedText className="text-sm font-semibold text-gray-900">
                  Credential Attributes (
                  {
                    Object.keys(revokingCredential.credentialSubject).filter((key) => key !== 'id')
                      .length
                  }
                  )
                </ThemedText>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="space-y-4">
                  {Object.entries(revokingCredential.credentialSubject)
                    .filter(([key]) => key !== 'id')
                    .map(([key, value], index) => (
                      <div key={index} className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block mb-1">
                            <ThemedText className="text-xs font-medium text-gray-600">
                              {key}
                            </ThemedText>
                          </label>
                        </div>
                        <div>
                          <div className="px-3 py-2 bg-white border border-gray-200 rounded text-sm text-gray-900">
                            {String(value)}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Warning Message */}
          <div className="mb-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-red-600 flex-shrink-0"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <ThemedText className="text-sm font-semibold text-red-800">
                    Warning: This action cannot be undone
                  </ThemedText>
                </div>
                <ThemedText className="text-xs text-red-700">
                  Revoking this credential will permanently invalidate it. The credential will no
                  longer be valid for verification purposes.
                </ThemedText>
              </div>
            </div>
          </div>

          {/* Revocation Reason Input */}
          <div className="mb-6">
            <label className="block mb-2">
              <ThemedText className="text-sm font-medium text-gray-700">
                Reason for Revocation <span className="text-red-500">*</span>
              </ThemedText>
            </label>
            <textarea
              value={revocationReason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="Please provide a detailed reason for revoking this credential..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none min-h-[150px] text-sm text-gray-900"
              disabled={isRevoking}
            />
            {revocationReason.trim() === '' && (
              <ThemedText className="text-xs text-gray-500 mt-1">This field is required</ThemedText>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              disabled={isRevoking}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              CANCEL
            </button>
            <button
              onClick={onSubmit}
              disabled={isRevoking || !revocationReason.trim()}
              className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px]"
            >
              {isRevoking ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Submitting...
                </span>
              ) : (
                'REVOKE VC'
              )}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
