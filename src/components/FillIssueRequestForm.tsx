'use client';

import { useState } from 'react';
import { ThemedText } from './ThemedText';
import { DataTable, Column } from './DataTable';

interface AttributeData {
  id: number;
  name: string;
  type: string;
  value: string;
}

interface FillIssueRequestFormProps {
  schemaId?: string;
  schemaName?: string;
  version?: string;
  status?: string;
  initialAttributes?: AttributeData[];
  onSubmit: (data: IssueRequestFormData) => void;
  onCancel: () => void;
}

export interface IssueRequestFormData {
  schemaId: string;
  schemaName: string;
  version: string;
  status: string;
  attributes: AttributeData[];
}

export default function FillIssueRequestForm({
  schemaId = 'ktp',
  schemaName = 'Kartu Tanda Penduduk',
  version = '1',
  status = 'Active',
  initialAttributes = [
    { id: 1, name: 'NIK', type: 'text', value: '' },
    { id: 2, name: 'Nama', type: 'text', value: '' },
    { id: 3, name: 'Tempat Lahir', type: 'text', value: '' },
    { id: 4, name: 'Foto', type: 'image', value: '' },
  ],
  onSubmit,
  onCancel,
}: FillIssueRequestFormProps) {
  const [attributes, setAttributes] = useState<AttributeData[]>(initialAttributes);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<Record<number, File>>({});

  const handleAttributeValueChange = (id: number, value: string) => {
    setAttributes(
      attributes.map((attr) => (attr.id === id ? { ...attr, value } : attr))
    );
  };

  const handleFileUpload = (id: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFiles({ ...uploadedFiles, [id]: file });
      // Update the value to show file name
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
      // Create a URL for the file and open it
      const url = URL.createObjectURL(file);
      window.open(url, '_blank');
    }
  };

  const handleSubmit = () => {
    onSubmit({
      schemaId,
      schemaName,
      version,
      status,
      attributes,
    });
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

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
              value={row.value}
              onChange={(e) => handleAttributeValueChange(row.id, e.target.value)}
              placeholder={`Enter ${row.name}`}
              className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          )}
        </div>
      ),
    },
  ];

  const filteredAttributes = attributes.filter((attr) =>
    attr.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="px-8 py-6">
      {/* Schema Information */}
      <div className="mb-6">
        <ThemedText className="text-sm text-gray-600 mb-2">Schema ID</ThemedText>
        <div className="px-4 py-3 bg-gray-50 rounded-lg">
          <ThemedText className="text-sm text-gray-900">{schemaId}</ThemedText>
        </div>
      </div>

      <div className="mb-6">
        <div>
          <ThemedText className="text-sm text-gray-600 mb-2">Schema Name</ThemedText>
          <div className="px-4 py-3 bg-gray-50 rounded-lg">
            <ThemedText className="text-sm text-gray-900">{schemaName}</ThemedText>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <ThemedText className="text-sm text-gray-600 mb-2">Version</ThemedText>
          <div className="px-4 py-3 bg-gray-50 rounded-lg">
            <ThemedText className="text-sm text-gray-900">{version}</ThemedText>
          </div>
        </div>
        <div>
          <ThemedText className="text-sm text-gray-600 mb-2">Status</ThemedText>
          <div className="px-4 py-3 bg-gray-50 rounded-lg">
            <ThemedText className="text-sm text-gray-900">{status}</ThemedText>
          </div>
        </div>
      </div>

      {/* Attributes Section */}
      <div className="mb-6">
        <ThemedText className="text-sm font-semibold text-gray-900 mb-4">
          Attributes<span className="text-red-500">*</span>
        </ThemedText>

        {/* Data Table */}
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

      {/* Action Buttons */}
      <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
        <button
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
        >
          CANCEL
        </button>
        <button
          onClick={handleSubmit}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
        >
          ISSUE CREDENTIAL
        </button>
      </div>
    </div>
  );
}
