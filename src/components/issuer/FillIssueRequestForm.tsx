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
  holderReason?: string;
  changedAttributes?: Record<string, string | number | boolean>; // For UPDATE requests
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

// Validation function for different field types
const validateFieldValue = (
  value: string | number | boolean,
  type: string,
  required?: boolean
): { isValid: boolean; error?: string } => {
  const stringValue = String(value);

  // Check if field is required and empty
  if (required && (!stringValue || stringValue.trim() === '')) {
    return { isValid: false, error: 'This field is required' };
  }

  // Allow empty values for non-required fields
  if (!stringValue || stringValue.trim() === '') {
    return { isValid: true };
  }

  switch (type.toLowerCase()) {
    case 'number':
    case 'integer':
    case 'float':
    case 'decimal': {
      const numValue = Number(stringValue);
      if (isNaN(numValue)) {
        return { isValid: false, error: 'Must be a valid number' };
      }
      if (type.toLowerCase() === 'integer' && !Number.isInteger(numValue)) {
        return { isValid: false, error: 'Must be a whole number' };
      }
      return { isValid: true };
    }

    case 'email': {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(stringValue)) {
        return { isValid: false, error: 'Must be a valid email address' };
      }
      return { isValid: true };
    }

    case 'url':
    case 'uri': {
      try {
        const url = new URL(stringValue);
        if (type.toLowerCase() === 'url' && !['http:', 'https:'].includes(url.protocol)) {
          return { isValid: false, error: 'URL must start with http:// or https://' };
        }
        return { isValid: true };
      } catch {
        return { isValid: false, error: 'Must be a valid URL' };
      }
    }

    case 'tel':
    case 'phone': {
      const phoneRegex = /^[\d\s\-\+\(\)]+$/;
      if (!phoneRegex.test(stringValue)) {
        return { isValid: false, error: 'Must be a valid phone number' };
      }
      const digitsOnly = stringValue.replace(/\D/g, '');
      if (digitsOnly.length < 7) {
        return { isValid: false, error: 'Phone number too short (minimum 7 digits)' };
      }
      return { isValid: true };
    }

    case 'date': {
      const dateValue = new Date(stringValue);
      if (isNaN(dateValue.getTime())) {
        return { isValid: false, error: 'Must be a valid date' };
      }
      return { isValid: true };
    }

    case 'datetime':
    case 'datetime-local': {
      const dateValue = new Date(stringValue);
      if (isNaN(dateValue.getTime())) {
        return { isValid: false, error: 'Must be a valid date and time' };
      }
      return { isValid: true };
    }

    case 'time': {
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;
      if (!timeRegex.test(stringValue)) {
        return { isValid: false, error: 'Must be a valid time (HH:MM)' };
      }
      return { isValid: true };
    }

    case 'boolean': {
      const lowerValue = stringValue.toLowerCase();
      if (!['true', 'false', '1', '0', 'yes', 'no'].includes(lowerValue)) {
        return { isValid: false, error: 'Must be true or false' };
      }
      return { isValid: true };
    }

    default:
      return { isValid: true };
  }
};

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
  holderReason,
  changedAttributes,
}: FillIssueRequestFormProps) {
  const [attributes, setAttributes] = useState<AttributeData[]>(initialAttributes);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<Record<number, File>>({});
  const [validationErrors, setValidationErrors] = useState<Record<number, string>>({});
  const previewRef = useRef<HTMLDivElement>(null);

  // Determine if fields should be disabled based on request type
  // UPDATE: all fields disabled (showing data from API, read-only)
  // RENEWAL: all fields disabled (attributes and amount unchangeable)
  // REVOKE: all fields disabled (attributes and amount unchangeable)
  // ISSUANCE: all fields editable (default behavior)
  const isFieldsDisabled =
    requestType === 'UPDATE' || requestType === 'RENEWAL' || requestType === 'REVOKE';

  const handleAttributeValueChange = (id: number, value: string) => {
    setAttributes(
      attributes.map((attr) => {
        if (attr.id === id) {
          // Validate the new value
          const validation = validateFieldValue(value, attr.type, attr.required);

          // Update validation errors
          setValidationErrors((prev) => {
            const newErrors = { ...prev };
            if (validation.isValid) {
              delete newErrors[id];
            } else {
              newErrors[id] = validation.error || 'Invalid value';
            }
            return newErrors;
          });

          return { ...attr, value };
        }
        return attr;
      })
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
        // For UPDATE requests, use the requested value (from changedAttributes) if it exists
        // Otherwise, use the current value
        if (
          requestType === 'UPDATE' &&
          changedAttributes &&
          changedAttributes[attr.name] !== undefined
        ) {
          attributeMap[attr.name] = String(changedAttributes[attr.name]);
        } else {
          attributeMap[attr.name] = String(attr.value);
        }
      });

      // Generate image with QR placeholder using jsPDF
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
    } catch (error) {
      console.error('❌ Failed to prepare credential:', error);
      alert('Failed to prepare credential. Please try again.');
    }
  };

  // Generate Image Blob using Konva.js (consistent canvas rendering)
  const generateImageBlob = async (): Promise<Blob | null> => {
    try {
      // Import the Konva-based credential image generator and high-res config
      const { generateCredentialImageKonva, HIGH_RES_RENDERING_CONFIG } =
        await import('@/utils/pdfGenerator');

      if (!imageUrl || !attributePositions) {
        console.error('Missing required data for image generation');
        console.error('imageUrl:', imageUrl);
        console.error('attributePositions:', attributePositions);
        return null;
      }

      // Prepare attribute data from current form values
      const attributeData: Record<string, string> = {};
      attributes.forEach((attr) => {
        // Use changed attributes if available (UPDATE requests), otherwise use current values
        if (
          requestType === 'UPDATE' &&
          changedAttributes &&
          changedAttributes[attr.name] !== undefined
        ) {
          attributeData[attr.name] = String(changedAttributes[attr.name]);
        } else {
          attributeData[attr.name] = String(attr.value);
        }
      });

      console.log('🎨 Generating high-resolution credential image with Konva...');
      console.log('Image URL:', imageUrl);
      console.log('Attributes:', attributeData);
      console.log('Positions:', attributePositions);

      // Generate high-resolution image using Konva (no QR for initial image)
      // Using HIGH_RES_RENDERING_CONFIG for print-quality output
      const pngBlob = await generateCredentialImageKonva(
        imageUrl,
        attributePositions,
        attributeData,
        qrCodePosition,
        undefined, // No VP ID yet, QR will be added later when presenting
        HIGH_RES_RENDERING_CONFIG // Use high-resolution configuration
      );

      console.log('✅ High-resolution Konva image generated successfully');
      return pngBlob;
    } catch (error) {
      console.error('❌ Failed to generate credential image:', error);
      return null;
    }
  };

  // Check if all required fields are filled and there are no validation errors
  const isSubmitDisabled = () => {
    const missingRequired = attributes.filter(
      (attr) => attr.required && (!attr.value || attr.value === '')
    );

    // Check if there are any validation errors
    const hasValidationErrors = Object.keys(validationErrors).length > 0;

    // For UPDATE requests with read-only fields, allow submission
    // (the attributes are from IndexedDB and the holder's requested changes are shown separately)
    return missingRequired.length > 0 || hasValidationErrors || isSubmitting;
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
        // For disabled fields (UPDATE, RENEWAL, REVOKE), show read-only display like View Credential
        if (isFieldsDisabled) {
          return (
            <ThemedText className="text-sm text-gray-900">
              {row.value ? String(row.value) : <em className="text-gray-400">(empty)</em>}
            </ThemedText>
          );
        }

        // For editable fields (ISSUANCE), render appropriate input based on type
        const hasError = !!validationErrors[row.id];
        const errorMessage = validationErrors[row.id];

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
                  disabled={isFieldsDisabled}
                  className={`w-full px-3 py-2 text-sm text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    isFieldsDisabled ? 'bg-gray-50 cursor-not-allowed' : ''
                  } ${hasError ? 'border-2 border-red-500' : 'border border-gray-200'}`}
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
                    hasError={hasError}
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
                    hasError={hasError}
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
                    hasError={hasError}
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
                  className={`w-full px-3 py-2 text-sm text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    isFieldsDisabled ? 'bg-gray-50 cursor-not-allowed' : ''
                  } ${hasError ? 'border-2 border-red-500' : 'border border-gray-200'}`}
                />
              );

            case 'email':
              return (
                <input
                  type="email"
                  value={String(row.value)}
                  onChange={(e) => handleAttributeValueChange(row.id, e.target.value)}
                  placeholder={isFieldsDisabled ? '' : `Enter ${row.name}`}
                  disabled={isFieldsDisabled}
                  className={`w-full px-3 py-2 text-sm text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    isFieldsDisabled ? 'bg-gray-50 cursor-not-allowed' : ''
                  } ${hasError ? 'border-2 border-red-500' : 'border border-gray-200'}`}
                />
              );

            case 'url':
            case 'uri':
              return (
                <input
                  type="url"
                  value={String(row.value)}
                  onChange={(e) => handleAttributeValueChange(row.id, e.target.value)}
                  placeholder={isFieldsDisabled ? '' : `Enter ${row.name}`}
                  disabled={isFieldsDisabled}
                  className={`w-full px-3 py-2 text-sm text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    isFieldsDisabled ? 'bg-gray-50 cursor-not-allowed' : ''
                  } ${hasError ? 'border-2 border-red-500' : 'border border-gray-200'}`}
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
                  placeholder={isFieldsDisabled ? '' : `Enter ${row.name}`}
                  disabled={isFieldsDisabled}
                  className={`w-full px-3 py-2 text-sm text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    isFieldsDisabled ? 'bg-gray-50 cursor-not-allowed' : ''
                  } ${hasError ? 'border-2 border-red-500' : 'border border-gray-200'}`}
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
                  className={`w-full px-3 py-2 text-sm text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${
                    isFieldsDisabled ? 'bg-gray-50 cursor-not-allowed' : ''
                  } ${hasError ? 'border-2 border-red-500' : 'border border-gray-200'}`}
                />
              );

            default:
              // text, string, or any other type defaults to text input
              return (
                <input
                  type="text"
                  value={String(row.value)}
                  onChange={(e) => handleAttributeValueChange(row.id, e.target.value)}
                  placeholder={isFieldsDisabled ? '' : `Enter ${row.name}`}
                  disabled={isFieldsDisabled}
                  className={`w-full px-3 py-2 text-sm text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    isFieldsDisabled ? 'bg-gray-50 cursor-not-allowed' : ''
                  } ${hasError ? 'border-2 border-red-500' : 'border border-gray-200'}`}
                />
              );
          }
        };

        return (
          <div className="w-full">
            <div className="flex items-center gap-2 w-full">{renderInputField()}</div>
            {hasError && (
              <div className="mt-1">
                <span className="text-sm text-red-500">{errorMessage}</span>
              </div>
            )}
          </div>
        );
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

      {/* Attributes Section */}
      <div className="mb-6">
        {/* Holder Reason (if present) */}
        {holderReason && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <span className="font-semibold text-yellow-800">Reason:</span>
            <span className="ml-2 text-yellow-900">{holderReason}</span>
          </div>
        )}

        {requestType === 'UPDATE' &&
        changedAttributes &&
        Object.keys(changedAttributes).length > 0 ? (
          // Merged table for UPDATE requests showing both current and requested values
          <>
            <div className="mb-4">
              <ThemedText className="text-sm font-medium text-gray-900">
                Attributes ({filteredAttributes.length})
              </ThemedText>
            </div>
            <DataTable
              data={filteredAttributes.map((attr) => ({
                ...attr,
                currentValue: attr.value,
                requestedValue:
                  changedAttributes[attr.name] !== undefined
                    ? changedAttributes[attr.name]
                    : attr.value,
                isChanged: changedAttributes[attr.name] !== undefined,
              }))}
              columns={[
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
                  id: 'currentValue',
                  label: 'CURRENT VALUE',
                  render: (row) => {
                    const value = String(row.currentValue);

                    // Helper function to format datetime display
                    const formatDateTimeValue = (val: string) => {
                      if (!val) return '';
                      try {
                        const [datePart, timePart] = val.split('T');
                        if (datePart) {
                          const date = new Date(datePart + 'T00:00:00');
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const day = String(date.getDate()).padStart(2, '0');
                          const year = date.getFullYear();
                          let displayValue = `${month}/${day}/${year}`;
                          if (timePart) {
                            displayValue += ` ${timePart}`;
                          }
                          return displayValue;
                        }
                      } catch {
                        return val;
                      }
                      return val;
                    };

                    // Helper function to format date display
                    const formatDateValue = (val: string) => {
                      if (!val) return '';
                      try {
                        const date = new Date(val + 'T00:00:00');
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        const year = date.getFullYear();
                        return `${month}/${day}/${year}`;
                      } catch {
                        return val;
                      }
                    };

                    let displayValue = value;
                    if (
                      row.type.toLowerCase() === 'datetime' ||
                      row.type.toLowerCase() === 'datetime-local'
                    ) {
                      displayValue = formatDateTimeValue(value);
                    } else if (row.type.toLowerCase() === 'date') {
                      displayValue = formatDateValue(value);
                    }

                    return (
                      <div className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg min-h-[38px] flex items-center text-gray-900">
                        {displayValue}
                      </div>
                    );
                  },
                },
                {
                  id: 'requestedValue',
                  label: 'REQUESTED VALUE',
                  render: (row) => {
                    const isChanged = (row as AttributeData & { isChanged?: boolean }).isChanged;
                    const value = String(row.requestedValue);

                    // Helper function to format datetime display
                    const formatDateTimeValue = (val: string) => {
                      if (!val) return '';
                      try {
                        const [datePart, timePart] = val.split('T');
                        if (datePart) {
                          const date = new Date(datePart + 'T00:00:00');
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const day = String(date.getDate()).padStart(2, '0');
                          const year = date.getFullYear();
                          let displayValue = `${month}/${day}/${year}`;
                          if (timePart) {
                            displayValue += ` ${timePart}`;
                          }
                          return displayValue;
                        }
                      } catch {
                        return val;
                      }
                      return val;
                    };

                    // Helper function to format date display
                    const formatDateValue = (val: string) => {
                      if (!val) return '';
                      try {
                        const date = new Date(val + 'T00:00:00');
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        const year = date.getFullYear();
                        return `${month}/${day}/${year}`;
                      } catch {
                        return val;
                      }
                    };

                    let displayValue = value;
                    if (
                      row.type.toLowerCase() === 'datetime' ||
                      row.type.toLowerCase() === 'datetime-local'
                    ) {
                      displayValue = formatDateTimeValue(value);
                    } else if (row.type.toLowerCase() === 'date') {
                      displayValue = formatDateValue(value);
                    }

                    return (
                      <div
                        className={`w-full px-3 py-2 text-sm rounded-lg min-h-[38px] flex items-center ${
                          isChanged
                            ? 'bg-yellow-50 border-2 border-yellow-400 text-gray-900 font-medium'
                            : 'bg-gray-50 border border-gray-200 text-gray-900'
                        }`}
                      >
                        {displayValue}
                      </div>
                    );
                  },
                },
              ]}
              searchPlaceholder="Search attributes..."
              onSearch={handleSearch}
              enableSelection={false}
              totalCount={filteredAttributes.length}
              hideBottomControls={true}
              rowsPerPageOptions={[1000]}
              idKey="id"
            />
          </>
        ) : (
          // Standard single table for other request types
          <>
            <div className="mb-4">
              <ThemedText className="text-sm font-medium text-gray-900">
                Attributes ({filteredAttributes.length})
              </ThemedText>
            </div>
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
          </>
        )}
      </div>

      {/* Action Buttons */}
      <div className="pt-4 border-t border-gray-200">
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
