'use client';

import { ThemedText } from '@/components/shared/ThemedText';
import { DataTable, Column } from '@/components/shared/DataTable';
import { formatDateTime } from '@/utils/dateUtils';
import CredentialPreview from '@/components/shared/CredentialPreview';
import { AttributePositionData, QRCodePosition } from '@/components/issuer/AttributePositionEditor';

interface Attribute {
  id: number;
  name: string;
  type: string;
  description: string;
  required: boolean;
}

interface ViewSchemaFormProps {
  onClose: () => void;
  schemaData: {
    id: string;
    schemaName: string;
    version: string;
    expiredIn: number;
    isActive: string;
    createdAt?: string;
    updatedAt: string;
    attributes: Attribute[];
    imageUrl?: string;
    attributePositions?: AttributePositionData;
    qrCodePosition?: QRCodePosition;
  };
}

export default function ViewSchemaForm({ onClose, schemaData }: ViewSchemaFormProps) {
  const columns: Column<Attribute>[] = [
    {
      id: 'name',
      label: 'NAME',
      sortKey: 'name',
      align: 'left',
      width: '25%',
      render: (row) => <ThemedText className="text-sm text-gray-900">{row.name}</ThemedText>,
    },
    {
      id: 'type',
      label: 'TYPE',
      sortKey: 'type',
      align: 'left',
      width: '260px',
      render: (row) => (
        <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium">
          {row.type}
        </span>
      ),
    },
    {
      id: 'description',
      label: 'DESCRIPTION',
      sortKey: 'description',
      align: 'left',
      width: '25%',
      render: (row) => (
        <ThemedText className="text-sm text-gray-600">
          {row.description || <span className="text-gray-400 italic">No description</span>}
        </ThemedText>
      ),
    },
    {
      id: 'required',
      label: 'REQUIRED',
      sortKey: 'required',
      align: 'center',
      width: '100px',
      render: (row) => (
        <div className="flex items-center justify-center h-full">
          <span
            className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${
              row.required ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {row.required ? 'Yes' : 'No'}
          </span>
        </div>
      ),
    },
  ];

  return (
    <div className="px-8 py-6">
      {/* Schema Information Grid */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Schema ID */}
        <div>
          <label className="block mb-2">
            <ThemedText className="text-sm font-medium text-gray-700">Schema ID</ThemedText>
          </label>
          <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
            {schemaData.id}
          </div>
        </div>

        {/* Schema Name */}
        <div>
          <label className="block mb-2">
            <ThemedText className="text-sm font-medium text-gray-700">Schema Name</ThemedText>
          </label>
          <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
            {schemaData.schemaName}
          </div>
        </div>

        {/* Version */}
        <div>
          <label className="block mb-2">
            <ThemedText className="text-sm font-medium text-gray-700">Version</ThemedText>
          </label>
          <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
            {schemaData.version}
          </div>
        </div>

        {/* Expired In */}
        <div>
          <label className="block mb-2">
            <ThemedText className="text-sm font-medium text-gray-700">
              Expired In (Years)
            </ThemedText>
          </label>
          <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
            {schemaData.expiredIn === 0 ||
            schemaData.expiredIn === null ||
            schemaData.expiredIn === undefined
              ? 'Lifetime'
              : schemaData.expiredIn}
          </div>
        </div>

        {/* Created At */}
        {schemaData.createdAt && (
          <div>
            <label className="block mb-2">
              <ThemedText className="text-sm font-medium text-gray-700">Created At</ThemedText>
            </label>
            <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
              {formatDateTime(schemaData.createdAt)}
            </div>
          </div>
        )}

        {/* Updated At */}
        <div>
          <label className="block mb-2">
            <ThemedText className="text-sm font-medium text-gray-700">Updated At</ThemedText>
          </label>
          <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
            {formatDateTime(schemaData.updatedAt)}
          </div>
        </div>

        {/* Status - Full width on last row */}
        <div className="col-span-2">
          <label className="block mb-2">
            <ThemedText className="text-sm font-medium text-gray-700">Status</ThemedText>
          </label>
          <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                schemaData.isActive === 'Active'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {schemaData.isActive}
            </span>
          </div>
        </div>
      </div>

      {/* Credential Template with Positioned Attributes */}
      {schemaData.imageUrl && (
        <div className="mb-6">
          {(schemaData.attributePositions &&
            Object.keys(schemaData.attributePositions).length > 0) ||
          schemaData.qrCodePosition ? (
            <CredentialPreview
              imageUrl={schemaData.imageUrl}
              positions={schemaData.attributePositions || {}}
              qrPosition={schemaData.qrCodePosition}
              sampleData={Object.fromEntries(
                schemaData.attributes.map((attr) => [attr.name, `[${attr.name}]`])
              )}
            />
          ) : (
            <>
              <label className="block mb-3">
                <ThemedText className="text-sm font-semibold text-gray-900">
                  Credential Template
                </ThemedText>
              </label>
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={schemaData.imageUrl}
                  alt="Credential Template"
                  className="w-full h-auto max-h-96 object-contain rounded-xl border-2 border-gray-200 shadow-md block bg-gray-50"
                />
              </div>
              <ThemedText className="text-xs text-gray-500 mt-2">
                No attribute positions configured for this schema.
              </ThemedText>
            </>
          )}
        </div>
      )}

      {/* Attributes Section */}
      <div className="mb-6">
        <div className="mb-4">
          <ThemedText className="text-sm font-medium text-gray-900">
            Attributes ({schemaData.attributes.length})
          </ThemedText>
        </div>

        <DataTable
          data={schemaData.attributes}
          columns={columns}
          searchPlaceholder="Search attributes..."
          enableSelection={false}
          totalCount={schemaData.attributes.length}
          hideBottomControls={true}
          rowsPerPageOptions={[1000]}
          idKey="id"
        />
      </div>

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
