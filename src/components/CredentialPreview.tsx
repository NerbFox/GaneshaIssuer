'use client';

import { useRef, useEffect, useState } from 'react';
import { ThemedText } from './ThemedText';
import { AttributePositionData, QRCodePosition } from './AttributePositionEditor';

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setContainerSize] = useState({ width: 800, height: 1131 });
  const [imageAspectRatio, setImageAspectRatio] = useState<number>(1 / 1.414);

  // Use default QR position if not provided
  const effectiveQRPosition = qrPosition || { x: 82, y: 70, size: 15 };

  // Load image and get its natural aspect ratio
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const aspectRatio = img.width / img.height;
      setImageAspectRatio(aspectRatio);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Update container size on mount and window resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const attributeNames = Object.keys(positions);

  return (
    <div className="w-full">
      {showTitle && (
        <div className="mb-4">
          <ThemedText className="text-sm font-semibold text-gray-900 block">
            Credential Preview
          </ThemedText>
          <ThemedText className="text-xs text-gray-500 mt-1 block">
            This is how the credential will appear to holders with the configured attribute
            positions
          </ThemedText>
        </div>
      )}

      <div className="bg-gray-100 rounded-lg p-4">
        <div
          ref={containerRef}
          className="credential-container relative mx-auto shadow-lg"
          style={{
            width: '100%',
            maxWidth: '800px',
            aspectRatio: `${imageAspectRatio}`,
          }}
        >
          {/* Background Image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Credential Template"
            className="absolute inset-0 w-full h-full object-contain"
            draggable={false}
          />

          {/* Positioned Attribute Values */}
          {attributeNames.map((attrName) => {
            const position = positions[attrName];
            const actualValue = sampleData[attrName];
            // Show actual value if filled, otherwise show sample placeholder
            const hasValue = actualValue && actualValue.trim() !== '';
            const displayValue = hasValue ? actualValue : `[${attrName}]`;
            const bgColor = position.bgColor || 'transparent';
            const fontColor = position.fontColor || '#000000';
            const fontFamily = position.fontFamily || 'Arial';

            return (
              <div
                key={attrName}
                className="absolute"
                style={{
                  left: `${position.x}%`,
                  top: `${position.y}%`,
                  width: `${position.width}%`,
                  minHeight: `${position.height}%`,
                  backgroundColor: bgColor,
                }}
              >
                <div
                  style={{
                    fontSize: `${position.fontSize}px`,
                    fontFamily: fontFamily,
                    color: fontColor,
                    opacity: hasValue ? 1 : 0.5,
                    fontStyle: hasValue ? 'normal' : 'italic',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    paddingTop: `${position.fontSize * 0.2}px`,
                    lineHeight: `${position.fontSize * 1.8}px`,
                  }}
                >
                  {displayValue}
                </div>
              </div>
            );
          })}

          {/* QR Code - Placeholder or Example */}
          <div
            className="absolute bg-white flex items-center justify-center"
            style={{
              left: `${effectiveQRPosition.x}%`,
              top: `${effectiveQRPosition.y}%`,
              width: `${effectiveQRPosition.size}%`,
              aspectRatio: '1 / 1',
            }}
          >
            {showQRCode ? (
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
            ) : (
              // Just show white placeholder when QR code is hidden
              <div className="w-full h-full bg-white" />
            )}
          </div>
        </div>
      </div>

      {/* Sample Data Info */}
      {attributeNames.length > 0 && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <ThemedText className="text-xs font-medium text-blue-900 mb-2">
            Configured Attributes:
          </ThemedText>
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
          <ThemedText className="text-xs text-yellow-800">
            No attributes have been positioned yet. Use the &quot;Configure Positions&quot; button
            to add attributes to the credential template.
          </ThemedText>
        </div>
      )}

      {attributeNames.length === 0 && !showTitle && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <ThemedText className="text-xs text-blue-800">
            💡 <strong>Attribute positions not configured.</strong> To configure attribute positions
            and properties for this credential, go to the <strong>Schema page</strong> and update
            this schema to set the position, font size, and styling for each attribute.
          </ThemedText>
        </div>
      )}
    </div>
  );
}
