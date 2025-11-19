'use client';

import React from 'react';
import Modal from '@/components/Modal';
import { ViewCredential } from '@/components/ViewCredential';
import { VerifiableCredential } from '@/utils/indexedDB';

interface ViewCredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCredential: VerifiableCredential | null;
  onDownload: (id: string) => void;
  onDownloadPdf?: (id: string) => void;
}

export const ViewCredentialModal: React.FC<ViewCredentialModalProps> = ({
  isOpen,
  onClose,
  selectedCredential,
  onDownload,
  onDownloadPdf,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="View Credential" minHeight="700px">
      {selectedCredential && (
        <ViewCredential
          credentialData={{
            id: selectedCredential.id,
            credentialType:
              selectedCredential.type.find((t) => t !== 'VerifiableCredential') || 'Unknown',
            issuer: selectedCredential.issuer,
            issuerName: selectedCredential.issuerName,
            holder: selectedCredential.credentialSubject.id,
            validFrom: selectedCredential.validFrom,
            expiredAt: selectedCredential.expiredAt,
            status: selectedCredential.expiredAt
              ? new Date(selectedCredential.expiredAt) < new Date()
                ? 'Expired'
                : 'Active'
              : 'Active',
            imageLink: selectedCredential.imageLink,
            attributes: Object.entries(selectedCredential.credentialSubject)
              .filter(([key]) => key !== 'id')
              .map(([name, value]) => ({
                name,
                value: typeof value === 'object' ? JSON.stringify(value) : String(value),
              })),
            proof: selectedCredential.proof,
          }}
          onClose={onClose}
          onDownload={() => onDownload(selectedCredential.id)}
          onDownloadPdf={onDownloadPdf ? () => onDownloadPdf(selectedCredential.id) : undefined}
        />
      )}
    </Modal>
  );
};
