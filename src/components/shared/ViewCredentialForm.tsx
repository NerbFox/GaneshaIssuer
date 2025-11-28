'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, Column } from '@/components/shared/DataTable';
import { formatDateTime } from '@/utils/dateUtils';
import { fetchSchemaByVersion, SchemaProperty } from '@/services/schemaService';

interface CredentialAttribute {
  id: number;
  name: string;
  value: string;
}

// Define interface for schema attribute details
interface SchemaAttributeDetail {
  name: string;
  type: string;
  required: boolean;
}

// Combined attribute for DataTable
interface DisplayAttribute {
  id: string;
  name: string;
  type: string;
  required: boolean;
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
  vcStatus?: boolean; // The vc_status from encrypted_body wrapper
}

export default function ViewCredentialForm({
  credential,
  onClose,
  currentVC,
  vcHistory,
  vcStatus,
}: ViewCredentialFormProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [schemaAttributes, setSchemaAttributes] = useState<SchemaAttributeDetail[]>([]);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);

  // Normalize VC data: use vcHistory if available, otherwise use currentVC, or null
  const vcs = vcHistory && vcHistory.length > 0 ? vcHistory : currentVC ? [currentVC] : [];
  const hasMultiple = vcs.length > 1;
  const displayVC = vcs[currentIndex];

  // Fetch schema data when credential changes
  useEffect(() => {
    const loadSchemaAttributes = async () => {
      if (!credential.schemaId || !credential.schemaVersion) {
        setSchemaAttributes([]);
        return;
      }

      setIsLoadingSchema(true);
      try {
        const response = await fetchSchemaByVersion(credential.schemaId, credential.schemaVersion);
        if (response.success && response.data) {
          const attributes = Object.entries(response.data.schema.properties).map(
            ([name, prop]) => ({
              name,
              type: (prop as SchemaProperty).type,
              required: response.data.schema.required.includes(name),
            })
          );
          setSchemaAttributes(attributes);
        } else {
          setSchemaAttributes([]);
        }
      } catch (error) {
        console.error('Error fetching schema for credential:', error);
        setSchemaAttributes([]);
      } finally {
        setIsLoadingSchema(false);
      }
    };

    loadSchemaAttributes();
  }, [credential.schemaId, credential.schemaVersion]);

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

  // Get current credential data
  const displayData = vcs[currentIndex]
    ? {
        id: vcs[currentIndex].id,
        holderDid: vcs[currentIndex].credentialSubject.id,
        issuerDid:
          typeof vcs[currentIndex].issuer === 'object'
            ? vcs[currentIndex].issuer.id
            : vcs[currentIndex].issuer,
        schemaName: credential.schemaName,
        schemaId: credential.schemaId,
        schemaVersion: credential.schemaVersion,
        status:
          // Only the newest version (index 0) can be APPROVED or REVOKED
          // All historical versions are marked as REVOKED
          currentIndex === 0 ? (vcStatus === false ? 'REVOKED' : 'APPROVED') : 'REVOKED',
        validFrom: vcs[currentIndex].validFrom,
        expiredAt: vcs[currentIndex].expiredAt,
        attributes: credential.attributes,
      }
    : credential;

  // Prepare data for DataTable
  const displayAttributes: DisplayAttribute[] = credential.attributes.map((attr) => {
    const schemaAttr = schemaAttributes.find((sa) => sa.name === attr.name);
    return {
      id: attr.name,
      name: attr.name,
      type: schemaAttr?.type || 'string',
      required: schemaAttr?.required || false,
      value: attr.value,
    };
  });

  const columns: Column<DisplayAttribute>[] = [
    {
      id: 'name',
      label: 'NAME',
      sortKey: 'name',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-900">{row.name}</span>
          {row.required && <span className="text-red-500 text-sm">*</span>}
        </div>
      ),
    },
    {
      id: 'type',
      label: 'TYPE',
      sortKey: 'type',
      render: (row) => (
        <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium">
          {row.type}
        </span>
      ),
    },
    {
      id: 'required',
      label: 'REQUIRED',
      sortKey: 'required',
      render: (row) => (
        <span
          className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
            row.required ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600'
          }`}
        >
          {row.required ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      id: 'value',
      label: 'VALUE',
      sortKey: 'value',
      render: (row) => (
        <span className="text-sm text-gray-900">
          {row.value ? row.value : <em className="text-gray-400">(empty)</em>}
        </span>
      ),
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
            <span className="text-sm font-medium text-xs font-medium text-gray-700">
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
          <label className="block mb-2 text-sm font-medium text-xs font-medium text-gray-700">
            Credential ID
          </label>
          <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
            {displayData.id}
          </div>
        </div>

        {/* Schema ID */}
        {displayData.schemaId && (
          <div className="col-span-2">
            <label className="block mb-2 text-sm font-medium text-xs font-medium text-gray-700">
              Schema ID
            </label>
            <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
              {displayData.schemaId}
            </div>
          </div>
        )}

        {/* Schema Name */}
        <div>
          <label className="block mb-2 text-sm font-medium text-xs font-medium text-gray-700">
            Schema Name
          </label>
          <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
            {displayData.schemaName}
          </div>
        </div>

        {/* Schema Version */}
        <div>
          <label className="block mb-2 text-sm font-medium text-xs font-medium text-gray-700">
            Schema Version
          </label>
          <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
            {displayData.schemaVersion}
          </div>
        </div>

        {/* Holder DID */}
        <div className="col-span-2">
          <label className="block mb-2 text-sm font-medium text-xs font-medium text-gray-700">
            Holder DID
          </label>
          <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
            {displayData.holderDid}
          </div>
        </div>

        {/* Issuer DID */}
        {displayData.issuerDid && (
          <div className="col-span-2">
            <label className="block mb-2 text-sm font-medium text-xs font-medium text-gray-700">
              Issuer DID
            </label>
            <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
              {displayData.issuerDid}
            </div>
          </div>
        )}

        {/* Issued At */}
        <div>
          <label className="block mb-2 text-sm font-medium text-xs font-medium text-gray-700">
            Issued At
          </label>
          <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
            {formatDateTime(
              displayVC ? displayVC.validFrom : credential.issuedAt || credential.activeUntil
            )}
          </div>
        </div>

        {/* Active Until / Expired At */}
        <div>
          <label className="block mb-2 text-sm font-medium text-xs font-medium text-gray-700">
            Expired At
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
          <label className="block mb-2 text-sm font-medium text-xs font-medium text-gray-700">
            Status
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
      {credential.attributes.length > 0 && (
        <div className="mb-6">
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-900">
              Credential Attributes ({credential.attributes.length})
            </p>
          </div>

          {!isLoadingSchema ? (
            <DataTable
              data={displayAttributes}
              columns={columns}
              searchPlaceholder="Search attributes..."
              enableSelection={false}
              totalCount={displayAttributes.length}
              rowsPerPageOptions={[5, 10, 25, 50]}
              idKey="id"
              hideBottomControls={true}
            />
          ) : (
            <div className="flex items-center justify-center p-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="ml-4 text-gray-600">Loading schema attributes...</p>
            </div>
          )}
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
