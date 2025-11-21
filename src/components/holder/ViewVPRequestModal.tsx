'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Modal from '@/components/shared/Modal';
import { ThemedText } from '@/components/shared/ThemedText';
import {
  getAllVCs,
  getSchemaDataByVCId,
  type VerifiableCredential,
  type SchemaData,
} from '@/utils/indexedDB';
import { formatDate } from '@/utils/dateUtils';
import InfoModal from '@/components/shared/InfoModal';

interface RequestedCredential {
  schema_id: string;
  schema_name: string;
  schema_version: number;
}

interface VPRequest {
  id: string;
  verifierDid: string;
  verifierName: string;
  purpose: string;
  requestedCredentials: RequestedCredential[];
  requestedDate: string;
  status: 'Pending' | 'Accepted' | 'Declined';
  verifyStatus: string;
}

interface MatchedCredential {
  vc: VerifiableCredential;
  schema: SchemaData | null;
}

interface ViewVPRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: VPRequest | null;
  onAccept: (request: VPRequest) => Promise<void>;
  onDecline: (request: VPRequest) => Promise<void>;
}

export const ViewVPRequestModal: React.FC<ViewVPRequestModalProps> = ({
  isOpen,
  onClose,
  request,
  onAccept,
  onDecline,
}) => {
  const [matchedCredentials, setMatchedCredentials] = useState<Map<string, MatchedCredential[]>>(
    new Map()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const loadCredentials = useCallback(async () => {
    if (!request) return;

    setIsLoading(true);
    try {
      // Get all VCs from IndexedDB
      const allVCs = await getAllVCs();
      const matches = new Map<string, MatchedCredential[]>();

      // For each requested credential, find matching VCs
      for (const reqCred of request.requestedCredentials) {
        const matchingVCs: MatchedCredential[] = [];

        for (const vc of allVCs) {
          // Get schema data for this VC
          const schema = await getSchemaDataByVCId(vc.id);

          // Check if this VC matches the requested credential
          if (
            schema &&
            schema.id === reqCred.schema_id &&
            schema.version === reqCred.schema_version
          ) {
            matchingVCs.push({ vc, schema });
          }
        }

        matches.set(reqCred.schema_id, matchingVCs);
      }

      setMatchedCredentials(matches);
    } catch (error) {
      console.error('Error loading credentials:', error);
    } finally {
      setIsLoading(false);
    }
  }, [request]);

  useEffect(() => {
    if (isOpen && request) {
      loadCredentials();
    }
  }, [isOpen, request, loadCredentials]);

  const handleAccept = async () => {
    if (!request || isProcessing) return;

    // Check if any credentials are missing
    if (!canAccept()) {
      // Show confirmation modal if missing credentials
      setShowConfirmModal(true);
    } else {
      // Directly accept if all credentials are available
      setIsProcessing(true);
      try {
        await onAccept(request);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleConfirmAcceptWithMissing = async () => {
    if (!request || isProcessing) return;

    setShowConfirmModal(false);
    setIsProcessing(true);
    try {
      await onAccept(request);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!request || isProcessing) return;

    setIsProcessing(true);
    try {
      await onDecline(request);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'Accepted':
        return 'bg-green-100 text-green-700';
      case 'Declined':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const canAccept = () => {
    if (!request) return false;

    // Check if all requested credentials have at least one matching VC
    return request.requestedCredentials.every((reqCred) => {
      const matches = matchedCredentials.get(reqCred.schema_id);
      return matches && matches.length > 0;
    });
  };

  if (!request) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="VP Request Details"
      maxWidth="1200px"
      minHeight="600px"
    >
      <div className="px-8 py-6 space-y-6">
        {/* Request Header */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <ThemedText className="text-xs text-gray-600 block">Request ID</ThemedText>
              <ThemedText fontSize={13} fontWeight={600} className="text-gray-900 font-mono block">
                {request.id}
              </ThemedText>
            </div>
            <div className="space-y-1">
              <ThemedText className="text-xs text-gray-600 block">Status</ThemedText>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}
              >
                {request.status}
              </span>
            </div>
            <div className="col-span-2 space-y-1">
              <ThemedText className="text-xs text-gray-600 block">Verifier</ThemedText>
              <ThemedText fontSize={13} fontWeight={600} className="text-gray-900 block">
                {request.verifierName}
              </ThemedText>
              <ThemedText fontSize={12} className="text-gray-500 font-mono break-all block">
                {request.verifierDid}
              </ThemedText>
            </div>
            <div className="space-y-1">
              <ThemedText className="text-xs text-gray-600 block">Requested Date</ThemedText>
              <ThemedText fontSize={13} fontWeight={600} className="text-gray-900 block">
                {formatDate(request.requestedDate)}
              </ThemedText>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-blue-200 space-y-1">
            <ThemedText className="text-xs text-gray-600 block">Purpose</ThemedText>
            <ThemedText fontSize={13} className="text-gray-900 leading-normal block">
              {request.purpose || 'No purpose specified'}
            </ThemedText>
          </div>
        </div>

        {/* Credentials Comparison */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
            <ThemedText fontSize={15} fontWeight={600} className="text-gray-900">
              Credentials Comparison
            </ThemedText>
          </div>
          <div className="p-5">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-6">
                  {/* Requested Credentials */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <ThemedText fontSize={14} fontWeight={600} className="text-gray-900">
                        Requested Credentials
                      </ThemedText>
                      <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        {request.requestedCredentials.length} Required
                      </span>
                    </div>
                    <div className="space-y-2.5">
                      {request.requestedCredentials.map((reqCred, index) => {
                        const matches = matchedCredentials.get(reqCred.schema_id) || [];
                        const hasMatch = matches.length > 0;

                        return (
                          <div
                            key={index}
                            className={`p-3 rounded-lg border-2 ${
                              hasMatch ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 space-y-0.5 grid grid-col-2">
                                <ThemedText
                                  fontSize={13}
                                  fontWeight={600}
                                  className="text-gray-900"
                                >
                                  {reqCred.schema_name} v{reqCred.schema_version}
                                </ThemedText>
                                <ThemedText fontSize={10} className="text-gray-500 font-mono">
                                  {reqCred.schema_id.substring(0, 24)}...
                                </ThemedText>
                              </div>
                              <div className="ml-4">
                                {hasMatch ? (
                                  <div className="flex items-center gap-1.5 text-green-600">
                                    <svg
                                      className="w-5 h-5"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                    <span className="text-xs font-bold">Available</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-red-600">
                                    <svg
                                      className="w-5 h-5"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                    <span className="text-xs font-bold">Missing</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Your Available Credentials */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <ThemedText fontSize={14} fontWeight={600} className="text-gray-900">
                        Your Available Credentials
                      </ThemedText>
                      <span className="px-2.5 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        {Array.from(matchedCredentials.values()).reduce(
                          (sum, matches) => sum + matches.length,
                          0
                        )}{' '}
                        Available
                      </span>
                    </div>
                    <div className="space-y-2.5">
                      {request.requestedCredentials.map((reqCred, index) => {
                        const matches = matchedCredentials.get(reqCred.schema_id) || [];

                        return matches.length > 0
                          ? matches.map((match, idx) => (
                              <div
                                key={`${index}-${idx}`}
                                className="p-3 rounded-lg border-2 border-green-200 bg-green-50"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1 space-y-0.5 grid grid-row-3">
                                    <ThemedText
                                      fontSize={13}
                                      fontWeight={600}
                                      className="text-gray-900"
                                    >
                                      {match.schema?.name || reqCred.schema_name} v
                                      {reqCred.schema_version}
                                    </ThemedText>
                                    <ThemedText fontSize={10} className="text-gray-500">
                                      Issuer: {match.vc.issuerName || match.vc.issuer}
                                    </ThemedText>
                                    <div className="flex items-center gap-2 mt-1">
                                      <ThemedText fontSize={10} className="text-gray-500">
                                        Valid From: {formatDate(match.vc.validFrom)}
                                      </ThemedText>
                                      {match.vc.expiredAt && (
                                        <ThemedText fontSize={10} className="text-gray-500">
                                          Expires: {formatDate(match.vc.expiredAt)}
                                        </ThemedText>
                                      )}
                                    </div>
                                  </div>
                                  <div className="ml-4">
                                    <div className="flex items-center gap-1.5 text-green-600">
                                      <svg
                                        className="w-5 h-5"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                      >
                                        <path
                                          fillRule="evenodd"
                                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                      <span className="text-xs font-bold">Matched</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))
                          : null;
                      })}
                      {Array.from(matchedCredentials.values()).reduce(
                        (sum, matches) => sum + matches.length,
                        0
                      ) === 0 && (
                        <div className="text-center py-8">
                          <ThemedText className="text-gray-500 text-sm">
                            No matching credentials found
                          </ThemedText>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Summary - Only show when all requirements are met */}
                {canAccept() && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-start gap-2.5">
                      <svg
                        className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <div className="space-y-0.5">
                        <ThemedText fontSize={13} fontWeight={600} className="text-green-900">
                          All Requirements Met
                        </ThemedText>
                        <ThemedText fontSize={12} className="text-green-700">
                          You have all the required credentials to accept this VP request.
                        </ThemedText>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            onClick={handleDecline}
            disabled={isLoading || isProcessing || request.status !== 'Pending'}
            className="px-6 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-500 flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Processing...</span>
              </>
            ) : (
              'Decline'
            )}
          </button>
          <button
            onClick={handleAccept}
            disabled={isLoading || isProcessing || request.status !== 'Pending'}
            className="px-6 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-green-500 flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Processing...</span>
              </>
            ) : (
              'Accept'
            )}
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Missing Credentials */}
      <InfoModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Missing Credentials"
        message="Some credentials are missing. Do you want to send anyway?"
        showCancelButton={true}
        cancelButtonText="Cancel"
        confirmButtonText="Send Anyway"
        buttonColor="orange"
        onConfirm={handleConfirmAcceptWithMissing}
      />
    </Modal>
  );
};
