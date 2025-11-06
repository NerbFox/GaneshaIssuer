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

interface Schema {
  id: string;
  name: string;
  version: number;
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
  const [version, setVersion] = useState<number>(1);
  const [attributes, setAttributes] = useState<AttributeData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<Record<number, File>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableVersions, setAvailableVersions] = useState<number[]>([]);

  const didPrefixes = ['did:dcert:'];

  // Update schema name and attributes when schema ID changes
  useEffect(() => {
    if (schemaId) {
      const selectedSchema = schemas.find((s) => s.id === schemaId);
      if (selectedSchema) {
        setSchemaName(selectedSchema.name);

        // Initialize attributes from schema
        const initialAttributes: AttributeData[] = selectedSchema.attributes.map((attr, index) => ({
          id: index + 1,
          name: attr.name,
          type: attr.type,
          value: '',
        }));
        setAttributes(initialAttributes);

        // Get available versions for this schema
        const versions = schemas
          .filter((s) => s.id === schemaId)
          .map((s) => s.version)
          .sort((a, b) => b - a); // Sort descending
        setAvailableVersions(versions);
      }
    } else {
      setSchemaName('');
      setAttributes([]);
      setAvailableVersions([]);
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
      alert('Holder DID is required');
      return;
    }

    if (!schemaId) {
      alert('Schema ID is required');
      return;
    }

    // Validate all attributes have values
    const emptyAttributes = attributes.filter((attr) => !attr.value);
    if (emptyAttributes.length > 0) {
      alert(`Please fill in all attributes: ${emptyAttributes.map((a) => a.name).join(', ')}`);
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

      {/* Schema ID */}
      <div className="mb-6">
        <ThemedText className="text-sm text-gray-600 mb-2">
          Schema ID<span className="text-red-500">*</span>
        </ThemedText>
        <select
          value={schemaId}
          onChange={(e) => setSchemaId(e.target.value)}
          className={`w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm cursor-pointer bg-white ${!schemaId ? 'text-gray-400' : 'text-gray-900'}`}
        >
          <option value="">Select schema</option>
          {uniqueSchemas.map((schema) => (
            <option key={schema.id} value={schema.id} className="text-gray-900">
              {schema.id}
            </option>
          ))}
        </select>
      </div>

      {/* Schema Name (auto-filled) */}
      <div className="mb-6">
        <ThemedText className="text-sm text-gray-600 mb-2">Schema Name</ThemedText>
        <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
          <ThemedText className={`text-sm ${!schemaName ? 'text-gray-400' : 'text-gray-900'}`}>
            {schemaName || 'Select a schema to see its name'}
          </ThemedText>
        </div>
      </div>

      {/* Version */}
      <div className="mb-6">
        <ThemedText className="text-sm text-gray-600 mb-2">
          Version<span className="text-red-500">*</span>
        </ThemedText>
        <select
          value={version}
          onChange={(e) => setVersion(Number(e.target.value))}
          disabled={!schemaId || availableVersions.length === 0}
          className={`w-full px-4 py-4 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm cursor-pointer bg-white disabled:bg-gray-50 disabled:cursor-not-allowed ${!schemaName ? 'text-gray-400' : 'text-gray-900'}`}
        >
          {availableVersions.length > 0 ? (
            availableVersions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))
          ) : (
            <option>{schemaName || 'Select a schema to see its version'}</option>
          )}
        </select>
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
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'ISSUING...' : 'ISSUE CREDENTIAL'}
        </button>
      </div>
    </div>
  );
}
