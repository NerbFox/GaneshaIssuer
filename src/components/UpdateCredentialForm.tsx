'use client';

import { useState, useEffect } from 'react';
import { ThemedText } from './ThemedText';
import { DataTable, Column } from './DataTable';

interface AttributeData {
  id: number;
  name: string;
  type: string;
  value: string | number | boolean;
}

interface UpdateCredentialFormProps {
  onSubmit: (data: UpdateCredentialFormData) => Promise<void>;
  onCancel: () => void;
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
    schemaIsActive?: boolean;
    attributes: { id: number; name: string; type: string; value: string }[];
  };
}

export interface UpdateCredentialFormData {
  credentialId: string;
  holderDid: string;
  schemaId: string;
  schemaName: string;
  version: number;
  status: string;
  attributes: AttributeData[];
}

export default function UpdateCredentialForm({
  onSubmit,
  onCancel,
  credentialData,
}: UpdateCredentialFormProps) {
  const [holderDid] = useState(credentialData.holderDid);
  const [schemaId] = useState(credentialData.schemaId || '');
  // Trim version suffix from schema name (e.g., "Schema Name v1" -> "Schema Name")
  const [schemaName] = useState(credentialData.schemaName.replace(/\s+v\d+$/, ''));
  const [version] = useState(credentialData.schemaVersion);
  const [status] = useState('Active');
  const [attributes, setAttributes] = useState<AttributeData[]>(
    credentialData.attributes.map((attr) => ({
      id: attr.id,
      name: attr.name,
      type: attr.type,
      value: attr.value,
    }))
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<Record<number, File>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [initialAttributes, setInitialAttributes] = useState<AttributeData[]>([]);

  useEffect(() => {
    setInitialAttributes(JSON.parse(JSON.stringify(attributes)));
  }, [attributes]);

  const handleAttributeValueChange = (id: number, value: string) => {
    setAttributes(attributes.map((attr) => (attr.id === id ? { ...attr, value } : attr)));
  };

  const handleFileUpload = (id: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFiles({ ...uploadedFiles, [id]: file });
      handleAttributeValueChange(id, file.name);
    }
  };

  const truncateFileName = (fileName: string, maxLength: number = 10): string => {
    if (fileName.length <= maxLength) {
      return fileName;
    }
    return fileName.substring(0, maxLength) + '...';
  };

  const handleFileView = (id: number) => {
    const file = uploadedFiles[id];
    if (file) {
      const url = URL.createObjectURL(file);
      window.open(url, '_blank');
    }
  };

  const handleSubmit = async () => {
    // Validate all attributes have values
    const emptyAttributes = attributes.filter((attr) => !attr.value);
    if (emptyAttributes.length > 0) {
      alert(`Please fill in all attributes: ${emptyAttributes.map((a) => a.name).join(', ')}`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        credentialId: credentialData.id,
        holderDid,
        schemaId,
        schemaName,
        version,
        status,
        attributes,
      });
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasDataChanged = () => {
    if (attributes.length !== initialAttributes.length) {
      return true;
    }

    return attributes.some((attr) => {
      const initialAttr = initialAttributes.find((initial) => initial.id === attr.id);
      if (!initialAttr) return true;
      return attr.value !== initialAttr.value;
    });
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  const filteredAttributes = attributes.filter((attr) =>
    attr.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const attributeColumns: Column<AttributeData>[] = [
    {
      id: 'name',
      label: 'NAME',
      sortKey: 'name',
      render: (row) => <ThemedText className="text-sm text-gray-900">{row.name}</ThemedText>,
    },
    {
      id: 'type',
      label: 'TYPE',
      sortKey: 'type',
      render: (row) => (
        <ThemedText className="text-sm text-blue-600 capitalize">{row.type}</ThemedText>
      ),
    },
    {
      id: 'value',
      label: 'VALUE',
      render: (row) => (
        <div className="flex items-center gap-2">
          {row.type === 'image' ? (
            <div className="flex gap-2 items-center">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(row.id, e)}
                  className="hidden"
                />
                <span className="text-blue-500 hover:text-blue-600 text-sm font-medium">
                  Upload
                </span>
              </label>
              <span className="text-gray-400">/</span>
              <button
                onClick={() => handleFileView(row.id)}
                disabled={!uploadedFiles[row.id]}
                className={`text-sm font-medium ${
                  uploadedFiles[row.id]
                    ? 'text-blue-500 hover:text-blue-600'
                    : 'text-gray-400 cursor-not-allowed'
                }`}
              >
                View
              </button>
              {uploadedFiles[row.id] && (
                <span className="text-xs text-gray-500 ml-2">
                  ({truncateFileName(uploadedFiles[row.id].name)})
                </span>
              )}
            </div>
          ) : (
            <input
              type={row.type === 'number' ? 'number' : 'text'}
              value={String(row.value)}
              onChange={(e) => handleAttributeValueChange(row.id, e.target.value)}
              placeholder={`Enter ${row.name}`}
              className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="px-8 py-6">
      {/* Holder DID (read-only) */}
      <div className="mb-6">
        <ThemedText className="text-sm text-gray-600 mb-2">Holder DID</ThemedText>
        <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
          <ThemedText className="text-sm text-gray-900 break-all">{holderDid}</ThemedText>
        </div>
      </div>

      {/* Schema ID (read-only) */}
      <div className="mb-6">
        <ThemedText className="text-sm text-gray-600 mb-2">Schema ID</ThemedText>
        <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
          <ThemedText className="text-sm text-gray-900">{schemaId || 'N/A'}</ThemedText>
        </div>
      </div>

      {/* Schema Name (read-only) */}
      <div className="mb-6">
        <ThemedText className="text-sm text-gray-600 mb-2">Schema Name</ThemedText>
        <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
          <ThemedText className="text-sm text-gray-900">{schemaName}</ThemedText>
        </div>
      </div>

      {/* Schema Version and Status in same row (read-only) */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Schema Version */}
        <div>
          <ThemedText className="text-sm text-gray-600 mb-2">Schema Version</ThemedText>
          <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
            <ThemedText className="text-sm text-gray-900">{version}</ThemedText>
          </div>
        </div>

        {/* Status (immutable) */}
        <div>
          <ThemedText className="text-sm text-gray-600 mb-2">Schema Status</ThemedText>
          <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
            <ThemedText className="text-sm text-gray-900">{status}</ThemedText>
          </div>
        </div>
      </div>

      {/* Attributes Table */}
      {attributes.length > 0 && (
        <div className="mb-6">
          <ThemedText className="text-sm font-semibold text-gray-900 mb-4">
            Attributes<span className="text-red-500">*</span>
          </ThemedText>
          <DataTable
            data={filteredAttributes}
            columns={attributeColumns}
            searchPlaceholder="Search attributes..."
            onSearch={handleSearch}
            enableSelection={true}
            totalCount={filteredAttributes.length}
            rowsPerPageOptions={[5, 10, 25]}
            idKey="id"
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          CANCEL
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !hasDataChanged() || credentialData.schemaIsActive === false}
          className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          title={
            credentialData.schemaIsActive === false
              ? 'Cannot update: Schema is inactive'
              : !hasDataChanged()
                ? 'No changes detected'
                : ''
          }
        >
          {isSubmitting ? 'UPDATING...' : 'UPDATE CREDENTIAL'}
        </button>
      </div>
    </div>
  );
}
