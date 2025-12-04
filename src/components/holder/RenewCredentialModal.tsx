'use client';

import React from 'react';
import Modal from '@/components/shared/Modal';
import { ThemedText } from '@/components/shared/ThemedText';
import { formatDateTime } from '@/utils/dateUtils';
import { VerifiableCredential } from '@/utils/indexedDB';

interface RenewCredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  renewingCredential: VerifiableCredential | null;
  renewalReason: string;
  onReasonChange: (reason: string) => void;
  isRenewing: boolean;
  onSubmit: () => void;
}

export const RenewCredentialModal: React.FC<RenewCredentialModalProps> = ({
  isOpen,
  onClose,
  renewingCredential,
  renewalReason,
  onReasonChange,
  isRenewing,
  onSubmit,
}) => {
  const getCredentialAttributes = () => {
    if (!renewingCredential) return {};

    const { id, ...attributes } = renewingCredential.credentialSubject;
    console.log('Credential ID:', id);

    return attributes;
  };

  const credentialAttributes = getCredentialAttributes();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Renew Credential" maxWidth="900px">
      {renewingCredential && (
        <div className="px-8 py-6">
          {/* Credential Information Grid */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Credential ID */}
            <div className="col-span-2">
              <label className="block mb-2">
                <ThemedText className="text-sm font-medium text-gray-700">Credential ID</ThemedText>
              </label>
              <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
                {renewingCredential.id}
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
                {Array.isArray(renewingCredential.type)
                  ? renewingCredential.type.find((t) => t !== 'VerifiableCredential') || 'Unknown'
                  : renewingCredential.type}
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
                {formatDateTime(new Date(renewingCredential.validFrom))}
              </div>
            </div>

            {/* Expired At */}
            <div>
              <label className="block mb-2">
                <ThemedText className="text-sm font-medium text-gray-700">Expired At</ThemedText>
              </label>
              <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                {renewingCredential.expiredAt
                  ? formatDateTime(new Date(renewingCredential.expiredAt))
                  : 'Never'}
              </div>
            </div>

            {/* Issuer Name */}
            <div>
              <label className="block mb-2">
                <ThemedText className="text-sm font-medium text-gray-700">Issuer Name</ThemedText>
              </label>
              <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                {renewingCredential.issuerName}
              </div>
            </div>

            {/* Issuer DID */}
            <div className="col-span-2">
              <label className="block mb-2">
                <ThemedText className="text-sm font-medium text-gray-700">Issuer DID</ThemedText>
              </label>
              <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
                {renewingCredential.issuer}
              </div>
            </div>

            {/* Holder DID */}
            <div className="col-span-2">
              <label className="block mb-2">
                <ThemedText className="text-sm font-medium text-gray-700">Holder DID</ThemedText>
              </label>
              <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
                {renewingCredential.credentialSubject.id}
              </div>
            </div>
          </div>

          {/* Credential Image */}
          {renewingCredential.imageLink && (
            <div className="mb-6">
              <label className="block mb-3">
                <ThemedText className="text-sm font-semibold text-gray-900">
                  VC Background Image
                </ThemedText>
              </label>
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={renewingCredential.imageLink}
                  alt="VC Background"
                  className="w-full h-auto max-h-96 object-contain rounded-xl border-2 border-gray-200 shadow-md block bg-gray-50"
                />
              </div>
            </div>
          )}

          {/* Credential Attributes Section - Read Only */}
          {Object.keys(credentialAttributes).length > 0 && (
            <div className="mb-6">
              <div className="mb-4">
                <ThemedText className="text-sm font-semibold text-gray-900">
                  Credential Attributes ({Object.keys(credentialAttributes).length}) - Read Only
                </ThemedText>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="space-y-4">
                  {Object.entries(credentialAttributes).map(([key, value], index) => (
                    <div key={index} className="grid grid-cols-2 gap-4">
                      <div className="flex items-center">
                        <label className="block">
                          <ThemedText className="text-xs font-medium text-gray-600">
                            {key}
                          </ThemedText>
                        </label>
                      </div>
                      <div>
                        <div className="w-full px-3 py-2 bg-white border border-gray-200 rounded text-sm text-gray-900">
                          {String(value)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Renewal Reason Input */}
          <div className="mb-6">
            <label className="block mb-2">
              <ThemedText className="text-sm font-medium text-gray-700">
                Reason for Renewal <span className="text-red-500">*</span>
              </ThemedText>
            </label>
            <textarea
              value={renewalReason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="Please provide a detailed reason for renewing this credential..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none min-h-[150px] text-sm text-gray-900"
              disabled={isRenewing}
            />
            {renewalReason.trim() === '' && (
              <ThemedText className="text-xs text-gray-500 mt-1">This field is required</ThemedText>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              disabled={isRenewing}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              CANCEL
            </button>
            <button
              onClick={onSubmit}
              disabled={isRenewing || !renewalReason.trim()}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px]"
            >
              {isRenewing ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Submitting...
                </span>
              ) : (
                'RENEW VC'
              )}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
