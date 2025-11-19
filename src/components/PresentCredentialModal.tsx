'use client';

/**
 * Present Credential Modal
 *
 * IMPORTANT: When creating a VP, metadata fields (source, claimId) must be removed
 * from the credentials before signing. These fields are added after VC issuance
 * for local storage tracking and are not part of the original signed credential.
 *
 * See vcValidator.ts for more details on metadata field handling.
 */

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Modal from '@/components/shared/Modal';
import { ThemedText } from '@/components/shared/ThemedText';
import { VerifiableCredential } from '@/utils/indexedDB';
import { createVerifiablePresentation, signVPWithStoredKey } from '@/utils/vpSigner';
import { buildApiUrl, API_ENDPOINTS } from '@/utils/api';
import { authenticatedPost } from '@/utils/api-client';
import QRCode from 'qrcode';

interface PresentCredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  credential: VerifiableCredential;
  onSuccess?: (vpId: string) => void;
}

export default function PresentCredentialModal({
  isOpen,
  onClose,
  credential,
  onSuccess,
}: PresentCredentialModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [vpId, setVpId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setQrCodeDataUrl(null);
      setVpId(null);
      setError(null);
    }
  }, [isOpen]);

  const handleGenerateVP = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const holderDid = localStorage.getItem('institutionDID');
      if (!holderDid) {
        throw new Error('Holder DID not found in localStorage');
      }

      console.log('[Present VP] Creating VP for holder:', holderDid);
      console.log('[Present VP] Raw Credential to present:', credential);

      // IMPORTANT: Remove metadata fields (source, claimId) before creating VP
      // These fields are for local storage tracking only and should not be in VP
      const cleanedCredential = { ...credential };
      const metadataFields = ['source', 'claimId'] as const;
      metadataFields.forEach((field) => {
        if (field in cleanedCredential) {
          console.log(`[Present VP] Removing metadata field: ${field}`);
          delete cleanedCredential[field];
        }
      });

      console.log('[Present VP] Cleaned credential (without metadata):', cleanedCredential);

      const unsignedVP = createVerifiablePresentation(holderDid, [cleanedCredential]);
      console.log('[Present VP] Unsigned VP created:', unsignedVP);

      const signedVP = await signVPWithStoredKey(unsignedVP);
      console.log('[Present VP] VP signed successfully');

      const vpString = JSON.stringify(signedVP);
      const url = buildApiUrl(API_ENDPOINTS.PRESENTATIONS.BASE);

      console.log('[Present VP] Sending VP to API:', url);

      const response = await authenticatedPost(url, {
        vp: vpString,
        is_barcode: false,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to store VP');
      }

      const result = await response.json();
      console.log('[Present VP] VP stored successfully:', result);

      if (!result.success || !result.data?.vp_id) {
        throw new Error('Invalid response from API');
      }

      const generatedVpId = result.data.vp_id;
      setVpId(generatedVpId);

      const qrData = {
        type: 'VP_ID',
        vpId: generatedVpId,
      };

      const qrDataString = JSON.stringify(qrData);
      console.log('[Present VP] Generating QR code for:', qrDataString);

      const qrDataUrl = await QRCode.toDataURL(qrDataString, {
        width: 250,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });

      setQrCodeDataUrl(qrDataUrl);
      console.log('[Present VP] QR code generated successfully');

      if (onSuccess) {
        onSuccess(generatedVpId);
      }
    } catch (err) {
      console.error('[Present VP] Error generating VP:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate VP';
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (isOpen && !qrCodeDataUrl && !isGenerating) {
      handleGenerateVP();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

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

  const credentialStatus = credential.expiredAt
    ? new Date(credential.expiredAt) < new Date()
      ? 'Expired'
      : 'Active'
    : 'Active';

  const credentialType = credential.type.find((t) => t !== 'VerifiableCredential') || 'Unknown';

  const attributes = Object.entries(credential.credentialSubject)
    .filter(([key]) => key !== 'id')
    .map(([name, value]) => ({
      name,
      value: typeof value === 'object' ? JSON.stringify(value) : String(value),
    }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Present Credential" minHeight="700px">
      <div className="px-8 py-6">
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block mb-2">
              <ThemedText className="text-sm font-medium text-gray-700">Credential ID</ThemedText>
            </label>
            <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
              {credential.id}
            </div>
          </div>

          <div>
            <label className="block mb-2">
              <ThemedText className="text-sm font-medium text-gray-700">Credential Type</ThemedText>
            </label>
            <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
              {credentialType}
            </div>
          </div>

          <div>
            <label className="block mb-2">
              <ThemedText className="text-sm font-medium text-gray-700">Status</ThemedText>
            </label>
            <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(credentialStatus)}`}
              >
                {credentialStatus}
              </span>
            </div>
          </div>

          <div>
            <label className="block mb-2">
              <ThemedText className="text-sm font-medium text-gray-700">Valid From</ThemedText>
            </label>
            <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
              {formatDate(credential.validFrom)}
            </div>
          </div>

          <div>
            <label className="block mb-2">
              <ThemedText className="text-sm font-medium text-gray-700">Expired At</ThemedText>
            </label>
            <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
              {credential.expiredAt ? formatDate(credential.expiredAt) : 'Never'}
            </div>
          </div>

          <div>
            <label className="block mb-2">
              <ThemedText className="text-sm font-medium text-gray-700">Issuer Name</ThemedText>
            </label>
            <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
              {credential.issuerName}
            </div>
          </div>

          <div className="col-span-2">
            <label className="block mb-2">
              <ThemedText className="text-sm font-medium text-gray-700">Issuer DID</ThemedText>
            </label>
            <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
              {credential.issuer}
            </div>
          </div>

          <div className="col-span-2">
            <label className="block mb-2">
              <ThemedText className="text-sm font-medium text-gray-700">Holder DID</ThemedText>
            </label>
            <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
              {credential.credentialSubject.id}
            </div>
          </div>
        </div>

        {credential.imageLink && (
          <div className="mb-6">
            <label className="block mb-3">
              <ThemedText className="text-sm font-semibold text-gray-900">
                VC Background Image
              </ThemedText>
            </label>
            <div className="relative w-full" style={{ maxHeight: '384px' }}>
              <Image
                src={credential.imageLink}
                alt="VC Background"
                width={800}
                height={384}
                className="w-full h-auto max-h-96 object-contain rounded-xl border-2 border-gray-200 shadow-md block bg-gray-50"
                unoptimized
              />
            </div>
          </div>
        )}

        {attributes.length > 0 && (
          <div className="mb-6">
            <div className="mb-4">
              <ThemedText className="text-sm font-semibold text-gray-900">
                Credential Attributes ({attributes.length})
              </ThemedText>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="space-y-4">
                {attributes.map((attr, index) => (
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

        <div className="mb-6">
          <div className="mb-4">
            <ThemedText className="text-sm font-semibold text-gray-900">
              Proof Information
            </ThemedText>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block mb-2">
                <ThemedText className="text-sm font-medium text-gray-700">Type</ThemedText>
              </label>
              <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                {credential.proof.type}
              </div>
            </div>

            <div>
              <label className="block mb-2">
                <ThemedText className="text-sm font-medium text-gray-700">Cryptosuite</ThemedText>
              </label>
              <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                {credential.proof.cryptosuite}
              </div>
            </div>

            <div>
              <label className="block mb-2">
                <ThemedText className="text-sm font-medium text-gray-700">Created</ThemedText>
              </label>
              <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                {formatDate(credential.proof.created)}
              </div>
            </div>

            <div>
              <label className="block mb-2">
                <ThemedText className="text-sm font-medium text-gray-700">Proof Purpose</ThemedText>
              </label>
              <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                {credential.proof.proofPurpose}
              </div>
            </div>

            <div className="col-span-2">
              <label className="block mb-2">
                <ThemedText className="text-sm font-medium text-gray-700">
                  Verification Method
                </ThemedText>
              </label>
              <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
                {credential.proof.verificationMethod}
              </div>
            </div>

            <div className="col-span-2">
              <label className="block mb-2">
                <ThemedText className="text-sm font-medium text-gray-700">Proof Value</ThemedText>
              </label>
              <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono text-gray-900 break-all">
                {credential.proof.proofValue}
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="mb-4">
            <ThemedText className="text-sm font-semibold text-gray-900">Scan to Verify</ThemedText>
          </div>

          <div className="flex flex-col items-center justify-center space-y-4 bg-gray-50 border border-gray-200 rounded-lg p-6">
            {isGenerating && (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 w-full">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {qrCodeDataUrl && !error && (
              <>
                <div className="bg-white p-4 rounded-lg shadow-md border-2 border-gray-200">
                  <Image
                    src={qrCodeDataUrl}
                    alt="VP QR Code"
                    width={256}
                    height={256}
                    className="w-64 h-64"
                    style={{ imageRendering: 'pixelated' }}
                    unoptimized
                  />
                </div>
                {vpId && (
                  <div className="text-center w-full">
                    <label className="block mb-2">
                      <ThemedText className="text-xs font-medium text-gray-600">VP ID</ThemedText>
                    </label>
                    <div className="px-4 py-3 bg-white border border-gray-200 rounded-lg text-xs font-mono text-gray-900 break-all">
                      {vpId}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
          {error && (
            <button
              onClick={handleGenerateVP}
              disabled={isGenerating}
              className="px-6 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? 'GENERATING...' : 'RETRY'}
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
    </Modal>
  );
}
