'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import InstitutionLayout from '@/components/shared/InstitutionLayout';
import { ThemedText } from '@/components/shared/ThemedText';
import { DataTable, Column } from '@/components/shared/DataTable';
import { redirectIfJWTInvalid } from '@/utils/auth';
import { buildApiUrlWithParams, buildApiUrl, API_ENDPOINTS } from '@/utils/api';
import { encryptWithPublicKey, decryptWithPrivateKey } from '@/utils/encryptUtils';
import { formatDate } from '@/utils/dateUtils';
import {
  storeVCBatch,
  getAllVCs,
  areVCsStoredByRequestIds,
  VerifiableCredential,
  getVCById,
  storeVC,
  SchemaData,
  storeSchemaData,
  storeSchemaDataBatch,
  deleteVC,
  deleteSchemaData,
} from '@/utils/indexedDB';
import { validateVCComprehensive } from '@/utils/vcValidator';
import { hashVC } from '@/utils/vcUtils';
import InfoModal from '@/components/shared/InfoModal';
import { authenticatedPost } from '@/utils/api-client';
import { RequestCredentialModal } from '@/components/holder/RequestCredentialModal';
import { ViewCredentialModal } from '@/components/holder/ViewCredentialModal';
import { UploadVCModal } from '@/components/holder/UploadVCModal';
import { UpdateCredentialModal } from '@/components/holder/UpdateCredentialModal';
import { RenewCredentialModal } from '@/components/holder/RenewCredentialModal';
import { RevokeCredentialModal } from '@/components/holder/RevokeCredentialModal';
import PresentCredentialModal from '@/components/holder/PresentCredentialModal';
import PDFPreviewModal from '@/components/PDFPreviewModal';
import { generatePDFWithQR, downloadPDF } from '@/utils/pdfGenerator';
import { createAndStoreVP } from '@/utils/vpGenerator';
import PresentMultipleCredentialsModal from '@/components/holder/PresentMultipleCredentialsModal';

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
  const [originalAttributes, setOriginalAttributes] = useState<{
    [key: string]: string | number | boolean;
  }>({});
  const [updateReason, setUpdateReason] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Revoke Credential Modal
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [revokingCredential, setRevokingCredential] = useState<VerifiableCredential | null>(null);
  const [revocationReason, setRevocationReason] = useState('');
  const [isRevoking, setIsRevoking] = useState(false);

  // Present Credential Modal
  const [showPresentModal, setShowPresentModal] = useState(false);
  const [presentingCredential, setPresentingCredential] = useState<VerifiableCredential | null>(
    null
  );

  // Present Multiple VCs as VP
  const [showPresentMultipleModal, setShowPresentMultipleModal] = useState(false);
  const [selectedVCsForVP, setSelectedVCsForVP] = useState<Set<string>>(new Set());
  const [selectedVCsList, setSelectedVCsList] = useState<VerifiableCredential[]>([]);

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
    hideActions: false,
  });

  // PDF Preview Modal State
  const [showPDFPreview, setShowPDFPreview] = useState(false);
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfCredentialName, setPdfCredentialName] = useState('');

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
          hideActions: false,
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
        hideActions: false,
      });
      setShowInfoModal(true);
    }
  };

  const handlePresent = async (id: string) => {
    try {
      console.log('Present credential:', id);

      // Fetch the full VC from IndexedDB
      const vc = await getVCById(id);

      if (!vc) {
        setInfoModalConfig({
          title: 'Credential Not Found',
          message: 'The requested credential could not be found in storage.',
          buttonColor: 'red',
          hideActions: false,
        });
        setShowInfoModal(true);
        return;
      }

      // Open present modal with the credential
      setPresentingCredential(vc);
      setShowPresentModal(true);
    } catch (error) {
      console.error('Error opening present modal:', error);
      setInfoModalConfig({
        title: 'Error',
        message: 'Failed to open present modal. Please try again.',
        buttonColor: 'red',
        hideActions: false,
      });
      setShowInfoModal(true);
    }
  };

  // Handle selection change for multiple VCs
  const handleVCSelection = (selectedIds: number[], selectedIdValues?: (string | number)[]) => {
    // Convert the selected IDs to a Set of strings
    const idsSet = new Set(selectedIdValues?.map(String) || selectedIds.map(String));
    setSelectedVCsForVP(idsSet);
  };

  // Handle opening the present multiple VCs modal
  const handleOpenPresentMultiple = async () => {
    if (selectedVCsForVP.size === 0) {
      setInfoModalConfig({
        title: 'No Credentials Selected',
        message: 'Please select at least one credential to create a Verifiable Presentation.',
        buttonColor: 'yellow',
        hideActions: false,
      });
      setShowInfoModal(true);
      return;
    }

    try {
      // Fetch all selected VCs from IndexedDB
      const vcs: VerifiableCredential[] = [];
      for (const id of Array.from(selectedVCsForVP)) {
        const vc = await getVCById(id);
        if (vc) {
          vcs.push(vc);
        }
      }

      if (vcs.length === 0) {
        setInfoModalConfig({
          title: 'Error',
          message: 'Could not load selected credentials.',
          buttonColor: 'red',
          hideActions: false,
        });
        setShowInfoModal(true);
        return;
      }

      setSelectedVCsList(vcs);
      setShowPresentMultipleModal(true);
    } catch (error) {
      console.error('Error loading selected credentials:', error);
      setInfoModalConfig({
        title: 'Error',
        message: 'Failed to load selected credentials. Please try again.',
        buttonColor: 'red',
        hideActions: false,
      });
      setShowInfoModal(true);
    }
  };

  // Handle closing the present multiple VCs modal
  const handleClosePresentMultiple = () => {
    setShowPresentMultipleModal(false);
    setSelectedVCsList([]);
    setSelectedVCsForVP(new Set());
  };

  // Handle successful VP creation
  const handleVPSuccess = (vpId: string) => {
    console.log('VP created successfully:', vpId);
    // Don't close modal immediately - let user see QR code and close manually
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
          hideActions: false,
        });
        setShowInfoModal(true);
        return;
      }

      // Extract attributes (excluding 'id' field)
      const credentialSubject = vc.credentialSubject;
      const { id: subjectId, ...attributes } = credentialSubject;

      console.log(`Excluding id ${subjectId} from attributes for update:`, attributes);

      setUpdatingCredential(vc);
      setOriginalAttributes(attributes as { [key: string]: string | number | boolean });
      setUpdatedAttributes(attributes as { [key: string]: string | number | boolean });
      setUpdateReason('');
      setShowUpdateModal(true);
    } catch (error) {
      console.error('Error loading credential for update:', error);
      setInfoModalConfig({
        title: 'Error Loading Credential',
        message: 'Failed to load credential details. Please try again.',
        buttonColor: 'red',
        hideActions: false,
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
          hideActions: false,
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
        hideActions: false,
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
          hideActions: false,
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
        hideActions: false,
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
        hideActions: false,
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
        hideActions: false,
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
        hideActions: false,
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
        hideActions: false,
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

      // Calculate changed attributes by comparing original and updated
      const changedAttributes: { [key: string]: string | number | boolean } = {};
      Object.keys(updatedAttributes).forEach((key) => {
        // Compare with original attributes to find what changed
        if (originalAttributes[key] !== updatedAttributes[key]) {
          changedAttributes[key] = updatedAttributes[key];
        }
      });

      // Check if there are any changed attributes
      if (Object.keys(changedAttributes).length === 0) {
        setInfoModalConfig({
          title: 'No Changes Detected',
          message: 'No attributes have been modified. Please make changes before submitting.',
          buttonColor: 'yellow',
          hideActions: false,
        });
        setShowInfoModal(true);
        setIsUpdating(false);
        return;
      }

      // Prepare update data with only changed attributes
      const updateData = {
        vc_id: updatingCredential.id,
        changed_attributes: changedAttributes,
        update_reason: updateReason.trim(),
      };

      console.log('Update data prepared:', updateData);
      console.log('Changed attributes:', changedAttributes);

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
      setOriginalAttributes({});
      setUpdateReason('');

      setInfoModalConfig({
        title: 'Update Request Submitted',
        message:
          'Your credential update request has been submitted successfully. The issuer will review your request.',
        buttonColor: 'green',
        hideActions: false,
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
        hideActions: false,
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
        hideActions: false,
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
        hideActions: false,
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
        hideActions: false,
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
          hideActions: false,
        });
        setShowInfoModal(true);
        return;
      }

      // Create a copy of the VC without metadata fields (claimId, source)
      // These fields are for local storage tracking only and should not be exported
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vcCopy: any = { ...vc };
      const metadataFields = ['claimId', 'source'] as const;
      const removedMetadata: Record<string, string | undefined> = {};

      metadataFields.forEach((field) => {
        if (field in vcCopy) {
          removedMetadata[field] = vcCopy[field];
          delete vcCopy[field];
        }
      });

      // Convert VC to JSON string with pretty formatting (without metadata fields)
      const jsonString = JSON.stringify(vcCopy, null, 2);
      console.log('Removed metadata fields:', removedMetadata);
      console.log('VC without metadata (ready for download):', vcCopy);

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
        hideActions: false,
      });
      setShowInfoModal(true);
    }
  };

  const handleDownloadPdf = async (id: string) => {
    try {
      console.log('📄 Starting PDF download for credential:', id);

      // Show loading
      setInfoModalConfig({
        title: 'Generating PDF',
        message: 'Please wait while we generate your PDF with QR code...',
        buttonColor: 'blue',
        hideActions: true,
      });
      setShowInfoModal(true);

      // Step 1: Get credential (VC) from IndexedDB
      const vc = await getVCById(id);
      if (!vc) {
        throw new Error('Credential not found');
      }

      console.log('✅ Credential retrieved:', vc.id);

      // Step 2: Get holder's private key to sign VP
      const holderPrivateKey = localStorage.getItem('institutionSigningPrivateKey');
      if (!holderPrivateKey) {
        throw new Error('Private key not found. Please log in again.');
      }

      const holderDid = localStorage.getItem('institutionDID');
      if (!holderDid) {
        throw new Error('DID not found. Please log in again.');
      }

      // Step 3: Create and sign VP, then store to backend
      console.log('🔐 Creating and storing VP...');
      const vpId = await createAndStoreVP(vc, holderPrivateKey, holderDid);
      console.log('✅ VP created and stored with ID:', vpId);

      // Step 4: Get schema data for QR position
      // Schema data is stored separately in IndexedDB
      const { getSchemaDataByVCId } = await import('@/utils/indexedDB');
      const schemaData = await getSchemaDataByVCId(vc.id);
      if (!schemaData?.schema?.qr_code_position) {
        throw new Error('QR code position not found in schema');
      }

      const qrPos = schemaData.schema.qr_code_position as unknown;
      if (
        !qrPos ||
        typeof (qrPos as { x?: unknown }).x !== 'number' ||
        typeof (qrPos as { y?: unknown }).y !== 'number' ||
        typeof (qrPos as { size?: unknown }).size !== 'number'
      ) {
        throw new Error('Invalid QR code position in schema');
      }

      const qrPosition: { x: number; y: number; size: number } = qrPos as {
        x: number;
        y: number;
        size: number;
      };
      console.log('✅ QR Position:', qrPosition);

      // Step 5: Get background image URL
      const backgroundImageUrl = vc.fileUrl || vc.imageLink;
      if (!backgroundImageUrl) {
        throw new Error('Background image URL not found');
      }

      console.log('✅ Background image URL:', backgroundImageUrl);

      // Step 6: Generate PDF with QR code
      console.log('📝 Generating PDF...');
      const pdfBlob = await generatePDFWithQR(backgroundImageUrl, vpId, qrPosition);
      console.log('✅ PDF generated successfully');

      // Step 7: Create object URL for preview (better for iframe)
      const pdfUrl = URL.createObjectURL(pdfBlob);

      // Close loading modal and open PDF preview
      setShowInfoModal(false);

      // Set PDF preview data
      setPdfDataUrl(pdfUrl);
      setPdfBlob(pdfBlob);
      setPdfCredentialName(
        `${vc.type.find((t) => t !== 'VerifiableCredential') || 'Credential'}_${new Date().toISOString().split('T')[0]}.pdf`
      );
      setShowPDFPreview(true);

      console.log('✅ PDF preview opened');
    } catch (error) {
      console.error('❌ Error downloading credential as PDF:', error);
      setInfoModalConfig({
        title: 'Download Failed',
        message: `Failed to download credential as PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
        buttonColor: 'red',
        hideActions: false,
      });
      setShowInfoModal(true);
    }
  };

  // Handle PDF download from preview modal
  const handleDownloadPdfFromPreview = () => {
    if (pdfBlob && pdfCredentialName) {
      downloadPDF(pdfBlob, pdfCredentialName);
      console.log('✅ PDF downloaded:', pdfCredentialName);
    }
  };

  // Handle PDF preview modal close
  const handleClosePDFPreview = () => {
    // Revoke object URL to prevent memory leak
    if (pdfDataUrl) {
      URL.revokeObjectURL(pdfDataUrl);
    }
    setShowPDFPreview(false);
    setPdfDataUrl(null);
    setPdfBlob(null);
    setPdfCredentialName('');
  };

  const fetchSchemas = async () => {
    setIsSchemasLoading(true);
    try {
      const token = localStorage.getItem('institutionToken');
      const institutionDid = localStorage.getItem('institutionDID');

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
        // Filter out schemas where issuer_did matches the institution's own DID
        const filteredData = result.data.data.filter(
          (schema: Schema) => schema.issuer_did !== institutionDid
        );

        const schemasWithIds = addCompositeIds(filteredData);
        console.log(
          'Schemas with composite IDs (excluding own):',
          schemasWithIds.map((s) => ({
            id: s.id,
            version: s.version,
            compositeId: s.compositeId,
            issuer_did: s.issuer_did,
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
        hideActions: false,
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
          hideActions: false,
        });
        setShowInfoModal(true);
        return;
      }

      if (!token) {
        setInfoModalConfig({
          title: 'Authentication Required',
          message: 'Authentication token not found. Please login again.',
          buttonColor: 'yellow',
          hideActions: false,
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
          hideActions: false,
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
          hideActions: false,
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
        hideActions: false,
      });
      setShowInfoModal(true);
    }
  };

  /**
   * Claim VCs from the API in batches
   * Step 1: Fetch claimed VCs batch
   */
  const claimVCBatch = async (
    limit: number = 50
  ): Promise<{
    vcs: VerifiableCredential[];
    schemaDataList: SchemaData[];
    requestTypeCounts: {
      ISSUANCE: number;
      RENEWAL: number;
      REVOKE: number;
      UPDATE: number;
    };
  }> => {
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
      const allSchemaData: SchemaData[] = [];
      let hasMore = true;

      // Track request type counts
      const requestTypeCounts = {
        ISSUANCE: 0,
        RENEWAL: 0,
        REVOKE: 0,
        UPDATE: 0,
      };

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

        // Step 2: Decrypt each claimed VC and extract schema_data
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
              console.log(`[VC Claim] Request type: ${claimedVC.request_type}`);

              // Handle different request types
              if (claimedVC.request_type === 'REVOKE') {
                // REVOKE: Delete the old VC from IndexedDB
                console.log('[VC Claim] Processing REVOKE request');
                requestTypeCounts.REVOKE++;

                const vcData = decryptedData.verifiable_credential as { id?: string };
                const vcId = vcData?.id;

                if (!vcId || typeof vcId !== 'string') {
                  console.error('[VC Claim] REVOKE request missing vc_id:', decryptedData);
                  throw new Error('REVOKE request is missing vc_id');
                }

                console.log(`[VC Claim] Deleting VC with id: ${vcId}`);
                const deleted = await deleteVC(vcId);

                if (deleted) {
                  console.log(`[VC Claim] Successfully deleted VC: ${vcId}`);
                  // Also delete associated schema_data
                  try {
                    await deleteSchemaData(vcId);
                    console.log(`[VC Claim] Successfully deleted schema_data for VC: ${vcId}`);
                  } catch {
                    console.warn(`[VC Claim] No schema_data found for VC: ${vcId}`);
                  }
                } else {
                  console.warn(`[VC Claim] VC not found for deletion: ${vcId}`);
                }

                // No VC to add to allDecryptedVCs for REVOKE
                continue;
              } else if (claimedVC.request_type === 'UPDATE') {
                // UPDATE: Delete old VC and add new VC
                console.log('[VC Claim] Processing UPDATE request');
                requestTypeCounts.UPDATE++;

                const oldVcId = decryptedData.old_vc_id as string;

                if (!oldVcId || typeof oldVcId !== 'string') {
                  console.error('[VC Claim] UPDATE request missing old_vc_id:', decryptedData);
                  throw new Error('UPDATE request is missing old_vc_id');
                }

                // Delete old VC (this is part of the update process, not counted as a separate revocation)
                console.log(
                  `[VC Claim] Deleting old VC with id (part of update process): ${oldVcId}`
                );
                const deleted = await deleteVC(oldVcId);

                if (deleted) {
                  console.log(`[VC Claim] Successfully deleted old VC during update: ${oldVcId}`);
                  // Also delete associated schema_data
                  try {
                    await deleteSchemaData(oldVcId);
                    console.log(
                      `[VC Claim] Successfully deleted schema_data for old VC: ${oldVcId}`
                    );
                  } catch {
                    console.warn(`[VC Claim] No schema_data found for old VC: ${oldVcId}`);
                  }
                } else {
                  console.warn(`[VC Claim] Old VC not found for deletion: ${oldVcId}`);
                }

                // Get the new VC
                const vc = decryptedData.verifiable_credential as unknown as VerifiableCredential;

                if (!vc || typeof vc !== 'object') {
                  throw new Error('Decrypted VC data is not a valid object');
                }

                if (!vc.id) {
                  console.error('[VC Claim] Updated VC is missing id field:', vc);
                  throw new Error('Updated VC is missing required "id" field');
                }

                // Attach the claimId and source to the VC for later confirmation
                vc.claimId = claimedVC.claimId;
                vc.source = claimedVC.source;

                console.log(
                  `[VC Claim] Updated VC successfully: ${vc.id} (claimId: ${claimedVC.claimId}) from ${claimedVC.source}`
                );
                allDecryptedVCs.push(vc);

                // Extract schema_data if present
                if (claimedVC.schema_data) {
                  console.log(`[VC Claim] Extracting schema_data for updated VC: ${vc.id}`);
                  const schemaData: SchemaData = {
                    vc_id: vc.id,
                    id: claimedVC.schema_data.id,
                    version: claimedVC.schema_data.version,
                    name: claimedVC.schema_data.name,
                    schema: claimedVC.schema_data.schema,
                    issuer_did: claimedVC.schema_data.issuer_did,
                    issuer_name: claimedVC.schema_data.issuer_name,
                    image_link: claimedVC.schema_data.image_link || null,
                    expired_in: claimedVC.schema_data.expired_in,
                    isActive: claimedVC.schema_data.isActive,
                  };
                  allSchemaData.push(schemaData);
                  console.log(`[VC Claim] Schema data extracted for updated VC: ${vc.id}`);
                }
              } else if (claimedVC.request_type === 'RENEWAL') {
                // RENEWAL: Delete old VC and add new VC
                console.log('[VC Claim] Processing RENEWAL request');
                requestTypeCounts.RENEWAL++;

                const vc = decryptedData.verifiable_credential as unknown as VerifiableCredential;

                // Validate that the VC has required fields
                if (!vc || typeof vc !== 'object') {
                  throw new Error('Decrypted data is not a valid object');
                }

                if (!vc.id) {
                  console.error('[VC Claim] Renewed VC is missing id field:', vc);
                  throw new Error('Renewed VC is missing required "id" field');
                }

                // Delete any existing VC with the same ID (renewal overwrites old VC)
                // Note: This is part of the renewal process, not counted as a separate revocation
                console.log(`[VC Claim] Checking for existing VC with id: ${vc.id}`);
                try {
                  const deleted = await deleteVC(vc.id);
                  if (deleted) {
                    console.log(
                      `[VC Claim] Deleted old VC during renewal (part of renewal process): ${vc.id}`
                    );
                    // Also delete associated schema_data
                    try {
                      await deleteSchemaData(vc.id);
                      console.log(`[VC Claim] Deleted schema_data for old VC: ${vc.id}`);
                    } catch {
                      console.warn(`[VC Claim] No schema_data found for old VC: ${vc.id}`);
                    }
                  } else {
                    console.log(
                      `[VC Claim] No existing VC found to delete (first time renewal): ${vc.id}`
                    );
                  }
                } catch (deleteError) {
                  console.warn(`[VC Claim] Error deleting old VC during renewal:`, deleteError);
                }

                // Attach the claimId and source to the new VC for later confirmation
                vc.claimId = claimedVC.claimId;
                vc.source = claimedVC.source;

                console.log(
                  `[VC Claim] Renewed VC successfully: ${vc.id} (claimId: ${claimedVC.claimId}) from ${claimedVC.source}`
                );
                allDecryptedVCs.push(vc);

                // Extract schema_data if present
                if (claimedVC.schema_data) {
                  console.log(`[VC Claim] Extracting schema_data for renewed VC: ${vc.id}`);
                  const schemaData: SchemaData = {
                    vc_id: vc.id,
                    id: claimedVC.schema_data.id,
                    version: claimedVC.schema_data.version,
                    name: claimedVC.schema_data.name,
                    schema: claimedVC.schema_data.schema,
                    issuer_did: claimedVC.schema_data.issuer_did,
                    issuer_name: claimedVC.schema_data.issuer_name,
                    image_link: claimedVC.schema_data.image_link || null,
                    expired_in: claimedVC.schema_data.expired_in,
                    isActive: claimedVC.schema_data.isActive,
                  };
                  allSchemaData.push(schemaData);
                  console.log(`[VC Claim] Schema data extracted for renewed VC: ${vc.id}`);
                }
              } else {
                // ISSUANCE (default): Add new VC
                console.log('[VC Claim] Processing ISSUANCE request');
                requestTypeCounts.ISSUANCE++;

                const vc = decryptedData.verifiable_credential as unknown as VerifiableCredential;

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

                // Extract schema_data if present
                if (claimedVC.schema_data) {
                  console.log(`[VC Claim] Extracting schema_data for VC: ${vc.id}`);
                  const schemaData: SchemaData = {
                    vc_id: vc.id, // Link to VC using VC's id
                    id: claimedVC.schema_data.id,
                    version: claimedVC.schema_data.version,
                    name: claimedVC.schema_data.name,
                    schema: claimedVC.schema_data.schema,
                    issuer_did: claimedVC.schema_data.issuer_did,
                    issuer_name: claimedVC.schema_data.issuer_name,
                    image_link: claimedVC.schema_data.image_link || null,
                    expired_in: claimedVC.schema_data.expired_in,
                    isActive: claimedVC.schema_data.isActive,
                  };
                  allSchemaData.push(schemaData);
                  console.log(`[VC Claim] Schema data extracted for VC: ${vc.id}`);
                }
              }
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

      console.log(
        `[VC Claim] Total VCs: ${allDecryptedVCs.length}, Total Schema Data: ${allSchemaData.length}`
      );
      console.log('[VC Claim] Request type breakdown:');
      console.log(`  - New Issuances: ${requestTypeCounts.ISSUANCE}`);
      console.log(`  - Renewals: ${requestTypeCounts.RENEWAL}`);
      console.log(`  - Updates: ${requestTypeCounts.UPDATE}`);
      console.log(`  - Revocations: ${requestTypeCounts.REVOKE}`);

      return {
        vcs: allDecryptedVCs,
        schemaDataList: allSchemaData,
        requestTypeCounts,
      };
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

      // Step 1 & 2: Claim and decrypt VCs with schema_data
      const { vcs: decryptedVCs, schemaDataList, requestTypeCounts } = await claimVCBatch(50);

      if (decryptedVCs.length === 0) {
        console.log(
          '[VC Flow] No new VCs to claim. Loading existing credentials from IndexedDB...'
        );
        // Load existing VCs from IndexedDB without calling confirm batch
        await loadCredentialsFromIndexedDB();
        return;
      }

      console.log(`[VC Flow] Found ${decryptedVCs.length} new VCs to store`);
      console.log('[VC Flow] Request breakdown:');
      console.log(`  - New Issuances: ${requestTypeCounts.ISSUANCE}`);
      console.log(`  - Renewals: ${requestTypeCounts.RENEWAL}`);
      console.log(`  - Updates: ${requestTypeCounts.UPDATE}`);
      console.log(`  - Revocations: ${requestTypeCounts.REVOKE}`);

      // Log all VC IDs and claim IDs for debugging
      console.log('[VC Flow] VCs to be stored:');
      decryptedVCs.forEach((vc, index) => {
        console.log(`  [${index + 1}] VC ID: ${vc.id}, Claim ID: ${vc.claimId}`);
      });

      // Check for duplicate VC IDs and track all claim IDs
      const vcIds = decryptedVCs.map((vc) => vc.id);
      const uniqueVcIds = new Set(vcIds);
      const allClaimIds = decryptedVCs
        .filter((vc) => vc.claimId && vc.source)
        .map((vc) => ({ claimId: vc.claimId!, source: vc.source! }));

      if (vcIds.length !== uniqueVcIds.size) {
        console.warn(
          `[VC Flow] WARNING: Found duplicate VC IDs! Total: ${vcIds.length}, Unique: ${uniqueVcIds.size}`
        );
        const duplicates = vcIds.filter((id, index) => vcIds.indexOf(id) !== index);
        console.warn('[VC Flow] Duplicate VC IDs:', [...new Set(duplicates)]);

        // Deduplicate: Keep only the LAST VC for each ID (most recent)
        // But preserve ALL claim IDs for confirmation
        const vcMap = new Map<string, VerifiableCredential>();
        const claimIdsByVcId = new Map<string, string[]>();

        decryptedVCs.forEach((vc) => {
          // Track all claim IDs for this VC ID
          if (!claimIdsByVcId.has(vc.id)) {
            claimIdsByVcId.set(vc.id, []);
          }
          if (vc.claimId) {
            claimIdsByVcId.get(vc.id)!.push(vc.claimId);
          }

          // Keep the last VC (overwrites previous)
          vcMap.set(vc.id, vc);
        });

        const deduplicatedVCs = Array.from(vcMap.values());

        console.log(`[VC Flow] After deduplication: ${deduplicatedVCs.length} unique VCs`);
        console.log('[VC Flow] Kept VCs (with their claim IDs):');
        deduplicatedVCs.forEach((vc, index) => {
          const claimIds = claimIdsByVcId.get(vc.id) || [];
          console.log(`  [${index + 1}] VC ID: ${vc.id}`);
          console.log(`      Claim IDs: ${claimIds.join(', ')}`);
          console.log(`      Kept: ${vc.claimId}`);
        });

        // Replace the array with deduplicated version
        decryptedVCs.length = 0;
        decryptedVCs.push(...deduplicatedVCs);
      }

      // Step 3: Store VCs in IndexedDB
      console.log('[VC Flow] Storing VCs in IndexedDB...');
      const storedIds = await storeVCBatch(decryptedVCs);
      console.log(`[VC Flow] Stored ${storedIds.length} VCs in IndexedDB`);
      console.log('[VC Flow] Stored VC IDs:', storedIds);

      // Step 3b: Store schema_data in IndexedDB
      if (schemaDataList.length > 0) {
        console.log('[VC Flow] Storing schema_data in IndexedDB...');
        const storedSchemaIds = await storeSchemaDataBatch(schemaDataList);
        console.log(`[VC Flow] Stored ${storedSchemaIds.length} schema_data in IndexedDB`);
      }

      // Collect claimId from the STORED (deduplicated) VCs
      const storedClaimIds = decryptedVCs
        .filter((vc) => vc.claimId) // Only VCs that have claimId
        .map((vc) => vc.claimId!);

      console.log('[VC Flow] Stored claim IDs to verify:', storedClaimIds);

      // Verify all stored VCs by checking their claimIds
      const { items, missing } = await areVCsStoredByRequestIds(storedClaimIds);
      console.log(`[VC Flow] Verification: ${items.length} stored, ${missing.length} missing`);
      console.log('[VC Flow] Stored items (with VC IDs):', items);
      console.log('[VC Flow] Missing claim IDs:', missing);

      if (missing.length > 0) {
        console.warn('[VC Flow] Some VCs failed to store:', missing);
        throw new Error(`Failed to store ${missing.length} VCs in IndexedDB`);
      }

      // Confirm ALL claim IDs (including duplicates that were deduplicated)
      // This tells the API that we successfully processed all requests
      console.log('[VC Flow] Total claim IDs to confirm:', allClaimIds.length);
      console.log('[VC Flow] Confirming ALL claim IDs (including duplicates):', allClaimIds);

      // Step 4: Confirm VCs batch (confirm ALL claim IDs, including duplicates)
      if (allClaimIds.length > 0) {
        console.log('[VC Flow] Confirming VCs with API...');
        const confirmed = await confirmVCBatch(allClaimIds);

        if (confirmed) {
          console.log('[VC Flow] All VCs confirmed successfully');

          // Build breakdown message
          const breakdownParts = [];
          if (requestTypeCounts.ISSUANCE > 0) {
            breakdownParts.push(
              `${requestTypeCounts.ISSUANCE} new issuance${requestTypeCounts.ISSUANCE > 1 ? 's' : ''}`
            );
          }
          if (requestTypeCounts.RENEWAL > 0) {
            breakdownParts.push(
              `${requestTypeCounts.RENEWAL} renewal${requestTypeCounts.RENEWAL > 1 ? 's' : ''}`
            );
          }
          if (requestTypeCounts.UPDATE > 0) {
            breakdownParts.push(
              `${requestTypeCounts.UPDATE} update${requestTypeCounts.UPDATE > 1 ? 's' : ''}`
            );
          }
          if (requestTypeCounts.REVOKE > 0) {
            breakdownParts.push(
              `${requestTypeCounts.REVOKE} revocation${requestTypeCounts.REVOKE > 1 ? 's' : ''}`
            );
          }

          // Calculate total (renewals and updates include implicit deletions)
          const totalRequests =
            requestTypeCounts.ISSUANCE +
            requestTypeCounts.RENEWAL +
            requestTypeCounts.UPDATE +
            requestTypeCounts.REVOKE;

          const breakdownMessage =
            breakdownParts.length > 0 ? `\n\nRequest breakdown:\n${breakdownParts.join('\n')}` : '';

          // Add note if there were renewals or updates (which delete old VCs)
          const implicitDeletions = requestTypeCounts.RENEWAL + requestTypeCounts.UPDATE;
          const deletionNote =
            implicitDeletions > 0
              ? `\n\nNote: ${implicitDeletions} old credential${implicitDeletions > 1 ? 's were' : ' was'} replaced during renewal/update.`
              : '';

          setInfoModalConfig({
            title: 'Success',
            message: `Successfully processed ${totalRequests} credential request${totalRequests > 1 ? 's' : ''}!${breakdownMessage}${deletionNote}\n\nAdded: ${decryptedVCs.length} credential${decryptedVCs.length > 1 ? 's' : ''} in storage.`,
            buttonColor: 'green',
            hideActions: false,
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
          hideActions: false,
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
          expiryDate: vc.expiredAt || 'Lifetime',
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
    const institutionDid = localStorage.getItem('institutionDID');

    // Filter schemas by search term, also ensuring institution's own schemas are excluded
    const filtered = schemas.filter((schema) => {
      const searchLower = value.toLowerCase();
      const matchesSearch =
        schema.name.toLowerCase().includes(searchLower) ||
        schema.issuer_name.toLowerCase().includes(searchLower);
      const notOwnSchema = schema.issuer_did !== institutionDid;

      return matchesSearch && notOwnSchema;
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
      // Store the VC first
      await storeVC(uploadedVC);
      console.log('[Upload VC] VC stored successfully:', uploadedVC.id);

      // Extract schema_id and version from VC.id
      // Format: {schema_id}:{schema_version}:{holder_did}:{timestamp}
      const vcIdParts = uploadedVC.id.split(':');
      if (vcIdParts.length >= 2) {
        const schemaId = vcIdParts[0];
        const schemaVersion = parseInt(vcIdParts[1], 10);

        console.log('[Upload VC] Fetching schema data:', { schemaId, schemaVersion });

        try {
          // Fetch schema data from API
          const schemaUrl = buildApiUrl(API_ENDPOINTS.SCHEMAS.BY_VERSION(schemaId, schemaVersion));

          const schemaResponse = await fetch(schemaUrl, {
            headers: {
              accept: 'application/json',
            },
          });

          if (schemaResponse.ok) {
            const schemaResult = await schemaResponse.json();

            if (schemaResult.success && schemaResult.data) {
              const schemaApiData = schemaResult.data;

              // Create SchemaData object for IndexedDB
              const schemaData: SchemaData = {
                vc_id: uploadedVC.id, // Link to VC
                id: schemaApiData.id,
                version: schemaApiData.version,
                name: schemaApiData.name,
                schema: schemaApiData.schema,
                issuer_did: schemaApiData.issuer_did,
                issuer_name: schemaApiData.issuer_name,
                image_link: schemaApiData.image_link || null,
                expired_in: schemaApiData.expired_in,
                isActive: schemaApiData.isActive,
              };

              // Store schema data
              await storeSchemaData(schemaData);
              console.log('[Upload VC] Schema data stored successfully for VC:', uploadedVC.id);
            } else {
              console.warn('[Upload VC] Invalid schema response:', schemaResult);
            }
          } else {
            console.warn('[Upload VC] Failed to fetch schema data:', schemaResponse.status);
          }
        } catch (schemaError) {
          console.error('[Upload VC] Error fetching/storing schema data:', schemaError);
          // Don't fail the upload if schema fetch fails
        }
      } else {
        console.warn(
          '[Upload VC] Could not parse schema_id and version from VC.id:',
          uploadedVC.id
        );
      }

      setInfoModalConfig({
        title: 'Success',
        message: 'Credential uploaded and stored successfully!',
        buttonColor: 'green',
        hideActions: false,
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
        hideActions: false,
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
        <ThemedText className="text-sm text-gray-900">
          {row.expiryDate === 'Lifetime' ? 'Lifetime' : formatDate(row.expiryDate)}
        </ThemedText>
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
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium cursor-pointer"
          >
            REQUEST
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleExpandSchema(row.compositeId);
            }}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm font-medium cursor-pointer"
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
            onSelectionChange={handleVCSelection}
            selectedIds={selectedVCsForVP as Set<string | number>}
            onRowClick={(row) => handleView(row.id)}
            totalCount={filteredCredentials.length}
            rowsPerPageOptions={[5, 10, 25, 50, 100]}
            idKey="id"
            topRightButtons={
              <div className="flex gap-3">
                <button
                  onClick={fetchAndStoreCredentials}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      Refresh
                    </>
                  )}
                </button>
                {selectedVCsForVP.size > 0 && (
                  <button
                    onClick={handleOpenPresentMultiple}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-sm font-medium cursor-pointer shadow-sm"
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
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    Present as VP ({selectedVCsForVP.size})
                  </button>
                )}
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
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-black"
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
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-black"
            />
          </div>
        </div>
      )}

      {/* Request New Credential Modal */}
      <RequestCredentialModal
        isOpen={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        isSchemasLoading={isSchemasLoading}
        filteredSchemas={filteredSchemas}
        expandedSchemaId={expandedSchemaId}
        schemaColumns={schemaColumns}
        vcInfoColumns={vcInfoColumns}
        attributesColumns={attributesColumns}
        onSchemaSearch={handleSchemaSearch}
        getVCInfoData={getVCInfoData}
        getAttributesData={getAttributesData}
      />

      {/* View Credential Modal */}
      <ViewCredentialModal
        isOpen={showViewCredentialModal}
        onClose={() => {
          setShowViewCredentialModal(false);
          setSelectedCredential(null);
        }}
        selectedCredential={selectedCredential}
        onDownload={handleDownload}
        onDownloadPdf={handleDownloadPdf}
      />

      {/* Upload VC Modal */}
      <UploadVCModal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setUploadedFile(null);
          setUploadedVC(null);
          setUploadValidation(null);
        }}
        isValidating={isValidating}
        uploadValidation={uploadValidation}
        uploadedVC={uploadedVC}
        fileInputRef={fileInputRef}
        onFileUpload={handleFileUpload}
        onSave={handleSaveUploadedVC}
      />

      {/* Renew Credential Modal */}
      <RenewCredentialModal
        isOpen={showRenewModal}
        onClose={() => {
          setShowRenewModal(false);
          setRenewingCredential(null);
          setRenewalReason('');
        }}
        renewingCredential={renewingCredential}
        renewalReason={renewalReason}
        onReasonChange={setRenewalReason}
        isRenewing={isRenewing}
        onSubmit={handleSubmitRenew}
      />

      {/* Update Credential Modal */}
      <UpdateCredentialModal
        isOpen={showUpdateModal}
        onClose={() => {
          setShowUpdateModal(false);
          setUpdatingCredential(null);
          setUpdatedAttributes({});
          setOriginalAttributes({});
          setUpdateReason('');
        }}
        updatingCredential={updatingCredential}
        updatedAttributes={updatedAttributes}
        onAttributeChange={(key, value) => {
          setUpdatedAttributes((prev) => ({
            ...prev,
            [key]: value,
          }));
        }}
        updateReason={updateReason}
        onReasonChange={setUpdateReason}
        isUpdating={isUpdating}
        onSubmit={handleSubmitUpdate}
      />

      {/* Revoke Credential Modal */}
      <RevokeCredentialModal
        isOpen={showRevokeModal}
        onClose={() => {
          setShowRevokeModal(false);
          setRevokingCredential(null);
          setRevocationReason('');
        }}
        revokingCredential={revokingCredential}
        revocationReason={revocationReason}
        onReasonChange={setRevocationReason}
        isRevoking={isRevoking}
        onSubmit={handleSubmitRevoke}
      />

      {/* Present Credential Modal */}
      {showPresentModal && presentingCredential && (
        <PresentCredentialModal
          isOpen={showPresentModal}
          onClose={() => {
            setShowPresentModal(false);
            setPresentingCredential(null);
          }}
          credential={presentingCredential}
          onSuccess={(vpId) => {
            console.log('VP created successfully with ID:', vpId);
          }}
        />
      )}

      {/* Present Multiple Credentials Modal */}
      {showPresentMultipleModal && selectedVCsList.length > 0 && (
        <PresentMultipleCredentialsModal
          isOpen={showPresentMultipleModal}
          onClose={handleClosePresentMultiple}
          credentials={selectedVCsList}
          onSuccess={handleVPSuccess}
        />
      )}

      {/* Info Modal */}
      <InfoModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title={infoModalConfig.title}
        message={infoModalConfig.message}
        buttonColor={infoModalConfig.buttonColor}
        hideActions={infoModalConfig.hideActions}
      />

      {/* PDF Preview Modal */}
      <PDFPreviewModal
        isOpen={showPDFPreview}
        pdfDataUrl={pdfDataUrl}
        onClose={handleClosePDFPreview}
        onDownload={handleDownloadPdfFromPreview}
        credentialName={pdfCredentialName}
      />

      {/* Filter Popup */}
    </InstitutionLayout>
  );
}
