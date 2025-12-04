'use client';

/**
 * Present Multiple Credentials Modal
 * Creates a Verifiable Presentation from multiple selected credentials
 *
 * IMPORTANT: When creating a VP, metadata fields (source, claimId) must be removed
 * from the credentials before signing. These fields are added after VC issuance
 * for local storage tracking and are not part of the original signed credential.
 */

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Modal from '../shared/Modal';
import { ThemedText } from '../shared/ThemedText';
import { VerifiableCredential } from '@/utils/indexedDB';
import { createVerifiablePresentation, signVPWithStoredKey } from '@/utils/vpSigner';
import { buildApiUrl, API_ENDPOINTS } from '@/utils/api';
import { authenticatedPost, authenticatedDelete } from '@/utils/api-client';
import QRCode from 'qrcode';

interface PresentMultipleCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  credentials: VerifiableCredential[];
  onSuccess?: (vpId: string) => void;
}

export default function PresentMultipleCredentialsModal({
  isOpen,
  onClose,
  credentials,
  onSuccess,
}: PresentMultipleCredentialsModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [vpId, setVpId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedCredentials, setExpandedCredentials] = useState<Set<string>>(new Set());
  const vpIdRef = React.useRef<string | null>(null);

  const toggleCredential = (credentialId: string) => {
    setExpandedCredentials((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(credentialId)) {
        newSet.delete(credentialId);
      } else {
        newSet.add(credentialId);
      }
      return newSet;
    });
  };

  // Track current VP ID
  React.useEffect(() => {
    vpIdRef.current = vpId;
  }, [vpId]);

  // Delete VP when modal is closed or component unmounts
  useEffect(() => {
    return () => {
      // Cleanup function runs when modal closes or component unmounts
      const currentVpId = vpIdRef.current;
      if (currentVpId) {
        deleteVP(currentVpId);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setQrCodeDataUrl(null);
      setVpId(null);
      setError(null);
      setExpandedCredentials(new Set());
    }
  }, [isOpen]);

  /**
   * Delete a VP by ID
   */
  const deleteVP = async (vpIdToDelete: string) => {
    try {
      const url = buildApiUrl(API_ENDPOINTS.PRESENTATIONS.DELETE(vpIdToDelete));
      console.log('[Present Multiple VP] Deleting old VP:', vpIdToDelete);

      const response = await authenticatedDelete(url);

      if (response.ok) {
        console.log('[Present Multiple VP] VP deleted successfully:', vpIdToDelete);
      } else {
        // Parse error details
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));

        // Treat "already deleted" as success since the goal is achieved
        if (errorData.message?.includes('already been deleted')) {
          console.log('[Present Multiple VP] VP already deleted:', vpIdToDelete);
        } else {
          console.error(
            '[Present Multiple VP] Failed to delete VP:',
            vpIdToDelete,
            'Status:',
            response.status,
            'Error:',
            errorData
          );
        }
      }
    } catch (err) {
      console.error('[Present Multiple VP] Error deleting VP:', err);
      // Non-blocking error - don't show to user
    }
  };

  const handleGenerateVP = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      // Delete old VP if regenerating
      if (vpId) {
        console.log('[Present Multiple VP] Regenerating - deleting old VP:', vpId);
        await deleteVP(vpId);
      }

      const holderDid = localStorage.getItem('institutionDID');
      if (!holderDid) {
        throw new Error('Holder DID not found in localStorage');
      }

      console.log('[Present Multiple VP] Creating VP for holder:', holderDid);
      console.log('[Present Multiple VP] Number of credentials:', credentials.length);

      // IMPORTANT: Remove metadata fields (source, claimId) before creating VP
      const cleanedCredentials = credentials.map((credential) => {
        const cleaned = { ...credential };
        const metadataFields = ['source', 'claimId'] as const;
        metadataFields.forEach((field) => {
          if (field in cleaned) {
            console.log(
              `[Present Multiple VP] Removing metadata field: ${field} from ${credential.id}`
            );
            delete cleaned[field];
          }
        });
        return cleaned;
      });

      console.log('[Present Multiple VP] Cleaned credentials (without metadata)');

      const unsignedVP = createVerifiablePresentation(holderDid, cleanedCredentials);
      console.log(
        '[Present Multiple VP] Unsigned VP created with',
        cleanedCredentials.length,
        'credentials'
      );

      const signedVP = await signVPWithStoredKey(unsignedVP);
      console.log('[Present Multiple VP] VP signed successfully');

      const vpString = JSON.stringify(signedVP);
      const url = buildApiUrl(API_ENDPOINTS.PRESENTATIONS.BASE);

      console.log('[Present Multiple VP] Sending VP to API:', url);

      const response = await authenticatedPost(url, {
        vp: vpString,
        is_barcode: false,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to store VP');
      }

      const result = await response.json();
      console.log('[Present Multiple VP] VP stored successfully:', result);

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
      console.log('[Present Multiple VP] Generating QR code for:', qrDataString);

      const qrDataUrl = await QRCode.toDataURL(qrDataString, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });

      setQrCodeDataUrl(qrDataUrl);
      console.log('[Present Multiple VP] QR code generated successfully');

      if (onSuccess) {
        onSuccess(generatedVpId);
      }
    } catch (err) {
      console.error('[Present Multiple VP] Error generating VP:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate VP';
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (isOpen && !qrCodeDataUrl && !isGenerating && credentials.length > 0) {
      handleGenerateVP();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

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

  const getCredentialStatus = (credential: VerifiableCredential) => {
    if (credential.expiredAt) {
      return new Date(credential.expiredAt) < new Date() ? 'Expired' : 'Active';
    }
    return 'Active';
  };

  const getCredentialType = (credential: VerifiableCredential) => {
    return credential.type.find((t) => t !== 'VerifiableCredential') || 'Unknown';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Present Multiple Credentials" minHeight="700px">
      <div className="px-10 py-8 space-y-8">
        {/* Credentials Preview Section */}
        <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden shadow-md">
          <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50">
            <ThemedText fontSize={20} fontWeight={600} className="text-gray-900 block">
              Credentials to Present ({credentials.length})
            </ThemedText>
          </div>

          <div className="p-6 space-y-6">
            {credentials.map((credential, index) => {
              const credentialType = getCredentialType(credential);
              const credentialStatus = getCredentialStatus(credential);
              const attributes = Object.entries(credential.credentialSubject)
                .filter(([key]) => key !== 'id')
                .map(([name, value]) => ({
                  name,
                  value: typeof value === 'object' ? JSON.stringify(value) : String(value),
                }));

              const isExpanded = expandedCredentials.has(credential.id);

              return (
                <div
                  key={credential.id}
                  className={`rounded-xl border-2 shadow-sm transition-all ${
                    credentialStatus === 'Active'
                      ? 'bg-green-50 border-green-200'
                      : credentialStatus === 'Expired'
                        ? 'bg-gray-50 border-gray-200'
                        : 'bg-red-50 border-red-200'
                  }`}
                >
                  {/* Credential Header - Always Visible, Clickable */}
                  <button
                    onClick={() => toggleCredential(credential.id)}
                    className="w-full p-5 flex items-start justify-between hover:opacity-80 transition-opacity cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center shadow-md ${
                          credentialStatus === 'Active'
                            ? 'bg-green-500'
                            : credentialStatus === 'Expired'
                              ? 'bg-gray-500'
                              : 'bg-red-500'
                        }`}
                      >
                        <ThemedText fontSize={16} fontWeight={700} className="text-white block">
                          {index + 1}
                        </ThemedText>
                      </div>
                      <div className="space-y-1 text-left">
                        <ThemedText
                          fontSize={16}
                          fontWeight={600}
                          className={`block ${
                            credentialStatus === 'Active'
                              ? 'text-green-800'
                              : credentialStatus === 'Expired'
                                ? 'text-gray-800'
                                : 'text-red-800'
                          }`}
                        >
                          {credentialType}
                        </ThemedText>
                        <ThemedText
                          fontSize={12}
                          className={`block font-medium ${
                            credentialStatus === 'Active'
                              ? 'text-green-700'
                              : credentialStatus === 'Expired'
                                ? 'text-gray-700'
                                : 'text-red-700'
                          }`}
                        >
                          Issued by {credential.issuerName}
                        </ThemedText>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(credentialStatus)}`}
                      >
                        {credentialStatus}
                      </span>
                      <svg
                        className={`w-5 h-5 transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        } ${
                          credentialStatus === 'Active'
                            ? 'text-green-600'
                            : credentialStatus === 'Expired'
                              ? 'text-gray-600'
                              : 'text-red-600'
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </button>

                  {/* Credential Details - Collapsible */}
                  {isExpanded && (
                    <div className="px-5 pb-5 space-y-5 animate-slideDown">
                      <div className="bg-white rounded-xl p-5 border-2 border-gray-200 shadow-sm">
                        {/* Basic Info Grid */}
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <ThemedText className="text-xs text-gray-500 font-bold tracking-wider">
                              CREDENTIAL ID
                            </ThemedText>
                            <ThemedText
                              fontSize={11}
                              fontWeight={600}
                              className="text-gray-900 break-all block"
                            >
                              {credential.id}
                            </ThemedText>
                          </div>
                          <div className="space-y-2">
                            <ThemedText className="text-xs text-gray-500 font-bold tracking-wider">
                              ISSUER
                            </ThemedText>
                            <ThemedText
                              fontSize={13}
                              fontWeight={600}
                              className="text-gray-900 block"
                            >
                              {credential.issuerName}
                            </ThemedText>
                            <ThemedText
                              fontSize={10}
                              className="text-gray-600 break-all block mt-1"
                            >
                              {credential.issuer}
                            </ThemedText>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <ThemedText className="text-xs text-gray-500 font-bold tracking-wider">
                              VALID FROM
                            </ThemedText>
                            <ThemedText fontSize={13} className="text-gray-900 block">
                              {new Date(credential.validFrom).toLocaleString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </ThemedText>
                          </div>
                          <div className="space-y-2">
                            <ThemedText className="text-xs text-gray-500 font-bold tracking-wider">
                              EXPIRES AT
                            </ThemedText>
                            <ThemedText fontSize={13} className="text-gray-900 block">
                              {credential.expiredAt
                                ? new Date(credential.expiredAt).toLocaleString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : 'Never'}
                            </ThemedText>
                          </div>
                        </div>

                        {/* Attributes */}
                        {attributes.length > 0 && (
                          <div className="space-y-3">
                            <ThemedText className="text-xs text-gray-500 font-bold tracking-wider block">
                              CREDENTIAL SUBJECT
                            </ThemedText>
                            <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-100">
                              {attributes.map((attr) => (
                                <div
                                  key={attr.name}
                                  className="flex justify-between items-start gap-4 border-b border-gray-200 pb-3 last:border-0 last:pb-0"
                                >
                                  <ThemedText
                                    fontSize={12}
                                    className="text-gray-600 font-medium block capitalize"
                                  >
                                    {attr.name.replace(/_/g, ' ')}:
                                  </ThemedText>
                                  <ThemedText
                                    fontSize={12}
                                    className="text-gray-900 text-right block flex-1"
                                  >
                                    {attr.value}
                                  </ThemedText>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* VP Generation Status */}
        {isGenerating && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-4">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mb-4"></div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-100 border-2 border-red-300 rounded-lg">
            <ThemedText fontSize={12} className="text-red-800 font-semibold block">
              ⚠️ Error: {error}
            </ThemedText>
          </div>
        )}

        {qrCodeDataUrl && vpId && (
          <div className="space-y-8">
            {/* VP Information */}
            <div className="bg-gray-50 rounded-2xl p-6 border-2 border-gray-200 space-y-6 shadow-sm">
              <ThemedText fontSize={18} fontWeight={600} className="text-gray-900 block">
                Presentation Information
              </ThemedText>
              <div className="space-y-2">
                <ThemedText className="text-sm text-gray-600 block">VP ID</ThemedText>
                <ThemedText
                  fontSize={11}
                  fontWeight={600}
                  className="text-gray-900 break-all block font-mono bg-white p-4 rounded-lg border border-gray-200"
                >
                  {vpId}
                </ThemedText>
              </div>
            </div>

            {/* QR Code Section */}
            <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden shadow-md">
              <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50">
                <div className="flex items-center justify-between">
                  <ThemedText fontSize={18} fontWeight={600} className="text-gray-900 block">
                    Scan QR Code to Share VP
                  </ThemedText>
                  <button
                    onClick={handleGenerateVP}
                    disabled={isGenerating}
                    className="p-2 text-purple-600 hover:text-purple-700 hover:bg-purple-100 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    title="Regenerate VP with new ID"
                  >
                    <svg
                      className={`h-5 w-5 ${isGenerating ? 'animate-spin' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="p-8 flex flex-col items-center space-y-4">
                <div className="bg-white p-6 rounded-lg shadow-lg border-2 border-gray-200">
                  {qrCodeDataUrl && (
                    <Image
                      src={qrCodeDataUrl}
                      alt="VP QR Code"
                      width={256}
                      height={256}
                      className="w-64 h-64"
                      style={{ imageRendering: 'pixelated' }}
                      unoptimized
                    />
                  )}
                </div>
                <ThemedText className="text-sm text-gray-500 text-center max-w-md">
                  This QR code contains the VP ID that can be scanned by verifiers to access your
                  presentation
                </ThemedText>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-4 pt-6 border-t-2 border-gray-200">
          {!qrCodeDataUrl && !isGenerating && error && (
            <button
              onClick={handleGenerateVP}
              className="px-8 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-sm font-semibold shadow-lg cursor-pointer"
            >
              Retry
            </button>
          )}
          <button
            onClick={onClose}
            className="px-8 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-semibold shadow-lg cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
