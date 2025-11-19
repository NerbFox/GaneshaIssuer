'use client';

import { useState, useRef } from 'react';
import { ThemedText } from '@/components/shared/ThemedText';
import { DataTable, Column } from '@/components/shared/DataTable';
import { DateTimePicker } from '@/components/shared/DateTimePicker';
import DatePicker from '@/components/shared/DatePicker';
import TimePicker from '@/components/shared/TimePicker';
import CredentialPreview from '@/components/shared/CredentialPreview';
import { AttributePositionData, QRCodePosition } from '@/components/issuer/AttributePositionEditor';
import { formatDateTime } from '@/utils/dateUtils';

interface AttributeData {
  id: number;
  name: string;
  type: string;
  value: string | number | boolean;
  required?: boolean;
}

interface FillIssueRequestFormProps {
  requestId?: string;
  issuerDid?: string;
  holderDid?: string;
  schemaId?: string;
  schemaName?: string;
  version?: string;
  status?: string;
  expiredIn?: number;
  requestedAt?: string; // When the request was created
  createdAt?: string; // When the schema was created
  updatedAt?: string; // When the schema was updated
  imageUrl?: string;
  requestType?: string; // ISSUANCE, RENEWAL, UPDATE, REVOKE
  vcId?: string; // For UPDATE, RENEWAL, REVOKE requests
  initialAttributes?: AttributeData[];
  attributePositions?: AttributePositionData;
  qrCodePosition?: QRCodePosition;
  onSubmit: (data: IssueRequestFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  reason?: string;
}

export interface IssueRequestFormData {
  requestId: string;
  issuerDid: string;
  holderDid: string;
  schemaId: string;
  schemaVersion: number;
  attributes: Record<string, string>;
  imageBlob?: Blob; // Image blob for upload
}

export default function FillIssueRequestForm({
  requestId,
  issuerDid,
  holderDid,
  schemaId = 'ktp',
  schemaName = 'Kartu Tanda Penduduk',
  version = '1',
  expiredIn,
  requestedAt,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createdAt: _createdAt,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  updatedAt: _updatedAt,
  imageUrl,
  requestType = 'ISSUANCE',
  vcId,
  initialAttributes = [
    { id: 1, name: 'NIK', type: 'text', value: '', required: true },
    { id: 2, name: 'Nama', type: 'text', value: '', required: true },
    { id: 3, name: 'Tempat Lahir', type: 'text', value: '', required: false },
    { id: 4, name: 'Foto', type: 'image', value: '', required: false },
  ],
  attributePositions,
  qrCodePosition,
  onSubmit,
  onCancel,
  isSubmitting = false,
  reason,
}: FillIssueRequestFormProps) {
  const [attributes, setAttributes] = useState<AttributeData[]>(initialAttributes);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<Record<number, File>>({});
  const previewRef = useRef<HTMLDivElement>(null);

  // Store original attributes to detect changes (for UPDATE requests)
  const [originalAttributes] = useState<AttributeData[]>(initialAttributes);

  // Determine if fields should be disabled based on request type
  // RENEWAL: all fields disabled (attributes and amount unchangeable)
  // REVOKE: all fields disabled (attributes and amount unchangeable)
  // UPDATE: fields are editable but amount is unchangeable
  // ISSUANCE: all fields editable (default behavior)
  const isFieldsDisabled = requestType === 'RENEWAL' || requestType === 'REVOKE';

  // Check if attributes have changed (for UPDATE requests)
  const hasAttributesChanged = () => {
    if (requestType !== 'UPDATE') {
      return true; // For non-UPDATE requests, always allow submission
    }

    // Compare current attributes with original attributes
    return attributes.some((attr) => {
      const original = originalAttributes.find((o) => o.id === attr.id);
      if (!original) return true; // New attribute added
      // Convert both values to strings for comparison
      return String(attr.value) !== String(original.value);
    });
  };

  const handleAttributeValueChange = (id: number, value: string) => {
    setAttributes(attributes.map((attr) => (attr.id === id ? { ...attr, value } : attr)));
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

  const handleSubmit = async () => {
    try {
      // Validate required fields
      if (!requestId || !issuerDid || !holderDid) {
        console.error('Missing required fields');
        return;
      }

      // Convert attributes array to map
      const attributeMap: Record<string, string> = {};
      attributes.forEach((attr) => {
        attributeMap[attr.name] = String(attr.value);
      });

      // Generate image with QR placeholder (no QR example)
      const imageBlob = await generateImageBlob();

      if (!imageBlob) {
        throw new Error('Failed to generate image');
      }

      // Pass the image blob to the parent component
      await onSubmit({
        requestId,
        issuerDid,
        holderDid,
        schemaId,
        schemaVersion: Number(version),
        attributes: attributeMap,
        imageBlob, // Include the image blob
      });
    } catch {
      alert('Failed to prepare credential. Please try again.');
    }
  };

  // Generate Image Blob (without QR example, just placeholder)
  const generateImageBlob = async (): Promise<Blob | null> => {
    try {
      // Dynamically import html2canvas
      const { default: html2canvas } = await import('html2canvas');

      if (!previewRef.current) {
        return null;
      }

      // Find the credential container inside the preview
      const credentialElement = previewRef.current.querySelector(
        '.credential-container'
      ) as HTMLElement;

      if (!credentialElement) {
        return null;
      }

      // Temporarily hide QR code example for image generation
      // We need to create a clone and modify it
      const clone = credentialElement.cloneNode(true) as HTMLElement;

      // Find and replace QR code with white placeholder in the clone
      const qrElements = clone.querySelectorAll('svg');
      qrElements.forEach((svg) => {
        // Check if this is the QR code SVG (it has the black rectangles)
        const hasBlackRects = svg.querySelector('rect[fill="black"]');
        if (hasBlackRects) {
          // Replace with white div
          const whiteDiv = document.createElement('div');
          whiteDiv.style.width = '100%';
          whiteDiv.style.height = '100%';
          whiteDiv.style.backgroundColor = 'white';
          svg.parentElement?.replaceChild(whiteDiv, svg);
        }
      });

      // Temporarily add clone to DOM for html2canvas
      clone.style.position = 'absolute';
      clone.style.left = '-9999px';
      document.body.appendChild(clone);

      // Capture the clone as canvas
      const canvas = await html2canvas(clone, {
        scale: 2, // Higher quality
        useCORS: true, // Allow cross-origin images
        allowTaint: true,
        backgroundColor: null,
        logging: false,
      });

      // Remove the clone
      document.body.removeChild(clone);

      // Convert canvas to blob (PNG format)
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/png');
      });
    } catch {
      return null;
    }
  };

  // Check if all required fields are filled
  const isSubmitDisabled = () => {
    const missingRequired = attributes.filter(
      (attr) => attr.required && (!attr.value || attr.value === '')
    );

    // For UPDATE requests, also check if any attributes have changed
    const noChanges = requestType === 'UPDATE' && !hasAttributesChanged();

    return missingRequired.length > 0 || isSubmitting || noChanges;
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

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
                  <label className={isFieldsDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(row.id, e)}
                      className="hidden"
                      disabled={isFieldsDisabled}
                    />
                    <span
                      className={`text-sm font-medium ${
                        isFieldsDisabled
                          ? 'text-gray-400 cursor-not-allowed'
                          : 'text-blue-500 hover:text-blue-600'
                      }`}
                    >
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
                  disabled={isFieldsDisabled}
                  className={`w-full px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    isFieldsDisabled ? 'bg-gray-50 cursor-not-allowed' : ''
                  }`}
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
                    disabled={isFieldsDisabled}
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
                    disabled={isFieldsDisabled}
                  />
                </div>
              );

            case 'time':
              return (
                <div className="w-full">
                  <TimePicker
                    value={String(row.value) || ''}
                    onChange={(value) => handleAttributeValueChange(row.id, value)}
                    disabled={isFieldsDisabled}
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
                    // Only allow valid numbers
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
                    // Prevent non-numeric characters (except decimal point for float/decimal)
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
                  disabled={isFieldsDisabled}
                  className={`w-full px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    isFieldsDisabled ? 'bg-gray-50 cursor-not-allowed' : ''
                  }`}
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
                  disabled={isFieldsDisabled}
                  className={`w-full px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    isFieldsDisabled ? 'bg-gray-50 cursor-not-allowed' : ''
                  }`}
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
                  disabled={isFieldsDisabled}
                  className={`w-full px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    isFieldsDisabled ? 'bg-gray-50 cursor-not-allowed' : ''
                  }`}
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
                    // Only allow numbers, spaces, dashes, parentheses, and plus sign
                    if (/^[\d\s\-+()]*$/.test(value)) {
                      handleAttributeValueChange(row.id, value);
                    }
                  }}
                  placeholder={`Enter ${row.name}`}
                  disabled={isFieldsDisabled}
                  className={`w-full px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    isFieldsDisabled ? 'bg-gray-50 cursor-not-allowed' : ''
                  }`}
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
                  disabled={isFieldsDisabled}
                  className={`w-full px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${
                    isFieldsDisabled ? 'bg-gray-50 cursor-not-allowed' : ''
                  }`}
                />
              );

            default:
              // text, string, or any other type defaults to text input
              return (
                <input
                  type="text"
                  value={String(row.value)}
                  onChange={(e) => handleAttributeValueChange(row.id, e.target.value)}
                  placeholder={`Enter ${row.name}`}
                  disabled={isFieldsDisabled}
                  className={`w-full px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    isFieldsDisabled ? 'bg-gray-50 cursor-not-allowed' : ''
                  }`}
                />
              );
          }
        };

        return <div className="flex items-center gap-2 w-full">{renderInputField()}</div>;
      },
    },
  ];

  const filteredAttributes = attributes.filter((attr) =>
    attr.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatRequestedAt = (dateString: string) => {
    return formatDateTime(dateString);
  };

  // Calculate "Will Expire At" date
  const calculateExpiryDate = () => {
    if (!expiredIn || expiredIn === 0) return 'Lifetime';

    // Calculate expiry date by adding years to current date
    const now = new Date();
    const expiryDate = new Date(now);
    expiryDate.setFullYear(expiryDate.getFullYear() + expiredIn);

    return formatDateTime(expiryDate);
  };

  return (
    <div className="px-8 py-6">
      {/* Request/Credential Information Grid */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Request ID or Credential ID (for UPDATE/RENEWAL/REVOKE) */}
        {(requestId || vcId) && (
          <div className="col-span-2">
            <label className="block mb-2">
              <ThemedText className="text-sm font-medium text-gray-700">
                {vcId ? 'Credential ID' : 'Request ID'}
              </ThemedText>
            </label>
            <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
              {vcId || requestId}
            </div>
          </div>
        )}

        {/* Schema ID */}
        {schemaId && (
          <div className="col-span-2">
            <label className="block mb-2">
              <ThemedText className="text-sm font-medium text-gray-700">Schema ID</ThemedText>
            </label>
            <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
              {schemaId}
            </div>
          </div>
        )}

        {/* Schema Name */}
        <div>
          <label className="block mb-2">
            <ThemedText className="text-sm font-medium text-gray-700">Schema Name</ThemedText>
          </label>
          <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
            {schemaName}
          </div>
        </div>

        {/* Schema Version */}
        <div>
          <label className="block mb-2">
            <ThemedText className="text-sm font-medium text-gray-700">Schema Version</ThemedText>
          </label>
          <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
            {version}
          </div>
        </div>

        {/* Holder DID */}
        {holderDid && (
          <div className="col-span-2">
            <label className="block mb-2">
              <ThemedText className="text-sm font-medium text-gray-700">Holder DID</ThemedText>
            </label>
            <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
              {holderDid}
            </div>
          </div>
        )}

        {/* Issuer DID */}
        {issuerDid && (
          <div className="col-span-2">
            <label className="block mb-2">
              <ThemedText className="text-sm font-medium text-gray-700">Issuer DID</ThemedText>
            </label>
            <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
              {issuerDid}
            </div>
          </div>
        )}

        {/* Requested At */}
        {requestedAt && (
          <div>
            <label className="block mb-2">
              <ThemedText className="text-sm font-medium text-gray-700">Requested At</ThemedText>
            </label>
            <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
              {formatRequestedAt(requestedAt)}
            </div>
          </div>
        )}

        {/* Will Expired At */}
        <div>
          <label className="block mb-2">
            <ThemedText className="text-sm font-medium text-gray-700">Will Expired At</ThemedText>
          </label>
          <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
            {calculateExpiryDate()}
          </div>
        </div>
      </div>

      {/* Credential Preview Section */}
      {imageUrl && (
        <div className="mb-6 p-4 bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 rounded-lg">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <ThemedText className="text-sm font-semibold text-gray-900 block mb-1">
                Credential Preview
              </ThemedText>
              <ThemedText className="text-xs text-gray-600 block">
                Preview how the credential will look with the filled attribute values.
              </ThemedText>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div ref={previewRef}>
              <CredentialPreview
                imageUrl={imageUrl}
                positions={attributePositions || {}}
                qrPosition={qrCodePosition}
                showTitle={false}
                showQRCode={true}
                sampleData={attributes.reduce(
                  (acc, attr) => {
                    // Only use actual value if it exists and is not empty
                    const displayValue =
                      attr.value && String(attr.value).trim() !== '' ? String(attr.value) : '';
                    acc[attr.name] = displayValue;
                    return acc;
                  },
                  {} as Record<string, string>
                )}
              />
            </div>
          </div>
        </div>
      )}

      {reason && (
        <div className="mb-6">
          <label className="block mb-2">
            <ThemedText className="text-sm font-medium text-gray-700">Reason</ThemedText>
          </label>
          <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
            {reason}
          </div>
        </div>
      )}

      {/* Attributes Section */}
      <div className="mb-6">
        <div className="mb-4">
          <ThemedText className="text-sm font-medium text-gray-900">
            Attributes ({filteredAttributes.length})
          </ThemedText>
        </div>

        {/* Data Table */}
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

      {/* Action Buttons */}
      <div className="pt-4 border-t border-gray-200">
        {/* Warning message for UPDATE requests with no changes */}
        {requestType === 'UPDATE' && !hasAttributesChanged() && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <ThemedText className="text-sm text-yellow-800">
              ⚠️ No changes detected in attributes. Please modify at least one attribute to update
              the credential.
            </ThemedText>
          </div>
        )}

        <div className="flex justify-end gap-4">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            CANCEL
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitDisabled()}
            title={
              requestType === 'UPDATE' && !hasAttributesChanged()
                ? 'No changes detected in attributes'
                : undefined
            }
            className={`px-6 py-2 text-white rounded-lg transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
              requestType === 'REVOKE'
                ? 'bg-red-500 hover:bg-red-600'
                : requestType === 'UPDATE'
                  ? 'bg-green-500 hover:bg-green-600'
                  : requestType === 'RENEWAL'
                    ? 'bg-purple-500 hover:bg-purple-600'
                    : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {isSubmitting && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            )}
            {isSubmitting
              ? requestType === 'RENEWAL'
                ? 'RENEWING...'
                : requestType === 'UPDATE'
                  ? 'UPDATING...'
                  : requestType === 'REVOKE'
                    ? 'REVOKING...'
                    : 'ISSUING...'
              : requestType === 'RENEWAL'
                ? 'RENEW CREDENTIAL'
                : requestType === 'UPDATE'
                  ? 'UPDATE CREDENTIAL'
                  : requestType === 'REVOKE'
                    ? 'REVOKE CREDENTIAL'
                    : 'ISSUE CREDENTIAL'}
          </button>
        </div>
      </div>
    </div>
  );
}
