'use client';

import { useState, useEffect, useRef } from 'react';
import { ThemedText } from './ThemedText';
import { DataTable, Column } from './DataTable';
import Modal from './Modal';
import AttributePositionEditor, {
  AttributePositionData,
  QRCodePosition,
} from './AttributePositionEditor';
import CredentialPreview from './CredentialPreview';

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
    expiredIn?: number;
    schemaDetails?: {
      properties: Record<
        string,
        { type: string; x?: number; y?: number; width?: number; height?: number; fontSize?: number }
      >;
      required: string[];
      attribute_positions?: AttributePositionData;
      qr_code_position?: QRCodePosition;
    };
  };
  imageUrl?: string; // Optional existing image URL from API
}

export interface SchemaFormData {
  schemaId: string;
  expiredIn: number;
  attributes: Attribute[];
  image?: File;
  image_link?: string; // URL of existing image to keep
  attributePositions?: AttributePositionData;
  qrCodePosition?: QRCodePosition;
}

export default function UpdateSchemaForm({
  onSubmit,
  onCancel,
  initialData,
  imageUrl,
}: UpdateSchemaFormProps) {
  const [schemaId, setSchemaId] = useState('');
  const [schemaName, setSchemaName] = useState('');
  const [version, setVersion] = useState('1');
  const [expiredIn, setExpiredIn] = useState<number>(0);
  const [expiredInInput, setExpiredInInput] = useState<string>('0');
  const [vcBackgroundImage, setVcBackgroundImage] = useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string>('');
  const [originalImageUrl, setOriginalImageUrl] = useState<string>('');
  const [hasImageChanged, setHasImageChanged] = useState<boolean>(false);
  const [imageError, setImageError] = useState<string>('');
  const [imageLoading, setImageLoading] = useState<boolean>(false);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAttributeIds, setSelectedAttributeIds] = useState<(string | number)[]>([]);
  const [attributePositions, setAttributePositions] = useState<AttributePositionData>({});
  const [qrCodePosition, setQrCodePosition] = useState<QRCodePosition>({ x: 80, y: 80, size: 15 });
  const [showPositionEditor, setShowPositionEditor] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [initialExpiredIn, setInitialExpiredIn] = useState<number>(0);
  const [initialAttributes, setInitialAttributes] = useState<Attribute[]>([]);
  const [initialPositions, setInitialPositions] = useState<AttributePositionData>({});
  const [initialQRPosition, setInitialQRPosition] = useState<QRCodePosition>({
    x: 80,
    y: 80,
    size: 15,
  });

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
        setInitialExpiredIn(initialData.expiredIn);
      }

      if (initialData.schemaDetails) {
        const loadedAttributes: Attribute[] = [];
        const loadedPositions: AttributePositionData = {};

        Object.entries(initialData.schemaDetails.properties).forEach(([name, config], index) => {
          // Add attribute
          loadedAttributes.push({
            id: index + 1,
            name,
            type: (config as { type: string }).type,
            description: '',
            required: initialData.schemaDetails!.required.includes(name),
          });

          // Extract position data if exists
          const propConfig = config as {
            type: string;
            x?: number;
            y?: number;
            width?: number;
            height?: number;
            fontSize?: number;
          };

          if (propConfig.x !== undefined && propConfig.y !== undefined) {
            loadedPositions[name] = {
              x: propConfig.x,
              y: propConfig.y,
              width: propConfig.width || 30,
              height: propConfig.height || 5,
              fontSize: propConfig.fontSize || 16,
            };
          }
        });

        setAttributes(loadedAttributes);
        setInitialAttributes(JSON.parse(JSON.stringify(loadedAttributes)));

        // Load attribute positions from attribute_positions if available, otherwise from properties
        const finalPositions = initialData.schemaDetails.attribute_positions || loadedPositions;
        setAttributePositions(finalPositions);
        setInitialPositions(JSON.parse(JSON.stringify(finalPositions)));

        // Load QR code position from qr_code_position if available
        if (initialData.schemaDetails.qr_code_position) {
          setQrCodePosition(initialData.schemaDetails.qr_code_position);
          setInitialQRPosition(
            JSON.parse(JSON.stringify(initialData.schemaDetails.qr_code_position))
          );
        } else {
          // Reset to default if no QR position exists
          const defaultQR = { x: 80, y: 80, size: 15 };
          setQrCodePosition(defaultQR);
          setInitialQRPosition(JSON.parse(JSON.stringify(defaultQR)));
        }
      } else {
        setAttributes([]);
        setInitialAttributes([]);
        setAttributePositions({});
        setInitialPositions({});
      }
    }
  }, [initialData]);

  // Set preview from existing image URL
  useEffect(() => {
    if (imageUrl && !vcBackgroundImage) {
      setPreviewSrc(imageUrl);
      setOriginalImageUrl(imageUrl);
      setHasImageChanged(false);
    }
  }, [imageUrl, vcBackgroundImage]);

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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) {
      setVcBackgroundImage(null);
      setPreviewSrc('');
      setImageLoading(false);
      return;
    }

    // Validate file size (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setImageError(`Image too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 5MB.`);
      setVcBackgroundImage(null);
      setPreviewSrc('');
      setImageLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate file type
    if (!file.type.match(/^image\/(jpeg|jpg|png|gif|webp)$/i)) {
      setImageError('Only JPG, PNG, GIF, and WebP images are allowed.');
      setVcBackgroundImage(null);
      setPreviewSrc('');
      setImageLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Clear previous error and set loading
    setImageError('');
    setImageLoading(true);

    setVcBackgroundImage(file);
    setHasImageChanged(true);

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setPreviewSrc(result);
      setImageLoading(false);
    };
    reader.onerror = () => {
      setImageError('Failed to read image file');
      setVcBackgroundImage(null);
      setPreviewSrc('');
      setImageLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setVcBackgroundImage(null);
    setPreviewSrc('');
    setImageError('');
    setImageLoading(false);
    setHasImageChanged(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];

      // Validate file size (5MB)
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        setImageError(`Image too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 5MB.`);
        return;
      }

      // Validate file type
      if (!file.type.match(/^image\/(jpeg|jpg|png|gif|webp)$/i)) {
        setImageError('Only JPG, PNG, GIF, and WebP images are allowed.');
        return;
      }

      // Clear previous error and set loading
      setImageError('');
      setImageLoading(true);

      setVcBackgroundImage(file);
      setHasImageChanged(true);

      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPreviewSrc(result);
        setImageLoading(false);
      };
      reader.onerror = () => {
        setImageError('Failed to read image file');
        setVcBackgroundImage(null);
        setPreviewSrc('');
        setImageLoading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRevertImage = () => {
    if (originalImageUrl) {
      setPreviewSrc(originalImageUrl);
      setVcBackgroundImage(null);
      setHasImageChanged(false);
      setImageError('');
      setImageLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAttributeChange = (
    id: number,
    field: 'name' | 'type' | 'description' | 'required',
    value: string | boolean
  ) => {
    setAttributes(attributes.map((attr) => (attr.id === id ? { ...attr, [field]: value } : attr)));
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const submitData = {
        schemaId,
        expiredIn,
        attributes,
        image: vcBackgroundImage || undefined,
        // Include image_link when keeping existing image (no new image uploaded and original image exists)
        image_link: !vcBackgroundImage && originalImageUrl ? originalImageUrl : undefined,
        attributePositions,
        qrCodePosition,
      };

      await onSubmit(submitData);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Validation function
  const isFormValid = () => {
    if (attributes.length === 0) {
      return false;
    }

    const allAttributesHaveNames = attributes.every((attr) => attr.name.trim() !== '');
    if (!allAttributesHaveNames) {
      return false;
    }

    // Check if image exists (either new upload or existing preview)
    if (!vcBackgroundImage && !previewSrc) {
      return false;
    }

    // Check if QR code position is configured (required)
    if (!qrCodePosition) {
      return false;
    }

    return true;
  };

  const hasDataChanged = () => {
    if (expiredIn !== initialExpiredIn) {
      return true;
    }

    if (hasImageChanged) {
      return true;
    }

    if (attributes.length !== initialAttributes.length) {
      return true;
    }

    const attributesChanged = attributes.some((attr) => {
      const initialAttr = initialAttributes.find((initial) => initial.name === attr.name);
      if (!initialAttr) return true;
      return (
        attr.type !== initialAttr.type ||
        attr.description !== initialAttr.description ||
        attr.required !== initialAttr.required
      );
    });

    if (attributesChanged) {
      return true;
    }

    // Check if positions changed
    const currentPositionKeys = Object.keys(attributePositions).sort();
    const initialPositionKeys = Object.keys(initialPositions).sort();

    if (currentPositionKeys.length !== initialPositionKeys.length) {
      return true;
    }

    const positionsChanged = currentPositionKeys.some((key) => {
      const current = attributePositions[key];
      const initial = initialPositions[key];

      if (!initial) return true;

      return (
        current.x !== initial.x ||
        current.y !== initial.y ||
        current.width !== initial.width ||
        current.height !== initial.height ||
        current.fontSize !== initial.fontSize
      );
    });

    if (positionsChanged) {
      return true;
    }

    // Check if QR code position changed
    const qrPositionChanged =
      qrCodePosition.x !== initialQRPosition.x ||
      qrCodePosition.y !== initialQRPosition.y ||
      qrCodePosition.size !== initialQRPosition.size;

    return qrPositionChanged;
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
          className="w-full px-2 py-1 border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded text-sm cursor-pointer"
        >
          <option value="string">string</option>
          <option value="number">number</option>
          <option value="integer">integer</option>
          <option value="boolean">boolean</option>
          <option value="date">date</option>
          <option value="datetime">datetime</option>
          <option value="time">time</option>
          <option value="email">email</option>
          <option value="url">url</option>
          <option value="uri">uri</option>
          <option value="phone">phone</option>
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
          <ThemedText className="text-sm font-medium text-gray-900">Schema ID</ThemedText>
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
          <ThemedText className="text-sm font-medium text-gray-900">Schema Name</ThemedText>
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

      {/* VC Background Image */}
      <div className="mb-6">
        <label className="block mb-3">
          <ThemedText className="text-sm font-semibold text-gray-900">
            Credential Template Image<span className="text-red-500">*</span>
          </ThemedText>
        </label>

        {imageLoading ? (
          <div className="w-full h-56 rounded-xl border-2 border-blue-200 shadow-md bg-gray-100 flex items-center justify-center">
            <div className="text-center">
              <svg
                className="animate-spin h-10 w-10 text-blue-500 mx-auto mb-2"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <p className="text-sm text-gray-600">Loading image...</p>
            </div>
          </div>
        ) : previewSrc ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewSrc}
              alt="VC Background Preview"
              className="w-full h-auto max-h-96 object-contain rounded-xl border-2 border-blue-200 shadow-md block bg-gray-50"
              onError={() => {
                setImageError('Failed to display image preview');
                setPreviewSrc('');
              }}
            />
            {hasImageChanged ? (
              <div className="absolute top-3 left-3 bg-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-md flex items-center space-x-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 20 20">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                <span>Preview</span>
              </div>
            ) : (
              <div className="absolute top-3 left-3 bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-md flex items-center space-x-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Uploaded</span>
              </div>
            )}
            <div className="absolute top-3 right-3 flex items-center space-x-2">
              {hasImageChanged && originalImageUrl && (
                <button
                  type="button"
                  onClick={handleRevertImage}
                  className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 shadow-lg font-medium text-sm flex items-center space-x-2 cursor-pointer"
                  title="Revert to original image"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                    />
                  </svg>
                  <span>Revert</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleRemoveImage}
                className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 shadow-lg font-medium text-sm flex items-center space-x-2 cursor-pointer"
                title="Remove image"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                <span>Remove</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <label
              className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-blue-300 rounded-xl cursor-pointer bg-blue-50 hover:bg-blue-100 transition-colors duration-200"
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <svg
                  className="w-10 h-10 mb-3 text-blue-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <p className="mb-2 text-sm text-blue-600 font-medium">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-blue-500">PNG, JPG, GIF, WebP up to 5MB</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handleImageChange}
                className="hidden"
              />
            </label>
            {hasImageChanged && originalImageUrl && (
              <button
                type="button"
                onClick={handleRevertImage}
                className="absolute top-3 right-3 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 shadow-lg font-medium text-sm flex items-center space-x-2 cursor-pointer"
                title="Revert to original image"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                  />
                </svg>
                <span>Revert</span>
              </button>
            )}
          </div>
        )}

        <ThemedText className="text-xs text-gray-500 mt-3">
          This image will be used as the template for digital credentials and card background
        </ThemedText>

        {imageError && (
          <div className="mt-2 flex items-center text-red-500">
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm">{imageError}</span>
          </div>
        )}
      </div>

      {/* Credential Position Configuration */}
      {previewSrc && (
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <ThemedText className="text-xs text-gray-600 mb-3">
                <span className="font-semibold text-gray-900">
                  Digital Credential Configuration
                </span>
                <br />
                Configure how attributes will be displayed on the digital credential.
                <br />
                Position each attribute on the template image so holders can view a professional
                digital version.
              </ThemedText>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPositionEditor(true)}
                  disabled={attributes.length === 0 || attributes.some((attr) => !attr.name.trim())}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium flex items-center gap-2 cursor-pointer disabled:bg-gray-300 disabled:cursor-not-allowed disabled:hover:bg-gray-300"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  Configure Positions
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreview(true)}
                  disabled={!vcBackgroundImage && !previewSrc}
                  className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  title={
                    !vcBackgroundImage && !previewSrc
                      ? 'Upload an image first to see preview'
                      : 'Preview digital credential'
                  }
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                  Preview Credential
                </button>
              </div>
            </div>
            <div className="ml-4">
              {Object.keys(attributePositions).length > 0 ? (
                <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-2 rounded-lg">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-xs font-medium">
                    {Object.keys(attributePositions).length} Configured
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-yellow-600 bg-yellow-50 px-3 py-2 rounded-lg">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-xs font-medium">Not Configured</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
          hideBottomControls={true}
          rowsPerPageOptions={[1000]}
          idKey="id"
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
          disabled={isSubmitting || !isFormValid() || !hasDataChanged()}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
          title={
            !isFormValid()
              ? attributes.length === 0
                ? 'Please add at least one attribute'
                : !attributes.every((attr) => attr.name.trim() !== '')
                  ? 'All attributes must have names'
                  : !vcBackgroundImage && !previewSrc
                    ? 'Please upload a credential template image'
                    : ''
              : !hasDataChanged()
                ? 'No changes detected'
                : ''
          }
        >
          {isSubmitting && (
            <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          )}
          {isSubmitting ? 'UPDATING...' : 'UPDATE SCHEMA'}
        </button>
      </div>

      {/* Position Editor Modal */}
      <Modal
        isOpen={showPositionEditor}
        onClose={() => setShowPositionEditor(false)}
        title="Configure Attribute Positions"
        maxWidth="95vw"
      >
        <AttributePositionEditor
          attributes={attributes}
          imageUrl={previewSrc}
          initialPositions={attributePositions}
          initialQRPosition={qrCodePosition}
          onSave={(data) => {
            setAttributePositions(data.attributes);
            setQrCodePosition(data.qrCode);
            setShowPositionEditor(false);
          }}
          onCancel={() => setShowPositionEditor(false)}
        />
      </Modal>

      {/* Preview Modal */}
      <Modal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        title="Credential Preview"
        maxWidth="900px"
      >
        <div className="p-6">
          <CredentialPreview
            imageUrl={previewSrc}
            positions={attributePositions}
            qrPosition={qrCodePosition}
            sampleData={attributes.reduce(
              (acc, attr) => {
                acc[attr.name] = `Sample ${attr.name}`;
                return acc;
              },
              {} as Record<string, string>
            )}
          />
        </div>
      </Modal>
    </div>
  );
}
