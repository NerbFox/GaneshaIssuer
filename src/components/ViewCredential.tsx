import React from 'react';
import { ThemedText } from './ThemedText';

interface CredentialAttribute {
  name: string;
  value: string;
}

interface ViewCredentialProps {
  credentialData: {
    id: string;
    credentialType: string;
    issuer: string;
    issuerName: string;
    holder: string;
    validFrom: string;
    expiredAt: string | null;
    status: 'Active' | 'Expired' | 'Revoked';
    imageLink: string | null;
    attributes: CredentialAttribute[];
    proof: {
      type: string;
      cryptosuite: string;
      created: string;
      verificationMethod: string;
      proofPurpose: string;
      proofValue: string;
    };
  };
  onClose: () => void;
  onDownload?: () => void;
  onDownloadPdf?: () => void;
}

export const ViewCredential: React.FC<ViewCredentialProps> = ({
  credentialData,
  onClose,
  onDownload,
  onDownloadPdf,
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-700';
      case 'Expired':
        return 'bg-gray-100 text-gray-700';
      case 'Revoked':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="px-8 py-6">
      {/* Credential Information Grid */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Credential ID */}
        <div>
          <label className="block mb-2">
            <ThemedText className="text-sm font-medium text-gray-700">Credential ID</ThemedText>
          </label>
          <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
            {credentialData.id}
          </div>
        </div>

        {/* Credential Type */}
        <div>
          <label className="block mb-2">
            <ThemedText className="text-sm font-medium text-gray-700">Credential Type</ThemedText>
          </label>
          <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
            {credentialData.credentialType}
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="block mb-2">
            <ThemedText className="text-sm font-medium text-gray-700">Status</ThemedText>
          </label>
          <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(credentialData.status)}`}
            >
              {credentialData.status}
            </span>
          </div>
        </div>

        {/* Valid From */}
        <div>
          <label className="block mb-2">
            <ThemedText className="text-sm font-medium text-gray-700">Valid From</ThemedText>
          </label>
          <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
            {formatDate(credentialData.validFrom)}
          </div>
        </div>

        {/* Expired At */}
        <div>
          <label className="block mb-2">
            <ThemedText className="text-sm font-medium text-gray-700">Expired At</ThemedText>
          </label>
          <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
            {credentialData.expiredAt ? formatDate(credentialData.expiredAt) : 'Never'}
          </div>
        </div>

        {/* Issuer Name */}
        <div>
          <label className="block mb-2">
            <ThemedText className="text-sm font-medium text-gray-700">Issuer Name</ThemedText>
          </label>
          <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
            {credentialData.issuerName}
          </div>
        </div>

        {/* Issuer DID */}
        <div className="col-span-2">
          <label className="block mb-2">
            <ThemedText className="text-sm font-medium text-gray-700">Issuer DID</ThemedText>
          </label>
          <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
            {credentialData.issuer}
          </div>
        </div>

        {/* Holder DID */}
        <div className="col-span-2">
          <label className="block mb-2">
            <ThemedText className="text-sm font-medium text-gray-700">Holder DID</ThemedText>
          </label>
          <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
            {credentialData.holder}
          </div>
        </div>
      </div>

      {/* Credential Image */}
      {credentialData.imageLink && (
        <div className="mb-6">
          <label className="block mb-3">
            <ThemedText className="text-sm font-semibold text-gray-900">
              VC Background Image
            </ThemedText>
          </label>
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={credentialData.imageLink}
              alt="VC Background"
              className="w-full h-auto max-h-96 object-contain rounded-xl border-2 border-gray-200 shadow-md block bg-gray-50"
            />
          </div>
        </div>
      )}

      {/* Credential Attributes Section */}
      {credentialData.attributes.length > 0 && (
        <div className="mb-6">
          <div className="mb-4">
            <ThemedText className="text-sm font-semibold text-gray-900">
              Credential Attributes ({credentialData.attributes.length})
            </ThemedText>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="space-y-4">
              {credentialData.attributes.map((attr, index) => (
                <div key={index} className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1">
                      <ThemedText className="text-xs font-medium text-gray-600">
                        {attr.name}
                      </ThemedText>
                    </label>
                  </div>
                  <div>
                    <div className="px-3 py-2 bg-white border border-gray-200 rounded text-sm text-gray-900">
                      {attr.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Proof Information Section */}
      <div className="mb-6">
        <div className="mb-4">
          <ThemedText className="text-sm font-semibold text-gray-900">Proof Information</ThemedText>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Proof Type */}
          <div>
            <label className="block mb-2">
              <ThemedText className="text-sm font-medium text-gray-700">Type</ThemedText>
            </label>
            <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
              {credentialData.proof.type}
            </div>
          </div>

          {/* Cryptosuite */}
          <div>
            <label className="block mb-2">
              <ThemedText className="text-sm font-medium text-gray-700">Cryptosuite</ThemedText>
            </label>
            <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
              {credentialData.proof.cryptosuite}
            </div>
          </div>

          {/* Created */}
          <div>
            <label className="block mb-2">
              <ThemedText className="text-sm font-medium text-gray-700">Created</ThemedText>
            </label>
            <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
              {formatDate(credentialData.proof.created)}
            </div>
          </div>

          {/* Proof Purpose */}
          <div>
            <label className="block mb-2">
              <ThemedText className="text-sm font-medium text-gray-700">Proof Purpose</ThemedText>
            </label>
            <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
              {credentialData.proof.proofPurpose}
            </div>
          </div>

          {/* Verification Method */}
          <div className="col-span-2">
            <label className="block mb-2">
              <ThemedText className="text-sm font-medium text-gray-700">
                Verification Method
              </ThemedText>
            </label>
            <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
              {credentialData.proof.verificationMethod}
            </div>
          </div>

          {/* Proof Value */}
          <div className="col-span-2">
            <label className="block mb-2">
              <ThemedText className="text-sm font-medium text-gray-700">Proof Value</ThemedText>
            </label>
            <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono text-gray-900 break-all">
              {credentialData.proof.proofValue}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
        {onDownload && (
          <button
            onClick={onDownload}
            className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium cursor-pointer flex items-center gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            DOWNLOAD
          </button>
        )}
        {onDownloadPdf && (
          <button
            onClick={onDownloadPdf}
            className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium cursor-pointer flex items-center gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            DOWNLOAD AS PDF
          </button>
        )}
        <button
          onClick={onClose}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium cursor-pointer"
        >
          CLOSE
        </button>
      </div>
    </div>
  );
};
