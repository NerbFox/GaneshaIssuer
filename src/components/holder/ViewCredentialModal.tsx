'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Modal from '@/components/shared/Modal';
import { ViewCredential } from '@/components/shared/ViewCredential';
import { VerifiableCredential } from '@/utils/indexedDB';
import { fetchSchemaByVersion } from '@/services/schemaService'; // Import fetchSchemaByVersion

interface ViewCredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCredential: VerifiableCredential | VerifiableCredential[] | null;
  onDownload: (id: string) => void;
  onDownloadPdf?: (id: string) => void;
}

interface SchemaProperty {
  type: string;
  [key: string]: unknown;
}

export const ViewCredentialModal: React.FC<ViewCredentialModalProps> = ({
  isOpen,
  onClose,
  selectedCredential,
  onDownload,
  onDownloadPdf,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [schemaAttributes, setSchemaAttributes] = useState<
    Array<{ name: string; type: string; required: boolean }>
  >([]); // State for schema attributes
  const [isLoadingSchema, setIsLoadingSchema] = useState(false); // State for schema loading

  // Normalize the credential data to always work with an array
  const credentials = Array.isArray(selectedCredential)
    ? selectedCredential
    : selectedCredential
      ? [selectedCredential]
      : [];

  const hasMultiple = credentials.length > 1;
  const currentCredential = credentials[currentIndex];

  // Fetch schema data when currentCredential changes
  useEffect(() => {
    const loadSchemaAttributes = async () => {
      if (!currentCredential?.id) {
        setSchemaAttributes([]);
        return;
      }

      setIsLoadingSchema(true);
      try {
        // Parse schema_id and schema_version from vc.id
        // vc.id format: "schema_id:schema_version:holder_did:timestamp"
        let schemaId = '';
        let schemaVersion = 1;

        if (currentCredential.id) {
          const vcIdParts = currentCredential.id.split(':');
          if (vcIdParts.length >= 2 && vcIdParts[0] !== 'undefined' && vcIdParts[0] !== '') {
            schemaId = vcIdParts[0];
            schemaVersion = parseInt(vcIdParts[1], 10) || 1;
          }
        }

        if (schemaId) {
          const response = await fetchSchemaByVersion(schemaId, schemaVersion);
          if (response.success && response.data) {
            const attributes = Object.entries(response.data.schema.properties).map(
              ([name, prop]) => ({
                name,
                type: (prop as SchemaProperty).type,
                required: response.data.schema.required.includes(name),
              })
            );
            setSchemaAttributes(attributes);
          } else {
            setSchemaAttributes([]);
          }
        } else {
          setSchemaAttributes([]);
        }
      } catch (error) {
        console.error('Error fetching schema for VC:', error);
        setSchemaAttributes([]);
      } finally {
        setIsLoadingSchema(false);
      }
    };

    if (isOpen && currentCredential) {
      loadSchemaAttributes();
    } else {
      setSchemaAttributes([]);
    }
  }, [isOpen, currentCredential]);

  // Reset index when modal opens or credential changes
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
    }
  }, [isOpen, selectedCredential]);

  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : credentials.length - 1));
  }, [credentials.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < credentials.length - 1 ? prev + 1 : 0));
  }, [credentials.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen || !hasMultiple) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasMultiple, handlePrevious, handleNext]);

  const handleDotClick = (index: number) => {
    setCurrentIndex(index);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="View Credential" minHeight="700px">
      {currentCredential && !isLoadingSchema ? ( // Only render if schema is not loading
        <>
          {/* Carousel Navigation - Top */}
          {hasMultiple && (
            <div className="flex items-center justify-between px-8 py-4 border-b border-gray-200">
              <button
                onClick={handlePrevious}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                aria-label="Previous credential"
              >
                <svg
                  className="w-6 h-6 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">
                  Credential {currentIndex + 1} of {credentials.length}
                </span>
              </div>

              <button
                onClick={handleNext}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                aria-label="Next credential"
              >
                <svg
                  className="w-6 h-6 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          )}

          {/* Credential Content */}
          <ViewCredential
            credentialData={{
              id: currentCredential.id,
              credentialType:
                currentCredential.type.find((t) => t !== 'VerifiableCredential') || 'Unknown',
              issuer: currentCredential.issuer,
              issuerName: currentCredential.issuerName,
              holder: currentCredential.credentialSubject.id,
              validFrom: currentCredential.validFrom,
              expiredAt: currentCredential.expiredAt,
              status:
                // Only the newest credential (index 0) can be Active
                // All other versions (including expired) are marked as Revoked
                currentIndex === 0 ? 'Active' : 'Revoked',
              imageLink: currentCredential.imageLink,
              attributes: Object.entries(currentCredential.credentialSubject)
                .filter(([key]) => key !== 'id')
                .map(([name, value]) => ({
                  name,
                  value: typeof value === 'object' ? JSON.stringify(value) : String(value),
                })),
              proof: currentCredential.proof,
            }}
            schemaAttributes={schemaAttributes} // Pass schema attributes
            onClose={onClose}
            onDownload={() => onDownload(currentCredential.id)}
            onDownloadPdf={onDownloadPdf ? () => onDownloadPdf(currentCredential.id) : undefined}
          />

          {/* Carousel Indicators - Bottom */}
          {hasMultiple && (
            <div className="flex justify-center gap-2 px-8 pb-6">
              {credentials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => handleDotClick(index)}
                  className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
                    index === currentIndex
                      ? 'w-8 bg-blue-500'
                      : 'w-2.5 bg-gray-300 hover:bg-gray-400'
                  }`}
                  aria-label={`Go to credential ${index + 1}`}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        // Loading state or error handling
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="ml-4 text-gray-600">Loading credential details...</p>
        </div>
      )}
    </Modal>
  );
};
