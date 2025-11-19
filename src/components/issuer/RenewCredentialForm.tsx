'use client';

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

interface CredentialData {
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
}

interface RenewCredentialFormProps {
  onClose: () => void;
  onRenew: () => void;
  credentialData: CredentialData;
  vcHistory?: VerifiableCredentialData[];
}

export default function RenewCredentialForm({
  onClose,
  onRenew,
  credentialData,
  vcHistory,
}: RenewCredentialFormProps) {
  // Use the newest VC from history if available
  const currentVC = vcHistory && vcHistory.length > 0 ? vcHistory[0] : null;

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

  // Get current credential data
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
            {formatDateTime(currentVC ? currentVC.validFrom : credentialData.issuedAt)}
          </div>
        </div>

        {/* Expired At */}
        <div>
          <label className="block mb-2">
            <ThemedText className="text-sm font-medium text-gray-700">Expired At</ThemedText>
          </label>
          <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
            {credentialData.activeUntil === '-'
              ? 'Lifetime'
              : formatDateTime(currentVC ? currentVC.expiredAt : credentialData.activeUntil)}
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

      {/* Info Box */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <ThemedText className="text-sm text-blue-800">
          <strong>Renewing this credential will:</strong>
          <br />
          • Keep all the same credential data
          <br />
          • Extend the expiration date based on the schema settings
          <br />• Issue a new credential to the holder with the extended validity
        </ThemedText>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
        <button
          onClick={onClose}
          className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm font-medium cursor-pointer"
        >
          CANCEL
        </button>
        <button
          onClick={onRenew}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium cursor-pointer"
        >
          RENEW CREDENTIAL
        </button>
      </div>
    </div>
  );
}
