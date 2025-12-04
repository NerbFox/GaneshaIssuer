'use client';

import { useState, useEffect } from 'react';
import { ThemedText } from '@/components/shared/ThemedText';
import { DataTable, Column } from '@/components/shared/DataTable';
import InfoModal from '@/components/shared/InfoModal';
import DatePicker from '@/components/shared/DatePicker';
import { DateTimePicker } from '@/components/shared/DateTimePicker';
import TimePicker from '@/components/shared/TimePicker';

interface AttributeData {
  id: number;
  name: string;
  type: string;
  value: string | number | boolean;
  required?: boolean;
}

interface Schema {
  id: string;
  name: string;
  version: number;
  isActive: boolean;
  expiredIn?: number;
  imageUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  attributes: {
    name: string;
    type: string;
    required: boolean;
    description?: string;
  }[];
}

interface IssueNewCredentialFormProps {
  schemas: Schema[];
  onSubmit: (data: IssueNewCredentialFormData) => void;
}

export interface IssueNewCredentialFormData {
  didPrefix: string;
  holderDid: string;
  schemaId: string;
  schemaName: string;
  version: number;
  status: string;
  attributes: AttributeData[];
}

export default function IssueNewCredentialForm({ schemas, onSubmit }: IssueNewCredentialFormProps) {
  const [didPrefix, setDidPrefix] = useState('did:dcert:');
  const [holderDid, setHolderDid] = useState('');
  const [schemaId, setSchemaId] = useState('');
  const [schemaName, setSchemaName] = useState('');
  const [version, setVersion] = useState<number>(0);
  const [expiredIn, setExpiredIn] = useState<number | null>(null);
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [attributes, setAttributes] = useState<AttributeData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<Record<number, File>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableVersions, setAvailableVersions] = useState<
    { version: number; isActive: boolean }[]
  >([]);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoModalConfig, setInfoModalConfig] = useState({
    title: '',
    message: '',
    buttonColor: 'blue' as 'blue' | 'green' | 'red' | 'yellow',
  });

  const didPrefixes = ['did:dcert:'];

  // Update schema name, attributes, and metadata when schema ID or version changes
  useEffect(() => {
    if (schemaId) {
      // Get available versions for this schema (only active versions)
      const versions = schemas
        .filter((s) => s.id === schemaId && s.isActive)
        .map((s) => ({ version: s.version, isActive: s.isActive }))
        .sort((a, b) => b.version - a.version); // Sort descending
      setAvailableVersions(versions);

      // Set default version to the highest active version if not already set
      if (version === 0 && versions.length > 0) {
        setVersion(versions[0].version);
      }
    } else {
      setAvailableVersions([]);
      setVersion(0);
    }
  }, [schemaId, schemas, version]);

  // Update form data when version changes
  useEffect(() => {
    if (schemaId && version > 0) {
      const selectedSchema = schemas.find((s) => s.id === schemaId && s.version === version);
      if (selectedSchema) {
        setSchemaName(selectedSchema.name);
        setExpiredIn(selectedSchema.expiredIn ?? null);
        setImageUrl(selectedSchema.imageUrl);

        // Initialize attributes from schema
        const initialAttributes: AttributeData[] = selectedSchema.attributes.map((attr, index) => ({
          id: index + 1,
          name: attr.name,
          type: attr.type,
          value: '',
          required: attr.required,
        }));
        setAttributes(initialAttributes);
      }
    } else {
      setSchemaName('');
      setExpiredIn(null);
      setImageUrl(undefined);
      setAttributes([]);
    }
  }, [schemaId, version, schemas]);

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
    // Validate required fields
    if (!holderDid.trim()) {
      setInfoModalConfig({
        title: 'Validation Error',
        message: 'Holder DID is required',
        buttonColor: 'red',
      });
      setShowInfoModal(true);
      return;
    }

    if (!schemaId) {
      setInfoModalConfig({
        title: 'Validation Error',
        message: 'Schema ID is required',
        buttonColor: 'red',
      });
      setShowInfoModal(true);
      return;
    }

    // Validate all required attributes have values
    const emptyRequiredAttributes = attributes.filter(
      (attr) => attr.required && (!attr.value || attr.value === '')
    );
    if (emptyRequiredAttributes.length > 0) {
      setInfoModalConfig({
        title: 'Validation Error',
        message: `Please fill in all required attributes: ${emptyRequiredAttributes.map((a) => a.name).join(', ')}`,
        buttonColor: 'red',
      });
      setShowInfoModal(true);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        didPrefix,
        holderDid: didPrefix + holderDid,
        schemaId,
        schemaName,
        version,
        status: 'Active',
        attributes,
      });
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsSubmitting(false);
    }
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
      render: (row) => (
        <div className="flex items-center gap-2">
          <ThemedText className="text-sm text-gray-900">{row.name}</ThemedText>
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
      render: (row) => {
        const renderInputField = () => {
          switch (row.type.toLowerCase()) {
            case 'image':
              return (
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
              );

            case 'boolean':
              return (
                <select
                  value={String(row.value)}
                  onChange={(e) => handleAttributeValueChange(row.id, e.target.value)}
                  className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select...</option>
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              );

            case 'date':
              return (
                <div className="w-full">
                  <DatePicker
                    value={String(row.value) || ''}
                    onChange={(value) => handleAttributeValueChange(row.id, value)}
                  />
                </div>
              );

            case 'datetime':
            case 'datetime-local':
              return (
                <div className="w-full">
                  <DateTimePicker
                    value={String(row.value) || ''}
                    onChange={(value) => handleAttributeValueChange(row.id, value)}
                  />
                </div>
              );

            case 'time':
              return (
                <div className="w-full">
                  <TimePicker
                    value={String(row.value) || ''}
                    onChange={(value) => handleAttributeValueChange(row.id, value)}
                  />
                </div>
              );

            case 'number':
            case 'integer':
            case 'float':
            case 'decimal':
              return (
                <input
                  type="number"
                  value={String(row.value)}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || !isNaN(Number(value))) {
                      handleAttributeValueChange(row.id, value);
                    }
                  }}
                  placeholder={`Enter ${row.name}`}
                  step={
                    row.type.toLowerCase() === 'float' || row.type.toLowerCase() === 'decimal'
                      ? '0.01'
                      : '1'
                  }
                  onKeyPress={(e) => {
                    const allowDecimal =
                      row.type.toLowerCase() === 'float' || row.type.toLowerCase() === 'decimal';
                    if (
                      !/[\d.]/.test(e.key) ||
                      (!allowDecimal && e.key === '.') ||
                      (e.key === '.' && String(row.value).includes('.'))
                    ) {
                      e.preventDefault();
                    }
                  }}
                  className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              );

            case 'email':
              return (
                <input
                  type="email"
                  value={String(row.value)}
                  onChange={(e) => handleAttributeValueChange(row.id, e.target.value)}
                  placeholder={`Enter ${row.name}`}
                  pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
                  className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              );

            case 'url':
            case 'uri':
              return (
                <input
                  type="url"
                  value={String(row.value)}
                  onChange={(e) => handleAttributeValueChange(row.id, e.target.value)}
                  placeholder={`Enter ${row.name}`}
                  pattern="https?://.+"
                  className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              );

            case 'tel':
            case 'phone':
              return (
                <input
                  type="tel"
                  value={String(row.value)}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^[\d\s\-+()]*$/.test(value)) {
                      handleAttributeValueChange(row.id, value);
                    }
                  }}
                  placeholder={`Enter ${row.name}`}
                  className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              );

            case 'textarea':
            case 'text-area':
            case 'multiline':
              return (
                <textarea
                  value={String(row.value)}
                  onChange={(e) => handleAttributeValueChange(row.id, e.target.value)}
                  placeholder={`Enter ${row.name}`}
                  rows={3}
                  className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              );

            default:
              return (
                <input
                  type="text"
                  value={String(row.value)}
                  onChange={(e) => handleAttributeValueChange(row.id, e.target.value)}
                  placeholder={`Enter ${row.name}`}
                  className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              );
          }
        };

        return <div className="flex items-center gap-2 w-full">{renderInputField()}</div>;
      },
    },
  ];

  // Get unique schemas (by ID)
  const uniqueSchemas = schemas.reduce((acc, schema) => {
    if (!acc.find((s) => s.id === schema.id)) {
      acc.push(schema);
    }
    return acc;
  }, [] as Schema[]);

  return (
    <div className="px-8 py-6">
      {/* DID Prefix and Holder DID in same row */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* DID Prefix */}
        <div>
          <ThemedText className="text-sm text-gray-600 mb-2">
            DID Prefix<span className="text-red-500">*</span>
          </ThemedText>
          <select
            value={didPrefix}
            onChange={(e) => setDidPrefix(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 cursor-pointer bg-white"
          >
            {didPrefixes.map((prefix) => (
              <option key={prefix} value={prefix}>
                {prefix}
              </option>
            ))}
          </select>
        </div>

        {/* Holder DID */}
        <div>
          <ThemedText className="text-sm text-gray-600 mb-2">
            Holder DID<span className="text-red-500">*</span>
          </ThemedText>
          <input
            type="text"
            value={holderDid}
            onChange={(e) => setHolderDid(e.target.value)}
            placeholder="abcdefghijklmnopqrstuvwxyz1234567890"
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
          />
        </div>
      </div>

      {/* Schema ID and Schema Name in same row */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Schema Name */}
        <div>
          <ThemedText className="text-sm text-gray-600 mb-2">
            Schema Name<span className="text-red-500">*</span>
          </ThemedText>
          <select
            value={schemaId}
            onChange={(e) => setSchemaId(e.target.value)}
            className={`w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm cursor-pointer bg-white ${!schemaId ? 'text-gray-400' : 'text-gray-900'}`}
          >
            <option value="">Select schema</option>
            {uniqueSchemas.map((schema) => (
              <option key={schema.id} value={schema.id} className="text-gray-900">
                {schema.name}
              </option>
            ))}
          </select>
        </div>

        {/* Schema ID (auto-filled) */}
        <div>
          <ThemedText className="text-sm text-gray-600 mb-2">Schema ID</ThemedText>
          <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
            <ThemedText className={`text-sm ${!schemaId ? 'text-gray-400' : 'text-gray-900'}`}>
              {schemaId || 'Select a schema to see its ID'}
            </ThemedText>
          </div>
        </div>
      </div>

      {/* Schema Version and Expired In in same row */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Schema Version */}
        <div>
          <ThemedText className="text-sm text-gray-600 mb-2">
            Schema Version<span className="text-red-500">*</span>
          </ThemedText>
          <select
            value={version}
            onChange={(e) => setVersion(Number(e.target.value))}
            disabled={!schemaId || availableVersions.length === 0}
            className={`w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm cursor-pointer bg-white disabled:bg-gray-50 disabled:cursor-not-allowed ${!schemaName ? 'text-gray-400' : 'text-gray-900'}`}
          >
            {availableVersions.length > 0 ? (
              availableVersions.map((v) => (
                <option key={v.version} value={v.version}>
                  {v.version}
                </option>
              ))
            ) : (
              <option value={0}>{schemaName || 'Select a schema to see its version'}</option>
            )}
          </select>
        </div>

        {/* Expired In (Years) - auto-filled */}
        <div>
          <ThemedText className="text-sm text-gray-600 mb-2">Expired In (Years)</ThemedText>
          <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
            <ThemedText className={`text-sm ${!schemaName ? 'text-gray-400' : 'text-gray-900'}`}>
              {schemaName
                ? expiredIn === 0 || expiredIn === null || expiredIn === undefined
                  ? 'Lifetime'
                  : expiredIn
                : 'Select a schema to see expiration'}
            </ThemedText>
          </div>
        </div>
      </div>

      {/* VC Background Image */}
      {imageUrl && (
        <div className="mb-6">
          <label className="block mb-3">
            <ThemedText className="text-sm font-semibold text-gray-900">
              VC Background Image
            </ThemedText>
          </label>
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="VC Background"
              className="w-full h-auto max-h-96 object-contain rounded-xl border-2 border-gray-200 shadow-md block bg-gray-50"
            />
          </div>
        </div>
      )}

      {/* Attributes Table */}
      {attributes.length > 0 && (
        <div className="mb-6">
          <ThemedText className="text-sm font-medium text-gray-900 mb-4">
            Attributes ({filteredAttributes.length})
          </ThemedText>
          <DataTable
            data={filteredAttributes}
            columns={attributeColumns}
            searchPlaceholder="Search attributes..."
            onSearch={handleSearch}
            enableSelection={false}
            totalCount={filteredAttributes.length}
            hideBottomControls={true}
            rowsPerPageOptions={[1000]}
            idKey="id"
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSubmitting && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          )}
          {isSubmitting ? 'ISSUING...' : 'ISSUE CREDENTIAL'}
        </button>
      </div>

      {/* Info Modal */}
      <InfoModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title={infoModalConfig.title}
        message={infoModalConfig.message}
        buttonColor={infoModalConfig.buttonColor}
      />
    </div>
  );
}
