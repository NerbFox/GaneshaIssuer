'use client';

import { useState, useEffect } from 'react';
import { ThemedText } from './ThemedText';
import { DataTable, Column } from './DataTable';
import { API_ENDPOINTS, buildApiUrl } from '@/utils/api';
import { authenticatedGet } from '@/utils/api-client';

interface CredentialAttribute {
  id: number;
  name: string;
  value: string;
}

interface VerifiableCredentialData {
  id: string;
  type: string[];
  issuer: { id: string; name: string };
  credentialSubject: {
    id: string;
    [key: string]: unknown;
  };
  validFrom: string;
  expiredAt: string;
  credentialStatus?: {
    id: string;
    type: string;
    revoked?: boolean;
  };
  proof?: unknown;
  imageLink?: string;
  fileUrl?: string;
  fileId?: string;
  issuerName?: string;
  '@context'?: string[];
}

interface ViewCredentialFormProps {
  onClose: () => void;
  credentialData: {
    id: string;
    holderDid: string;
    issuerDid?: string;
    schemaName: string;
    schemaId?: string;
    schemaVersion: number;
    status: string;
    issuedAt: string;
    activeUntil: string;
    lastUpdated?: string;
    attributes: CredentialAttribute[];
  };
  vcId?: string;
  vcHistory?: VerifiableCredentialData[];
}

export default function ViewCredentialForm({
  onClose,
  credentialData,
  vcId,
  vcHistory,
}: ViewCredentialFormProps) {
  const [blockchainStatus, setBlockchainStatus] = useState<string | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0); // Start with newest (index 0)

  // Get current VC data from history if available
  const currentVC = vcHistory && vcHistory.length > 0 ? vcHistory[currentIndex] : null;
  const totalVersions = vcHistory?.length || 1;

  // Extract attributes from current VC
  const currentAttributes: CredentialAttribute[] = currentVC
    ? Object.entries(currentVC.credentialSubject)
        .filter(([key]) => key !== 'id')
        .map(([name, value], index) => ({
          id: index + 1,
          name,
          value: String(value),
        }))
    : credentialData.attributes;

  // Get current credential data (from carousel or fallback)
  const displayData = currentVC
    ? {
        id: currentVC.id,
        holderDid: currentVC.credentialSubject.id,
        issuerDid: typeof currentVC.issuer === 'object' ? currentVC.issuer.id : currentVC.issuer,
        schemaName: credentialData.schemaName,
        schemaId: credentialData.schemaId,
        schemaVersion: credentialData.schemaVersion,
        status: currentVC.credentialStatus?.revoked
          ? 'REVOKED'
          : new Date(currentVC.expiredAt) < new Date()
            ? 'EXPIRED'
            : 'APPROVED',
        validFrom: currentVC.validFrom,
        expiredAt: currentVC.expiredAt,
        attributes: currentAttributes,
      }
    : credentialData;

  // Fetch status from blockchain
  useEffect(() => {
    const fetchBlockchainStatus = async () => {
      const credentialVcId = currentVC?.id || vcId || credentialData.id;
      if (!credentialVcId) return;

      setIsLoadingStatus(true);
      try {
        const statusUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.STATUS(credentialVcId));
        const statusResponse = await authenticatedGet(statusUrl);

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          // status from blockchain is a boolean: true = active, false = revoked
          if (statusData.success && statusData.data) {
            setBlockchainStatus(statusData.data.status ? 'APPROVED' : 'REVOKED');
          }
        }
      } catch (err) {
        console.error('Error fetching blockchain status:', err);
      } finally {
        setIsLoadingStatus(false);
      }
    };

    fetchBlockchainStatus();
  }, [currentVC, vcId, credentialData.id, currentIndex]);

  // Navigation handlers
  const handlePrevious = () => {
    if (currentIndex < totalVersions - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };
  const columns: Column<CredentialAttribute>[] = [
    {
      id: 'name',
      label: 'ATTRIBUTE NAME',
      sortKey: 'name',
      render: (row) => (
        <ThemedText className="text-sm font-medium text-gray-900">{row.name}</ThemedText>
      ),
    },
    {
      id: 'value',
      label: 'VALUE',
      sortKey: 'value',
      render: (row) => <ThemedText className="text-sm text-gray-900">{row.value}</ThemedText>,
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-700';
      case 'REVOKED':
        return 'bg-red-100 text-red-700';
      case 'EXPIRED':
        return 'bg-gray-100 text-gray-700';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'Active';
      case 'REVOKED':
        return 'Revoked';
      case 'EXPIRED':
        return 'Expired';
      case 'PENDING':
        return 'Pending';
      default:
        return status;
    }
  };

  return (
    <div className="px-8 py-6">
      {/* Version Navigation - Only show if there's a history */}
      {vcHistory && vcHistory.length > 1 && (
        <div className="mb-6 flex items-center justify-between bg-blue-50 p-4 rounded-lg">
          <button
            onClick={handlePrevious}
            disabled={currentIndex >= totalVersions - 1}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Previous Version
          </button>
          <div className="text-center">
            <ThemedText className="text-sm font-medium text-gray-700">
              Version {totalVersions - currentIndex} of {totalVersions}
            </ThemedText>
            <ThemedText className="text-xs text-gray-500 mt-1">
              {currentIndex === 0 ? '(Current)' : '(Historical)'}
            </ThemedText>
          </div>
          <button
            onClick={handleNext}
            disabled={currentIndex <= 0}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next Version →
          </button>
        </div>
      )}

      {/* Credential Information Grid */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Credential ID */}
        <div className="col-span-2">
          <label className="block mb-2">
            <ThemedText className="text-sm font-medium text-gray-700">Credential ID</ThemedText>
          </label>
          <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
            {displayData.id}
          </div>
        </div>

        {/* Schema Name */}
        <div>
          <label className="block mb-2">
            <ThemedText className="text-sm font-medium text-gray-700">Schema Name</ThemedText>
          </label>
          <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
            {displayData.schemaName}
          </div>
        </div>

        {/* Schema Version */}
        <div>
          <label className="block mb-2">
            <ThemedText className="text-sm font-medium text-gray-700">Schema Version</ThemedText>
          </label>
          <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
            {displayData.schemaVersion}
          </div>
        </div>

        {/* Schema ID */}
        {displayData.schemaId && (
          <div className="col-span-2">
            <label className="block mb-2">
              <ThemedText className="text-sm font-medium text-gray-700">Schema ID</ThemedText>
            </label>
            <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
              {displayData.schemaId}
            </div>
          </div>
        )}

        {/* Holder DID */}
        <div className="col-span-2">
          <label className="block mb-2">
            <ThemedText className="text-sm font-medium text-gray-700">Holder DID</ThemedText>
          </label>
          <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
            {displayData.holderDid}
          </div>
        </div>

        {/* Issuer DID */}
        {displayData.issuerDid && (
          <div className="col-span-2">
            <label className="block mb-2">
              <ThemedText className="text-sm font-medium text-gray-700">Issuer DID</ThemedText>
            </label>
            <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
              {displayData.issuerDid}
            </div>
          </div>
        )}

        {/* Status */}
        <div>
          <label className="block mb-2">
            <ThemedText className="text-sm font-medium text-gray-700">Status</ThemedText>
          </label>
          <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
            {isLoadingStatus ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-gray-600">Loading status...</span>
              </div>
            ) : (
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(blockchainStatus || displayData.status)}`}
              >
                {getStatusLabel(blockchainStatus || displayData.status)}
              </span>
            )}
          </div>
        </div>

        {/* Issued At */}
        <div>
          <label className="block mb-2">
            <ThemedText className="text-sm font-medium text-gray-700">Issued At</ThemedText>
          </label>
          <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
            {new Date(currentVC ? currentVC.validFrom : credentialData.issuedAt).toLocaleString(
              'en-US',
              {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
              }
            )}
          </div>
        </div>

        {/* Expired At */}
        <div className="col-span-2">
          <label className="block mb-2">
            <ThemedText className="text-sm font-medium text-gray-700">Expired At</ThemedText>
          </label>
          <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
            {(currentVC ? currentVC.expiredAt : credentialData.activeUntil) === '-'
              ? 'Lifetime'
              : new Date(
                  currentVC ? currentVC.expiredAt : credentialData.activeUntil
                ).toLocaleString('en-US', {
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
      </div>

      {/* Attributes Section */}
      {displayData.attributes.length > 0 && (
        <div className="mb-6">
          <div className="mb-4">
            <ThemedText className="text-sm font-medium text-gray-900">
              Credential Attributes ({displayData.attributes.length})
            </ThemedText>
          </div>

          <DataTable
            data={displayData.attributes}
            columns={columns}
            searchPlaceholder="Search attributes..."
            enableSelection={false}
            totalCount={displayData.attributes.length}
            rowsPerPageOptions={[5, 10, 25, 50]}
            idKey="id"
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
        <button
          onClick={onClose}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium cursor-pointer"
        >
          CLOSE
        </button>
      </div>
    </div>
  );
}
