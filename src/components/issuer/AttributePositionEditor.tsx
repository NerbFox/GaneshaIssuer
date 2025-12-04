'use client';

import { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Image, Text, Rect, Transformer, Group } from 'react-konva';
import useImage from 'use-image';
import Konva from 'konva';
import { ThemedText } from '@/components/shared/ThemedText';

export interface AttributePosition {
  x: number; // percentage from left
  y: number; // percentage from top
  width: number; // percentage width
  height: number; // percentage height
  fontSize: number; // in pixels
  fontFamily?: string; // font family
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
  fontFamily: string;
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
    initialQRPosition || { x: 82, y: 70, size: 15 }
  );
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [selectedQR, setSelectedQR] = useState<boolean>(false);
  const [backgroundImage, bgImageStatus] = useImage(imageUrl, 'anonymous');
  const [qrImage, setQrImage] = useState<HTMLImageElement | null>(null);

  // Refs for Konva nodes and transformer
  const fieldRefs = useRef<Map<string, Konva.Group>>(new Map());
  const qrRef = useRef<Konva.Group>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const stageRef = useRef<Konva.Stage>(null);

  // Constants for stage sizing
  const MAX_DISPLAY_WIDTH = 800;
  const naturalWidth = backgroundImage?.naturalWidth || 800;
  const naturalHeight = backgroundImage?.naturalHeight || 1131;
  const scale = naturalWidth > MAX_DISPLAY_WIDTH ? MAX_DISPLAY_WIDTH / naturalWidth : 1;
  const stageWidth = naturalWidth * scale;
  const stageHeight = naturalHeight * scale;

  // Generate QR code placeholder
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 120;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // White background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, 120, 120);

      // Simple QR code representation in black
      ctx.fillStyle = 'black';
      ctx.fillRect(10, 10, 30, 30);
      ctx.fillRect(45, 10, 10, 10);
      ctx.fillRect(60, 10, 10, 10);
      ctx.fillRect(80, 10, 30, 30);
      ctx.fillRect(10, 45, 10, 10);
      ctx.fillRect(25, 45, 10, 10);
      ctx.fillRect(55, 45, 10, 10);
      ctx.fillRect(80, 45, 10, 10);
      ctx.fillRect(95, 45, 10, 10);
      ctx.fillRect(10, 80, 30, 30);
      ctx.fillRect(45, 80, 10, 10);
      ctx.fillRect(60, 95, 10, 10);
      ctx.fillRect(80, 80, 10, 10);
      ctx.fillRect(95, 95, 10, 10);

      const img = new window.Image();
      img.src = canvas.toDataURL();
      img.onload = () => setQrImage(img);
    }
  }, []);

  // Initialize fields from initial positions
  useEffect(() => {
    const initialFields: DraggableField[] = [];
    attributes.forEach((attr) => {
      if (initialPositions[attr.name]) {
        initialFields.push({
          attributeName: attr.name,
          ...initialPositions[attr.name],
          fontFamily: initialPositions[attr.name].fontFamily || 'Arial',
          bgColor: initialPositions[attr.name].bgColor || 'transparent',
          fontColor: initialPositions[attr.name].fontColor || '#000000',
        });
      }
    });
    setFields(initialFields);
  }, [attributes, initialPositions]);

  // Update transformer when selection changes
  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;

    if (selectedField) {
      const node = fieldRefs.current.get(selectedField);
      if (node) {
        transformer.nodes([node]);
        transformer.getLayer()?.batchDraw();
      }
    } else if (selectedQR && qrRef.current) {
      transformer.nodes([qrRef.current]);
      transformer.getLayer()?.batchDraw();
    } else {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
    }
  }, [selectedField, selectedQR]);

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
      fontFamily: 'Arial',
      bgColor: 'transparent',
      fontColor: '#000000',
    };

    setFields([...fields, newField]);
    setSelectedField(attributeName);
  };

  const handleRemoveField = (attributeName: string) => {
    setFields(fields.filter((f) => f.attributeName !== attributeName));
    fieldRefs.current.delete(attributeName);
    if (selectedField === attributeName) {
      setSelectedField(null);
    }
  };

  // Handle drag end for attribute fields
  const handleFieldDragEnd = (attributeName: string, e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const x = (node.x() / stageWidth) * 100;
    const y = (node.y() / stageHeight) * 100;

    setFields((prevFields) =>
      prevFields.map((field) =>
        field.attributeName === attributeName
          ? {
              ...field,
              x: Math.max(0, Math.min(100 - field.width, x)),
              y: Math.max(0, Math.min(100 - field.height, y)),
            }
          : field
      )
    );
  };

  // Handle transform end (resize) for attribute fields
  const handleFieldTransformEnd = (attributeName: string, e: Konva.KonvaEventObject<Event>) => {
    const node = e.target as Konva.Group;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    const field = fields.find((f) => f.attributeName === attributeName);
    if (!field) return;

    // Calculate new dimensions in pixels
    const oldWidthPx = (field.width / 100) * stageWidth;
    const oldHeightPx = (field.height / 100) * stageHeight;
    const newWidthPx = oldWidthPx * scaleX;
    const newHeightPx = oldHeightPx * scaleY;

    // Convert to percentages
    const newWidth = (newWidthPx / stageWidth) * 100;
    const newHeight = (newHeightPx / stageHeight) * 100;

    // Get current position (already in pixels from Konva)
    const currentX = node.x();
    const currentY = node.y();

    // Convert to percentages
    const x = (currentX / stageWidth) * 100;
    const y = (currentY / stageHeight) * 100;

    // Constrain values
    const constrainedWidth = Math.max(10, Math.min(100, newWidth));
    const constrainedHeight = Math.max(3, Math.min(100, newHeight));
    const constrainedX = Math.max(0, Math.min(100 - constrainedWidth, x));
    const constrainedY = Math.max(0, Math.min(100 - constrainedHeight, y));

    // Calculate final pixel dimensions
    const finalWidthPx = (constrainedWidth / 100) * stageWidth;
    const finalHeightPx = (constrainedHeight / 100) * stageHeight;

    // Update children dimensions BEFORE resetting scale
    const children = node.getChildren();
    children.forEach((child) => {
      if (child instanceof Konva.Rect) {
        child.width(finalWidthPx);
        child.height(finalHeightPx);
      } else if (child instanceof Konva.Text) {
        child.width(finalWidthPx - 16); // Account for padding
      }
    });

    // Reset scale to 1
    node.scaleX(1);
    node.scaleY(1);

    // Update node position immediately (convert back to pixels)
    node.x((constrainedX / 100) * stageWidth);
    node.y((constrainedY / 100) * stageHeight);

    // Force redraw after all updates
    node.getLayer()?.batchDraw();

    // Update state
    setFields((prevFields) =>
      prevFields.map((f) =>
        f.attributeName === attributeName
          ? {
              ...f,
              x: constrainedX,
              y: constrainedY,
              width: constrainedWidth,
              height: constrainedHeight,
            }
          : f
      )
    );
  };

  // Handle QR code drag end
  const handleQRDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const x = (node.x() / stageWidth) * 100;
    const y = (node.y() / stageHeight) * 100;
    const imageAspectRatio = stageWidth / stageHeight;
    const qrHeightPercent = qrCode.size * imageAspectRatio;

    setQrCode({
      ...qrCode,
      x: Math.max(0, Math.min(100 - qrCode.size, x)),
      y: Math.max(0, Math.min(100 - qrHeightPercent, y)),
    });
  };

  // Handle QR code transform end (resize)
  const handleQRTransformEnd = (e: Konva.KonvaEventObject<Event>) => {
    const node = e.target as Konva.Group;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // Use average of scaleX and scaleY to maintain square
    const scale = (scaleX + scaleY) / 2;

    // Calculate new size in pixels
    const oldSizePx = (qrCode.size / 100) * stageWidth;
    const newSizePx = oldSizePx * scale;

    // Convert to percentage
    const newSize = (newSizePx / stageWidth) * 100;

    // Get current position
    const currentX = node.x();
    const currentY = node.y();
    const x = (currentX / stageWidth) * 100;
    const y = (currentY / stageHeight) * 100;

    // Calculate constraints
    const imageAspectRatio = stageWidth / stageHeight;
    const maxSizeForHeight = 100 / imageAspectRatio;
    const maxSize = Math.min(50, maxSizeForHeight);

    // Constrain values
    const constrainedSize = Math.max(5, Math.min(maxSize, newSize));
    const qrHeightPercent = constrainedSize * imageAspectRatio;
    const constrainedX = Math.max(0, Math.min(100 - constrainedSize, x));
    const constrainedY = Math.max(0, Math.min(100 - qrHeightPercent, y));

    // Calculate final pixel size
    const finalSizePx = (constrainedSize / 100) * stageWidth;

    // Update children dimensions BEFORE resetting scale
    const children = node.getChildren();
    children.forEach((child) => {
      if (child instanceof Konva.Image || child instanceof Konva.Rect) {
        child.width(finalSizePx);
        child.height(finalSizePx);
      }
    });

    // Reset scale to 1
    node.scaleX(1);
    node.scaleY(1);

    // Update node position immediately
    node.x((constrainedX / 100) * stageWidth);
    node.y((constrainedY / 100) * stageHeight);

    // Force redraw after all updates
    node.getLayer()?.batchDraw();

    // Update state
    setQrCode({
      x: constrainedX,
      y: constrainedY,
      size: constrainedSize,
    });
  };

  const handleFontSizeChange = (attributeName: string, newSize: number) => {
    setFields((prevFields) =>
      prevFields.map((field) =>
        field.attributeName === attributeName ? { ...field, fontSize: newSize } : field
      )
    );
  };

  const handleFontFamilyChange = (attributeName: string, newFamily: string) => {
    setFields((prevFields) =>
      prevFields.map((field) =>
        field.attributeName === attributeName ? { ...field, fontFamily: newFamily } : field
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
        fontFamily: field.fontFamily,
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

        <div className="flex-1 bg-gray-100 rounded-lg p-4 flex items-center justify-center overflow-auto min-h-0">
          {bgImageStatus === 'loading' && (
            <div className="flex items-center justify-center">
              <ThemedText className="text-gray-600">Loading template...</ThemedText>
            </div>
          )}

          {bgImageStatus === 'failed' && (
            <div className="flex items-center justify-center">
              <ThemedText className="text-red-600">Failed to load credential template</ThemedText>
            </div>
          )}

          {bgImageStatus === 'loaded' && backgroundImage && (
            <div className="shadow-lg">
              <Stage
                ref={stageRef}
                width={stageWidth}
                height={stageHeight}
                onClick={(e) => {
                  // Deselect if clicking on stage background
                  if (e.target === e.target.getStage()) {
                    setSelectedField(null);
                    setSelectedQR(false);
                  }
                }}
              >
                {/* Background Layer */}
                <Layer>
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image image={backgroundImage} width={stageWidth} height={stageHeight} />
                </Layer>

                {/* Attribute Fields Layer */}
                <Layer>
                  {fields.map((field) => {
                    const x = (field.x / 100) * stageWidth;
                    const y = (field.y / 100) * stageHeight;
                    const width = (field.width / 100) * stageWidth;
                    const height = (field.height / 100) * stageHeight;
                    const isSelected = selectedField === field.attributeName;

                    return (
                      <Group
                        key={field.attributeName}
                        x={x}
                        y={y}
                        draggable
                        onDragEnd={(e) => handleFieldDragEnd(field.attributeName, e)}
                        onTransformEnd={(e) => handleFieldTransformEnd(field.attributeName, e)}
                        onClick={() => {
                          setSelectedField(field.attributeName);
                          setSelectedQR(false);
                        }}
                        onTap={() => {
                          setSelectedField(field.attributeName);
                          setSelectedQR(false);
                        }}
                        ref={(node) => {
                          if (node) {
                            fieldRefs.current.set(field.attributeName, node);
                          }
                        }}
                      >
                        {/* Background Rectangle */}
                        {field.bgColor !== 'transparent' && (
                          <Rect width={width} height={height} fill={field.bgColor} />
                        )}

                        {/* Border Rectangle */}
                        <Rect
                          width={width}
                          height={height}
                          stroke={isSelected ? '#3B82F6' : '#93C5FD'}
                          strokeWidth={isSelected ? 2 : 1}
                        />

                        {/* Text */}
                        <Text
                          x={8}
                          y={2}
                          text={field.attributeName}
                          fontSize={field.fontSize}
                          fontFamily={field.fontFamily}
                          fill={field.fontColor}
                          width={width - 16}
                          align="left"
                          verticalAlign="top"
                          ellipsis={true}
                          wrap="none"
                        />
                      </Group>
                    );
                  })}

                  {/* QR Code */}
                  {qrImage && (
                    <Group
                      ref={qrRef}
                      x={(qrCode.x / 100) * stageWidth}
                      y={(qrCode.y / 100) * stageHeight}
                      draggable
                      onDragEnd={handleQRDragEnd}
                      onTransformEnd={handleQRTransformEnd}
                      onClick={() => {
                        setSelectedQR(true);
                        setSelectedField(null);
                      }}
                      onTap={() => {
                        setSelectedQR(true);
                        setSelectedField(null);
                      }}
                    >
                      {/* QR Code Image */}
                      {/* eslint-disable-next-line jsx-a11y/alt-text */}
                      <Image
                        image={qrImage}
                        width={(qrCode.size / 100) * stageWidth}
                        height={(qrCode.size / 100) * stageWidth}
                      />

                      {/* Border */}
                      <Rect
                        width={(qrCode.size / 100) * stageWidth}
                        height={(qrCode.size / 100) * stageWidth}
                        stroke={selectedQR ? '#10B981' : '#6EE7B7'}
                        strokeWidth={selectedQR ? 2 : 1}
                      />
                    </Group>
                  )}

                  {/* Transformer */}
                  <Transformer
                    ref={transformerRef}
                    boundBoxFunc={(oldBox, newBox) => {
                      // Limit minimum size
                      if (newBox.width < 50 || newBox.height < 20) {
                        return oldBox;
                      }
                      return newBox;
                    }}
                  />
                </Layer>
              </Stage>
            </div>
          )}
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
              <label className="block text-xs font-medium text-gray-700 mb-1">Font Family</label>
              <select
                value={selectedFieldData.fontFamily}
                onChange={(e) =>
                  handleFontFamilyChange(selectedFieldData.attributeName, e.target.value)
                }
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded text-sm text-gray-900"
              >
                <option value="Arial">Arial</option>
                <option value="Helvetica">Helvetica</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Georgia">Georgia</option>
                <option value="Courier New">Courier New</option>
                <option value="Verdana">Verdana</option>
                <option value="Tahoma">Tahoma</option>
                <option value="Trebuchet MS">Trebuchet MS</option>
                <option value="Impact">Impact</option>
                <option value="Comic Sans MS">Comic Sans MS</option>
              </select>
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
