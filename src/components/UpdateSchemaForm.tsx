'use client';

import { useState, useEffect } from 'react';
import { ThemedText } from './ThemedText';
import { DataTable, Column } from './DataTable';

interface Attribute {
  id: number;
  name: string;
  type: string;
  description: string;
  required: boolean;
}

interface UpdateSchemaFormProps {
  onSubmit: (data: SchemaFormData) => Promise<void>;
  onCancel: () => void;
  initialData?: {
    id: string;
    schemaName: string;
    attributes: number;
    isActive: string;
    lastUpdated: string;
    expiredIn?: number;
    schemaDetails?: {
      properties: Record<string, { type: string }>;
      required: string[];
    };
  };
}

export interface SchemaFormData {
  schemaId: string;
  expiredIn: number;
  attributes: Attribute[];
}

export default function UpdateSchemaForm({
  onSubmit,
  onCancel,
  initialData,
}: UpdateSchemaFormProps) {
  const [schemaId, setSchemaId] = useState('');
  const [schemaName, setSchemaName] = useState('');
  const [version, setVersion] = useState('1');
  const [expiredIn, setExpiredIn] = useState<number>(1);
  const [expiredInInput, setExpiredInInput] = useState<string>('1');
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [selectedAttributeIds, setSelectedAttributeIds] = useState<(string | number)[]>([]);

  // Pre-fill form with initial data
  useEffect(() => {
    if (initialData) {
      setSchemaId(initialData.id);
      // Extract name and version from schemaName (format: "Name vX")
      const nameMatch = initialData.schemaName.match(/^(.+?)\s+v(\d+)$/);
      if (nameMatch) {
        setSchemaName(nameMatch[1]);
        setVersion(nameMatch[2]);
      } else {
        setSchemaName(initialData.schemaName);
      }

      // Set expired in from initial data
      if (initialData.expiredIn !== undefined) {
        setExpiredIn(initialData.expiredIn);
        setExpiredInInput(String(initialData.expiredIn));
      }

      // Load existing attributes from schema details
      if (initialData.schemaDetails) {
        const loadedAttributes: Attribute[] = Object.entries(
          initialData.schemaDetails.properties
        ).map(([name, config], index) => ({
          id: index + 1,
          name,
          type: (config as { type: string }).type,
          description: '',
          required: initialData.schemaDetails!.required.includes(name),
        }));
        setAttributes(loadedAttributes);
      } else {
        setAttributes([]);
      }
    }
  }, [initialData]);

  const handleAddAttribute = () => {
    const newId = attributes.length > 0 ? Math.max(...attributes.map((a) => a.id)) + 1 : 1;
    setAttributes([
      ...attributes,
      { id: newId, name: '', type: 'string', description: '', required: false },
    ]);
  };

  const handleDeleteAttribute = (id: number) => {
    setAttributes(attributes.filter((attr) => attr.id !== id));
  };

  const handleDeleteSelected = () => {
    if (selectedAttributeIds.length === 0) return;

    const idsToDelete = new Set(selectedAttributeIds);
    setAttributes(attributes.filter((attr) => !idsToDelete.has(attr.id)));
    setSelectedAttributeIds([]);
  };

  const handleSelectionChange = (_indices: number[], idValues?: (string | number)[]) => {
    setSelectedAttributeIds(idValues || []);
  };

  const handleAttributeChange = (
    id: number,
    field: 'name' | 'type' | 'description' | 'required',
    value: string | boolean
  ) => {
    setAttributes(attributes.map((attr) => (attr.id === id ? { ...attr, [field]: value } : attr)));
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newAttributes = [...attributes];
    const draggedItem = newAttributes[draggedIndex];
    newAttributes.splice(draggedIndex, 1);
    newAttributes.splice(index, 0, draggedItem);

    setAttributes(newAttributes);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return; // Prevent double submission

    setIsSubmitting(true);
    try {
      // Reassign IDs based on current order before submitting
      const reorderedAttributes = attributes.map((attr, index) => ({
        ...attr,
        id: index + 1,
      }));

      await onSubmit({
        schemaId,
        expiredIn,
        attributes: reorderedAttributes,
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
          className="w-full px-2 py-1 border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded text-sm"
        >
          <option value="string">String</option>
          <option value="number">Number</option>
          <option value="boolean">Boolean</option>
          <option value="date">Date</option>
          <option value="array">Array</option>
          <option value="object">Object</option>
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
          className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 cursor-pointer"
        />
      ),
    },
    {
      id: 'action',
      label: 'ACTION',
      render: (row) => (
        <button
          onClick={() => handleDeleteAttribute(row.id)}
          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-xs font-medium cursor-pointer"
        >
          DELETE
        </button>
      ),
    },
  ];

  const filteredAttributes = attributes.filter((attr) =>
    attr.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Use full attributes list when dragging to maintain correct indices
  const displayAttributes = searchTerm ? filteredAttributes : attributes;

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
          disabled
          className="w-full text-black px-4 py-3 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm cursor-not-allowed"
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
          disabled
          className="w-full text-black px-4 py-3 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm cursor-not-allowed"
        />
      </div>

      {/* Version */}
      <div className="mb-6">
        <label className="block mb-2">
          <ThemedText className="text-sm font-medium text-gray-900">Version</ThemedText>
        </label>
        <input
          type="text"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          placeholder="1"
          disabled
          className="w-full text-black px-4 py-3 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm cursor-not-allowed"
        />
      </div>

      {/* Expired In (Years) */}
      <div className="mb-6">
        <label className="block mb-2">
          <ThemedText className="text-sm font-medium text-gray-900">
            Expired In (Years)<span className="text-red-500">*</span>
          </ThemedText>
        </label>
        <input
          type="number"
          min="0"
          value={expiredInInput}
          onChange={(e) => {
            const value = e.target.value;

            // Allow empty string during editing
            if (value === '') {
              setExpiredInInput('0');
              setExpiredIn(0);
              return;
            }

            // Remove leading zeros, but keep single 0
            const sanitized = value.replace(/^0+(\d)/, '$1');
            const numValue = Number(sanitized);

            if (!isNaN(numValue) && numValue >= 0) {
              setExpiredInInput(sanitized);
              setExpiredIn(numValue);
            }
          }}
          onBlur={() => {
            // Ensure the display value matches the state
            setExpiredInInput(String(expiredIn));
          }}
          placeholder="Enter expiration years (0 for lifetime)"
          className="w-full text-black px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
        <ThemedText className="text-xs text-gray-500 mt-1">
          Enter 0 for lifetime (no expiration)
        </ThemedText>
      </div>

      {/* Attributes Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <ThemedText className="text-sm font-medium text-gray-900">
            Attributes<span className="text-red-500">*</span>
          </ThemedText>
          <div className="flex items-center gap-2">
            {selectedAttributeIds.length > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium flex items-center gap-2 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Delete Selected ({selectedAttributeIds.length})
              </button>
            )}
            <button
              onClick={handleAddAttribute}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium flex items-center gap-2 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              New Attribute
            </button>
          </div>
        </div>

        {/* Data Table */}
        <DataTable
          data={displayAttributes}
          columns={columns}
          searchPlaceholder="Search..."
          onSearch={handleSearch}
          enableSelection={true}
          onSelectionChange={handleSelectionChange}
          totalCount={displayAttributes.length}
          rowsPerPageOptions={[5, 10, 25, 50]}
          idKey="id"
          enableDragDrop={true}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          draggedIndex={draggedIndex}
        />
      </div>

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
          disabled={isSubmitting}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
        >
          {isSubmitting && (
            <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          )}
          {isSubmitting ? 'UPDATING...' : 'UPDATE SCHEMA'}
        </button>
      </div>
    </div>
  );
}
