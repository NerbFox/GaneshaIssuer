'use client';

import { useState, useRef, useEffect } from 'react';
import { ThemedText } from './ThemedText';

export interface AttributePosition {
  x: number; // percentage from left
  y: number; // percentage from top
  width: number; // percentage width
  height: number; // percentage height
  fontSize: number; // in pixels
  bgColor?: string; // background color (can be 'transparent')
  fontColor?: string; // font color
}

export interface QRCodePosition {
  x: number; // percentage from left
  y: number; // percentage from top
  size: number; // percentage size (width and height are equal for QR)
}

export interface AttributePositionData {
  [attributeName: string]: AttributePosition;
}

export interface CredentialPositionData {
  attributes: AttributePositionData;
  qrCode: QRCodePosition;
}

interface Attribute {
  id: number;
  name: string;
  type: string;
  description: string;
  required: boolean;
}

interface AttributePositionEditorProps {
  attributes: Attribute[];
  imageUrl: string;
  initialPositions?: AttributePositionData;
  initialQRPosition?: QRCodePosition;
  onSave: (data: { attributes: AttributePositionData; qrCode: QRCodePosition }) => void;
  onCancel: () => void;
}

interface DraggableField {
  attributeName: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  bgColor: string;
  fontColor: string;
}

export default function AttributePositionEditor({
  attributes,
  imageUrl,
  initialPositions = {},
  initialQRPosition,
  onSave,
  onCancel,
}: AttributePositionEditorProps) {
  const [fields, setFields] = useState<DraggableField[]>([]);
  const [qrCode, setQrCode] = useState<QRCodePosition>(
    initialQRPosition || { x: 80, y: 80, size: 15 }
  );
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [selectedQR, setSelectedQR] = useState<boolean>(false);
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    isResizing: boolean;
    resizeHandle: 'se' | 'sw' | 'ne' | 'nw' | null;
    startX: number;
    startY: number;
    startFieldX: number;
    startFieldY: number;
    startFieldWidth: number;
    startFieldHeight: number;
    target: 'attribute' | 'qr' | null;
  }>({
    isDragging: false,
    isResizing: false,
    resizeHandle: null,
    startX: 0,
    startY: 0,
    startFieldX: 0,
    startFieldY: 0,
    startFieldWidth: 0,
    startFieldHeight: 0,
    target: null,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 1131 });
  const [imageAspectRatio, setImageAspectRatio] = useState<number>(1 / 1.414); // Default A4 ratio

  // Load image and get its natural aspect ratio
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const aspectRatio = img.width / img.height;
      setImageAspectRatio(aspectRatio);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Initialize fields from initial positions
  useEffect(() => {
    const initialFields: DraggableField[] = [];
    attributes.forEach((attr) => {
      if (initialPositions[attr.name]) {
        initialFields.push({
          attributeName: attr.name,
          ...initialPositions[attr.name],
          bgColor: initialPositions[attr.name].bgColor || 'transparent',
          fontColor: initialPositions[attr.name].fontColor || '#000000',
        });
      }
    });
    setFields(initialFields);
  }, [attributes, initialPositions]);

  // Update container size on mount and window resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();
    // Add a small delay to ensure the image has loaded and container is properly sized
    const timer = setTimeout(updateSize, 100);
    window.addEventListener('resize', updateSize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateSize);
    };
  }, [imageAspectRatio]);

  const handleAddField = (attributeName: string) => {
    // Check if field already exists
    if (fields.find((f) => f.attributeName === attributeName)) {
      alert(`Field "${attributeName}" is already added`);
      return;
    }

    // Add new field at center
    const newField: DraggableField = {
      attributeName,
      x: 25, // 25% from left
      y: 25, // 25% from top
      width: 30, // 30% width
      height: 5, // 5% height
      fontSize: 16,
      bgColor: 'transparent',
      fontColor: '#000000',
    };

    setFields([...fields, newField]);
    setSelectedField(attributeName);
  };

  const handleRemoveField = (attributeName: string) => {
    setFields(fields.filter((f) => f.attributeName !== attributeName));
    if (selectedField === attributeName) {
      setSelectedField(null);
    }
  };

  const handleMouseDown = (
    e: React.MouseEvent,
    attributeName: string,
    resizeHandle?: 'se' | 'sw' | 'ne' | 'nw'
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const field = fields.find((f) => f.attributeName === attributeName);
    if (!field) return;

    setSelectedField(attributeName);
    setSelectedQR(false);

    if (resizeHandle) {
      setDragState({
        isDragging: false,
        isResizing: true,
        resizeHandle,
        startX: e.clientX,
        startY: e.clientY,
        startFieldX: field.x,
        startFieldY: field.y,
        startFieldWidth: field.width,
        startFieldHeight: field.height,
        target: 'attribute',
      });
    } else {
      setDragState({
        isDragging: true,
        isResizing: false,
        resizeHandle: null,
        startX: e.clientX,
        startY: e.clientY,
        startFieldX: field.x,
        startFieldY: field.y,
        startFieldWidth: field.width,
        startFieldHeight: field.height,
        target: 'attribute',
      });
    }
  };

  const handleQRMouseDown = (e: React.MouseEvent, resizeHandle?: 'se' | 'sw' | 'ne' | 'nw') => {
    e.preventDefault();
    e.stopPropagation();

    setSelectedQR(true);
    setSelectedField(null);

    if (resizeHandle) {
      setDragState({
        isDragging: false,
        isResizing: true,
        resizeHandle,
        startX: e.clientX,
        startY: e.clientY,
        startFieldX: qrCode.x,
        startFieldY: qrCode.y,
        startFieldWidth: qrCode.size,
        startFieldHeight: qrCode.size,
        target: 'qr',
      });
    } else {
      setDragState({
        isDragging: true,
        isResizing: false,
        resizeHandle: null,
        startX: e.clientX,
        startY: e.clientY,
        startFieldX: qrCode.x,
        startFieldY: qrCode.y,
        startFieldWidth: qrCode.size,
        startFieldHeight: qrCode.size,
        target: 'qr',
      });
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if ((!selectedField && !selectedQR) || (!dragState.isDragging && !dragState.isResizing)) return;

    const deltaX = ((e.clientX - dragState.startX) / containerSize.width) * 100;
    const deltaY = ((e.clientY - dragState.startY) / containerSize.height) * 100;

    if (dragState.target === 'qr') {
      // Handle QR code movement and resizing
      if (dragState.isDragging) {
        setQrCode({
          ...qrCode,
          x: Math.max(0, Math.min(100 - qrCode.size, dragState.startFieldX + deltaX)),
          y: Math.max(0, Math.min(100 - qrCode.size, dragState.startFieldY + deltaY)),
        });
      } else if (dragState.isResizing) {
        // For QR code, maintain square shape
        // Calculate size change based on the resize handle direction
        let delta = 0;
        const handle = dragState.resizeHandle;

        if (handle === 'se') {
          // Southeast: use maximum of deltaX and deltaY for growth
          delta = Math.max(deltaX, deltaY);
        } else if (handle === 'sw') {
          // Southwest: use maximum of -deltaX and deltaY
          delta = Math.max(-deltaX, deltaY);
        } else if (handle === 'ne') {
          // Northeast: use maximum of deltaX and -deltaY
          delta = Math.max(deltaX, -deltaY);
        } else if (handle === 'nw') {
          // Northwest: use maximum of -deltaX and -deltaY
          delta = Math.max(-deltaX, -deltaY);
        }

        const newSize = Math.max(5, Math.min(50, dragState.startFieldWidth + delta));

        // Adjust position when resizing from west or north handles
        let newX = qrCode.x;
        let newY = qrCode.y;

        if (handle === 'sw' || handle === 'nw') {
          // Moving left edge: adjust x position
          const sizeDiff = newSize - qrCode.size;
          newX = Math.max(0, qrCode.x - sizeDiff);
        }

        if (handle === 'ne' || handle === 'nw') {
          // Moving top edge: adjust y position
          const sizeDiff = newSize - qrCode.size;
          newY = Math.max(0, qrCode.y - sizeDiff);
        }

        setQrCode({
          x: newX,
          y: newY,
          size: newSize,
        });
      }
    } else {
      // Handle attribute field movement and resizing
      setFields((prevFields) =>
        prevFields.map((field) => {
          if (field.attributeName !== selectedField) return field;

          if (dragState.isDragging) {
            // Move the field
            return {
              ...field,
              x: Math.max(0, Math.min(100 - field.width, dragState.startFieldX + deltaX)),
              y: Math.max(0, Math.min(100 - field.height, dragState.startFieldY + deltaY)),
            };
          } else if (dragState.isResizing) {
            // Resize the field based on handle
            const handle = dragState.resizeHandle;
            let newX = field.x;
            let newY = field.y;
            let newWidth = field.width;
            let newHeight = field.height;

            if (handle === 'se') {
              // Southeast: increase width and height
              newWidth = Math.max(10, Math.min(100 - field.x, dragState.startFieldWidth + deltaX));
              newHeight = Math.max(3, Math.min(100 - field.y, dragState.startFieldHeight + deltaY));
            } else if (handle === 'sw') {
              // Southwest: change x, width, and height
              const proposedX = dragState.startFieldX + deltaX;
              const proposedWidth = dragState.startFieldWidth - deltaX;
              if (proposedWidth >= 10 && proposedX >= 0) {
                newX = proposedX;
                newWidth = proposedWidth;
              }
              newHeight = Math.max(3, Math.min(100 - field.y, dragState.startFieldHeight + deltaY));
            } else if (handle === 'ne') {
              // Northeast: change y, width, and height
              newWidth = Math.max(10, Math.min(100 - field.x, dragState.startFieldWidth + deltaX));
              const proposedY = dragState.startFieldY + deltaY;
              const proposedHeight = dragState.startFieldHeight - deltaY;
              if (proposedHeight >= 3 && proposedY >= 0) {
                newY = proposedY;
                newHeight = proposedHeight;
              }
            } else if (handle === 'nw') {
              // Northwest: change x, y, width, and height
              const proposedX = dragState.startFieldX + deltaX;
              const proposedWidth = dragState.startFieldWidth - deltaX;
              if (proposedWidth >= 10 && proposedX >= 0) {
                newX = proposedX;
                newWidth = proposedWidth;
              }
              const proposedY = dragState.startFieldY + deltaY;
              const proposedHeight = dragState.startFieldHeight - deltaY;
              if (proposedHeight >= 3 && proposedY >= 0) {
                newY = proposedY;
                newHeight = proposedHeight;
              }
            }

            return {
              ...field,
              x: newX,
              y: newY,
              width: newWidth,
              height: newHeight,
            };
          }

          return field;
        })
      );
    }
  };

  const handleMouseUp = () => {
    setDragState({
      isDragging: false,
      isResizing: false,
      resizeHandle: null,
      startX: 0,
      startY: 0,
      startFieldX: 0,
      startFieldY: 0,
      startFieldWidth: 0,
      startFieldHeight: 0,
      target: null,
    });
  };

  useEffect(() => {
    if (dragState.isDragging || dragState.isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragState, selectedField, selectedQR, containerSize, qrCode]);

  const handleFontSizeChange = (attributeName: string, newSize: number) => {
    setFields((prevFields) =>
      prevFields.map((field) =>
        field.attributeName === attributeName ? { ...field, fontSize: newSize } : field
      )
    );
  };

  const handleBgColorChange = (attributeName: string, newColor: string) => {
    setFields((prevFields) =>
      prevFields.map((field) =>
        field.attributeName === attributeName ? { ...field, bgColor: newColor } : field
      )
    );
  };

  const handleFontColorChange = (attributeName: string, newColor: string) => {
    setFields((prevFields) =>
      prevFields.map((field) =>
        field.attributeName === attributeName ? { ...field, fontColor: newColor } : field
      )
    );
  };

  const handleSave = () => {
    const positions: AttributePositionData = {};
    fields.forEach((field) => {
      positions[field.attributeName] = {
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
        fontSize: field.fontSize,
        bgColor: field.bgColor,
        fontColor: field.fontColor,
      };
    });
    onSave({
      attributes: positions,
      qrCode: qrCode,
    });
  };

  const selectedFieldData = fields.find((f) => f.attributeName === selectedField);
  const availableAttributes = attributes.filter(
    (attr) => !fields.find((f) => f.attributeName === attr.name)
  );

  return (
    <div className="flex h-[80vh] gap-4 p-4">
      {/* Left Sidebar - Available Attributes */}
      <div className="w-64 bg-gray-50 rounded-lg p-4 overflow-y-auto">
        <ThemedText className="text-sm font-semibold mb-3 text-gray-900">
          Available Attributes
        </ThemedText>
        <div className="space-y-2">
          {availableAttributes.map((attr) => (
            <button
              key={attr.id}
              onClick={() => handleAddField(attr.name)}
              className="w-full text-left px-3 py-2 bg-white border border-gray-200 rounded hover:bg-blue-50 hover:border-blue-300 transition-colors text-sm cursor-pointer"
            >
              <div className="font-medium text-gray-900">{attr.name}</div>
              <div className="text-xs text-gray-500">{attr.type}</div>
            </button>
          ))}
          {availableAttributes.length === 0 && (
            <ThemedText className="text-xs text-gray-500 italic">
              All attributes have been added
            </ThemedText>
          )}
        </div>

        {/* Added Fields List */}
        {fields.length > 0 && (
          <div className="mt-6">
            <ThemedText className="text-sm font-semibold mb-3 text-gray-900">
              Added Fields ({fields.length})
            </ThemedText>
            <div className="space-y-2">
              {fields.map((field) => (
                <div
                  key={field.attributeName}
                  className={`px-3 py-2 bg-white border rounded text-sm cursor-pointer ${
                    selectedField === field.attributeName
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedField(field.attributeName)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{field.attributeName}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveField(field.attributeName);
                      }}
                      className="text-red-500 hover:text-red-700 ml-2 cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Center - Canvas */}
      <div className="flex-1 flex flex-col">
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <ThemedText className="text-sm text-blue-900">
            <strong>Instructions:</strong> Click on attributes from the left to add them to the
            template. Drag to move, resize from corners, and adjust font size in the right panel.
          </ThemedText>
        </div>

        <div className="flex-1 bg-gray-100 rounded-lg p-4 flex items-center justify-center overflow-hidden min-h-0">
          <div
            ref={containerRef}
            className="relative shadow-lg mx-auto"
            style={{
              width: '100%',
              maxWidth: '800px',
              aspectRatio: `${imageAspectRatio}`,
            }}
            onClick={() => {
              setSelectedField(null);
              setSelectedQR(false);
            }}
          >
            {/* Background Image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Template"
              className="absolute inset-0 w-full h-full object-contain"
              draggable={false}
            />

            {/* Draggable Fields */}
            {fields.map((field) => (
              <div
                key={field.attributeName}
                className={`absolute cursor-move border-2 flex items-center overflow-hidden ${
                  selectedField === field.attributeName
                    ? 'border-blue-500 shadow-lg'
                    : 'border-blue-300'
                }`}
                style={{
                  left: `${field.x}%`,
                  top: `${field.y}%`,
                  width: `${field.width}%`,
                  height: `${field.height}%`,
                  fontSize: `${field.fontSize}px`,
                  backgroundColor: field.bgColor,
                  lineHeight: '1',
                  padding: '0',
                }}
                onMouseDown={(e) => handleMouseDown(e, field.attributeName)}
                onClick={(e) => e.stopPropagation()}
              >
                <span
                  className="font-medium truncate"
                  style={{
                    color: field.fontColor,
                    textShadow:
                      field.bgColor === 'transparent' ? '0 1px 2px rgba(0,0,0,0.8)' : 'none',
                    paddingLeft: '4px',
                    paddingRight: '4px',
                    lineHeight: '1',
                    display: 'flex',
                    alignItems: 'center',
                    height: '100%',
                  }}
                >
                  {field.attributeName}
                </span>

                {/* Resize Handles */}
                {selectedField === field.attributeName && (
                  <>
                    {/* Southeast */}
                    <div
                      className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 border border-white cursor-se-resize"
                      onMouseDown={(e) => handleMouseDown(e, field.attributeName, 'se')}
                    />
                    {/* Southwest */}
                    <div
                      className="absolute bottom-0 left-0 w-3 h-3 bg-blue-500 border border-white cursor-sw-resize"
                      onMouseDown={(e) => handleMouseDown(e, field.attributeName, 'sw')}
                    />
                    {/* Northeast */}
                    <div
                      className="absolute top-0 right-0 w-3 h-3 bg-blue-500 border border-white cursor-ne-resize"
                      onMouseDown={(e) => handleMouseDown(e, field.attributeName, 'ne')}
                    />
                    {/* Northwest */}
                    <div
                      className="absolute top-0 left-0 w-3 h-3 bg-blue-500 border border-white cursor-nw-resize"
                      onMouseDown={(e) => handleMouseDown(e, field.attributeName, 'nw')}
                    />
                  </>
                )}
              </div>
            ))}

            {/* QR Code */}
            <div
              className={`absolute cursor-move border-2 ${
                selectedQR ? 'border-green-500 shadow-lg' : 'border-green-300'
              } bg-white flex items-center justify-center`}
              style={{
                left: `${qrCode.x}%`,
                top: `${qrCode.y}%`,
                width: `${qrCode.size}%`,
                height: `${qrCode.size}%`,
              }}
              onMouseDown={(e) => handleQRMouseDown(e)}
              onClick={(e) => e.stopPropagation()}
            >
              <svg className="w-full h-full" viewBox="0 0 120 120">
                {/* White background */}
                <rect x="0" y="0" width="120" height="120" fill="white" />
                {/* Simple QR code representation in black with padding */}
                <rect x="10" y="10" width="30" height="30" fill="black" />
                <rect x="45" y="10" width="10" height="10" fill="black" />
                <rect x="60" y="10" width="10" height="10" fill="black" />
                <rect x="80" y="10" width="30" height="30" fill="black" />
                <rect x="10" y="45" width="10" height="10" fill="black" />
                <rect x="25" y="45" width="10" height="10" fill="black" />
                <rect x="55" y="45" width="10" height="10" fill="black" />
                <rect x="80" y="45" width="10" height="10" fill="black" />
                <rect x="95" y="45" width="10" height="10" fill="black" />
                <rect x="10" y="80" width="30" height="30" fill="black" />
                <rect x="45" y="80" width="10" height="10" fill="black" />
                <rect x="60" y="95" width="10" height="10" fill="black" />
                <rect x="80" y="80" width="10" height="10" fill="black" />
                <rect x="95" y="95" width="10" height="10" fill="black" />
              </svg>

              {/* Resize Handles */}
              {selectedQR && (
                <>
                  {/* Southeast */}
                  <div
                    className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border border-white cursor-se-resize"
                    onMouseDown={(e) => handleQRMouseDown(e, 'se')}
                  />
                  {/* Southwest */}
                  <div
                    className="absolute bottom-0 left-0 w-3 h-3 bg-green-500 border border-white cursor-sw-resize"
                    onMouseDown={(e) => handleQRMouseDown(e, 'sw')}
                  />
                  {/* Northeast */}
                  <div
                    className="absolute top-0 right-0 w-3 h-3 bg-green-500 border border-white cursor-ne-resize"
                    onMouseDown={(e) => handleQRMouseDown(e, 'ne')}
                  />
                  {/* Northwest */}
                  <div
                    className="absolute top-0 left-0 w-3 h-3 bg-green-500 border border-white cursor-nw-resize"
                    onMouseDown={(e) => handleQRMouseDown(e, 'nw')}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Properties */}
      <div className="w-64 bg-gray-50 rounded-lg p-4 overflow-y-auto flex flex-col">
        <ThemedText className="text-sm font-semibold mb-3 text-gray-900">Properties</ThemedText>
        {selectedFieldData ? (
          <div className="space-y-4 flex-1">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Field Name</label>
              <div className="px-3 py-2 bg-white border border-gray-200 rounded text-sm text-gray-900">
                {selectedFieldData.attributeName}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Font Size</label>
              <input
                type="number"
                min="8"
                max="72"
                value={selectedFieldData.fontSize === 0 ? '' : selectedFieldData.fontSize}
                onChange={(e) => {
                  const value = e.target.value;

                  // Allow empty string during editing
                  if (value === '') {
                    handleFontSizeChange(selectedFieldData.attributeName, 0);
                    return;
                  }

                  // Remove leading zeros, but keep single 0
                  const sanitized = value.replace(/^0+(\d)/, '$1');
                  const numValue = Number(sanitized);

                  if (!isNaN(numValue) && numValue >= 0) {
                    handleFontSizeChange(selectedFieldData.attributeName, numValue);
                  }
                }}
                onBlur={() => {
                  // Auto-correct to valid range on blur
                  const value = selectedFieldData.fontSize;
                  if (value === 0 || value < 8) {
                    handleFontSizeChange(selectedFieldData.attributeName, 8);
                  } else if (value > 72) {
                    handleFontSizeChange(selectedFieldData.attributeName, 72);
                  }
                }}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded text-sm text-gray-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Position</label>
              <div className="space-y-1 text-xs text-gray-600">
                <div>X: {selectedFieldData.x.toFixed(1)}%</div>
                <div>Y: {selectedFieldData.y.toFixed(1)}%</div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Size</label>
              <div className="space-y-1 text-xs text-gray-600">
                <div>Width: {selectedFieldData.width.toFixed(1)}%</div>
                <div>Height: {selectedFieldData.height.toFixed(1)}%</div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-200">
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Attribute Display Settings
              </label>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1.5">Background</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={
                        selectedFieldData.bgColor === 'transparent'
                          ? '#ffffff'
                          : selectedFieldData.bgColor
                      }
                      onChange={(e) =>
                        handleBgColorChange(selectedFieldData.attributeName, e.target.value)
                      }
                      disabled={selectedFieldData.bgColor === 'transparent'}
                      className="w-10 h-10 rounded border border-gray-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Background Color"
                    />
                    <div className="flex-1 flex gap-1">
                      <button
                        onClick={() => {
                          if (selectedFieldData.bgColor === 'transparent') {
                            handleBgColorChange(selectedFieldData.attributeName, '#ffffff');
                          }
                        }}
                        className={`flex-1 px-2 py-1.5 text-xs rounded transition-colors cursor-pointer ${
                          selectedFieldData.bgColor !== 'transparent'
                            ? 'bg-blue-500 text-white border-2 border-blue-600'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                        }`}
                        title="Use colored background"
                      >
                        Color
                      </button>
                      <button
                        onClick={() =>
                          handleBgColorChange(selectedFieldData.attributeName, 'transparent')
                        }
                        className={`flex-1 px-2 py-1.5 text-xs rounded transition-colors cursor-pointer ${
                          selectedFieldData.bgColor === 'transparent'
                            ? 'bg-blue-500 text-white border-2 border-blue-600'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                        }`}
                        title="Use transparent background"
                      >
                        None
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1.5">Font Color</label>
                  <input
                    type="color"
                    value={selectedFieldData.fontColor}
                    onChange={(e) =>
                      handleFontColorChange(selectedFieldData.attributeName, e.target.value)
                    }
                    className="w-full h-10 rounded border border-gray-300 cursor-pointer"
                    title="Font Color"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={() => handleRemoveField(selectedFieldData.attributeName)}
              className="w-full px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-sm font-medium cursor-pointer"
            >
              Remove Field
            </button>
          </div>
        ) : selectedQR ? (
          <div className="space-y-4 flex-1">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Element</label>
              <div className="px-3 py-2 bg-white border border-gray-200 rounded text-sm text-gray-900 font-semibold">
                QR Code
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Size</label>
              <input
                type="number"
                min="5"
                max="50"
                value={qrCode.size === 0 ? '' : qrCode.size}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    setQrCode({ ...qrCode, size: 0 });
                    return;
                  }
                  const sanitized = value.replace(/^0+(\d)/, '$1');
                  const numValue = Number(sanitized);
                  if (!isNaN(numValue) && numValue >= 0) {
                    setQrCode({ ...qrCode, size: numValue });
                  }
                }}
                onBlur={() => {
                  const value = qrCode.size;
                  if (value === 0 || value < 5) {
                    setQrCode({ ...qrCode, size: 5 });
                  } else if (value > 50) {
                    setQrCode({ ...qrCode, size: 50 });
                  }
                }}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded text-sm text-gray-900"
              />
              <ThemedText className="text-xs text-gray-500 mt-1">
                Size as percentage of template (5-50%)
              </ThemedText>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Position</label>
              <div className="space-y-1 text-xs text-gray-600">
                <div>X: {qrCode.x.toFixed(1)}%</div>
                <div>Y: {qrCode.y.toFixed(1)}%</div>
              </div>
            </div>
          </div>
        ) : (
          <ThemedText className="text-xs text-gray-500 italic">
            Select a field or QR code to view properties.
          </ThemedText>
        )}

        {/* Bottom Action Buttons */}
        <div className="mt-auto pt-4 border-t border-gray-200 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium cursor-pointer"
          >
            CANCEL
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium cursor-pointer"
          >
            SAVE POSITIONS
          </button>
        </div>
      </div>
    </div>
  );
}
