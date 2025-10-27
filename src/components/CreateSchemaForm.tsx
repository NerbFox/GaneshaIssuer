'use client';

import { useState } from 'react';
import { ThemedText } from './ThemedText';
import { DataTable, Column } from './DataTable';

interface Attribute {
  id: number;
  name: string;
  type: string;
  description: string;
  required: boolean;
}

interface CreateSchemaFormProps {
  onSubmit: (data: SchemaFormData) => Promise<void>;
  onCancel: () => void;
}

export interface SchemaFormData {
  schemaId: string;
  schemaName: string;
  version: string;
  status: string;
  attributes: Attribute[];
}

export default function CreateSchemaForm({ onSubmit, onCancel }: CreateSchemaFormProps) {
  const [schemaId, setSchemaId] = useState('');
  const [schemaName, setSchemaName] = useState('');
  const [version, setVersion] = useState('1');
  const [status, setStatus] = useState('Active');
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddAttribute = () => {
    const newId = attributes.length > 0 ? Math.max(...attributes.map(a => a.id)) + 1 : 1;
    setAttributes([...attributes, { id: newId, name: '', type: 'string', description: '', required: false }]);
  };

  const handleDeleteAttribute = (id: number) => {
    setAttributes(attributes.filter(attr => attr.id !== id));
  };

  const handleAttributeChange = (id: number, field: 'name' | 'type' | 'description' | 'required', value: string | boolean) => {
    setAttributes(attributes.map(attr => 
      attr.id === id ? { ...attr, [field]: value } : attr
    ));
  };

  const handleSubmit = async () => {
    if (isSubmitting) return; // Prevent double submission
    
    setIsSubmitting(true);
    try {
      await onSubmit({
        schemaId,
        schemaName,
        version,
        status,
        attributes,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  const columns: Column<Attribute>[] = [
    {
      id: 'name',
      label: 'NAME',
      sortKey: 'name',
      render: (row) => (
        <input
          type="text"
          value={row.name}
          onChange={(e) => handleAttributeChange(row.id, 'name', e.target.value)}
          placeholder="Enter attribute name"
          className="w-full px-2 py-1 border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded text-sm"
        />
      ),
    },
    {
      id: 'type',
      label: 'TYPE',
      sortKey: 'type',
      render: (row) => (
        <select
          value={row.type}
          onChange={(e) => handleAttributeChange(row.id, 'type', e.target.value)}
          className="w-full px-2 py-1 border-0 text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded text-sm cursor-pointer"
        >
          <option value="string">string</option>
          <option value="number">number</option>
          <option value="boolean">boolean</option>
        </select>
      ),
    },
    {
      id: 'description',
      label: 'DESCRIPTION',
      sortKey: 'description',
      render: (row) => (
        <input
          type="text"
          value={row.description}
          onChange={(e) => handleAttributeChange(row.id, 'description', e.target.value)}
          placeholder="Enter description"
          className="w-full px-2 py-1 border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded text-sm"
        />
      ),
    },
    {
      id: 'required',
      label: 'REQUIRED',
      sortKey: 'required',
      render: (row) => (
        <input
          type="checkbox"
          checked={row.required}
          onChange={(e) => handleAttributeChange(row.id, 'required', e.target.checked)}
          className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500 rounded cursor-pointer"
        />
      ),
    },
    {
      id: 'action',
      label: 'ACTION',
      render: (row) => (
        <button
          onClick={() => handleDeleteAttribute(row.id)}
          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-xs font-medium"
        >
          DELETE
        </button>
      ),
    },
  ];

  const filteredAttributes = attributes.filter(attr =>
    attr.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="px-8 py-6">
      {/* Schema ID */}
      <div className="mb-6">
        <label className="block mb-2">
          <ThemedText className="text-sm font-medium text-gray-900">
            Schema ID<span className="text-red-500">*</span>
          </ThemedText>
        </label>
        <input
          type="text"
          value={schemaId}
          onChange={(e) => setSchemaId(e.target.value)}
          placeholder="Enter schema ID"
          className="w-full text-black px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
      </div>

      {/* Schema Name */}
      <div className="mb-6">
        <label className="block mb-2">
          <ThemedText className="text-sm font-medium text-gray-900">
            Schema Name<span className="text-red-500">*</span>
          </ThemedText>
        </label>
        <input
          type="text"
          value={schemaName}
          onChange={(e) => setSchemaName(e.target.value)}
          placeholder="Enter schema name"
          className="w-full text-black px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
      </div>

      {/* Version and Status */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block mb-2">
            <ThemedText className="text-sm font-medium text-gray-900">Version</ThemedText>
          </label>
          <input
            type="text"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="1"
            className="w-full text-black px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
        <div>
          <label className="block mb-2">
            <ThemedText className="text-sm font-medium text-gray-900">
              Status<span className="text-red-500">*</span>
            </ThemedText>
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full text-black px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Draft">Draft</option>
          </select>
        </div>
      </div>

      {/* Attributes Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <ThemedText className="text-sm font-medium text-gray-900">
            Attributes<span className="text-red-500">*</span>
          </ThemedText>
          <button
            onClick={handleAddAttribute}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Attribute
          </button>
        </div>

        {/* Data Table */}
        <DataTable
          data={filteredAttributes}
          columns={columns}
          searchPlaceholder="Search..."
          onSearch={handleSearch}
          enableSelection={true}
          totalCount={filteredAttributes.length}
          rowsPerPageOptions={[5, 10, 25, 50]}
          idKey="id"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          CANCEL
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSubmitting && (
            <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          )}
          {isSubmitting ? 'CREATING...' : 'CREATE SCHEMA'}
        </button>
      </div>
    </div>
  );
}
