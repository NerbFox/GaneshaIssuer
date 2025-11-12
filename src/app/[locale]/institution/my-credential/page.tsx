'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import InstitutionLayout from '@/components/InstitutionLayout';
import { ThemedText } from '@/components/ThemedText';
import { DataTable, Column } from '@/components/DataTable';
import { redirectIfJWTInvalid } from '@/utils/auth';
import Modal from '@/components/Modal';
import { buildApiUrlWithParams, buildApiUrl, API_ENDPOINTS } from '@/utils/api';
import { encryptWithPublicKey, decryptWithPrivateKey } from '@/utils/encryptUtils';
import {
  storeVCBatch,
  getAllVCs,
  areVCsStoredByRequestIds,
  VerifiableCredential,
  getVCById,
  storeVC,
} from '@/utils/indexedDB';
import { ViewCredential } from '@/components/ViewCredential';
import { validateVCComprehensive } from '@/utils/vcValidator';
import { hashVC } from '@/utils/vcUtils';
import InfoModal from '@/components/InfoModal';
import { authenticatedPost } from '@/utils/api-client';

/**
 * Renew-specific credential data
 * Prepared from VerifiableCredential for renewal request
 */
interface VCRenewCredentialData {
  // VC Identification
  vc_id: string;

  // Schema Information (derived from credential type)
  schema_id: string;
  schema_version: number;
  schema_name: string;

  // Credential Subject Data - all dynamic fields
  attributes: {
    [key: string]: string | number | boolean;
  };

  // Mandatory Subject Fields
  id: string; // Subject DID

  // Validity Period
  valid_from: string;
  expiration_date: string | null;

  // VC Metadata
  vc_type: string[];
  vc_context: string[];

  // Issuer Information
  issuer: string;
  issuer_name: string;

  // Renewal specific
  renewal_reason: string;

  // Optional image reference
  image_link?: string | null;
}

/**
 * Update-specific credential data
 * Prepared from VerifiableCredential for update request
 */
interface VCUpdateCredentialData {
  // VC Identification
  vc_id: string;

  // Schema Information (derived from credential type)
  schema_id: string;
  schema_version: number;
  schema_name: string;

  // Credential Subject Data - all dynamic fields
  attributes: {
    [key: string]: string | number | boolean;
  };

  // Mandatory Subject Fields
  id: string; // Subject DID

  // Validity Period
  valid_from: string;
  expiration_date: string | null;

  // VC Metadata
  vc_type: string[];
  vc_context: string[];

  // Issuer Information
  issuer: string;
  issuer_name: string;

  // Update specific
  update_reason: string;

  // Optional image reference
  image_link?: string | null;
}

/**
 * Revoke-specific credential data
 * Prepared from VerifiableCredential for revocation request
 */
interface VCRevokeCredentialData {
  // VC Identification
  vc_id: string;

  // Schema Information (derived from credential type)
  schema_id: string;
  schema_version: number;
  schema_name: string;

  // Credential Subject Data - all dynamic fields
  attributes: {
    [key: string]: string | number | boolean;
  };

  // Mandatory Subject Fields
  id: string; // Subject DID

  // Validity Period
  valid_from: string;
  expiration_date: string | null;

  // VC Metadata
  vc_type: string[];
  vc_context: string[];

  // Issuer Information
  issuer: string;
  issuer_name: string;

  // Revoke specific
  revocation_reason: string;

  // Optional image reference
  image_link?: string | null;
}

interface Credential {
  id: string;
  credentialType: string;
  issuerDid: string;
  issuerName: string;
  issuedDate: string;
  expiryDate: string;
  status: 'Active' | 'Expired' | 'Revoked';
}

interface Schema {
  id: string;
  version: number;
  name: string;
  schema: {
    type: string;
    required: string[];
    expired_in: number;
    properties: {
      [key: string]: {
        type: string;
        description: string;
      };
    };
  };
  issuer_did: string;
  issuer_name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SchemaWithCompositeId extends Schema {
  compositeId: string;
}

interface VCInfoItem {
  id: string;
  name: string;
  value: string;
}

interface AttributeItem {
  id: string;
  name: string;
  type: string;
}

export default function MyCredentialPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [filteredCredentials, setFilteredCredentials] = useState<Credential[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'Active' | 'Expired' | 'Revoked'>('all');
  const [filterType, setFilterType] = useState('');
  const [filterButtonPosition, setFilterButtonPosition] = useState({ top: 0, left: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // Request New Credential Modal
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [schemas, setSchemas] = useState<SchemaWithCompositeId[]>([]);
  const [filteredSchemas, setFilteredSchemas] = useState<SchemaWithCompositeId[]>([]);
  const [isSchemasLoading, setIsSchemasLoading] = useState(false);
  const [expandedSchemaId, setExpandedSchemaId] = useState<string | null>(null);

  // Helper function to add composite IDs to schemas
  const addCompositeIds = (schemas: Schema[]): SchemaWithCompositeId[] => {
    return schemas.map((schema, index) => ({
      ...schema,
      compositeId:
        schema.id && schema.version !== undefined
          ? `${schema.id}-v${schema.version}`
          : `schema-${index}`, // Fallback for schemas without proper id or version
    }));
  };

  // View Credential Modal
  const [showViewCredentialModal, setShowViewCredentialModal] = useState(false);
  const [selectedCredential, setSelectedCredential] = useState<VerifiableCredential | null>(null);

  // Renew Credential Modal
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewingCredential, setRenewingCredential] = useState<VerifiableCredential | null>(null);
  const [renewalReason, setRenewalReason] = useState('');
  const [isRenewing, setIsRenewing] = useState(false);

  // Update Credential Modal
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updatingCredential, setUpdatingCredential] = useState<VerifiableCredential | null>(null);
  const [updatedAttributes, setUpdatedAttributes] = useState<{
    [key: string]: string | number | boolean;
  }>({});
  const [updateReason, setUpdateReason] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Revoke Credential Modal
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [revokingCredential, setRevokingCredential] = useState<VerifiableCredential | null>(null);
  const [revocationReason, setRevocationReason] = useState('');
  const [isRevoking, setIsRevoking] = useState(false);

  // Upload VC Modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [, setUploadedFile] = useState<File | null>(null);
  const [uploadedVC, setUploadedVC] = useState<VerifiableCredential | null>(null);
  const [uploadValidation, setUploadValidation] = useState<{
    isValid: boolean;
    errors: string[];
    stage?: 'structure' | 'api' | 'duplicate';
  } | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoModalConfig, setInfoModalConfig] = useState({
    title: '',
    message: '',
    buttonColor: 'blue' as 'blue' | 'green' | 'red' | 'yellow',
  });

  const filterModalRef = useRef<HTMLDivElement>(null);

  const activeCount = credentials.filter((c) => c.status === 'Active').length;

  // Check authentication with JWT verification on component mount
  useEffect(() => {
    const checkAuth = async () => {
      const redirected = await redirectIfJWTInvalid(router);
      if (!redirected) {
        setIsAuthenticated(true);
        // Fetch and store credentials after authentication
        await fetchAndStoreCredentials();
      }
    };

    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Close filter modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showFilterModal &&
        filterModalRef.current &&
        !filterModalRef.current.contains(event.target as Node)
      ) {
        setShowFilterModal(false);
      }
    };

    if (showFilterModal) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFilterModal]);

  const handleSearch = (value: string) => {
    const filtered = credentials.filter((credential) => {
      const searchLower = value.toLowerCase();
      return (
        credential.credentialType.toLowerCase().includes(searchLower) ||
        credential.issuerDid.toLowerCase().includes(searchLower) ||
        credential.issuerName.toLowerCase().includes(searchLower) ||
        credential.status.toLowerCase().includes(searchLower)
      );
    });
    setFilteredCredentials(filtered);
  };

  const handleFilter = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setFilterButtonPosition({
      top: rect.bottom + 8,
      left: rect.left,
    });
    setShowFilterModal(true);
  };

  const applyFilters = (status: 'all' | 'Active' | 'Expired' | 'Revoked', type: string) => {
    let filtered = credentials;

    if (status !== 'all') {
      filtered = filtered.filter((credential) => credential.status === status);
    }

    if (type) {
      filtered = filtered.filter((credential) =>
        credential.credentialType.toLowerCase().includes(type.toLowerCase())
      );
    }

    setFilteredCredentials(filtered);
  };

  const handleStatusChange = (status: 'all' | 'Active' | 'Expired' | 'Revoked') => {
    setFilterStatus(status);
    applyFilters(status, filterType);
  };

  const handleTypeChange = (type: string) => {
    setFilterType(type);
    applyFilters(filterStatus, type);
  };

  const handleView = async (id: string) => {
    try {
      console.log('View credential:', id);

      // Fetch the full VC from IndexedDB
      const vc = await getVCById(id);

      if (vc) console.log('VC Hash View:', hashVC(vc));
      if (vc) console.log('VC Content View:', vc);

      if (!vc) {
        setInfoModalConfig({
          title: 'Credential Not Found',
          message: 'The requested credential could not be found in storage.',
          buttonColor: 'red',
        });
        setShowInfoModal(true);
        return;
      }

      setSelectedCredential(vc);
      setShowViewCredentialModal(true);
    } catch (error) {
      console.error('Error loading credential:', error);
      setInfoModalConfig({
        title: 'Error Loading Credential',
        message: 'Failed to load credential details. Please try again.',
        buttonColor: 'red',
      });
      setShowInfoModal(true);
    }
  };

  const handlePresent = (id: string) => {
    console.log('Present credential:', id);
    // TODO: Implement present credential
  };

  const handleUpdate = async (id: string) => {
    try {
      console.log('Update credential:', id);

      // Fetch the full VC from IndexedDB
      const vc = await getVCById(id);

      if (!vc) {
        setInfoModalConfig({
          title: 'Credential Not Found',
          message: 'The requested credential could not be found in storage.',
          buttonColor: 'red',
        });
        setShowInfoModal(true);
        return;
      }

      // Extract attributes (excluding 'id' field)
      const credentialSubject = vc.credentialSubject;
      const { ...attributes } = credentialSubject;

      setUpdatingCredential(vc);
      setUpdatedAttributes(attributes as { [key: string]: string | number | boolean });
      setUpdateReason('');
      setShowUpdateModal(true);
    } catch (error) {
      console.error('Error loading credential for update:', error);
      setInfoModalConfig({
        title: 'Error Loading Credential',
        message: 'Failed to load credential details. Please try again.',
        buttonColor: 'red',
      });
      setShowInfoModal(true);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      console.log('Revoke credential:', id);

      // Fetch the full VC from IndexedDB
      const vc = await getVCById(id);

      if (!vc) {
        setInfoModalConfig({
          title: 'Credential Not Found',
          message: 'The requested credential could not be found in storage.',
          buttonColor: 'red',
        });
        setShowInfoModal(true);
        return;
      }

      setRevokingCredential(vc);
      setRevocationReason('');
      setShowRevokeModal(true);
    } catch (error) {
      console.error('Error loading credential for revocation:', error);
      setInfoModalConfig({
        title: 'Error Loading Credential',
        message: 'Failed to load credential details. Please try again.',
        buttonColor: 'red',
      });
      setShowInfoModal(true);
    }
  };

  const handleRenew = async (id: string) => {
    try {
      console.log('Renew credential:', id);

      // Fetch the full VC from IndexedDB
      const vc = await getVCById(id);

      if (!vc) {
        setInfoModalConfig({
          title: 'Credential Not Found',
          message: 'The requested credential could not be found in storage.',
          buttonColor: 'red',
        });
        setShowInfoModal(true);
        return;
      }

      setRenewingCredential(vc);
      setRenewalReason('');
      setShowRenewModal(true);
    } catch (error) {
      console.error('Error loading credential for renewal:', error);
      setInfoModalConfig({
        title: 'Error Loading Credential',
        message: 'Failed to load credential details. Please try again.',
        buttonColor: 'red',
      });
      setShowInfoModal(true);
    }
  };

  const handleSubmitRenew = async () => {
    if (!renewingCredential || !renewalReason.trim()) {
      setInfoModalConfig({
        title: 'Missing Information',
        message: 'Please provide a reason for renewal.',
        buttonColor: 'yellow',
      });
      setShowInfoModal(true);
      return;
    }

    setIsRenewing(true);

    try {
      // Get holder DID from localStorage
      const holderDid = localStorage.getItem('institutionDID');

      if (!holderDid) {
        throw new Error('Missing holder DID');
      }

      // Fetch issuer's DID document to get public key
      const issuerDid = renewingCredential.issuer;
      console.log('Fetching DID document for issuer:', issuerDid);

      const didDocResponse = await fetch(buildApiUrl(API_ENDPOINTS.DIDS.DOCUMENT(issuerDid)));

      if (!didDocResponse.ok) {
        throw new Error('Failed to fetch issuer DID document');
      }

      const didDocData = await didDocResponse.json();

      if (!didDocData.success || !didDocData.data) {
        throw new Error('Invalid DID document response');
      }

      // Extract public key from DID document
      const keyId = didDocData.data.keyId;
      const issuerPublicKey = didDocData.data[keyId];

      if (!issuerPublicKey) {
        throw new Error('Public key not found in DID document');
      }

      console.log('Issuer public key retrieved from DID document');

      // Extract credential subject attributes (excluding 'id' field)
      const credentialSubject = renewingCredential.credentialSubject;
      const { id: subjectId, ...rawAttributes } = credentialSubject;

      // Convert attributes to proper types
      const attributes: { [key: string]: string | number | boolean } = {};
      Object.entries(rawAttributes).forEach(([key, value]) => {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          attributes[key] = value;
        } else if (value !== null && value !== undefined) {
          // Convert other types to string
          attributes[key] = String(value);
        }
      });

      // Extract schema ID and version from VC id
      // Format: {schema_id}:{schema_version}:{holder_did}:{timestamp}
      const vcIdParts = renewingCredential.id.split(':');
      let schemaId = 'Unknown';
      let schemaVersion = 1;

      if (vcIdParts.length >= 2) {
        schemaId = vcIdParts[0];
        schemaVersion = parseInt(vcIdParts[1], 10) || 1;
      }

      // Get schema name from the credential type
      const schemaName = Array.isArray(renewingCredential.type)
        ? renewingCredential.type.find((t) => t !== 'VerifiableCredential') || 'Unknown'
        : 'Unknown';

      // Prepare renewal data according to VCRenewCredentialData interface
      const renewalData: VCRenewCredentialData = {
        vc_id: renewingCredential.id,
        schema_id: schemaId,
        schema_version: schemaVersion,
        schema_name: schemaName,
        attributes: attributes,
        id: subjectId,
        valid_from: renewingCredential.validFrom,
        expiration_date: renewingCredential.expiredAt,
        vc_type: Array.isArray(renewingCredential.type)
          ? renewingCredential.type
          : [renewingCredential.type],
        vc_context: Array.isArray(renewingCredential['@context'])
          ? renewingCredential['@context']
          : [renewingCredential['@context']],
        issuer: renewingCredential.issuer,
        issuer_name: renewingCredential.issuerName,
        renewal_reason: renewalReason.trim(),
        image_link: renewingCredential.imageLink || null,
      };

      console.log('Renewal data prepared:', renewalData);

      // Encrypt the renewal data
      const encryptedBody = await encryptWithPublicKey(
        renewalData as unknown as Record<string, string | number | boolean | null>,
        issuerPublicKey
      );

      console.log('Renewal data encrypted');

      // Prepare the request payload
      const requestPayload = {
        issuer_did: renewingCredential.issuer,
        holder_did: holderDid,
        encrypted_body: encryptedBody,
      };

      console.log('Sending renewal request...');

      // Send the renewal request
      const response = await authenticatedPost(
        buildApiUrl(API_ENDPOINTS.CREDENTIALS.RENEW_REQUEST),
        requestPayload
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Failed to submit renewal request: ${response.statusText}`
        );
      }

      const responseData = await response.json();
      console.log('Renewal request submitted successfully:', responseData);

      // Close the modal and show success message
      setShowRenewModal(false);
      setRenewingCredential(null);
      setRenewalReason('');

      setInfoModalConfig({
        title: 'Renewal Request Submitted',
        message:
          'Your credential renewal request has been submitted successfully. The issuer will review your request.',
        buttonColor: 'green',
      });
      setShowInfoModal(true);
    } catch (error) {
      console.error('Error submitting renewal request:', error);
      setInfoModalConfig({
        title: 'Renewal Request Failed',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to submit renewal request. Please try again.',
        buttonColor: 'red',
      });
      setShowInfoModal(true);
    } finally {
      setIsRenewing(false);
    }
  };

  const handleSubmitUpdate = async () => {
    if (!updatingCredential || !updateReason.trim()) {
      setInfoModalConfig({
        title: 'Missing Information',
        message: 'Please provide a reason for update.',
        buttonColor: 'yellow',
      });
      setShowInfoModal(true);
      return;
    }

    setIsUpdating(true);

    try {
      // Get holder DID from localStorage
      const holderDid = localStorage.getItem('institutionDID');

      if (!holderDid) {
        throw new Error('Missing holder DID');
      }

      // Fetch issuer's DID document to get public key
      const issuerDid = updatingCredential.issuer;
      console.log('Fetching DID document for issuer:', issuerDid);

      const didDocResponse = await fetch(buildApiUrl(API_ENDPOINTS.DIDS.DOCUMENT(issuerDid)));

      if (!didDocResponse.ok) {
        throw new Error('Failed to fetch issuer DID document');
      }

      const didDocData = await didDocResponse.json();

      if (!didDocData.success || !didDocData.data) {
        throw new Error('Invalid DID document response');
      }

      // Extract public key from DID document
      const keyId = didDocData.data.keyId;
      const issuerPublicKey = didDocData.data[keyId];

      if (!issuerPublicKey) {
        throw new Error('Public key not found in DID document');
      }

      console.log('Issuer public key retrieved from DID document');

      // Use the updated attributes from state
      const attributes: { [key: string]: string | number | boolean } = { ...updatedAttributes };

      // Extract schema ID and version from VC id
      // Format: {schema_id}:{schema_version}:{holder_did}:{timestamp}
      const vcIdParts = updatingCredential.id.split(':');
      let schemaId = 'Unknown';
      let schemaVersion = 1;

      if (vcIdParts.length >= 2) {
        schemaId = vcIdParts[0];
        schemaVersion = parseInt(vcIdParts[1], 10) || 1;
      }

      // Get schema name from the credential type
      const schemaName = Array.isArray(updatingCredential.type)
        ? updatingCredential.type.find((t) => t !== 'VerifiableCredential') || 'Unknown'
        : 'Unknown';

      // Prepare update data according to VCUpdateCredentialData interface
      const updateData: VCUpdateCredentialData = {
        vc_id: updatingCredential.id,
        schema_id: schemaId,
        schema_version: schemaVersion,
        schema_name: schemaName,
        attributes: attributes,
        id: updatingCredential.credentialSubject.id,
        valid_from: updatingCredential.validFrom,
        expiration_date: updatingCredential.expiredAt,
        vc_type: Array.isArray(updatingCredential.type)
          ? updatingCredential.type
          : [updatingCredential.type],
        vc_context: Array.isArray(updatingCredential['@context'])
          ? updatingCredential['@context']
          : [updatingCredential['@context']],
        issuer: updatingCredential.issuer,
        issuer_name: updatingCredential.issuerName,
        update_reason: updateReason.trim(),
        image_link: updatingCredential.imageLink || null,
      };

      console.log('Update data prepared:', updateData);

      // Encrypt the update data
      const encryptedBody = await encryptWithPublicKey(
        updateData as unknown as Record<string, string | number | boolean | null>,
        issuerPublicKey
      );

      console.log('Update data encrypted');

      // Prepare the request payload
      const requestPayload = {
        issuer_did: updatingCredential.issuer,
        holder_did: holderDid,
        encrypted_body: encryptedBody,
      };

      console.log('Sending update request...');

      // Send the update request
      const response = await authenticatedPost(
        buildApiUrl(API_ENDPOINTS.CREDENTIALS.UPDATE_REQUEST),
        requestPayload
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Failed to submit update request: ${response.statusText}`
        );
      }

      const responseData = await response.json();
      console.log('Update request submitted successfully:', responseData);

      // Close the modal and show success message
      setShowUpdateModal(false);
      setUpdatingCredential(null);
      setUpdatedAttributes({});
      setUpdateReason('');

      setInfoModalConfig({
        title: 'Update Request Submitted',
        message:
          'Your credential update request has been submitted successfully. The issuer will review your request.',
        buttonColor: 'green',
      });
      setShowInfoModal(true);
    } catch (error) {
      console.error('Error submitting update request:', error);
      setInfoModalConfig({
        title: 'Update Request Failed',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to submit update request. Please try again.',
        buttonColor: 'red',
      });
      setShowInfoModal(true);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSubmitRevoke = async () => {
    if (!revokingCredential || !revocationReason.trim()) {
      setInfoModalConfig({
        title: 'Missing Information',
        message: 'Please provide a reason for revocation.',
        buttonColor: 'yellow',
      });
      setShowInfoModal(true);
      return;
    }

    setIsRevoking(true);

    try {
      // Get holder DID from localStorage
      const holderDid = localStorage.getItem('institutionDID');

      if (!holderDid) {
        throw new Error('Missing holder DID');
      }

      // Fetch issuer's DID document to get public key
      const issuerDid = revokingCredential.issuer;
      console.log('Fetching DID document for issuer:', issuerDid);

      const didDocResponse = await fetch(buildApiUrl(API_ENDPOINTS.DIDS.DOCUMENT(issuerDid)));

      if (!didDocResponse.ok) {
        throw new Error('Failed to fetch issuer DID document');
      }

      const didDocData = await didDocResponse.json();

      if (!didDocData.success || !didDocData.data) {
        throw new Error('Invalid DID document response');
      }

      // Extract public key from DID document
      const keyId = didDocData.data.keyId;
      const issuerPublicKey = didDocData.data[keyId];

      if (!issuerPublicKey) {
        throw new Error('Public key not found in DID document');
      }

      console.log('Issuer public key retrieved from DID document');

      // Extract credential subject attributes (excluding 'id' field)
      const credentialSubject = revokingCredential.credentialSubject;
      const { id: subjectId, ...rawAttributes } = credentialSubject;

      // Convert attributes to proper types
      const attributes: { [key: string]: string | number | boolean } = {};
      Object.entries(rawAttributes).forEach(([key, value]) => {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          attributes[key] = value;
        } else if (value !== null && value !== undefined) {
          // Convert other types to string
          attributes[key] = String(value);
        }
      });

      // Extract schema ID and version from VC id
      // Format: {schema_id}:{schema_version}:{holder_did}:{timestamp}
      const vcIdParts = revokingCredential.id.split(':');
      let schemaId = 'Unknown';
      let schemaVersion = 1;

      if (vcIdParts.length >= 2) {
        schemaId = vcIdParts[0];
        schemaVersion = parseInt(vcIdParts[1], 10) || 1;
      }

      // Get schema name from the credential type
      const schemaName = Array.isArray(revokingCredential.type)
        ? revokingCredential.type.find((t) => t !== 'VerifiableCredential') || 'Unknown'
        : 'Unknown';

      // Prepare revocation data according to VCRevokeCredentialData interface
      const revocationData: VCRevokeCredentialData = {
        vc_id: revokingCredential.id,
        schema_id: schemaId,
        schema_version: schemaVersion,
        schema_name: schemaName,
        attributes: attributes,
        id: subjectId,
        valid_from: revokingCredential.validFrom,
        expiration_date: revokingCredential.expiredAt,
        vc_type: Array.isArray(revokingCredential.type)
          ? revokingCredential.type
          : [revokingCredential.type],
        vc_context: Array.isArray(revokingCredential['@context'])
          ? revokingCredential['@context']
          : [revokingCredential['@context']],
        issuer: revokingCredential.issuer,
        issuer_name: revokingCredential.issuerName,
        revocation_reason: revocationReason.trim(),
        image_link: revokingCredential.imageLink || null,
      };

      console.log('Revocation data prepared:', revocationData);

      // Encrypt the revocation data
      const encryptedBody = await encryptWithPublicKey(
        revocationData as unknown as Record<string, string | number | boolean | null>,
        issuerPublicKey
      );

      console.log('Revocation data encrypted');

      // Prepare the request payload
      const requestPayload = {
        issuer_did: revokingCredential.issuer,
        holder_did: holderDid,
        encrypted_body: encryptedBody,
      };

      console.log('Sending revocation request...');

      // Send the revocation request
      const response = await authenticatedPost(
        buildApiUrl(API_ENDPOINTS.CREDENTIALS.REVOKE_REQUEST),
        requestPayload
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Failed to submit revocation request: ${response.statusText}`
        );
      }

      const responseData = await response.json();
      console.log('Revocation request submitted successfully:', responseData);

      // Close the modal and show success message
      setShowRevokeModal(false);
      setRevokingCredential(null);
      setRevocationReason('');

      setInfoModalConfig({
        title: 'Revocation Request Submitted',
        message:
          'Your credential revocation request has been submitted successfully. The issuer will review your request.',
        buttonColor: 'green',
      });
      setShowInfoModal(true);
    } catch (error) {
      console.error('Error submitting revocation request:', error);
      setInfoModalConfig({
        title: 'Revocation Request Failed',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to submit revocation request. Please try again.',
        buttonColor: 'red',
      });
      setShowInfoModal(true);
    } finally {
      setIsRevoking(false);
    }
  };

  const handleDownload = async (id: string) => {
    try {
      console.log('Download credential:', id);

      // Fetch the full VC from IndexedDB
      const vc = await getVCById(id);

      if (vc) console.log('VC Hash Download:', hashVC(vc));

      if (!vc) {
        setInfoModalConfig({
          title: 'Credential Not Found',
          message: 'The requested credential could not be found in storage.',
          buttonColor: 'red',
        });
        setShowInfoModal(true);
        return;
      }

      // Create a copy of the VC without the claimIdfield
      const { claimId, ...vcWithoutRequestId } = vc;

      // Convert VC to JSON string with pretty formatting (without claimId)
      const jsonString = JSON.stringify(vcWithoutRequestId, null, 2);
      console.log('claimId:', claimId);
      console.log('vc without claimId download:', vcWithoutRequestId);

      // Create a blob and download link
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${id}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('Credential downloaded successfully');
    } catch (error) {
      console.error('Error downloading credential:', error);
      setInfoModalConfig({
        title: 'Download Failed',
        message: 'Failed to download credential. Please try again.',
        buttonColor: 'red',
      });
      setShowInfoModal(true);
    }
  };

  const fetchSchemas = async () => {
    setIsSchemasLoading(true);
    try {
      const token = localStorage.getItem('institutionToken');

      const headers: HeadersInit = {
        accept: 'application/json',
      };

      // Add authorization if token exists
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const url = buildApiUrlWithParams(API_ENDPOINTS.SCHEMAS.BASE, { isActive: true });

      const response = await fetch(url, {
        headers,
      });

      if (!response.ok) {
        const result = await response.json();
        const errorMessage = result.message || result.error || 'Failed to fetch schemas';
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('Schemas fetched:', result);

      if (result.success && result.data) {
        const schemasWithIds = addCompositeIds(result.data.data);
        console.log(
          'Schemas with composite IDs:',
          schemasWithIds.map((s) => ({
            id: s.id,
            version: s.version,
            compositeId: s.compositeId,
          }))
        );
        setSchemas(schemasWithIds);
        setFilteredSchemas(schemasWithIds);
      }
    } catch (error) {
      console.error('Error fetching schemas:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setInfoModalConfig({
        title: 'Error Fetching Schemas',
        message: `Failed to fetch schemas: ${errorMessage}`,
        buttonColor: 'red',
      });
      setShowInfoModal(true);
    } finally {
      setIsSchemasLoading(false);
    }
  };

  const handleRequestCredential = async (schemaId: string, issuerDid: string) => {
    try {
      const holderDid = localStorage.getItem('institutionDID');
      const token = localStorage.getItem('institutionToken');

      if (!holderDid) {
        setInfoModalConfig({
          title: 'Authentication Required',
          message: 'Holder DID not found. Please login again.',
          buttonColor: 'yellow',
        });
        setShowInfoModal(true);
        return;
      }

      if (!token) {
        setInfoModalConfig({
          title: 'Authentication Required',
          message: 'Authentication token not found. Please login again.',
          buttonColor: 'yellow',
        });
        setShowInfoModal(true);
        return;
      }

      // Find the schema to get its version
      const schema = schemas.find((s) => s.id === schemaId);
      if (!schema) {
        setInfoModalConfig({
          title: 'Schema Not Found',
          message: 'The requested schema could not be found.',
          buttonColor: 'red',
        });
        setShowInfoModal(true);
        return;
      }

      // Step 1: Fetch the DID document to get the public key
      console.log('Fetching DID document for:', issuerDid);
      const didDocumentUrl = buildApiUrl(API_ENDPOINTS.DIDS.DOCUMENT(issuerDid));

      const didResponse = await fetch(didDocumentUrl, {
        headers: {
          accept: 'application/json',
        },
      });

      if (!didResponse.ok) {
        const didResult = await didResponse.json();
        const errorMessage = didResult.message || didResult.error || 'Failed to fetch DID document';
        throw new Error(errorMessage);
      }

      const didResult = await didResponse.json();
      console.log('DID document fetched:', didResult);

      if (!didResult.success || !didResult.data) {
        throw new Error('Invalid DID document response');
      }

      // Extract the public key from the DID document
      const keyId = didResult.data.keyId; // e.g., "#key-1"
      const publicKeyHex = didResult.data[keyId]; // Get the public key using keyId

      if (!publicKeyHex) {
        throw new Error(`Public key not found for keyId: ${keyId}`);
      }

      console.log('Public key extracted:', publicKeyHex.substring(0, 20) + '...');

      // Step 2: Create the body data to encrypt
      const bodyData = {
        schema_id: schemaId,
        schema_version: schema.version,
      };

      console.log('Encrypting body data:', bodyData);

      // Step 3: Encrypt the body data with the issuer's public key
      const encryptedBody = await encryptWithPublicKey(bodyData, publicKeyHex);
      console.log('Body data encrypted successfully');

      // Step 4: Create the request body with encrypted data
      const requestBody = {
        holder_did: holderDid,
        issuer_did: issuerDid,
        encrypted_body: encryptedBody,
      };

      console.log('Requesting credential with: ', requestBody);

      const url = buildApiUrl(API_ENDPOINTS.CREDENTIALS.REQUESTS);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      console.log('Response status:', response.status);
      const result = await response.json();
      console.log('Response data:', result);

      if (!response.ok) {
        const errorMessage = result.message || result.error || 'Failed to request credential';
        throw new Error(errorMessage);
      }

      if (result.success) {
        setInfoModalConfig({
          title: 'Request Successful',
          message: `Credential request successful!\n\nRequest ID: ${result.data.claimId}\nStatus: ${result.data.status}`,
          buttonColor: 'green',
        });
        setShowInfoModal(true);
        setShowRequestModal(false);
      } else {
        throw new Error(result.message || 'Request failed');
      }
    } catch (error) {
      console.error('Error requesting credential:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setInfoModalConfig({
        title: 'Error',
        message: `Failed to request credential: ${errorMessage}\n\nPlease check the console for more details.`,
        buttonColor: 'red',
      });
      setShowInfoModal(true);
    }
  };

  /**
   * Claim VCs from the API in batches
   * Step 1: Fetch claimed VCs batch
   */
  const claimVCBatch = async (limit: number = 50): Promise<VerifiableCredential[]> => {
    try {
      const holderDid = localStorage.getItem('institutionDID');
      const token = localStorage.getItem('institutionToken');
      const privateKey = localStorage.getItem('institutionSigningPrivateKey');

      if (!holderDid) {
        throw new Error('Holder DID not found. Please login again.');
      }

      if (!token) {
        throw new Error('Authentication token not found. Please login again.');
      }

      if (!privateKey) {
        throw new Error('Private key not found. Please login again.');
      }

      console.log('[VC Claim] Starting VC claim process...');

      const allDecryptedVCs: VerifiableCredential[] = [];
      let hasMore = true;

      // Keep claiming until there are no more VCs
      while (hasMore) {
        console.log('[VC Claim] Claiming batch...');

        const url = buildApiUrl(API_ENDPOINTS.CREDENTIALS.CLAIM_COMBINED_BATCH);

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            holder_did: holderDid,
            limit: limit,
          }),
        });

        if (!response.ok) {
          const result = await response.json();
          const errorMessage = result.message || result.error || 'Failed to claim VCs';
          throw new Error(errorMessage);
        }

        const result = await response.json();
        console.log('[VC Claim] Response:', result);

        if (!result.success || !result.data) {
          throw new Error('Invalid claim response');
        }

        const { claimed_vcs, claimed_count, remaining_count, has_more } = result.data;

        console.log(`[VC Claim] Claimed ${claimed_count} VCs, ${remaining_count} remaining`);

        // Step 2: Decrypt each claimed VC
        if (claimed_vcs && claimed_vcs.length > 0) {
          for (const claimedVC of claimed_vcs) {
            try {
              console.log(`[VC Claim] Decrypting VC: ${claimedVC.claimId}`);

              // Decrypt the encrypted body
              const decryptedData = await decryptWithPrivateKey(
                claimedVC.encrypted_body,
                privateKey
              );

              console.log(`[VC Claim] Decrypted data for ${claimedVC.claimId}:`, decryptedData);

              // The decrypted data should be a VerifiableCredential
              const vc = decryptedData as unknown as VerifiableCredential;

              // Validate that the VC has required fields
              if (!vc || typeof vc !== 'object') {
                throw new Error('Decrypted data is not a valid object');
              }

              if (!vc.id) {
                console.error('[VC Claim] Decrypted VC is missing id field:', vc);
                throw new Error('Decrypted VC is missing required "id" field');
              }

              // Attach the claimId and source to the VC for later confirmation
              vc.claimId = claimedVC.claimId;
              vc.source = claimedVC.source;

              console.log(
                `[VC Claim] Decrypted VC successfully: ${vc.id} (claimId: ${claimedVC.claimId}) from ${claimedVC.source}`
              );
              allDecryptedVCs.push(vc);
            } catch (decryptError) {
              console.error(`[VC Claim] Failed to decrypt VC ${claimedVC.claimId}:`, decryptError);
              // Continue with other VCs even if one fails
            }
          }
        }

        // Check if there are more VCs to claim
        hasMore = has_more && remaining_count > 0;

        if (!hasMore) {
          console.log('[VC Claim] All VCs claimed successfully');
        }
      }

      return allDecryptedVCs;
    } catch (error) {
      console.error('[VC Claim] Error claiming VCs:', error);
      throw error;
    }
  };

  /**
   * Confirm VCs batch after storing them in IndexedDB
   * Step 4: Confirm that VCs have been received and stored
   */
  const confirmVCBatch = async (
    items: Array<{ claimId: string; source: string }>
  ): Promise<boolean> => {
    try {
      const holderDid = localStorage.getItem('institutionDID');
      const token = localStorage.getItem('institutionToken');

      if (!holderDid) {
        throw new Error('Holder DID not found');
      }

      if (!token) {
        throw new Error('Authentication token not found');
      }

      if (items.length === 0) {
        console.log('[VC Confirm] No VCs to confirm');
        return true;
      }

      console.log(`[VC Confirm] Confirming ${items.length} VCs...`);
      console.log('[VC Confirm] Items with sources:', items);

      const url = buildApiUrl(API_ENDPOINTS.CREDENTIALS.CONFIRM_COMBINED_BATCH);

      const requestBody = {
        items: items,
        holder_did: holderDid,
      };

      console.log('[VC Confirm] Request body:', requestBody);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      console.log('[VC Confirm] Response status:', response.status);

      if (!response.ok) {
        const result = await response.json();
        console.error('[VC Confirm] Error response:', result);
        const errorMessage = result.message || result.error || 'Failed to confirm VCs';
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('[VC Confirm] Response:', result);

      if (!result.success) {
        throw new Error(result.message || 'Failed to confirm VCs');
      }

      const { confirmed_count, requested_count } = result.data;
      console.log(`[VC Confirm] Confirmed ${confirmed_count}/${requested_count} VCs`);

      return confirmed_count === requested_count;
    } catch (error) {
      console.error('[VC Confirm] Error confirming VCs:', error);
      throw error;
    }
  };

  /**
   * Complete VC claim flow: Claim -> Decrypt -> Store -> Confirm
   */
  const fetchAndStoreCredentials = async () => {
    setIsLoading(true);
    try {
      console.log('[VC Flow] Starting VC claim check...');

      // Step 1 & 2: Claim and decrypt VCs
      const decryptedVCs = await claimVCBatch(50);

      if (decryptedVCs.length === 0) {
        console.log(
          '[VC Flow] No new VCs to claim. Loading existing credentials from IndexedDB...'
        );
        // Load existing VCs from IndexedDB without calling confirm batch
        await loadCredentialsFromIndexedDB();
        return;
      }

      console.log(`[VC Flow] Found ${decryptedVCs.length} new VCs to store`);

      // Step 3: Store VCs in IndexedDB
      console.log('[VC Flow] Storing VCs in IndexedDB...');
      const storedIds = await storeVCBatch(decryptedVCs);
      console.log(`[VC Flow] Stored ${storedIds.length} VCs in IndexedDB`);

      // Collect claimId from the decrypted VCs
      const claimIds = decryptedVCs
        .filter((vc) => vc.claimId) // Only VCs that have claimId
        .map((vc) => vc.claimId!);

      console.log('[VC Flow] Request IDs to verify:', claimIds);

      // Verify all VCs are stored by checking claimIds
      const { items, missing } = await areVCsStoredByRequestIds(claimIds);
      console.log(`[VC Flow] Verification: ${items.length} stored, ${missing.length} missing`);

      if (missing.length > 0) {
        console.warn('[VC Flow] Some VCs failed to store:', missing);
        throw new Error(`Failed to store ${missing.length} VCs in IndexedDB`);
      }

      // Step 4: Confirm VCs batch (only if we actually stored VCs)
      if (items.length > 0) {
        console.log('[VC Flow] Confirming VCs with API...');
        const confirmed = await confirmVCBatch(items);

        if (confirmed) {
          console.log('[VC Flow] All VCs confirmed successfully');
          setInfoModalConfig({
            title: 'Success',
            message: `Successfully claimed and stored ${items.length} new credential(s)!`,
            buttonColor: 'green',
          });
          setShowInfoModal(true);
        } else {
          throw new Error('Failed to confirm all VCs with the API');
        }
      }

      // Load the credentials to display
      await loadCredentialsFromIndexedDB();
    } catch (error) {
      console.error('[VC Flow] Error in VC claim flow:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Only show alert for actual errors, not for "no VCs" scenario
      if (!(error instanceof Error && error.message.includes('No new VCs'))) {
        setInfoModalConfig({
          title: 'Error Claiming Credentials',
          message: `Failed to claim credentials: ${errorMessage}\n\nPlease check the console for more details.`,
          buttonColor: 'red',
        });
        setShowInfoModal(true);
      }

      // Still try to load existing credentials
      try {
        await loadCredentialsFromIndexedDB();
      } catch (loadError) {
        console.error('[VC Flow] Failed to load existing credentials:', loadError);
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Load credentials from IndexedDB and convert to display format
   */
  const loadCredentialsFromIndexedDB = async () => {
    try {
      console.log('[Load Credentials] Loading from IndexedDB...');
      const vcs = await getAllVCs();
      console.log(`[Load Credentials] Found ${vcs.length} VCs`);

      // Convert VCs to Credential format for display
      const displayCredentials: Credential[] = vcs.map((vc) => {
        // Determine status based on expiry date
        let status: 'Active' | 'Expired' | 'Revoked' = 'Active';
        if (vc.expiredAt) {
          const expiryDate = new Date(vc.expiredAt);
          const today = new Date();
          if (expiryDate < today) {
            status = 'Expired';
          }
        }

        // Get credential type from VC type array (exclude 'VerifiableCredential')
        const credentialType = vc.type.find((t) => t !== 'VerifiableCredential') || 'Unknown';

        return {
          id: vc.id,
          credentialType: credentialType,
          issuerDid: vc.issuer,
          issuerName: vc.issuerName,
          issuedDate: vc.validFrom,
          expiryDate: vc.expiredAt || 'N/A',
          status: status,
        };
      });

      setCredentials(displayCredentials);
      setFilteredCredentials(displayCredentials);
      console.log('[Load Credentials] Credentials loaded successfully');
    } catch (error) {
      console.error('[Load Credentials] Error loading credentials:', error);
      throw error;
    }
  };

  const handleOpenRequestModal = () => {
    setShowRequestModal(true);
    fetchSchemas();
  };

  const handleSchemaSearch = (value: string) => {
    const filtered = schemas.filter((schema) => {
      const searchLower = value.toLowerCase();
      return (
        schema.name.toLowerCase().includes(searchLower) ||
        schema.issuer_name.toLowerCase().includes(searchLower)
      );
    });
    // Ensure all filtered schemas have compositeId
    const filteredWithIds = filtered.map((schema, index) => ({
      ...schema,
      compositeId: schema.compositeId || `schema-fallback-${index}`,
    }));
    setFilteredSchemas(filteredWithIds);
  };

  const toggleExpandSchema = (compositeId: string) => {
    setExpandedSchemaId(expandedSchemaId === compositeId ? null : compositeId);
  };

  const handleOpenUploadModal = () => {
    setShowUploadModal(true);
    setUploadedFile(null);
    setUploadedVC(null);
    setUploadValidation(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    // Check if file is JSON
    if (!file.name.endsWith('.json')) {
      setUploadValidation({
        isValid: false,
        errors: ['File must be a JSON file'],
        stage: 'structure',
      });
      setUploadedFile(null);
      setUploadedVC(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setIsValidating(true);
    setUploadValidation(null);
    setUploadedFile(file);
    setUploadedVC(null);

    try {
      const fileContent = await file.text();

      // Use comprehensive validation (structure → API → duplicate)
      const result = await validateVCComprehensive(fileContent);

      if (result.isValid && result.vc) {
        setUploadValidation({
          isValid: true,
          errors: [],
        });
        setUploadedVC(result.vc);
      } else {
        setUploadValidation({
          isValid: false,
          errors: result.errors,
          stage: result.stage,
        });
        setUploadedVC(result.vc || null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    } catch (error) {
      console.error('Error reading file:', error);
      setUploadValidation({
        isValid: false,
        errors: ['Failed to read file'],
        stage: 'structure',
      });
      setUploadedVC(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } finally {
      setIsValidating(false);
    }
  };

  const handleSaveUploadedVC = async () => {
    if (!uploadedVC) {
      return;
    }

    try {
      await storeVC(uploadedVC);
      setInfoModalConfig({
        title: 'Success',
        message: 'Credential uploaded and stored successfully!',
        buttonColor: 'green',
      });
      setShowInfoModal(true);
      setShowUploadModal(false);
      setUploadedFile(null);
      setUploadedVC(null);
      setUploadValidation(null);

      // Reload credentials
      await loadCredentialsFromIndexedDB();
    } catch (error) {
      console.error('Error storing uploaded VC:', error);
      setInfoModalConfig({
        title: 'Error Storing Credential',
        message: 'Failed to store credential. Please try again.',
        buttonColor: 'red',
      });
      setShowInfoModal(true);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-700';
      case 'Expired':
        return 'bg-gray-100 text-gray-700';
      case 'Revoked':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date
      .toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      .replace(/\//g, '/');
  };

  const columns: Column<Credential>[] = [
    {
      id: 'credentialType',
      label: 'CREDENTIAL TYPE',
      sortKey: 'credentialType',
      render: (row) => (
        <ThemedText className="text-sm font-medium text-gray-900">{row.credentialType}</ThemedText>
      ),
    },
    {
      id: 'issuerDid',
      label: 'ISSUER DID',
      sortKey: 'issuerDid',
      render: (row) => (
        <ThemedText className="text-sm text-gray-900">
          {row.issuerDid.substring(0, 25)}...
        </ThemedText>
      ),
    },
    {
      id: 'issuerName',
      label: 'ISSUER NAME',
      sortKey: 'issuerName',
      render: (row) => <ThemedText className="text-sm text-gray-900">{row.issuerName}</ThemedText>,
    },
    {
      id: 'issuedDate',
      label: 'ISSUED DATE',
      sortKey: 'issuedDate',
      render: (row) => (
        <ThemedText className="text-sm text-gray-900">{formatDate(row.issuedDate)}</ThemedText>
      ),
    },
    {
      id: 'expiryDate',
      label: 'EXPIRY DATE',
      sortKey: 'expiryDate',
      render: (row) => (
        <ThemedText className="text-sm text-gray-900">{formatDate(row.expiryDate)}</ThemedText>
      ),
    },
    {
      id: 'status',
      label: 'STATUS',
      sortKey: 'status',
      render: (row) => (
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(row.status)}`}
        >
          {row.status}
        </span>
      ),
    },
    {
      id: 'action',
      label: 'ACTION',
      render: (row) => {
        return (
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePresent(row.id);
              }}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
            >
              PRESENT
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleUpdate(row.id);
              }}
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors text-sm font-medium"
            >
              UPDATE
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRenew(row.id);
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
            >
              RENEW
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRevoke(row.id);
              }}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
            >
              REVOKE
            </button>
          </div>
        );
      },
    },
  ];

  // Helper functions to prepare data for DataTables
  const getVCInfoData = (schema: Schema): VCInfoItem[] => {
    return [
      {
        id: `${schema.id}-schema-id`,
        name: 'Schema ID',
        value: schema.id,
      },
      {
        id: `${schema.id}-vc-duration`,
        name: 'VC Duration',
        value: `${schema.schema.expired_in} Years`,
      },
    ];
  };

  const getAttributesData = (schema: Schema): AttributeItem[] => {
    return Object.entries(schema.schema.properties).map(([key, value]) => ({
      id: `${schema.id}-${key}`, // Use schema.id + attribute key for unique ID
      name: key,
      type: value.type,
    }));
  };

  // Schema columns for Request Modal
  const schemaColumns: Column<SchemaWithCompositeId>[] = [
    {
      id: 'name',
      label: 'SCHEMA NAME',
      sortKey: 'name',
      render: (row) => (
        <ThemedText className="text-sm font-medium text-gray-900">
          {row.name} v{row.version}
        </ThemedText>
      ),
    },
    {
      id: 'issuer_name',
      label: 'ISSUER',
      sortKey: 'issuer_name',
      render: (row) => <ThemedText className="text-sm text-gray-900">{row.issuer_name}</ThemedText>,
    },
    {
      id: 'action',
      label: 'ACTION',
      render: (row) => (
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRequestCredential(row.id, row.issuer_did);
            }}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
          >
            REQUEST
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleExpandSchema(row.compositeId);
            }}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm font-medium"
          >
            VIEW
          </button>
        </div>
      ),
    },
  ];

  // VC Info columns
  const vcInfoColumns: Column<VCInfoItem>[] = [
    {
      id: 'name',
      label: 'NAME',
      render: (row) => <ThemedText className="text-sm text-gray-900">{row.name}</ThemedText>,
    },
    {
      id: 'value',
      label: 'VALUE',
      render: (row) => <ThemedText className="text-sm text-gray-600">{row.value}</ThemedText>,
    },
  ];

  // Attributes columns
  const attributesColumns: Column<AttributeItem>[] = [
    {
      id: 'name',
      label: 'NAME',
      render: (row) => <ThemedText className="text-sm text-gray-900">{row.name}</ThemedText>,
    },
    {
      id: 'type',
      label: 'TYPE',
      render: (row) => <ThemedText className="text-sm text-blue-600">{row.type}</ThemedText>,
    },
  ];

  // Show loading screen while checking authentication
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0D2B45] mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  return (
    <InstitutionLayout activeTab="my-credential">
      <div className="p-12">
        <ThemedText fontSize={40} fontWeight={700} className="text-black mb-8">
          My Credential
        </ThemedText>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-6 mb-8 pt-4">
          <div className="bg-blue-50 grid grid-row-2 rounded-2xl p-6">
            <ThemedText className="text-sm text-gray-600 mb-2">Total Credentials</ThemedText>
            <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
              {isLoading ? 0 : credentials.length}
            </ThemedText>
          </div>
          <div className="bg-blue-50 grid grid-row-2 rounded-2xl p-6">
            <ThemedText className="text-sm text-gray-600 mb-2">Active Credentials</ThemedText>
            <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
              {isLoading ? 0 : activeCount}
            </ThemedText>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Data Table */}
        {!isLoading && (
          <DataTable
            data={filteredCredentials}
            columns={columns}
            onFilter={handleFilter}
            searchPlaceholder="Search..."
            onSearch={handleSearch}
            enableSelection={true}
            onRowClick={(row) => handleView(row.id)}
            totalCount={filteredCredentials.length}
            rowsPerPageOptions={[5, 10, 25, 50, 100]}
            idKey="id"
            topRightButtons={
              <div className="flex gap-3">
                <button
                  onClick={handleOpenUploadModal}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium cursor-pointer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  Upload VC
                </button>
                <button
                  onClick={handleOpenRequestModal}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium cursor-pointer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Request New Credential
                </button>
              </div>
            }
          />
        )}
      </div>

      {/* Filter Popup */}
      {showFilterModal && (
        <div
          ref={filterModalRef}
          className="fixed bg-white rounded-lg shadow-xl border border-gray-200 p-6 w-80 z-50"
          style={{
            top: `${filterButtonPosition.top}px`,
            left: `${filterButtonPosition.left}px`,
          }}
        >
          <div className="flex items-center justify-between mb-6">
            <ThemedText fontSize={18} fontWeight={600} className="text-gray-900">
              Filter Credentials
            </ThemedText>
            <button
              onClick={() => setShowFilterModal(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Status Filter */}
          <div className="mb-4">
            <ThemedText className="block text-sm font-medium text-gray-900 mb-2">Status</ThemedText>
            <select
              value={filterStatus}
              onChange={(e) =>
                handleStatusChange(e.target.value as 'all' | 'Active' | 'Expired' | 'Revoked')
              }
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="all">All</option>
              <option value="Active">Active</option>
              <option value="Expired">Expired</option>
              <option value="Revoked">Revoked</option>
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <ThemedText className="block text-sm font-medium text-gray-900 mb-2">
              Credential Type
            </ThemedText>
            <input
              type="text"
              value={filterType}
              onChange={(e) => handleTypeChange(e.target.value)}
              placeholder="Enter credential type"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
        </div>
      )}

      {/* Request New Credential Modal */}
      <Modal
        isOpen={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        title="Request New Credential"
        minHeight="700px"
      >
        <div className="px-8 py-6">
          {isSchemasLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                <ThemedText className="text-gray-600">Loading schemas...</ThemedText>
              </div>
            </div>
          ) : (
            <>
              {/* Schema List with Expandable Rows */}
              <DataTable<SchemaWithCompositeId>
                data={filteredSchemas.filter((s) => s.compositeId)}
                columns={schemaColumns}
                searchPlaceholder="Search schemas..."
                onSearch={handleSchemaSearch}
                enableSelection={false}
                totalCount={filteredSchemas.filter((s) => s.compositeId).length}
                rowsPerPageOptions={[5, 10, 25]}
                idKey="compositeId"
                expandableRows={{
                  expandedRowId: expandedSchemaId,
                  renderExpandedContent: (schema: SchemaWithCompositeId) => (
                    <div className="space-y-6 bg-white p-4 rounded-lg">
                      {/* VC Info */}
                      <div>
                        <ThemedText fontSize={16} fontWeight={600} className="text-gray-900 mb-3">
                          VC Info
                        </ThemedText>
                        <DataTable
                          data={getVCInfoData(schema)}
                          columns={vcInfoColumns}
                          enableSelection={false}
                          totalCount={getVCInfoData(schema).length}
                          idKey="id"
                          hideTopControls={true}
                          hideBottomControls={true}
                          rowsPerPageOptions={[1000]}
                        />
                      </div>

                      {/* Attributes */}
                      <div>
                        <ThemedText fontSize={16} fontWeight={600} className="text-gray-900 mb-3">
                          Attributes
                        </ThemedText>
                        <DataTable
                          data={getAttributesData(schema)}
                          columns={attributesColumns}
                          enableSelection={false}
                          totalCount={getAttributesData(schema).length}
                          idKey="id"
                          hideTopControls={true}
                          hideBottomControls={true}
                          rowsPerPageOptions={[1000]}
                        />
                      </div>
                    </div>
                  ),
                }}
              />

              {filteredSchemas.length === 0 && (
                <div className="text-center py-12">
                  <ThemedText className="text-gray-500">No schemas available</ThemedText>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>

      {/* View Credential Modal */}
      <Modal
        isOpen={showViewCredentialModal}
        onClose={() => {
          setShowViewCredentialModal(false);
          setSelectedCredential(null);
        }}
        title="View Credential"
        minHeight="700px"
      >
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
                .filter(([key]) => key !== 'id') // Exclude the 'id' field
                .map(([name, value]) => ({
                  name,
                  value: typeof value === 'object' ? JSON.stringify(value) : String(value),
                })),
              proof: selectedCredential.proof,
            }}
            onClose={() => {
              setShowViewCredentialModal(false);
              setSelectedCredential(null);
            }}
            onDownload={() => handleDownload(selectedCredential.id)}
          />
        )}
      </Modal>

      {/* Upload VC Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setUploadedFile(null);
          setUploadedVC(null);
          setUploadValidation(null);
        }}
        title="Upload Verifiable Credential"
        minHeight="600px"
      >
        <div className="px-8 py-6">
          <div className="mb-6">
            <label className="block mb-3">
              <ThemedText className="text-sm font-semibold text-gray-900">
                Select JSON File
              </ThemedText>
            </label>

            <div className="relative">
              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-blue-300 rounded-xl cursor-pointer bg-blue-50 hover:bg-blue-100 transition-colors duration-200">
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
                  <p className="text-xs text-blue-500">JSON files only</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Loading State */}
          {isValidating && (
            <div className="mb-6 flex items-center gap-3 text-blue-700 bg-blue-50 px-4 py-3 rounded-lg">
              <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-blue-700"></div>
              <ThemedText fontSize={14} fontWeight={600}>
                Validating credential...
              </ThemedText>
            </div>
          )}

          {/* Validation Message */}
          {!isValidating && uploadValidation && (
            <div className="mb-6">
              {uploadValidation.isValid ? (
                <div className="flex items-center gap-2 text-green-700 bg-green-50 px-4 py-3 rounded-lg">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <ThemedText fontSize={14} fontWeight={600}>
                      ✓ All validations passed
                    </ThemedText>
                    <ThemedText fontSize={12} className="text-green-600 mt-1">
                      Structure validated → API validated → No duplicates found
                    </ThemedText>
                  </div>
                </div>
              ) : (
                <div className="text-red-700 bg-red-50 px-4 py-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div>
                      <ThemedText fontSize={14} fontWeight={600}>
                        Validation failed
                        {uploadValidation.stage && ` at ${uploadValidation.stage} stage`}
                      </ThemedText>
                    </div>
                  </div>
                  <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                    {uploadValidation.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Preview VC */}
          {uploadValidation?.isValid && uploadedVC && (
            <div>
              <ThemedText fontSize={16} fontWeight={600} className="text-gray-900 mb-4">
                Credential Preview
              </ThemedText>
              <div className="border border-gray-200 rounded-lg bg-gray-50 max-h-96 overflow-y-auto">
                <div className="p-6 space-y-6">
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <ThemedText fontSize={12} fontWeight={600} className="text-gray-500 mb-2">
                      ID
                    </ThemedText>
                    <ThemedText
                      fontSize={14}
                      className="text-gray-900 break-all leading-relaxed text-right"
                    >
                      {uploadedVC.id}
                    </ThemedText>
                  </div>

                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <ThemedText fontSize={12} fontWeight={600} className="text-gray-500 mb-2">
                      Type
                    </ThemedText>
                    <ThemedText fontSize={14} className="text-gray-900 text-right">
                      {uploadedVC.type.join(', ')}
                    </ThemedText>
                  </div>

                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <ThemedText fontSize={12} fontWeight={600} className="text-gray-500 mb-2">
                      Issuer
                    </ThemedText>
                    <ThemedText
                      fontSize={14}
                      className="text-gray-900 break-all leading-relaxed text-right"
                    >
                      {uploadedVC.issuer}
                    </ThemedText>
                  </div>

                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <ThemedText fontSize={12} fontWeight={600} className="text-gray-500 mb-2">
                      Issuer Name
                    </ThemedText>
                    <ThemedText fontSize={14} className="text-gray-900 text-right">
                      {uploadedVC.issuerName}
                    </ThemedText>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <ThemedText fontSize={12} fontWeight={600} className="text-gray-500 mb-2">
                        Valid From
                      </ThemedText>
                      <ThemedText fontSize={14} className="text-gray-900 text-right">
                        {new Date(uploadedVC.validFrom).toLocaleDateString()}
                      </ThemedText>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <ThemedText fontSize={12} fontWeight={600} className="text-gray-500 mb-2">
                        Expired At
                      </ThemedText>
                      <ThemedText fontSize={14} className="text-gray-900 text-right">
                        {uploadedVC.expiredAt
                          ? new Date(uploadedVC.expiredAt).toLocaleDateString()
                          : 'N/A'}
                      </ThemedText>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <ThemedText fontSize={12} fontWeight={600} className="text-gray-500 mb-2">
                      Credential Subject
                    </ThemedText>
                    <div className="bg-gray-50 rounded-lg p-4 mt-2">
                      <pre className="whitespace-pre-wrap break-all text-gray-700 text-sm leading-relaxed">
                        {JSON.stringify(uploadedVC.credentialSubject, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadedFile(null);
                    setUploadedVC(null);
                    setUploadValidation(null);
                  }}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleSaveUploadedVC}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium cursor-pointer"
                >
                  SAVE TO INDEXEDDB
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Renew Credential Modal */}
      <Modal
        isOpen={showRenewModal}
        onClose={() => {
          setShowRenewModal(false);
          setRenewingCredential(null);
          setRenewalReason('');
        }}
        title="Renew Credential"
        maxWidth="900px"
      >
        {renewingCredential && (
          <div className="px-8 py-6">
            {/* Credential Information Grid */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              {/* Credential ID */}
              <div className="col-span-2">
                <label className="block mb-2">
                  <ThemedText className="text-sm font-medium text-gray-700">
                    Credential ID
                  </ThemedText>
                </label>
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
                  {renewingCredential.id}
                </div>
              </div>

              {/* Credential Type */}
              <div>
                <label className="block mb-2">
                  <ThemedText className="text-sm font-medium text-gray-700">
                    Credential Type
                  </ThemedText>
                </label>
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                  {Array.isArray(renewingCredential.type)
                    ? renewingCredential.type.find((t) => t !== 'VerifiableCredential') || 'Unknown'
                    : renewingCredential.type}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block mb-2">
                  <ThemedText className="text-sm font-medium text-gray-700">Status</ThemedText>
                </label>
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    Active
                  </span>
                </div>
              </div>

              {/* Valid From */}
              <div>
                <label className="block mb-2">
                  <ThemedText className="text-sm font-medium text-gray-700">Valid From</ThemedText>
                </label>
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                  {new Date(renewingCredential.validFrom).toLocaleString('en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                  })}
                </div>
              </div>

              {/* Expired At */}
              <div>
                <label className="block mb-2">
                  <ThemedText className="text-sm font-medium text-gray-700">Expired At</ThemedText>
                </label>
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                  {renewingCredential.expiredAt
                    ? new Date(renewingCredential.expiredAt).toLocaleString('en-US', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false,
                      })
                    : 'Never'}
                </div>
              </div>

              {/* Issuer Name */}
              <div>
                <label className="block mb-2">
                  <ThemedText className="text-sm font-medium text-gray-700">Issuer Name</ThemedText>
                </label>
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                  {renewingCredential.issuerName}
                </div>
              </div>

              {/* Issuer DID */}
              <div className="col-span-2">
                <label className="block mb-2">
                  <ThemedText className="text-sm font-medium text-gray-700">Issuer DID</ThemedText>
                </label>
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
                  {renewingCredential.issuer}
                </div>
              </div>

              {/* Holder DID */}
              <div className="col-span-2">
                <label className="block mb-2">
                  <ThemedText className="text-sm font-medium text-gray-700">Holder DID</ThemedText>
                </label>
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
                  {renewingCredential.credentialSubject.id}
                </div>
              </div>
            </div>

            {/* Credential Image */}
            {renewingCredential.imageLink && (
              <div className="mb-6">
                <label className="block mb-3">
                  <ThemedText className="text-sm font-semibold text-gray-900">
                    VC Background Image
                  </ThemedText>
                </label>
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={renewingCredential.imageLink}
                    alt="VC Background"
                    className="w-full h-auto max-h-96 object-contain rounded-xl border-2 border-gray-200 shadow-md block bg-gray-50"
                  />
                </div>
              </div>
            )}

            {/* Credential Attributes Section */}
            {Object.keys(renewingCredential.credentialSubject).filter((key) => key !== 'id')
              .length > 0 && (
              <div className="mb-6">
                <div className="mb-4">
                  <ThemedText className="text-sm font-semibold text-gray-900">
                    Credential Attributes (
                    {
                      Object.keys(renewingCredential.credentialSubject).filter(
                        (key) => key !== 'id'
                      ).length
                    }
                    )
                  </ThemedText>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="space-y-4">
                    {Object.entries(renewingCredential.credentialSubject)
                      .filter(([key]) => key !== 'id')
                      .map(([key, value], index) => (
                        <div key={index} className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block mb-1">
                              <ThemedText className="text-xs font-medium text-gray-600">
                                {key}
                              </ThemedText>
                            </label>
                          </div>
                          <div>
                            <div className="px-3 py-2 bg-white border border-gray-200 rounded text-sm text-gray-900">
                              {String(value)}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* Renewal Reason Input */}
            <div className="mb-6">
              <label className="block mb-2">
                <ThemedText className="text-sm font-medium text-gray-700">
                  Reason for Renewal <span className="text-red-500">*</span>
                </ThemedText>
              </label>
              <textarea
                value={renewalReason}
                onChange={(e) => setRenewalReason(e.target.value)}
                placeholder="Please provide a detailed reason for renewing this credential..."
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none min-h-[150px] text-sm text-gray-900"
                disabled={isRenewing}
              />
              {renewalReason.trim() === '' && (
                <ThemedText className="text-xs text-gray-500 mt-1">
                  This field is required
                </ThemedText>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowRenewModal(false);
                  setRenewingCredential(null);
                  setRenewalReason('');
                }}
                disabled={isRenewing}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                CANCEL
              </button>
              <button
                onClick={handleSubmitRenew}
                disabled={isRenewing || !renewalReason.trim()}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px]"
              >
                {isRenewing ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Submitting...
                  </span>
                ) : (
                  'RENEW VC'
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Update Credential Modal */}
      <Modal
        isOpen={showUpdateModal}
        onClose={() => {
          setShowUpdateModal(false);
          setUpdatingCredential(null);
          setUpdatedAttributes({});
          setUpdateReason('');
        }}
        title="Update Credential"
        maxWidth="900px"
      >
        {updatingCredential && (
          <div className="px-8 py-6">
            {/* Credential Information Grid */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              {/* Credential ID */}
              <div className="col-span-2">
                <label className="block mb-2">
                  <ThemedText className="text-sm font-medium text-gray-700">
                    Credential ID
                  </ThemedText>
                </label>
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
                  {updatingCredential.id}
                </div>
              </div>

              {/* Credential Type */}
              <div>
                <label className="block mb-2">
                  <ThemedText className="text-sm font-medium text-gray-700">
                    Credential Type
                  </ThemedText>
                </label>
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                  {Array.isArray(updatingCredential.type)
                    ? updatingCredential.type.find((t) => t !== 'VerifiableCredential') || 'Unknown'
                    : updatingCredential.type}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block mb-2">
                  <ThemedText className="text-sm font-medium text-gray-700">Status</ThemedText>
                </label>
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    Active
                  </span>
                </div>
              </div>

              {/* Valid From */}
              <div>
                <label className="block mb-2">
                  <ThemedText className="text-sm font-medium text-gray-700">Valid From</ThemedText>
                </label>
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                  {new Date(updatingCredential.validFrom).toLocaleString('en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                  })}
                </div>
              </div>

              {/* Expired At */}
              <div>
                <label className="block mb-2">
                  <ThemedText className="text-sm font-medium text-gray-700">Expired At</ThemedText>
                </label>
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                  {updatingCredential.expiredAt
                    ? new Date(updatingCredential.expiredAt).toLocaleString('en-US', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false,
                      })
                    : 'Never'}
                </div>
              </div>

              {/* Issuer Name */}
              <div>
                <label className="block mb-2">
                  <ThemedText className="text-sm font-medium text-gray-700">Issuer Name</ThemedText>
                </label>
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                  {updatingCredential.issuerName}
                </div>
              </div>

              {/* Issuer DID */}
              <div className="col-span-2">
                <label className="block mb-2">
                  <ThemedText className="text-sm font-medium text-gray-700">Issuer DID</ThemedText>
                </label>
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
                  {updatingCredential.issuer}
                </div>
              </div>

              {/* Holder DID */}
              <div className="col-span-2">
                <label className="block mb-2">
                  <ThemedText className="text-sm font-medium text-gray-700">Holder DID</ThemedText>
                </label>
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
                  {updatingCredential.credentialSubject.id}
                </div>
              </div>
            </div>

            {/* Credential Image */}
            {updatingCredential.imageLink && (
              <div className="mb-6">
                <label className="block mb-3">
                  <ThemedText className="text-sm font-semibold text-gray-900">
                    VC Background Image
                  </ThemedText>
                </label>
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={updatingCredential.imageLink}
                    alt="VC Background"
                    className="w-full h-auto max-h-96 object-contain rounded-xl border-2 border-gray-200 shadow-md block bg-gray-50"
                  />
                </div>
              </div>
            )}

            {/* Editable Credential Attributes Section */}
            {Object.keys(updatedAttributes).length > 0 && (
              <div className="mb-6">
                <div className="mb-4">
                  <ThemedText className="text-sm font-semibold text-gray-900">
                    Credential Attributes ({Object.keys(updatedAttributes).length}) - Editable
                  </ThemedText>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="space-y-4">
                    {Object.entries(updatedAttributes).map(([key, value], index) => (
                      <div key={index} className="grid grid-cols-2 gap-4">
                        <div className="flex items-center">
                          <label className="block">
                            <ThemedText className="text-xs font-medium text-gray-600">
                              {key}
                            </ThemedText>
                          </label>
                        </div>
                        <div>
                          <input
                            type="text"
                            value={String(value)}
                            onChange={(e) => {
                              const newValue = e.target.value;
                              setUpdatedAttributes((prev) => ({
                                ...prev,
                                [key]: newValue,
                              }));
                            }}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            disabled={isUpdating}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Update Reason Input */}
            <div className="mb-6">
              <label className="block mb-2">
                <ThemedText className="text-sm font-medium text-gray-700">
                  Reason for Update <span className="text-red-500">*</span>
                </ThemedText>
              </label>
              <textarea
                value={updateReason}
                onChange={(e) => setUpdateReason(e.target.value)}
                placeholder="Please provide a detailed reason for updating this credential..."
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none min-h-[150px] text-sm text-gray-900"
                disabled={isUpdating}
              />
              {updateReason.trim() === '' && (
                <ThemedText className="text-xs text-gray-500 mt-1">
                  This field is required
                </ThemedText>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowUpdateModal(false);
                  setUpdatingCredential(null);
                  setUpdatedAttributes({});
                  setUpdateReason('');
                }}
                disabled={isUpdating}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                CANCEL
              </button>
              <button
                onClick={handleSubmitUpdate}
                disabled={isUpdating || !updateReason.trim()}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px]"
              >
                {isUpdating ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Submitting...
                  </span>
                ) : (
                  'UPDATE VC'
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Revoke Credential Modal */}
      <Modal
        isOpen={showRevokeModal}
        onClose={() => {
          setShowRevokeModal(false);
          setRevokingCredential(null);
          setRevocationReason('');
        }}
        title="Revoke Credential"
        maxWidth="900px"
      >
        {revokingCredential && (
          <div className="px-8 py-6">
            {/* Credential Information Grid */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              {/* Credential ID */}
              <div className="col-span-2">
                <label className="block mb-2">
                  <ThemedText className="text-sm font-medium text-gray-700">
                    Credential ID
                  </ThemedText>
                </label>
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
                  {revokingCredential.id}
                </div>
              </div>

              {/* Credential Type */}
              <div>
                <label className="block mb-2">
                  <ThemedText className="text-sm font-medium text-gray-700">
                    Credential Type
                  </ThemedText>
                </label>
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                  {Array.isArray(revokingCredential.type)
                    ? revokingCredential.type.find((t) => t !== 'VerifiableCredential') || 'Unknown'
                    : revokingCredential.type}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block mb-2">
                  <ThemedText className="text-sm font-medium text-gray-700">Status</ThemedText>
                </label>
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    Active
                  </span>
                </div>
              </div>

              {/* Valid From */}
              <div>
                <label className="block mb-2">
                  <ThemedText className="text-sm font-medium text-gray-700">Valid From</ThemedText>
                </label>
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                  {new Date(revokingCredential.validFrom).toLocaleString('en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                  })}
                </div>
              </div>

              {/* Expired At */}
              <div>
                <label className="block mb-2">
                  <ThemedText className="text-sm font-medium text-gray-700">Expired At</ThemedText>
                </label>
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                  {revokingCredential.expiredAt
                    ? new Date(revokingCredential.expiredAt).toLocaleString('en-US', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false,
                      })
                    : 'Never'}
                </div>
              </div>

              {/* Issuer Name */}
              <div>
                <label className="block mb-2">
                  <ThemedText className="text-sm font-medium text-gray-700">Issuer Name</ThemedText>
                </label>
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                  {revokingCredential.issuerName}
                </div>
              </div>

              {/* Issuer DID */}
              <div className="col-span-2">
                <label className="block mb-2">
                  <ThemedText className="text-sm font-medium text-gray-700">Issuer DID</ThemedText>
                </label>
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
                  {revokingCredential.issuer}
                </div>
              </div>

              {/* Holder DID */}
              <div className="col-span-2">
                <label className="block mb-2">
                  <ThemedText className="text-sm font-medium text-gray-700">Holder DID</ThemedText>
                </label>
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
                  {revokingCredential.credentialSubject.id}
                </div>
              </div>
            </div>

            {/* Credential Image */}
            {revokingCredential.imageLink && (
              <div className="mb-6">
                <label className="block mb-3">
                  <ThemedText className="text-sm font-semibold text-gray-900">
                    VC Background Image
                  </ThemedText>
                </label>
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={revokingCredential.imageLink}
                    alt="VC Background"
                    className="w-full h-auto max-h-96 object-contain rounded-xl border-2 border-gray-200 shadow-md block bg-gray-50"
                  />
                </div>
              </div>
            )}

            {/* Credential Attributes Section */}
            {Object.keys(revokingCredential.credentialSubject).filter((key) => key !== 'id')
              .length > 0 && (
              <div className="mb-6">
                <div className="mb-4">
                  <ThemedText className="text-sm font-semibold text-gray-900">
                    Credential Attributes (
                    {
                      Object.keys(revokingCredential.credentialSubject).filter(
                        (key) => key !== 'id'
                      ).length
                    }
                    )
                  </ThemedText>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="space-y-4">
                    {Object.entries(revokingCredential.credentialSubject)
                      .filter(([key]) => key !== 'id')
                      .map(([key, value], index) => (
                        <div key={index} className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block mb-1">
                              <ThemedText className="text-xs font-medium text-gray-600">
                                {key}
                              </ThemedText>
                            </label>
                          </div>
                          <div>
                            <div className="px-3 py-2 bg-white border border-gray-200 rounded text-sm text-gray-900">
                              {String(value)}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* Warning Message */}
            <div className="mb-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-red-600 flex-shrink-0"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <ThemedText className="text-sm font-semibold text-red-800">
                      Warning: This action cannot be undone
                    </ThemedText>
                  </div>
                  <ThemedText className="text-xs text-red-700">
                    Revoking this credential will permanently invalidate it. The credential will no
                    longer be valid for verification purposes.
                  </ThemedText>
                </div>
              </div>
            </div>

            {/* Revocation Reason Input */}
            <div className="mb-6">
              <label className="block mb-2">
                <ThemedText className="text-sm font-medium text-gray-700">
                  Reason for Revocation <span className="text-red-500">*</span>
                </ThemedText>
              </label>
              <textarea
                value={revocationReason}
                onChange={(e) => setRevocationReason(e.target.value)}
                placeholder="Please provide a detailed reason for revoking this credential..."
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none min-h-[150px] text-sm text-gray-900"
                disabled={isRevoking}
              />
              {revocationReason.trim() === '' && (
                <ThemedText className="text-xs text-gray-500 mt-1">
                  This field is required
                </ThemedText>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowRevokeModal(false);
                  setRevokingCredential(null);
                  setRevocationReason('');
                }}
                disabled={isRevoking}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                CANCEL
              </button>
              <button
                onClick={handleSubmitRevoke}
                disabled={isRevoking || !revocationReason.trim()}
                className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px]"
              >
                {isRevoking ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Submitting...
                  </span>
                ) : (
                  'REVOKE VC'
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Info Modal */}
      <InfoModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title={infoModalConfig.title}
        message={infoModalConfig.message}
        buttonColor={infoModalConfig.buttonColor}
      />

      {/* Filter Popup */}
    </InstitutionLayout>
  );
}
