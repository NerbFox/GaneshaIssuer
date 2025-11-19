'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import InstitutionLayout from '@/components/shared/InstitutionLayout';
import { ThemedText } from '@/components/shared/ThemedText';
import { DataTable, Column } from '@/components/shared/DataTable';
import Modal from '@/components/shared/Modal';
import IssueNewCredentialForm, {
  IssueNewCredentialFormData,
} from '@/components/issuer/IssueNewCredentialForm';
import UpdateCredentialForm, {
  UpdateCredentialFormData,
} from '@/components/issuer/UpdateCredentialForm';
import ViewCredentialForm from '@/components/shared/ViewCredentialForm';
import ViewSchemaForm from '@/components/shared/ViewSchemaForm';
import ConfirmationModal from '@/components/shared/ConfirmationModal';
import InfoModal from '@/components/shared/InfoModal';
import { RenewCredentialModal } from '@/components/issuer/RenewCredentialModal';
import { redirectIfJWTInvalid } from '@/utils/auth';
import { decryptWithIssuerPrivateKey } from '@/utils/encryptUtils';
import { formatDateTime, formatTime } from '@/utils/dateUtils';
import {
  fetchVCsByIssuerDID,
  issueCredential,
  updateCredential,
  renewCredential,
  revokeCredential,
} from '@/services/credentialService';
import { fetchPublicKeyForDID } from '@/services/didService';
import { fetchSchemaByVersion, fetchSchemas } from '@/services/schemaService';
import { storeIssuedCredentialsBatch } from '@/utils/indexedDB';

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
  issuerDid: string; // Add issuer DID for IndexedDB
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
  const [showRenewModal, setShowRenewModal] = useState(false);
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
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

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

      // Fetch credentials using service
      const credentialsResult = await fetchVCsByIssuerDID(institutionDID);

      // Fetch schemas using service
      const schemasResult = await fetchSchemas({ issuerDid: institutionDID });

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
      const transformedCredentials: IssuedCredential[] = [];

      for (const vcData of credentialsResult.data.data) {
        try {
          // Decrypt the encrypted body using issuer's private key from localStorage
          const decryptedData = await decryptWithIssuerPrivateKey(vcData.encrypted_body);
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

            // Determine credential status based on vc_status from decrypted data
            let credentialStatus = 'APPROVED';

            // Primary status check: use vc_status from decrypted data
            if (vcContainer.vc_status === false) {
              credentialStatus = 'REVOKED';
            } else if (newestVC.expiredAt) {
              // Secondary check: if vc_status is true, check expiration
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
              issuerDid: institutionDID, // Add issuer DID for IndexedDB
            });
          }
        } catch (error) {
          console.error('Error decrypting VC data:', error);
          // Skip this VC if decryption fails
        }
      }

      setCredentials(transformedCredentials);
      setFilteredCredentials(transformedCredentials);
      setLastRefresh(new Date());

      // Store credentials in IndexedDB for later use (e.g., renew, update operations)
      if (transformedCredentials.length > 0) {
        try {
          const storedIds = await storeIssuedCredentialsBatch(transformedCredentials);
          console.log(`[IndexedDB] Stored ${storedIds.length} issued credentials`);
        } catch (storageError) {
          console.error('[IndexedDB] Failed to store credentials:', storageError);
          // Don't fail the entire operation if storage fails
        }
      }
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

      // Fetch holder's public key using service
      const holderPublicKey = await fetchPublicKeyForDID(data.holderDid);

      // Fetch schema details using service
      const schemaResponse = await fetchSchemaByVersion(data.schemaId, data.version);
      const schemaData = schemaResponse.data;
      const imageLink = schemaData.image_link || null;
      const expiredIn = schemaData.schema.expired_in || 5;

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

      // Update credential using service
      const { updateResponse } = await updateCredential({
        issuerDid,
        holderDid: data.holderDid,
        holderPublicKey,
        oldVcId: credential.vcId,
        newVcId,
        schemaId: data.schemaId,
        schemaVersion: data.version,
        schemaName: data.schemaName,
        vcType: data.schemaName.replace(/\s+v\d+$/, '').replace(/\s+/g, ''),
        credentialData,
        expiredAt: expiredAt.toISOString(),
        imageLink,
        institutionName,
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

    const vcId = credential.vcId;
    if (!vcId) {
      setInfoModalConfig({
        title: 'Error',
        message: 'Credential VC ID not found. Cannot revoke this credential.',
        buttonText: 'OK',
        buttonColor: 'red',
      });
      setShowInfoModal(true);
      return;
    }

    setConfirmationConfig({
      title: 'Revoke Credential',
      message: `Are you sure you want to revoke this credential?\n\nThis action cannot be undone.`,
      confirmText: 'Revoke',
      confirmButtonColor: 'red',
      onConfirm: async () => {
        try {
          console.log('Revoke credential:', vcId);

          // Get issuer DID
          const issuerDid = localStorage.getItem('institutionDID');
          if (!issuerDid) {
            throw new Error('Issuer DID not found. Please log in again.');
          }

          // Fetch holder's public key using service
          const holderPublicKey = await fetchPublicKeyForDID(credential.holderDid);

          // Revoke credential using service
          const { revokeResponse } = await revokeCredential({
            issuerDid,
            holderDid: credential.holderDid,
            holderPublicKey,
            vcId: vcId,
            issuerVCDataId: credential.id, // ID of the issued credential record
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
      setInfoModalConfig({
        title: 'Error',
        message: 'Credential VC ID not found. Cannot renew this credential.',
        buttonText: 'OK',
        buttonColor: 'red',
      });
      setShowInfoModal(true);
      return;
    }

    setSelectedCredential(credential);
    setShowRenewModal(true);
  };

  const handleRenewConfirm = async () => {
    if (!selectedCredential) return;

    setShowRenewModal(false);

    setConfirmationConfig({
      title: 'Renew Credential',
      message: `Are you sure you want to renew this credential?\n\nA new credential with the same data will be issued.`,
      confirmText: 'Renew',
      confirmButtonColor: 'blue',
      onConfirm: async () => {
        try {
          console.log('Renew credential:', selectedCredential.vcId);

          // Get issuer information
          const issuerDid = localStorage.getItem('institutionDID');
          if (!issuerDid) {
            throw new Error('Issuer DID not found. Please log in again.');
          }

          // Fetch holder's public key using service
          const holderPublicKey = await fetchPublicKeyForDID(selectedCredential.holderDid);

          // Fetch schema details using service
          const schemaResponse = await fetchSchemaByVersion(
            selectedCredential.schemaId,
            selectedCredential.schemaVersion
          );
          const schemaData = schemaResponse.data;
          const expiredIn = schemaData.schema.expired_in;

          // Expireable credential can't be renewed
          if (!expiredIn) return;

          // Calculate new expiration date based on schema's expired_in
          // If expired_in is 0 or not set, the credential is lifetime (no expiration)
          const now = new Date();
          const expiredAt = new Date(now);
          expiredAt.setFullYear(expiredAt.getFullYear() + expiredIn);
          const expiredAtString = expiredAt.toISOString();

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
          const imageLink = schemaData.image_link || null;

          // Transform credential data
          const credentialData: Record<string, string | number | boolean> = {};
          if (selectedCredential.encryptedBody) {
            Object.entries(selectedCredential.encryptedBody).forEach(([key, value]) => {
              credentialData[key] = value as string | number | boolean;
            });
          }

          // Renew credential using service
          const { renewResponse } = await renewCredential({
            issuerDid,
            holderDid: selectedCredential.holderDid,
            holderPublicKey,
            vcId: selectedCredential.vcId!,
            schemaId: selectedCredential.schemaId,
            schemaVersion: selectedCredential.schemaVersion,
            schemaName: selectedCredential.schemaName,
            credentialData,
            expiredAt: expiredAtString,
            imageLink,
            institutionName,
            issuerVCDataId: selectedCredential.id, // ID of the issued credential record
          });

          if (!renewResponse.ok) {
            const errorData = await renewResponse.json();
            throw new Error(errorData.message || 'Failed to renew credential');
          }

          setShowConfirmation(false);
          setInfoModalConfig({
            title: 'Success',
            message:
              'The credential has been renewed successfully.\n\nThe holder can claim the renewed credential.',
            buttonText: 'OK',
            buttonColor: 'green',
          });
          setShowInfoModal(true);
          fetchCredentials();
        } catch (error) {
          console.error('Error renewing credential:', error);
          setShowConfirmation(false);
          setInfoModalConfig({
            title: 'Error',
            message: `Failed to renew credential: ${error instanceof Error ? error.message : 'Unknown error'}`,
            buttonText: 'OK',
            buttonColor: 'red',
          });
          setShowInfoModal(true);
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
      // Fetch schema using service
      const schemaApiData = await fetchSchemaByVersion(schemaId, schemaVersion);

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

      if (!issuerDid || !institutionDataStr) {
        throw new Error('Issuer information not found. Please log in again.');
      }

      const institutionData = JSON.parse(institutionDataStr);
      const institutionName = institutionData.name;

      if (!institutionName) {
        throw new Error('Institution name not found. Please log in again.');
      }

      // Step 2: Fetch holder's public key using service
      const holderPublicKey = await fetchPublicKeyForDID(data.holderDid);
      console.log('Fetched holder public key');

      // Step 3: Fetch schema details using service
      const schemaResponse = await fetchSchemaByVersion(data.schemaId, data.version);
      const schemaData = schemaResponse.data;
      const imageLink = schemaData.image_link || null;
      const expiredIn = schemaData.schema.expired_in || 5;

      // Calculate expiration date
      const now = new Date();
      const expiredAt = new Date(now);
      expiredAt.setFullYear(expiredAt.getFullYear() + expiredIn);

      // Step 4: Transform attributes into credential data format
      const credentialData: Record<string, string | number | boolean> = {};
      data.attributes.forEach((attr) => {
        credentialData[attr.name] = attr.value;
      });

      // Step 5-11: Issue credential using service
      const { issueResponse, storeResponse, signedVC } = await issueCredential({
        issuerDid,
        holderDid: data.holderDid,
        holderPublicKey,
        schemaId: data.schemaId,
        schemaVersion: data.version,
        schemaName: data.schemaName,
        credentialData,
        expiredAt: expiredAt.toISOString(),
        imageLink,
        institutionName,
      });

      console.log('Issued VC:', signedVC);

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
        <ThemedText className="text-sm text-gray-900">{formatDateTime(row.createdAt)}</ThemedText>
      ),
    },
    {
      id: 'activeUntil',
      label: 'ACTIVE UNTIL',
      sortKey: 'activeUntil',
      render: (row) => (
        <ThemedText className="text-sm text-gray-900">
          {row.activeUntil === '-' ? 'Lifetime' : formatDateTime(row.activeUntil)}
        </ThemedText>
      ),
    },
    {
      id: 'action',
      label: 'ACTION',
      render: (row) => {
        const showUpdateButton = row.schemaName !== 'Unknown Schema' && row.schemaId;
        const showRenewButton = showUpdateButton && row.activeUntil !== '-'; // Don't show renew for lifetime credentials
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
            {showRenewButton && (
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
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <ThemedText fontSize={12} className="text-gray-500">
                    Last updated: {formatTime(lastRefresh)}
                  </ThemedText>
                </div>
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
            credential={{
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
            onClose={() => {
              setShowViewModal(false);
              setSelectedCredential(null);
            }}
            currentVC={selectedCredential.vcHistory?.[0]}
            vcHistory={selectedCredential.vcHistory}
          />
        )}
      </Modal>

      {/* Renew Credential Modal */}
      <RenewCredentialModal
        isOpen={showRenewModal}
        onClose={() => {
          setShowRenewModal(false);
          setSelectedCredential(null);
        }}
        onRenew={handleRenewConfirm}
        selectedCredential={selectedCredential}
      />

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
