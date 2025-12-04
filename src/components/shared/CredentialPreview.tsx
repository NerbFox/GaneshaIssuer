'use client';

import React, { useEffect, useState } from 'react';
import { Stage, Layer, Image, Text, Rect } from 'react-konva';
import useImage from 'use-image';
import { ThemedText } from '@/components/shared/ThemedText';
import { AttributePositionData, QRCodePosition } from '@/components/issuer/AttributePositionEditor';

interface CredentialPreviewProps {
  imageUrl: string;
  positions: AttributePositionData;
  qrPosition?: QRCodePosition;
  sampleData?: Record<string, string>; // Sample values for preview
  showTitle?: boolean; // Whether to show the title section
  showQRCode?: boolean; // Whether to show the QR code example (default: true)
}

export default function CredentialPreview({
  imageUrl,
  positions,
  qrPosition,
  sampleData = {},
  showTitle = true,
  showQRCode = true,
}: CredentialPreviewProps) {
  // Use default QR position if not provided
  const effectiveQRPosition = qrPosition || { x: 82, y: 70, size: 15 };
  const attributeNames = Object.keys(positions);

  // Load background image using useImage hook
  const [backgroundImage, bgImageStatus] = useImage(imageUrl, 'anonymous');

  // State for QR code image
  const [qrImage, setQrImage] = useState<HTMLImageElement | null>(null);

  // Calculate stage dimensions based on loaded image with display constraints
  const MAX_DISPLAY_WIDTH = 800;
  const naturalWidth = backgroundImage?.naturalWidth || 800;
  const naturalHeight = backgroundImage?.naturalHeight || 1131;
  const scale = naturalWidth > MAX_DISPLAY_WIDTH ? MAX_DISPLAY_WIDTH / naturalWidth : 1;
  const stageWidth = naturalWidth * scale;
  const stageHeight = naturalHeight * scale;

  // Generate simple QR code placeholder
  useEffect(() => {
    if (!showQRCode) return;

    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 120;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // White background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, 120, 120);

      // Black QR pattern
      ctx.fillStyle = '#000000';
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
  }, [showQRCode]);

  return (
    <div className="w-full">
      {showTitle && (
        <div className="mb-4">
          <span className="text-sm font-semibold text-gray-900 block">Credential Preview</span>
          <span className="text-xs text-gray-500 mt-1 block">
            This is how the credential will appear to holders with the configured attribute
            positions (Rendered with Konva.js)
          </ThemedText>
        </div>
      )}

      <div className="bg-gray-100 rounded-lg p-4">
        <div
          className="credential-container inline-block mx-auto shadow-lg"
          style={{ maxWidth: '100%' }}
        >
          {bgImageStatus === 'loading' && (
            <div className="w-full h-64 flex items-center justify-center bg-gray-200 rounded">
              <ThemedText className="text-gray-500">Loading credential template...</ThemedText>
            </div>
          )}

          {bgImageStatus === 'failed' && (
            <div className="w-full h-64 flex items-center justify-center bg-red-50 rounded">
              <ThemedText className="text-red-600">Failed to load credential template</ThemedText>
            </div>
          )}

          {bgImageStatus === 'loaded' && backgroundImage && (
            <Stage width={stageWidth} height={stageHeight} pixelRatio={1}>
              {/* Background Layer */}
              <Layer>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image image={backgroundImage} width={stageWidth} height={stageHeight} />
              </Layer>

              {/* Text Layer */}
              <Layer>
                {attributeNames.map((attrName) => {
                  const position = positions[attrName];
                  const actualValue = sampleData[attrName];
                  const hasValue = actualValue && actualValue.trim() !== '';
                  const displayValue = hasValue ? actualValue : `[${attrName}]`;
                  const bgColor = position.bgColor || 'transparent';
                  const fontColor = position.fontColor || '#000000';
                  const fontFamily = position.fontFamily || 'Arial';

                  // Convert percentage to pixels
                  const x = (position.x / 100) * stageWidth;
                  const y = (position.y / 100) * stageHeight;
                  const width = (position.width / 100) * stageWidth;
                  const height = (position.height / 100) * stageHeight;

                  return (
                    <React.Fragment key={attrName}>
                      {/* Background rectangle */}
                      {bgColor !== 'transparent' && (
                        <Rect x={x} y={y} width={width} height={height} fill={bgColor} />
                      )}

                      {/* Text */}
                      <Text
                        x={x + 8} // 8px left padding
                        y={y + 2} // 2px top padding
                        text={displayValue}
                        fontSize={position.fontSize}
                        fontFamily={fontFamily}
                        fill={fontColor}
                        opacity={hasValue ? 1 : 0.5}
                        fontStyle={hasValue ? 'normal' : 'italic'}
                        width={width - 16} // Account for padding
                        align="left"
                        verticalAlign="top"
                        ellipsis={true}
                        wrap="none"
                      />
                    </React.Fragment>
                  );
                })}
              </Layer>

              {/* QR Code Layer */}
              {showQRCode && qrImage && (
                <Layer>
                  <Rect
                    x={(effectiveQRPosition.x / 100) * stageWidth}
                    y={(effectiveQRPosition.y / 100) * stageHeight}
                    width={(effectiveQRPosition.size / 100) * Math.min(stageWidth, stageHeight)}
                    height={(effectiveQRPosition.size / 100) * Math.min(stageWidth, stageHeight)}
                    fill="#FFFFFF"
                  />
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image
                    image={qrImage}
                    x={(effectiveQRPosition.x / 100) * stageWidth}
                    y={(effectiveQRPosition.y / 100) * stageHeight}
                    width={(effectiveQRPosition.size / 100) * Math.min(stageWidth, stageHeight)}
                    height={(effectiveQRPosition.size / 100) * Math.min(stageWidth, stageHeight)}
                  />
                </Layer>
              )}
            </Stage>
          )}
        </div>
      </div>

      {/* Sample Data Info */}
      {attributeNames.length > 0 && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-xs font-medium text-blue-900 mb-2">Configured Attributes:</span>
          <div className="space-y-1">
            {attributeNames.map((attrName) => (
              <div key={attrName} className="flex items-center gap-2 text-xs">
                <span className="font-medium text-blue-900">{attrName}</span>
                <span className="text-blue-700">({positions[attrName].fontSize}px font)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {attributeNames.length === 0 && showTitle && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <span className="text-xs text-yellow-800">
            No attributes have been positioned yet. Use the &quot;Configure Positions&quot; button
            to add attributes to the credential template.
          </span>
        </div>
      )}

      {attributeNames.length === 0 && !showTitle && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-xs text-blue-800">
            💡 <strong>Attribute positions not configured.</strong> To configure attribute positions
            and properties for this credential, go to the <strong>Schema page</strong> and update
            this schema to set the position, font size, and styling for each attribute.
          </span>
        </div>
      )}
    </div>
  );
}
