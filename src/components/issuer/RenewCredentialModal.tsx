'use client';

import React from 'react';
import Modal from '@/components/shared/Modal';
import RenewCredentialForm from '@/components/issuer/RenewCredentialForm';

interface VerifiableCredentialData {
  id: string;
  type: string[];
  issuer: { id: string; name: string };
  credentialSubject: {
    id: string;
    [key: string]: unknown;
  };
  validFrom: string;
  expiredAt: string;
  credentialStatus?: {
    id: string;
    type: string;
    revoked?: boolean;
  };
  proof?: unknown;
  imageLink?: string;
  fileUrl?: string;
  fileId?: string;
  issuerName?: string;
  '@context'?: string[];
}

interface IssuedCredential {
  id: string;
  holderDid: string;
  schemaName: string;
  status: string;
  activeUntil: string;
  schemaId: string;
  schemaVersion: number;
  encryptedBody?: Record<string, unknown>;
  createdAt: string;
  vcId?: string;
  vcHistory?: VerifiableCredentialData[];
}

interface RenewCredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRenew: () => void;
  selectedCredential: IssuedCredential | null;
}

export const RenewCredentialModal: React.FC<RenewCredentialModalProps> = ({
  isOpen,
  onClose,
  onRenew,
  selectedCredential,
}) => {
  if (!selectedCredential) return null;

  // Extract attributes from encryptedBody
  const attributes = selectedCredential.encryptedBody
    ? Object.entries(selectedCredential.encryptedBody)
        .filter(
          ([key]) => !['schema_id', 'schema_version', 'issuer_did', 'holder_did'].includes(key)
        )
        .map(([name, value], index) => ({
          id: index + 1,
          name,
          value: String(value),
        }))
    : [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Renew Credential" maxWidth="1000px">
      <RenewCredentialForm
        onClose={onClose}
        onRenew={onRenew}
        credentialData={{
          id: selectedCredential.vcId || selectedCredential.id,
          holderDid: selectedCredential.holderDid,
          issuerDid: localStorage.getItem('institutionDID') || undefined,
          schemaName: selectedCredential.schemaName,
          schemaId: selectedCredential.schemaId,
          schemaVersion: selectedCredential.schemaVersion,
          status: selectedCredential.status,
          issuedAt: selectedCredential.createdAt,
          activeUntil: selectedCredential.activeUntil,
          attributes,
        }}
        vcHistory={selectedCredential.vcHistory}
      />
    </Modal>
  );
};
