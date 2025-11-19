'use client';

import { useState, useEffect, useCallback } from 'react';
import { ThemedText } from '@/components/shared/ThemedText';
import { DataTable, Column } from '@/components/shared/DataTable';
import { formatDateTime } from '@/utils/dateUtils';

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
  credential: {
    id: string;
    holderDid: string;
    issuerDid?: string;
    schemaName: string;
    schemaId?: string;
    schemaVersion: number;
    status: string;
    issuedAt?: string;
    activeUntil: string;
    lastUpdated?: string;
    attributes: CredentialAttribute[];
  };
  onClose: () => void;
  currentVC?: VerifiableCredentialData;
  vcHistory?: VerifiableCredentialData[];
}

export default function ViewCredentialForm({
  credential,
  onClose,
  currentVC,
  vcHistory,
}: ViewCredentialFormProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Normalize VC data: use vcHistory if available, otherwise use currentVC, or null
  const vcs = vcHistory && vcHistory.length > 0 ? vcHistory : currentVC ? [currentVC] : [];
  const hasMultiple = vcs.length > 1;
  const displayVC = vcs[currentIndex];

  // Reset index when component mounts or vcHistory changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [vcHistory]);

  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : vcs.length - 1));
  }, [vcs.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < vcs.length - 1 ? prev + 1 : 0));
  }, [vcs.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!hasMultiple) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasMultiple, handlePrevious, handleNext]);

  const handleDotClick = (index: number) => {
    setCurrentIndex(index);
  };
  // Extract attributes from display VC
  const currentAttributes: CredentialAttribute[] = displayVC
    ? Object.entries(displayVC.credentialSubject)
        .filter(([key]) => key !== 'id')
        .map(([name, value], index) => ({
          id: index + 1,
          name,
          value: String(value),
        }))
    : credential.attributes;

  // Get current credential data
  const displayData = displayVC
    ? {
        id: displayVC.id,
        holderDid: displayVC.credentialSubject.id,
        issuerDid: typeof displayVC.issuer === 'object' ? displayVC.issuer.id : displayVC.issuer,
        schemaName: credential.schemaName,
        schemaId: credential.schemaId,
        schemaVersion: credential.schemaVersion,
        status:
          // Only the newest version (index 0) can be APPROVED
          // All historical versions (including expired) are marked as REVOKED
          currentIndex === 0
            ? displayVC.credentialStatus?.revoked
              ? 'REVOKED'
              : 'APPROVED'
            : 'REVOKED',
        validFrom: displayVC.validFrom,
        expiredAt: displayVC.expiredAt,
        attributes: currentAttributes,
      }
    : credential;

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
      {/* Carousel Navigation - Top */}
      {hasMultiple && (
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
          <button
            onClick={handlePrevious}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Previous version"
          >
            <svg
              className="w-6 h-6 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">
              Version {currentIndex + 1} of {vcs.length}
            </span>
          </div>

          <button
            onClick={handleNext}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Next version"
          >
            <svg
              className="w-6 h-6 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
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

        {/* Issued At */}
        <div>
          <label className="block mb-2">
            <ThemedText className="text-sm font-medium text-gray-700">Issued At</ThemedText>
          </label>
          <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
            {formatDateTime(
              displayVC ? displayVC.validFrom : credential.issuedAt || credential.activeUntil
            )}
          </div>
        </div>

        {/* Active Until / Expired At */}
        <div>
          <label className="block mb-2">
            <ThemedText className="text-sm font-medium text-gray-700">Expired At</ThemedText>
          </label>
          <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
            {(() => {
              const expiredAtValue = displayVC ? displayVC.expiredAt : credential.activeUntil;
              // Check if the value is null, empty, '-', or undefined
              if (!expiredAtValue || expiredAtValue === '-') {
                return 'Lifetime';
              }
              return formatDateTime(expiredAtValue);
            })()}
          </div>
        </div>

        {/* Status */}
        <div className="col-span-2">
          <label className="block mb-2">
            <ThemedText className="text-sm font-medium text-gray-700">Status</ThemedText>
          </label>
          <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(displayData.status)}`}
            >
              {getStatusLabel(displayData.status)}
            </span>
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

      {/* Carousel Indicators - Bottom */}
      {hasMultiple && (
        <div className="flex justify-center gap-2 pt-6">
          {vcs.map((_, index) => (
            <button
              key={index}
              onClick={() => handleDotClick(index)}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                index === currentIndex ? 'w-8 bg-blue-500' : 'w-2.5 bg-gray-300 hover:bg-gray-400'
              }`}
              aria-label={`Go to version ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
