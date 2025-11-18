'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import InstitutionLayout from '@/components/InstitutionLayout';
import { ThemedText } from '@/components/ThemedText';
import { DataTable, Column } from '@/components/DataTable';
import Modal from '@/components/Modal';
import IssueNewCredentialForm, {
  IssueNewCredentialFormData,
} from '@/components/IssueNewCredentialForm';
import UpdateCredentialForm, { UpdateCredentialFormData } from '@/components/UpdateCredentialForm';
import ViewCredentialForm from '@/components/ViewCredentialForm';
import ViewSchemaForm from '@/components/ViewSchemaForm';
import ConfirmationModal from '@/components/ConfirmationModal';
import InputModal from '@/components/InputModal';
import InfoModal from '@/components/InfoModal';
import { redirectIfJWTInvalid } from '@/utils/auth';
import { API_ENDPOINTS, buildApiUrlWithParams, buildApiUrl } from '@/utils/api';
import { authenticatedGet, authenticatedPost } from '@/utils/api-client';
import { decryptWithPrivateKey, encryptWithPublicKey, type JsonObject } from '@/utils/encryptUtils';
import { createVC, hashVC } from '@/utils/vcUtils';
import { signVCWithStoredKey } from '@/utils/vcSigner';

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
  vcHistory?: VerifiableCredentialData[]; // Array of all VCs (newest first)
}

interface ApiVCDataResponse {
  success: boolean;
  message: string;
  data: {
    message: string;
    count: number;
    data: {
      id: string;
      issuer_did: string;
      encrypted_body: string;
      createdAt: string;
      updatedAt: string;
    }[];
  };
}

interface SchemaResponse {
  success: boolean;
  data: {
    count: number;
    data: {
      id: string;
      version: number;
      name: string;
      schema: {
        type: string;
        required: string[];
        expired_in: number;
        properties: Record<string, { type: string; description: string }>;
      };
      issuer_did: string;
      issuer_name: string;
      isActive: boolean;
      image_link?: string | null;
      createdAt: string;
      updatedAt: string;
    }[];
  };
}

interface SchemaApiResponse {
  success: boolean;
  data: {
    id: string;
    name: string;
    schema: {
      type: string;
      required: string[];
      properties: Record<string, { type: string; description: string }>;
      expired_in: number;
    };
    issuer_did: string;
    version: number;
    isActive: boolean;
    image_link: string | null;
    createdAt: string;
    updatedAt: string;
  };
}

interface SchemaAttribute {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

interface Schema {
  id: string;
  name: string;
  version: string;
  status: string;
  attributes: SchemaAttribute[];
  image_link: string | null;
  expired_in: number;
  created_at?: string;
  updated_at?: string;
}

export default function IssuedByMePage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [credentials, setCredentials] = useState<IssuedCredential[]>([]);
  const [filteredCredentials, setFilteredCredentials] = useState<IssuedCredential[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'Active' | 'Revoked' | 'Expired'>('all');
  const [filterType, setFilterType] = useState('');
  const [filterButtonPosition, setFilterButtonPosition] = useState({ top: 0, left: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedCredential, setSelectedCredential] = useState<IssuedCredential | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationConfig, setConfirmationConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    confirmButtonColor?: 'blue' | 'green' | 'red' | 'yellow';
  }>({
    title: '',
    message: '',
    onConfirm: () => {},
  });
  const [schemas, setSchemas] = useState<
    {
      id: string;
      name: string;
      version: number;
      isActive: boolean;
      expiredIn?: number;
      imageUrl?: string;
      createdAt?: string;
      updatedAt?: string;
      attributes: {
        name: string;
        type: string;
        required: boolean;
        description?: string;
      }[];
    }[]
  >([]);
  const [showSchemaModal, setShowSchemaModal] = useState(false);
  const [schemaData, setSchemaData] = useState<Schema | null>(null);
  const [showRevokeInputModal, setShowRevokeInputModal] = useState(false);
  const [revokeCredentialId, setRevokeCredentialId] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoModalConfig, setInfoModalConfig] = useState<{
    title: string;
    message: string;
    buttonText?: string;
    buttonColor?: 'blue' | 'green' | 'red' | 'yellow';
  }>({
    title: '',
    message: '',
  });

  const filterModalRef = useRef<HTMLDivElement>(null);

  const activeCount = credentials.filter((c) => c.status === 'APPROVED').length;

  // Fetch credentials from API
  const fetchCredentials = async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    setError(null);
    try {
      const institutionDID = localStorage.getItem('institutionDID');
      if (!institutionDID) {
        throw new Error('Institution DID not found. Please log in again.');
      }

      // Fetch credentials using issuer VC data endpoint
      const credentialsUrl = buildApiUrl(
        API_ENDPOINTS.CREDENTIALS.ISSUER.VC_BY_DID(institutionDID)
      );

      const credentialsResponse = await authenticatedGet(credentialsUrl);

      if (!credentialsResponse.ok) {
        throw new Error('Failed to fetch credentials');
      }

      const credentialsResult: ApiVCDataResponse = await credentialsResponse.json();

      // Fetch schemas to get schema names
      const schemasUrl = buildApiUrlWithParams(API_ENDPOINTS.SCHEMAS.BASE, {
        issuerDid: institutionDID,
      });

      const schemasResponse = await authenticatedGet(schemasUrl);

      if (!schemasResponse.ok) {
        throw new Error('Failed to fetch schemas');
      }

      const schemasResult: SchemaResponse = await schemasResponse.json();

      // Create a map of schema_id to schema name
      const schemaMap = new Map<string, { name: string; expiredIn: number }>();
      schemasResult.data.data.forEach((schema) => {
        schemaMap.set(schema.id, {
          name: schema.name,
          expiredIn: schema.schema.expired_in || 5,
        });
      });

      // Transform schemas for the form
      const transformedSchemas = schemasResult.data.data.map((schema) => ({
        id: schema.id,
        name: schema.name,
        version: schema.version,
        isActive: schema.isActive,
        expiredIn: schema.schema.expired_in || 0,
        imageUrl: schema.image_link || undefined,
        createdAt: schema.createdAt,
        updatedAt: schema.updatedAt,
        attributes: Object.entries(schema.schema.properties).map(([key, prop]) => ({
          name: key,
          type: prop.type,
          required: schema.schema.required.includes(key),
          description: prop.description,
        })),
      }));
      setSchemas(transformedSchemas);

      // Decrypt and process all encrypted VC data
      const privateKeyHex = localStorage.getItem('institutionSigningPrivateKey');
      const transformedCredentials: IssuedCredential[] = [];

      for (const vcData of credentialsResult.data.data) {
        if (!privateKeyHex) {
          continue;
        }

        try {
          // Decrypt the encrypted body
          const decryptedData = await decryptWithPrivateKey(vcData.encrypted_body, privateKeyHex);
          console.log('decryptedData', decryptedData);

          // The decrypted data should have structure: { vc_status: boolean, verifiable_credentials: [...] }
          const vcContainer = decryptedData as unknown as {
            vc_status: boolean;
            verifiable_credentials: VerifiableCredentialData[];
          };

          // Store all VCs in history (verifiable_credentials array is already sorted newest first)
          const vcHistory = vcContainer.verifiable_credentials || [];

          // Use the first (newest) VC for the table display
          if (vcHistory.length > 0) {
            const newestVC = vcHistory[0];

            // Parse schema_id and schema_version from vc.id
            // vc.id format: "schema_id:schema_version:holder_did:timestamp"
            let schemaId = '';
            let schemaVersion = 1;

            if (newestVC.id) {
              const vcIdParts = newestVC.id.split(':');
              if (vcIdParts.length >= 2 && vcIdParts[0] !== 'undefined' && vcIdParts[0] !== '') {
                schemaId = vcIdParts[0];
                schemaVersion = parseInt(vcIdParts[1], 10) || 1;
              }
            }

            // Get holder DID from credentialSubject
            const holderDid = newestVC.credentialSubject?.id || '';

            // Get schema name from the map
            const schemaInfo = schemaMap.get(schemaId);
            const schemaName = schemaInfo?.name || 'Unknown Schema';
            const isUnknownSchema = !schemaInfo || !schemaId;

            // Determine credential status based on newest VC
            let credentialStatus = 'APPROVED';
            if (newestVC.credentialStatus?.revoked) {
              credentialStatus = 'REVOKED';
            } else if (newestVC.expiredAt) {
              const expirationDate = new Date(newestVC.expiredAt);
              const now = new Date();
              if (expirationDate < now) {
                credentialStatus = 'EXPIRED';
              }
            }

            // Extract credential data (excluding standard VC fields)
            const encryptedBody: Record<string, unknown> = {};
            if (newestVC.credentialSubject) {
              Object.entries(newestVC.credentialSubject).forEach(([key, value]) => {
                if (key !== 'id') {
                  encryptedBody[key] = value;
                }
              });
            }

            transformedCredentials.push({
              id: vcData.id,
              holderDid: holderDid,
              schemaName: isUnknownSchema
                ? schemaName
                : schemaVersion > 0
                  ? `${schemaName} v${schemaVersion}`
                  : schemaName,
              status: credentialStatus,
              activeUntil: newestVC.expiredAt || '-',
              schemaId: schemaId,
              schemaVersion: schemaVersion,
              encryptedBody: encryptedBody,
              createdAt: newestVC.validFrom || vcData.createdAt,
              vcId: newestVC.id,
              vcHistory: vcHistory, // Store the entire history
            });
          }
        } catch (error) {
          console.error('Error decrypting VC data:', error);
          // Skip this VC if decryption fails
        }
      }

      setCredentials(transformedCredentials);
      setFilteredCredentials(transformedCredentials);
    } catch (err) {
      console.error('Error fetching credentials:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      // Keep empty array on error
      setCredentials([]);
      setFilteredCredentials([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Check authentication with JWT verification on component mount
  useEffect(() => {
    const checkAuth = async () => {
      const redirected = await redirectIfJWTInvalid(router);
      if (!redirected) {
        setIsAuthenticated(true);
      }
    };

    checkAuth();
  }, [router]);

  useEffect(() => {
    fetchCredentials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

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
        credential.schemaName.toLowerCase().includes(searchLower) ||
        credential.holderDid.toLowerCase().includes(searchLower) ||
        (credential.status || '').toLowerCase().includes(searchLower)
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

  const applyFilters = (status: 'all' | 'Active' | 'Revoked' | 'Expired', type: string) => {
    let filtered = credentials;

    if (status !== 'all') {
      const statusMap = {
        Active: 'APPROVED',
        Revoked: 'REVOKED',
        Expired: 'EXPIRED',
      };
      filtered = filtered.filter(
        (credential) => credential.status === statusMap[status as keyof typeof statusMap]
      );
    }

    if (type) {
      filtered = filtered.filter((credential) =>
        credential.schemaName.toLowerCase().includes(type.toLowerCase())
      );
    }

    setFilteredCredentials(filtered);
  };

  const handleStatusChange = (status: 'all' | 'Active' | 'Revoked' | 'Expired') => {
    setFilterStatus(status);
    applyFilters(status, filterType);
  };

  const handleTypeChange = (type: string) => {
    setFilterType(type);
    applyFilters(filterStatus, type);
  };

  const handleUpdate = (id: string) => {
    const credential = credentials.find((c) => c.id === id);
    if (!credential) return;

    setSelectedCredential(credential);
    setShowUpdateModal(true);
  };

  const handleUpdateCredential = async (data: UpdateCredentialFormData) => {
    try {
      console.log('Updating credential:', data);

      // Get issuer information
      const issuerDid = localStorage.getItem('institutionDID');
      const institutionDataStr = localStorage.getItem('institutionData');

      if (!issuerDid || !institutionDataStr) {
        throw new Error('Issuer information not found. Please log in again.');
      }

      const institutionData = JSON.parse(institutionDataStr);
      const institutionName = institutionData.name;

      if (!institutionName) {
        throw new Error('Institution name not found. Please log in again.');
      }

      // Find the credential to get the vcId
      const credential = credentials.find((c) => c.id === data.credentialId);
      if (!credential || !credential.vcId) {
        throw new Error('Credential not found or missing VC ID.');
      }

      // Fetch holder's DID document to get their public key
      const holderDidUrl = buildApiUrl(API_ENDPOINTS.DIDS.DOCUMENT(data.holderDid));
      const holderDidResponse = await authenticatedGet(holderDidUrl);

      if (!holderDidResponse.ok) {
        throw new Error('Failed to fetch holder DID document.');
      }

      const holderDidDoc = await holderDidResponse.json();
      const holderPublicKey = holderDidDoc.data?.[holderDidDoc.data?.keyId];
      if (!holderPublicKey) {
        throw new Error('Holder public key not found in DID document');
      }

      // Fetch schema details
      const schemaUrl = buildApiUrl(API_ENDPOINTS.SCHEMAS.BY_VERSION(data.schemaId, data.version));
      const schemaResponse = await authenticatedGet(schemaUrl);

      if (!schemaResponse.ok) {
        throw new Error('Failed to fetch schema details');
      }

      const schemaData = await schemaResponse.json();
      const imageLink = schemaData.data?.image_link || null;
      const expiredIn = schemaData.data?.schema?.expired_in || 5;

      // Calculate expiration date
      const now = new Date();
      const expiredAt = new Date(now);
      expiredAt.setFullYear(expiredAt.getFullYear() + expiredIn);

      // Transform attributes into credential data format
      const credentialData: Record<string, string | number | boolean> = {};
      data.attributes.forEach((attr) => {
        credentialData[attr.name] = attr.value;
      });

      // Create a unique new VC ID
      const timestamp = Date.now();
      const newVcId = `${schemaData.id}:${schemaData.version}:${data.holderDid}:${timestamp}`;

      // Create the new Verifiable Credential
      const vc = createVC({
        id: newVcId,
        vcType: data.schemaName.replace(/\s+v\d+$/, '').replace(/\s+/g, ''), // Remove version suffix and spaces
        issuerDid: issuerDid,
        issuerName: institutionName,
        holderDid: data.holderDid,
        credentialData: credentialData,
        validFrom: now.toISOString(),
        expiredAt: expiredAt.toISOString(),
        imageLink: imageLink,
      });

      // Sign the VC
      const signedVC = await signVCWithStoredKey(vc);

      // Hash the VC
      const vcHashWithoutPrefix = hashVC(signedVC);

      const wrappedBody = {
        old_vc_id: credential.vcId,
        verifiable_credential: signedVC,
      };

      // Encrypt with holder's public key
      const encryptedBody = await encryptWithPublicKey(
        JSON.parse(JSON.stringify(wrappedBody)),
        holderPublicKey
      );

      // Call the update-vc API
      const updateUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.ISSUER.UPDATE_VC);
      const updateResponse = await authenticatedPost(updateUrl, {
        issuer_did: issuerDid,
        holder_did: data.holderDid,
        old_vc_id: credential.vcId,
        new_vc_id: newVcId,
        vc_type: data.schemaName.replace(/\s+v\d+$/, '').replace(/\s+/g, ''),
        schema_id: data.schemaId,
        schema_version: data.version,
        new_vc_hash: vcHashWithoutPrefix,
        encrypted_body: encryptedBody,
        expiredAt: expiredAt.toISOString(),
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(errorData.message || 'Failed to update credential');
      }

      // Show success confirmation
      setShowUpdateModal(false);
      setSelectedCredential(null);
      setConfirmationConfig({
        title: 'Update Credential',
        message: `The credential has been updated successfully.\n\nThe holder can claim the updated credential.`,
        confirmText: 'OK',
        confirmButtonColor: 'green',
        onConfirm: () => {
          setShowConfirmation(false);
          fetchCredentials();
        },
      });
      setShowConfirmation(true);
    } catch (error) {
      console.error('Error updating credential:', error);
      setConfirmationConfig({
        title: 'Error',
        message: `Failed to update credential: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again.`,
        confirmText: 'OK',
        confirmButtonColor: 'red',
        onConfirm: () => {
          setShowConfirmation(false);
        },
      });
      setShowConfirmation(true);
      throw error;
    }
  };

  const handleRevoke = (id: string) => {
    const credential = credentials.find((c) => c.id === id);
    if (!credential) return;

    if (!credential.vcId) {
      setInfoModalConfig({
        title: 'Error',
        message: 'Credential VC ID not found. Cannot revoke this credential.',
        buttonText: 'OK',
        buttonColor: 'red',
      });
      setShowInfoModal(true);
      return;
    }

    // Show input modal for revocation reason
    setRevokeCredentialId(id);
    setShowRevokeInputModal(true);
  };

  const handleRevokeConfirm = async (reason: string) => {
    setShowRevokeInputModal(false);

    if (!revokeCredentialId) return;

    const credential = credentials.find((c) => c.id === revokeCredentialId);
    if (!credential) return;

    setConfirmationConfig({
      title: 'Revoke Credential',
      message: `Are you sure you want to revoke this credential?\n\nReason: ${reason}\n\nThis action cannot be undone.`,
      confirmText: 'Revoke',
      confirmButtonColor: 'red',
      onConfirm: async () => {
        try {
          console.log('Revoke credential:', credential.vcId);

          // Fetch holder's DID document to get their public key
          const holderDidUrl = buildApiUrl(API_ENDPOINTS.DIDS.DOCUMENT(credential.holderDid));
          const holderDidResponse = await authenticatedGet(holderDidUrl);

          if (!holderDidResponse.ok) {
            throw new Error('Failed to fetch holder DID document.');
          }

          const holderDidDoc = await holderDidResponse.json();
          const holderPublicKey = holderDidDoc.data?.[holderDidDoc.data?.keyId];
          if (!holderPublicKey) {
            throw new Error('Holder public key not found in DID document');
          }

          // Encrypt the reason with holder's public key
          const encryptedReason = await encryptWithPublicKey(
            { reason: reason } as JsonObject,
            holderPublicKey
          );

          const revokeUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.ISSUER.REVOKE_VC);
          const issuerDid = localStorage.getItem('institutionDID');
          const revokeResponse = await authenticatedPost(revokeUrl, {
            issuer_did: issuerDid,
            holder_did: credential.holderDid,
            vc_id: credential.vcId,
            encrypted_body: encryptedReason,
          });

          if (!revokeResponse.ok) {
            const errorData = await revokeResponse.json();
            throw new Error(errorData.message || 'Failed to revoke credential');
          }

          setShowConfirmation(false);
          setInfoModalConfig({
            title: 'Success',
            message: 'Credential has been revoked successfully.',
            buttonText: 'OK',
            buttonColor: 'green',
          });
          setShowInfoModal(true);
          fetchCredentials();
        } catch (error) {
          console.error('Error revoking credential:', error);
          setShowConfirmation(false);
          setInfoModalConfig({
            title: 'Error',
            message: `Failed to revoke credential: ${error instanceof Error ? error.message : 'Unknown error'}`,
            buttonText: 'OK',
            buttonColor: 'red',
          });
          setShowInfoModal(true);
        }
      },
    });
    setShowConfirmation(true);
  };

  const handleRenew = (id: string) => {
    const credential = credentials.find((c) => c.id === id);
    if (!credential) return;

    if (!credential.vcId) {
      setConfirmationConfig({
        title: 'Error',
        message: 'Credential VC ID not found. Cannot renew this credential.',
        confirmText: 'OK',
        confirmButtonColor: 'red',
        onConfirm: () => {
          setShowConfirmation(false);
        },
      });
      setShowConfirmation(true);
      return;
    }

    setConfirmationConfig({
      title: 'Renew Credential',
      message: `Are you sure you want to renew this credential?\n\nA new credential with the same data will be issued.`,
      confirmText: 'Renew',
      confirmButtonColor: 'blue',
      onConfirm: async () => {
        try {
          console.log('Renew credential:', credential.vcId);

          // Get issuer information
          const issuerDid = localStorage.getItem('institutionDID');
          if (!issuerDid) {
            throw new Error('Issuer DID not found. Please log in again.');
          }

          // Fetch holder's DID document to get their public key
          const holderDidUrl = buildApiUrl(API_ENDPOINTS.DIDS.DOCUMENT(credential.holderDid));
          const holderDidResponse = await authenticatedGet(holderDidUrl);

          if (!holderDidResponse.ok) {
            throw new Error('Failed to fetch holder DID document.');
          }

          const holderDidDoc = await holderDidResponse.json();
          const holderPublicKey = holderDidDoc.data?.[holderDidDoc.data?.keyId];
          if (!holderPublicKey) {
            throw new Error('Holder public key not found in DID document');
          }

          // Fetch schema details to get expiration
          const schemaUrl = buildApiUrl(
            API_ENDPOINTS.SCHEMAS.BY_VERSION(credential.schemaId, credential.schemaVersion)
          );
          const schemaResponse = await authenticatedGet(schemaUrl);

          if (!schemaResponse.ok) {
            throw new Error('Failed to fetch schema details');
          }

          const schemaData = await schemaResponse.json();
          const expiredIn = schemaData.data?.schema?.expired_in || 5;

          // Calculate new expiration date
          const now = new Date();
          const expiredAt = new Date(now);
          expiredAt.setFullYear(expiredAt.getFullYear() + expiredIn);

          // Get institution information
          const institutionDataStr = localStorage.getItem('institutionData');
          if (!institutionDataStr) {
            throw new Error('Institution information not found. Please log in again.');
          }

          const institutionData = JSON.parse(institutionDataStr);
          const institutionName = institutionData.name;

          if (!institutionName) {
            throw new Error('Institution name not found. Please log in again.');
          }

          // Get image link from schema
          const imageLink = schemaData.data?.image_link || null;

          // Transform credential data
          const credentialData: Record<string, string | number | boolean> = {};
          if (credential.encryptedBody) {
            Object.entries(credential.encryptedBody).forEach(([key, value]) => {
              credentialData[key] = value as string | number | boolean;
            });
          }

          // Create the Verifiable Credential (vcId is guaranteed to exist by earlier check)
          const vc = createVC({
            id: credential.vcId!,
            vcType: credential.schemaName.replace(/\s+v\d+$/, '').replace(/\s+/g, ''),
            issuerDid: issuerDid,
            issuerName: institutionName,
            holderDid: credential.holderDid,
            credentialData: credentialData,
            validFrom: now.toISOString(),
            expiredAt: expiredAt.toISOString(),
            imageLink: imageLink,
          });

          console.log('Created VC (unsigned):', vc);

          // Sign the VC with stored private key
          const signedVC = await signVCWithStoredKey(vc);
          console.log('Signed VC with proof:', signedVC);

          const wrappedBody = {
            verifiable_credential: signedVC,
          };

          // Encrypt with holder's public key
          const encryptedBody = await encryptWithPublicKey(
            JSON.parse(JSON.stringify(wrappedBody)),
            holderPublicKey
          );

          // Call the renew-vc API
          const renewUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.ISSUER.RENEW_VC);
          const renewResponse = await authenticatedPost(renewUrl, {
            issuer_did: issuerDid,
            holder_did: credential.holderDid,
            vc_id: credential.vcId,
            encrypted_body: encryptedBody,
            expiredAt: expiredAt.toISOString(),
          });

          if (!renewResponse.ok) {
            const errorData = await renewResponse.json();
            throw new Error(errorData.message || 'Failed to renew credential');
          }

          setShowConfirmation(false);
          setConfirmationConfig({
            title: 'Renew Credential',
            message: `The credential has been renewed successfully.\n\nThe holder can claim the renewed credential.`,
            confirmText: 'OK',
            confirmButtonColor: 'green',
            onConfirm: () => {
              setShowConfirmation(false);
              fetchCredentials();
            },
          });
          setShowConfirmation(true);
        } catch (error) {
          console.error('Error renewing credential:', error);
          setShowConfirmation(false);
          setConfirmationConfig({
            title: 'Error',
            message: `Failed to renew credential: ${error instanceof Error ? error.message : 'Unknown error'}`,
            confirmText: 'OK',
            confirmButtonColor: 'red',
            onConfirm: () => {
              setShowConfirmation(false);
            },
          });
          setShowConfirmation(true);
        }
      },
    });
    setShowConfirmation(true);
  };

  const handleRowClick = (credential: IssuedCredential) => {
    setSelectedCredential(credential);
    setShowViewModal(true);
  };

  const handleNewCredential = () => {
    setShowIssueModal(true);
  };

  const handleCopyDid = async (did: string, id: string) => {
    try {
      await navigator.clipboard.writeText(did);
      setCopiedId(id);
      // Reset after 2 seconds
      setTimeout(() => {
        setCopiedId(null);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy DID:', error);
    }
  };

  const truncateDid = (did: string, maxLength: number = 25): string => {
    if (did.length <= maxLength) {
      return did;
    }
    return did.substring(0, maxLength) + '...';
  };

  const handleViewSchema = async (schemaId: string, schemaVersion: number) => {
    try {
      const schemaUrl = buildApiUrl(API_ENDPOINTS.SCHEMAS.BY_VERSION(schemaId, schemaVersion));
      const schemaResponse = await authenticatedGet(schemaUrl);

      if (schemaResponse.ok) {
        const schemaApiData: SchemaApiResponse = await schemaResponse.json();

        if (schemaApiData.success && schemaApiData.data) {
          const { id, name, schema, version, isActive, createdAt, updatedAt } = schemaApiData.data;

          // Transform schema properties into attributes array
          const attributes: SchemaAttribute[] = Object.entries(schema.properties).map(
            ([key, prop]) => ({
              name: key,
              type: prop.type,
              required: schema.required.includes(key),
              description: prop.description,
            })
          );

          setSchemaData({
            id: id,
            name: name,
            version: version.toString(),
            status: isActive ? 'Active' : 'Inactive',
            attributes: attributes,
            image_link: schemaApiData.data.image_link,
            expired_in: schema.expired_in,
            created_at: createdAt,
            updated_at: updatedAt,
          });

          setShowSchemaModal(true);
        } else {
          throw new Error('Invalid schema response');
        }
      } else {
        throw new Error('Failed to fetch schema details');
      }
    } catch (err) {
      console.error('Error fetching schema details:', err);
      alert('Failed to load schema details');
    }
  };

  const handleIssueCredential = async (data: IssueNewCredentialFormData) => {
    try {
      console.log('Issuing new credential:', data);

      // Step 1: Get issuer information from localStorage
      const issuerDid = localStorage.getItem('institutionDID');
      const institutionDataStr = localStorage.getItem('institutionData');
      const issuerPublicKey = localStorage.getItem('institutionSigningPublicKey');

      if (!issuerDid || !institutionDataStr || !issuerPublicKey) {
        throw new Error('Issuer information not found. Please log in again.');
      }

      const institutionData = JSON.parse(institutionDataStr);
      const institutionName = institutionData.name;

      if (!institutionName) {
        throw new Error('Institution name not found. Please log in again.');
      }

      // Step 2: Fetch holder's DID document to get their public key
      const holderDidUrl = buildApiUrl(API_ENDPOINTS.DIDS.DOCUMENT(data.holderDid));
      const holderDidResponse = await authenticatedGet(holderDidUrl);

      if (!holderDidResponse.ok) {
        throw new Error('Failed to fetch holder DID document. Please check the holder DID.');
      }

      const holderDidDoc = await holderDidResponse.json();
      console.log('holderDidDoc', holderDidDoc);

      // Extract public key from DID document (use keyId to get the public key)
      const holderPublicKey = holderDidDoc.data?.[holderDidDoc.data?.keyId];
      if (!holderPublicKey) {
        throw new Error('Holder public key not found in DID document');
      }

      // Step 3: Fetch schema details to get image link and expiration
      const schemaUrl = buildApiUrl(API_ENDPOINTS.SCHEMAS.BY_VERSION(data.schemaId, data.version));
      const schemaResponse = await authenticatedGet(schemaUrl);

      if (!schemaResponse.ok) {
        throw new Error('Failed to fetch schema details');
      }

      const schemaData = await schemaResponse.json();
      const imageLink = schemaData.data?.image_link || null;
      const expiredIn = schemaData.data?.schema?.expired_in || 5;

      // Calculate expiration date
      const now = new Date();
      const expiredAt = new Date(now);
      expiredAt.setFullYear(expiredAt.getFullYear() + expiredIn);

      // Step 4: Transform attributes into credential data format
      const credentialData: Record<string, string | number | boolean> = {};
      data.attributes.forEach((attr) => {
        credentialData[attr.name] = attr.value;
      });

      // Step 5: Create a unique VC ID (using UUID format with timestamp)
      const timestamp = Date.now();
      const vcId = `${data.schemaId}:${data.version}:${data.holderDid}:${timestamp}`;

      // Step 6: Create the Verifiable Credential
      const vc = createVC({
        id: vcId,
        vcType: data.schemaName.replace(/\s+/g, ''), // Remove spaces for VC type
        issuerDid: issuerDid,
        issuerName: institutionName,
        holderDid: data.holderDid,
        credentialData: credentialData,
        validFrom: now.toISOString(),
        expiredAt: expiredAt.toISOString(),
        imageLink: imageLink,
      });

      console.log('Created VC:', vc);

      // Step 7: Sign the VC with stored keys
      const signedVC = await signVCWithStoredKey(vc);
      console.log('Signed VC:', signedVC);

      // Step 8: Hash the VC (returns 64-character hex without 0x prefix)
      const vcHashWithoutPrefix = hashVC(signedVC);
      console.log('VC Hash:', vcHashWithoutPrefix);

      const wrappedBody = {
        verifiable_credential: signedVC,
      };

      // Step 10: Encrypt the body with holder's public key
      const encryptedBodyByHolderPK = await encryptWithPublicKey(
        JSON.parse(JSON.stringify(wrappedBody)),
        holderPublicKey
      );
      const encryptedBodyByIssuerPK = await encryptWithPublicKey(
        JSON.parse(
          JSON.stringify({
            vc_status: true,
            verifiable_credentials: [signedVC],
          })
        ),
        issuerPublicKey
      );
      console.log('Encrypted body length:', encryptedBodyByHolderPK.length);

      // Step 11: Call the API to issue the credential
      const issueUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.ISSUER.ISSUE_VC);
      const issueResponse = await authenticatedPost(issueUrl, {
        issuer_did: issuerDid,
        holder_did: data.holderDid,
        vc_id: vcId,
        vc_type: data.schemaName.replace(/\s+/g, ''),
        schema_id: data.schemaId,
        schema_version: data.version,
        vc_hash: vcHashWithoutPrefix,
        encrypted_body: encryptedBodyByHolderPK,
        expiredAt: expiredAt.toISOString(),
      });
      const storeUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.ISSUER.VC);
      const storeResponse = await authenticatedPost(storeUrl, {
        issuer_did: issuerDid,
        encrypted_body: encryptedBodyByIssuerPK,
      });

      if (!issueResponse.ok || !storeResponse.ok) {
        const errorData1 = await issueResponse.json();
        const errorData2 = await issueResponse.json();
        throw new Error(errorData1.message || errorData2.message || 'Failed to issue credential');
      }

      const responseData = await issueResponse.json();
      console.log('Issue credential response:', responseData);

      // Show success message and close the modal
      setShowIssueModal(false);
      setConfirmationConfig({
        title: 'Success',
        message: `Credential has been issued successfully!\n\nThe holder can now claim this credential.`,
        confirmText: 'OK',
        confirmButtonColor: 'green',
        onConfirm: () => {
          setShowConfirmation(false);
          // Refresh the credentials list
          window.location.reload();
        },
      });
      setShowConfirmation(true);
    } catch (error) {
      console.error('Error issuing credential:', error);
      setShowIssueModal(false);
      setConfirmationConfig({
        title: 'Error',
        message: `Failed to issue credential: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again.`,
        confirmText: 'OK',
        confirmButtonColor: 'red',
        onConfirm: () => {
          setShowConfirmation(false);
        },
      });
      setShowConfirmation(true);
      throw error;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-700';
      case 'REVOKED':
        return 'bg-red-100 text-red-700';
      case 'EXPIRED':
        return 'bg-gray-100 text-gray-700';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'Active';
      case 'REVOKED':
        return 'Revoked';
      case 'EXPIRED':
        return 'Expired';
      case 'PENDING':
        return 'Pending';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const columns: Column<IssuedCredential>[] = [
    {
      id: 'holderDid',
      label: 'HOLDER DID',
      sortKey: 'holderDid',
      render: (row) => (
        <div className="flex items-center gap-2">
          <ThemedText className="text-sm text-gray-900">{truncateDid(row.holderDid)}</ThemedText>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopyDid(row.holderDid, row.id);
            }}
            className={`relative transition-all duration-200 cursor-pointer ${
              copiedId === row.id
                ? 'text-green-500 scale-110'
                : 'text-blue-500 hover:text-blue-600 hover:scale-110'
            }`}
            title={copiedId === row.id ? 'Copied!' : 'Copy to clipboard'}
          >
            {copiedId === row.id ? (
              <svg
                className="w-4 h-4 animate-[scale-in_0.3s_cubic-bezier(0.68,-0.55,0.265,1.55)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            )}
          </button>
        </div>
      ),
    },
    {
      id: 'schemaName',
      label: 'SCHEMA NAME',
      sortKey: 'schemaName',
      render: (row) => {
        const isUnknown = row.schemaName.includes('Unknown Schema');

        // If unknown schema, just show text without button
        if (isUnknown || !row.schemaId) {
          return <ThemedText className="text-sm text-red-600">{row.schemaName}</ThemedText>;
        }

        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleViewSchema(row.schemaId, row.schemaVersion);
            }}
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline text-left cursor-pointer"
          >
            {row.schemaName}
          </button>
        );
      },
    },
    {
      id: 'status',
      label: 'STATUS',
      sortKey: 'status',
      render: (row) => (
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(row.status)}`}
        >
          {getStatusLabel(row.status)}
        </span>
      ),
    },
    {
      id: 'createdAt',
      label: 'CREATED AT',
      sortKey: 'createdAt',
      render: (row) => (
        <ThemedText className="text-sm text-gray-900">{formatDate(row.createdAt)}</ThemedText>
      ),
    },
    {
      id: 'activeUntil',
      label: 'ACTIVE UNTIL',
      sortKey: 'activeUntil',
      render: (row) => (
        <ThemedText className="text-sm text-gray-900">
          {row.activeUntil === '-' ? '-' : formatDate(row.activeUntil)}
        </ThemedText>
      ),
    },
    {
      id: 'action',
      label: 'ACTION',
      render: (row) => {
        const showUpdateButton = row.schemaName !== 'Unknown Schema' && row.schemaId;
        return (
          <div className="flex gap-2">
            {showUpdateButton && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleUpdate(row.id);
                }}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium cursor-pointer"
              >
                UPDATE
              </button>
            )}
            {showUpdateButton && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRenew(row.id);
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium cursor-pointer"
              >
                RENEW
              </button>
            )}
            {row.status === 'APPROVED' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRevoke(row.id);
                }}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium cursor-pointer"
              >
                REVOKE
              </button>
            )}
          </div>
        );
      },
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
    <InstitutionLayout activeTab="issued-by-me">
      <div className="p-12">
        <ThemedText fontSize={40} fontWeight={700} className="text-black mb-8">
          Issued By Me
        </ThemedText>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-6 mb-8 pt-4">
          <div className="bg-blue-50 grid grid-row-2 rounded-2xl p-6">
            <ThemedText className="text-sm text-gray-600 mb-2">Total Issued</ThemedText>
            <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
              {credentials.length}
            </ThemedText>
          </div>
          <div className="bg-blue-50 grid grid-row-2 rounded-2xl p-6">
            <ThemedText className="text-sm text-gray-600 mb-2">Active Credentials</ThemedText>
            <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
              {activeCount}
            </ThemedText>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <ThemedText className="text-red-800">Error: {error}</ThemedText>
          </div>
        )}

        {/* Data Table */}
        {!isLoading && !error && (
          <DataTable
            data={filteredCredentials}
            columns={columns}
            onFilter={handleFilter}
            searchPlaceholder="Search..."
            onSearch={handleSearch}
            topRightButtons={
              <div className="flex items-center gap-3 justify-end">
                <button
                  onClick={fetchCredentials}
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                <button
                  onClick={handleNewCredential}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  New Credential
                </button>
              </div>
            }
            enableSelection={true}
            totalCount={filteredCredentials.length}
            rowsPerPageOptions={[5, 10, 25, 50, 100]}
            idKey="id"
            onRowClick={handleRowClick}
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
              className="text-gray-400 hover:text-gray-600 cursor-pointer"
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
                handleStatusChange(e.target.value as 'all' | 'Active' | 'Revoked' | 'Expired')
              }
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-black"
            >
              <option value="all">All</option>
              <option value="Active">Active</option>
              <option value="Revoked">Revoked</option>
              <option value="Expired">Expired</option>
            </select>
          </div>

          {/* Schema Name Filter */}
          <div>
            <ThemedText className="block text-sm font-medium text-gray-900 mb-2">
              Schema Name
            </ThemedText>
            <input
              type="text"
              value={filterType}
              onChange={(e) => handleTypeChange(e.target.value)}
              placeholder="Enter schema name"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-black"
            />
          </div>
        </div>
      )}

      {/* Issue New Credential Modal */}
      <Modal
        isOpen={showIssueModal}
        onClose={() => setShowIssueModal(false)}
        title="Issue New Credential"
        maxWidth="1000px"
      >
        <IssueNewCredentialForm schemas={schemas} onSubmit={handleIssueCredential} />
      </Modal>

      {/* Update Credential Modal */}
      <Modal
        isOpen={showUpdateModal}
        onClose={() => {
          setShowUpdateModal(false);
          setSelectedCredential(null);
        }}
        title="Update Credential"
        maxWidth="1000px"
      >
        {selectedCredential && (
          <UpdateCredentialForm
            onSubmit={handleUpdateCredential}
            onCancel={() => {
              setShowUpdateModal(false);
              setSelectedCredential(null);
            }}
            vcId={selectedCredential.vcId}
            credentialData={{
              id: selectedCredential.id,
              holderDid: selectedCredential.holderDid,
              issuerDid: localStorage.getItem('institutionDID') || undefined,
              schemaName: selectedCredential.schemaName,
              schemaId: selectedCredential.schemaId,
              // Use the selected credential's schema version
              schemaVersion: selectedCredential.schemaVersion,
              status: selectedCredential.status,
              issuedAt: selectedCredential.createdAt,
              activeUntil: selectedCredential.activeUntil,
              schemaIsActive: (() => {
                // Find the schema with the selected credential's version to check if it's active
                const credentialSchema = schemas.find(
                  (s) =>
                    s.id === selectedCredential.schemaId &&
                    s.version === selectedCredential.schemaVersion
                );
                return credentialSchema?.isActive;
              })(),
              attributes: (() => {
                // Find the schema with the selected credential's version to get attribute types and required info
                const credentialSchema = schemas.find(
                  (s) =>
                    s.id === selectedCredential.schemaId &&
                    s.version === selectedCredential.schemaVersion
                );

                if (selectedCredential.encryptedBody) {
                  // Extract attributes from encryptedBody
                  const extractedAttributes = Object.entries(selectedCredential.encryptedBody)
                    .filter(
                      ([key]) =>
                        !['schema_id', 'schema_version', 'issuer_did', 'holder_did'].includes(key)
                    )
                    .map(([name, value], index) => {
                      // Find the attribute type and required info from schema
                      const schemaAttribute = credentialSchema?.attributes.find(
                        (attr) => attr.name === name
                      );
                      return {
                        id: index + 1,
                        name,
                        type: schemaAttribute?.type || 'string',
                        value: String(value),
                        required: schemaAttribute?.required || false,
                      };
                    });

                  // If we found attributes in encryptedBody, return them
                  if (extractedAttributes.length > 0) {
                    return extractedAttributes;
                  }
                }

                // Fallback: Use schema attributes with empty values
                return (
                  credentialSchema?.attributes.map((attr, index) => ({
                    id: index + 1,
                    name: attr.name,
                    type: attr.type,
                    value: '',
                    required: attr.required,
                  })) || []
                );
              })(),
            }}
          />
        )}
      </Modal>

      {/* View Credential Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedCredential(null);
        }}
        title="View Credential"
        maxWidth="1000px"
      >
        {selectedCredential && (
          <ViewCredentialForm
            onClose={() => {
              setShowViewModal(false);
              setSelectedCredential(null);
            }}
            vcId={selectedCredential.vcId}
            vcHistory={selectedCredential.vcHistory}
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
              attributes: (() => {
                // Find the schema with the selected credential's version to get attribute types
                const credentialSchema = schemas.find(
                  (s) =>
                    s.id === selectedCredential.schemaId &&
                    s.version === selectedCredential.schemaVersion
                );

                if (selectedCredential.encryptedBody) {
                  // Extract attributes from encryptedBody
                  const extractedAttributes = Object.entries(selectedCredential.encryptedBody)
                    .filter(
                      ([key]) =>
                        !['schema_id', 'schema_version', 'issuer_did', 'holder_did'].includes(key)
                    )
                    .map(([name, value], index) => {
                      return {
                        id: index + 1,
                        name,
                        value: String(value),
                      };
                    });

                  // If we found attributes in encryptedBody, return them
                  if (extractedAttributes.length > 0) {
                    return extractedAttributes;
                  }
                }

                // Fallback: Use schema attributes with empty values
                return (
                  credentialSchema?.attributes.map((attr, index) => ({
                    id: index + 1,
                    name: attr.name,
                    value: '',
                  })) || []
                );
              })(),
            }}
          />
        )}
      </Modal>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={confirmationConfig.onConfirm}
        title={confirmationConfig.title}
        message={confirmationConfig.message}
        confirmText={confirmationConfig.confirmText}
        confirmButtonColor={confirmationConfig.confirmButtonColor}
      />

      {/* Revoke Input Modal */}
      <InputModal
        isOpen={showRevokeInputModal}
        onClose={() => {
          setShowRevokeInputModal(false);
          setRevokeCredentialId(null);
        }}
        onConfirm={handleRevokeConfirm}
        title="Revoke Credential"
        message="Please provide a reason for revoking this credential:"
        placeholder="Enter revocation reason..."
        confirmText="Continue"
        confirmButtonColor="red"
        inputType="textarea"
        required={true}
        minLength={5}
        maxLength={500}
      />

      {/* Info Modal */}
      <InfoModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title={infoModalConfig.title}
        message={infoModalConfig.message}
        buttonText={infoModalConfig.buttonText}
        buttonColor={infoModalConfig.buttonColor}
      />

      {/* View Schema Modal */}
      <Modal
        isOpen={showSchemaModal}
        onClose={() => {
          setShowSchemaModal(false);
          setSchemaData(null);
        }}
        title="View Schema"
      >
        {schemaData && (
          <ViewSchemaForm
            onClose={() => {
              setShowSchemaModal(false);
              setSchemaData(null);
            }}
            schemaData={{
              id: schemaData.id,
              schemaName: schemaData.name,
              version: schemaData.version,
              expiredIn: schemaData.expired_in,
              isActive: schemaData.status,
              createdAt: schemaData.created_at,
              updatedAt: schemaData.updated_at || new Date().toISOString(),
              attributes: schemaData.attributes.map((attr, index) => ({
                id: index + 1,
                name: attr.name,
                type: attr.type,
                description: attr.description || '',
                required: attr.required,
              })),
              imageUrl: schemaData.image_link || undefined,
            }}
          />
        )}
      </Modal>
    </InstitutionLayout>
  );
}
