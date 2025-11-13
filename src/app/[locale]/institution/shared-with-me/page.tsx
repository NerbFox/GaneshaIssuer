'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import InstitutionLayout from '@/components/InstitutionLayout';
import { ThemedText } from '@/components/ThemedText';
import { DataTable, Column } from '@/components/DataTable';
import { redirectIfJWTInvalid } from '@/utils/auth';
import Modal from '@/components/Modal';
import { buildApiUrlWithParams, buildApiUrl, API_ENDPOINTS } from '@/utils/api';
import { authenticatedPost } from '@/utils/api-client';
import InfoModal from '@/components/InfoModal';
import {
  storeVPSharings,
  getAllVPSharings,
  getVPSharingById,
  VPSharing,
  deleteVPSharing,
} from '@/utils/indexedDB';

interface SharedCredential {
  id: string;
  credentialType: string;
  holderDid: string;
  sharedDate: string;
  verified: boolean;
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

interface VPRequestDetail {
  id: string;
  holder_did: string;
  verifier_did: string;
  verifier_name: string;
  purpose: string;
  status: string;
  requested_credentials: Array<{
    schema_id: string;
    schema_name: string;
    schema_version: number;
  }>;
  vp_id: string;
  verify_status: string;
  createdAt: string;
  updatedAt: string;
}

interface VPDetailData {
  vpSharing: VPSharing;
  requestDetail: VPRequestDetail;
}

interface CredentialVerification {
  credential_id: string;
  valid: boolean;
  errors: string[];
}

interface VPVerificationData {
  vp: {
    '@context': string[];
    type: string[];
    verifiableCredential: Array<{
      '@context': string[];
      id: string;
      type: string[];
      issuer: {
        id: string;
        name?: string;
      };
      issuerName?: string;
      issuanceDate: string;
      validFrom?: string;
      expirationDate?: string;
      expiredAt?: string;
      credentialSubject: Record<string, unknown>;
      credentialSchema?: {
        id: string;
        type: string;
        version?: number;
      };
      fileUrl?: string;
      proof: {
        type: string;
        created: string;
        proofPurpose: string;
        verificationMethod: string;
        cryptosuite?: string;
        proofValue: string;
      };
    }>;
    holder: string;
    proof: {
      type: string;
      created: string;
      proofPurpose: string;
      verificationMethod: string;
      challenge?: string;
      domain?: string;
      proofValue: string;
    };
  };
  verification: {
    vp_valid: boolean;
    holder_did: string;
    credentials_verification: CredentialVerification[];
  };
  vpId: string;
}

export default function SharedWithMePage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [credentials, setCredentials] = useState<SharedCredential[]>([]);
  const [filteredCredentials, setFilteredCredentials] = useState<SharedCredential[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterVerified, setFilterVerified] = useState<'all' | 'verified' | 'unverified'>('all');
  const [filterButtonPosition, setFilterButtonPosition] = useState({ top: 0, left: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // Request VP Modal states
  const [showRequestVPModal, setShowRequestVPModal] = useState(false);
  const [vpDidPrefix, setVpDidPrefix] = useState('did:dcert:');
  const [vpHolderDid, setVpHolderDid] = useState('');
  const [vpPurpose, setVpPurpose] = useState('');
  const [selectedCredentials, setSelectedCredentials] = useState<Set<string>>(new Set());
  const [schemas, setSchemas] = useState<SchemaWithCompositeId[]>([]);
  const [filteredSchemas, setFilteredSchemas] = useState<SchemaWithCompositeId[]>([]);
  const [isSchemasLoading, setIsSchemasLoading] = useState(false);
  const [expandedSchemaId, setExpandedSchemaId] = useState<string | null>(null);
  const [isSubmittingVP, setIsSubmittingVP] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoModalConfig, setInfoModalConfig] = useState({
    title: '',
    message: '',
    buttonColor: 'blue' as 'blue' | 'green' | 'red' | 'yellow' | 'orange',
    showCancelButton: false,
    onConfirm: undefined as (() => void) | undefined,
    confirmButtonText: undefined as string | undefined,
  });

  // View VP Detail Modal states
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedVPDetail, setSelectedVPDetail] = useState<VPDetailData | null>(null);
  const [isLoadingVPDetail, setIsLoadingVPDetail] = useState(false);

  // VP Verification Modal states
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [vpVerificationData, setVPVerificationData] = useState<VPVerificationData | null>(null);
  const [isLoadingVerification, setIsLoadingVerification] = useState(false);
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);

  const filterModalRef = useRef<HTMLDivElement>(null);

  const didPrefixes = ['did:dcert:'];

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

  const verifiedCount = credentials.filter((c) => c.verified).length;

  // Fetch shared VPs from API (runs in background)
  const fetchSharedVPs = async () => {
    try {
      const verifierDid = localStorage.getItem('institutionDID');

      if (!verifierDid) {
        console.error('Verifier DID not found in localStorage');
        return;
      }

      // Step 1: Claim VPs
      const claimUrl = buildApiUrl(API_ENDPOINTS.PRESENTATIONS.CLAIM);
      const claimResponse = await authenticatedPost(claimUrl, {
        verifier_did: verifierDid,
      });

      if (!claimResponse.ok) {
        const result = await claimResponse.json();
        const errorMessage = result.message || result.error || 'Failed to claim VPs';
        throw new Error(errorMessage);
      }

      const claimResult = await claimResponse.json();
      console.log('VPs claimed:', claimResult);

      if (claimResult.success && claimResult.data?.vp_sharings) {
        const vpSharings: VPSharing[] = claimResult.data.vp_sharings;

        // Step 2: Store VPs in IndexedDB
        if (vpSharings.length > 0) {
          try {
            const storedVpIds = await storeVPSharings(vpSharings);
            console.log(`Stored ${storedVpIds.length} VPs in IndexedDB`);

            // Step 3: Confirm the storage with API
            const confirmUrl = buildApiUrl(API_ENDPOINTS.PRESENTATIONS.CONFIRM);
            const confirmResponse = await authenticatedPost(confirmUrl, {
              verifier_did: verifierDid,
              vp_ids: storedVpIds,
            });

            if (!confirmResponse.ok) {
              const result = await confirmResponse.json();
              const errorMessage = result.message || result.error || 'Failed to confirm VPs';
              console.error('Failed to confirm VPs:', errorMessage);
            } else {
              const confirmResult = await confirmResponse.json();
              console.log('VPs confirmed:', confirmResult);
            }

            // Step 4: Reload VPs from IndexedDB to update the display
            await loadVPsFromIndexedDB();
          } catch (error) {
            console.error('Error storing VPs in IndexedDB:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching shared VPs:', error);
    }
  };

  // Load VPs from IndexedDB and convert to SharedCredential format
  const loadVPsFromIndexedDB = async () => {
    setIsLoading(true);
    try {
      const vpSharings = await getAllVPSharings();

      // Convert VP sharings to SharedCredential format
      const sharedCredentials: SharedCredential[] = vpSharings.map((vp) => {
        // Get credential type from credentials array
        console.log('[VP]: ', vp);
        const credentialType =
          vp.credentials && vp.credentials.length > 0
            ? vp.credentials.map((c) => c.schema_name).join(', ')
            : 'No credentials';

        // For now, set verified as false - you may want to add verification logic later
        return {
          id: vp.vp_id,
          credentialType,
          holderDid: vp.holder_did,
          sharedDate: vp.created_at,
          verified: false,
        };
      });

      setCredentials(sharedCredentials);
      setFilteredCredentials(sharedCredentials);
    } catch (error) {
      console.error('Error loading VPs from IndexedDB:', error);
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
        // First, try to load from IndexedDB
        await loadVPsFromIndexedDB();

        // Then fetch new VPs from API in the background
        fetchSharedVPs();
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
        credential.holderDid.toLowerCase().includes(searchLower) ||
        credential.id.toLowerCase().includes(searchLower)
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

  const applyFilters = (verified: 'all' | 'verified' | 'unverified') => {
    let filtered = credentials;

    if (verified === 'verified') {
      filtered = filtered.filter((credential) => credential.verified === true);
    } else if (verified === 'unverified') {
      filtered = filtered.filter((credential) => credential.verified === false);
    }

    setFilteredCredentials(filtered);
  };

  const handleVerifiedChange = (verified: 'all' | 'verified' | 'unverified') => {
    setFilterVerified(verified);
    applyFilters(verified);
  };

  const handleView = async (vpId: string) => {
    setShowViewModal(true);
    setIsLoadingVPDetail(true);

    try {
      // Get the VP sharing data from credentials state
      const vpSharing = credentials.find((c) => c.id === vpId);
      if (!vpSharing) {
        throw new Error('VP sharing not found');
      }

      // Get the full VP data from IndexedDB
      const vpData = await getVPSharingById(vpId);
      if (!vpData) {
        throw new Error('VP data not found in IndexedDB');
      }

      // Fetch the VP request detail
      const url = buildApiUrl(API_ENDPOINTS.PRESENTATIONS.REQUEST_DETAIL(vpData.vp_request_id));
      const response = await fetch(url, {
        headers: {
          accept: 'application/json',
          Authorization: `Bearer ${localStorage.getItem('institutionToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch VP request details');
      }

      const result = await response.json();

      if (result.success && result.data) {
        setSelectedVPDetail({
          vpSharing: vpData,
          requestDetail: result.data as VPRequestDetail,
        });
      }
    } catch (error) {
      console.error('Error fetching VP details:', error);
      setInfoModalConfig({
        title: 'Error',
        message: 'Failed to load VP details. Please try again.',
        buttonColor: 'red',
        showCancelButton: false,
        onConfirm: undefined,
        confirmButtonText: undefined,
      });
      setShowInfoModal(true);
      setShowViewModal(false);
    } finally {
      setIsLoadingVPDetail(false);
    }
  };

  const handleVerify = async (vpId: string) => {
    try {
      // Get the VP data from IndexedDB
      const vpData = await getVPSharingById(vpId);
      if (!vpData) {
        throw new Error('VP data not found in IndexedDB');
      }

      // Fetch the VP request detail from API
      const url = buildApiUrl(API_ENDPOINTS.PRESENTATIONS.REQUEST_DETAIL(vpData.vp_request_id));
      const response = await fetch(url, {
        headers: {
          accept: 'application/json',
          Authorization: `Bearer ${localStorage.getItem('institutionToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch VP request details');
      }

      const result = await response.json();
      const requestDetail = result.data as VPRequestDetail;

      // Compare requested credentials with shared credentials
      const comparison = compareCredentials(
        requestDetail.requested_credentials,
        vpData.credentials.map((vc) => ({
          schema_id: vc.schema_id,
          schema_name: vc.schema_name,
          schema_version: vc.schema_version,
        }))
      );

      // Show confirmation modal - orange warning if mismatch, blue if match
      if (!comparison.isComplete) {
        // Show orange warning for mismatch
        setInfoModalConfig({
          title: '⚠️ Credential Mismatch Detected',
          message: `Warning: The shared credentials do not match the requested credentials.\n\n${comparison.message}\n\nDo you still want to proceed with verification?`,
          buttonColor: 'orange',
          showCancelButton: true,
          onConfirm: () => {
            setShowInfoModal(false);
            performVPVerification(vpId);
          },
          confirmButtonText: 'Proceed Anyway',
        });
      } else {
        // Show blue confirmation for match
        setInfoModalConfig({
          title: 'Verify Credentials',
          message:
            '🔍 You are about to verify the credentials in this Verifiable Presentation.\n\nThis will check the cryptographic signatures and validate all credentials. Once verified, you will see the detailed verification results.\n\nDo you want to proceed?',
          buttonColor: 'blue',
          showCancelButton: true,
          onConfirm: () => {
            setShowInfoModal(false);
            performVPVerification(vpId);
          },
          confirmButtonText: 'Yes, Verify Now',
        });
      }

      setShowInfoModal(true);
    } catch (error) {
      console.error('Error preparing verification:', error);
      setInfoModalConfig({
        title: 'Error',
        message: 'Failed to prepare verification. Please try again.',
        buttonColor: 'red',
        showCancelButton: false,
        onConfirm: undefined,
        confirmButtonText: undefined,
      });
      setShowInfoModal(true);
    }
  };

  const performVPVerification = async (vpId: string) => {
    // Close the View modal if it's open
    setShowViewModal(false);
    setSelectedVPDetail(null);

    // Open verification modal with loading state
    setShowVerifyModal(true);
    setIsLoadingVerification(true);

    try {
      const token = localStorage.getItem('institutionToken');

      // Fetch VP details and verification in parallel
      const [vpResponse, verifyResponse] = await Promise.all([
        fetch(buildApiUrl(API_ENDPOINTS.PRESENTATIONS.DETAIL(vpId)), {
          headers: {
            accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch(buildApiUrl(API_ENDPOINTS.PRESENTATIONS.VERIFY(vpId)), {
          headers: {
            accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }),
      ]);

      if (!vpResponse.ok || !verifyResponse.ok) {
        throw new Error('Failed to fetch VP data or verification');
      }

      const vpResult = await vpResponse.json();
      const verifyResult = await verifyResponse.json();

      setVPVerificationData({
        vp: vpResult.data.vp,
        verification: verifyResult.data,
        vpId: vpId,
      });
    } catch (error) {
      console.error('Error fetching VP verification:', error);
      setInfoModalConfig({
        title: 'Error',
        message: 'Failed to load VP verification data. Please try again.',
        buttonColor: 'red',
        showCancelButton: false,
        onConfirm: undefined,
        confirmButtonText: undefined,
      });
      setShowInfoModal(true);
      setShowVerifyModal(false);
    } finally {
      setIsLoadingVerification(false);
    }
  };

  // Handle close verification modal with confirmation
  const handleCloseVerifyModal = () => {
    setShowCloseConfirmation(true);
  };

  const confirmCloseVerifyModal = async () => {
    try {
      // Delete VP from IndexedDB
      if (vpVerificationData?.vpId) {
        await deleteVPSharing(vpVerificationData.vpId);
        console.log('VP deleted from IndexedDB');

        // Reload VPs from IndexedDB
        await loadVPsFromIndexedDB();
      }

      // Close modals
      setShowCloseConfirmation(false);
      setShowVerifyModal(false);
      setVPVerificationData(null);
    } catch (error) {
      console.error('Error deleting VP:', error);
      setInfoModalConfig({
        title: 'Error',
        message: 'Failed to delete VP data. Please try again.',
        buttonColor: 'red',
        showCancelButton: false,
        onConfirm: undefined,
        confirmButtonText: undefined,
      });
      setShowInfoModal(true);
    }
  };

  // Compare requested credentials with shared credentials
  const compareCredentials = (
    requested: Array<{ schema_id: string; schema_name: string; schema_version: number }>,
    shared: Array<{ schema_id: string; schema_name: string; schema_version: number }>
  ) => {
    const sharedSet = shared.map((s) => `${s.schema_id}-v${s.schema_version}`);

    const missing = requested.filter(
      (r) => !sharedSet.includes(`${r.schema_id}-v${r.schema_version}`)
    );

    const isComplete = missing.length === 0 && requested.length === shared.length;

    let message = '';
    if (missing.length > 0) {
      message = `Missing ${missing.length} credential(s): ${missing.map((m) => `${m.schema_name} v${m.schema_version}`).join(', ')}`;
    } else if (shared.length > requested.length) {
      message = `Received ${shared.length - requested.length} extra credential(s) that were not requested.`;
    }

    return { isComplete, message, missing };
  };

  const handleOpenRequestVPModal = () => {
    setShowRequestVPModal(true);
    fetchSchemas();
  };

  const handleCloseRequestVPModal = () => {
    setShowRequestVPModal(false);
    setVpDidPrefix('did:dcert:');
    setVpHolderDid('');
    setVpPurpose('');
    setSelectedCredentials(new Set());
    setExpandedSchemaId(null);
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
        setSchemas(schemasWithIds);
        setFilteredSchemas(schemasWithIds);
      }
    } catch (error) {
      console.error('Error fetching schemas:', error);
    } finally {
      setIsSchemasLoading(false);
    }
  };

  const handleSchemaSearch = (value: string) => {
    const searchLower = value.toLowerCase();
    const filtered = schemas.filter((schema) => {
      return (
        schema.name.toLowerCase().includes(searchLower) ||
        schema.issuer_name.toLowerCase().includes(searchLower)
      );
    });
    setFilteredSchemas(filtered);
  };

  const handleCredentialSelection = (
    selectedIds: number[],
    selectedIdValues?: (string | number)[]
  ) => {
    if (selectedIdValues) {
      setSelectedCredentials(new Set(selectedIdValues.map((id) => String(id))));
    }
  };

  const toggleExpandSchema = (compositeId: string) => {
    setExpandedSchemaId(expandedSchemaId === compositeId ? null : compositeId);
  };

  const handleRemoveFromSelection = (id: string) => {
    const newSelected = new Set(selectedCredentials);
    newSelected.delete(id);
    setSelectedCredentials(newSelected);
  };

  const handleSubmitVPRequest = async () => {
    setIsSubmittingVP(true);
    try {
      // Get verifier DID and name from localStorage
      const verifierDid = localStorage.getItem('institutionDID');
      const institutionDataStr = localStorage.getItem('institutionData');

      if (!verifierDid) {
        setInfoModalConfig({
          title: 'Authentication Required',
          message: 'Verifier DID not found. Please login again.',
          buttonColor: 'yellow',
          showCancelButton: false,
          onConfirm: undefined,
          confirmButtonText: undefined,
        });
        setShowInfoModal(true);
        return;
      }

      let verifierName = 'Unknown Verifier';
      if (institutionDataStr) {
        try {
          const institutionData = JSON.parse(institutionDataStr);
          verifierName = institutionData.name || verifierName;
        } catch (error) {
          console.error('Error parsing institution data:', error);
        }
      }

      // Build holder DID from prefix and input
      const holderDid = `${vpDidPrefix}${vpHolderDid}`;

      // Build requested credentials array from selected schemas
      const requestedCredentials = selectedCredentialsList.map((schema) => ({
        schema_id: schema.id,
        schema_name: schema.name,
        schema_version: schema.version,
      }));

      // Prepare request body
      const requestBody = {
        verifier_did: verifierDid,
        verifier_name: verifierName,
        holder_did: holderDid,
        purpose: vpPurpose,
        requested_credentials: requestedCredentials,
      };

      console.log('Submitting VP Request:', requestBody);

      // Make API request
      const url = buildApiUrl(API_ENDPOINTS.PRESENTATIONS.REQUEST);
      const response = await authenticatedPost(url, requestBody);

      if (!response.ok) {
        const result = await response.json();
        const errorMessage = result.message || result.error || 'Failed to request VP';
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('VP Request Response:', result);

      setInfoModalConfig({
        title: 'VP Request Sent',
        message: 'Your Verifiable Presentation request has been sent successfully.',
        buttonColor: 'green',
        showCancelButton: false,
        onConfirm: undefined,
        confirmButtonText: undefined,
      });
      setShowInfoModal(true);
      handleCloseRequestVPModal();
    } catch (error) {
      console.error('Error requesting VP:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setInfoModalConfig({
        title: 'Request Failed',
        message: `Failed to send VP request: ${errorMessage}`,
        buttonColor: 'red',
        showCancelButton: false,
        onConfirm: undefined,
        confirmButtonText: undefined,
      });
      setShowInfoModal(true);
    } finally {
      setIsSubmittingVP(false);
    }
  };

  const selectedCredentialsList = schemas.filter((s) => selectedCredentials.has(s.compositeId));

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

  // Schema columns for Request VP Modal
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

  const columns: Column<SharedCredential>[] = [
    {
      id: 'holderDid',
      label: 'HOLDER DID',
      sortKey: 'holderDid',
      render: (row) => (
        <div className="flex flex-col">
          <ThemedText className="text-sm font-medium text-gray-900">
            {row.holderDid.length > 30 ? `${row.holderDid.substring(0, 30)}...` : row.holderDid}
          </ThemedText>
          <ThemedText className="text-xs text-gray-500">
            {row.holderDid.split(':')[0]}:{row.holderDid.split(':')[1]}
          </ThemedText>
        </div>
      ),
    },
    {
      id: 'credentialType',
      label: 'CREDENTIALS SHARED',
      sortKey: 'credentialType',
      render: (row) => (
        <div className="flex flex-col">
          <ThemedText className="text-sm font-medium text-gray-900">
            {row.credentialType.split(', ').length} Credential(s)
          </ThemedText>
          <ThemedText
            className="text-xs text-gray-500 truncate max-w-xs"
            title={row.credentialType}
          >
            {row.credentialType}
          </ThemedText>
        </div>
      ),
    },
    {
      id: 'sharedDate',
      label: 'SHARED DATE',
      sortKey: 'sharedDate',
      render: (row) => (
        <div className="flex flex-col">
          <ThemedText className="text-sm text-gray-900">{formatDate(row.sharedDate)}</ThemedText>
          <ThemedText className="text-xs text-gray-500">
            {new Date(row.sharedDate).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </ThemedText>
        </div>
      ),
    },
    {
      id: 'verified',
      label: 'VERIFICATION',
      sortKey: 'verified',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
              row.verified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
            }`}
          >
            {row.verified ? 'Verified' : 'Pending'}
          </span>
        </div>
      ),
    },
    {
      id: 'action',
      label: 'ACTION',
      render: (row) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleView(row.id)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
          >
            VIEW
          </button>
          {!row.verified && (
            <button
              onClick={() => handleVerify(row.id)}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
            >
              VERIFY
            </button>
          )}
        </div>
      ),
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
    <InstitutionLayout activeTab="shared-with-me">
      <div className="p-12">
        <ThemedText fontSize={40} fontWeight={700} className="text-black mb-8">
          Shared With Me
        </ThemedText>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
              <ThemedText className="text-gray-600">Loading shared credentials...</ThemedText>
            </div>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-6 mb-8 pt-4">
              <div className="bg-blue-50 grid grid-row-2 rounded-2xl p-6">
                <ThemedText className="text-sm text-gray-600 mb-2">Total Shared</ThemedText>
                <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
                  {credentials.length}
                </ThemedText>
              </div>
              <div className="bg-blue-50 grid grid-row-2 rounded-2xl p-6">
                <ThemedText className="text-sm text-gray-600 mb-2">Verified</ThemedText>
                <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
                  {verifiedCount}
                </ThemedText>
              </div>
            </div>

            {/* Data Table */}
            <DataTable
              data={filteredCredentials}
              columns={columns}
              onFilter={handleFilter}
              searchPlaceholder="Search..."
              onSearch={handleSearch}
              enableSelection={true}
              totalCount={filteredCredentials.length}
              rowsPerPageOptions={[5, 10, 25, 50, 100]}
              idKey="id"
              topRightButtons={
                <button
                  onClick={handleOpenRequestVPModal}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-sm font-medium cursor-pointer"
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
                  Request VP
                </button>
              }
            />
          </>
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

          {/* Verified Filter */}
          <div>
            <ThemedText className="block text-sm font-medium text-gray-900 mb-2">
              Verification Status
            </ThemedText>
            <select
              value={filterVerified}
              onChange={(e) =>
                handleVerifiedChange(e.target.value as 'all' | 'verified' | 'unverified')
              }
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="all">All</option>
              <option value="verified">Verified</option>
              <option value="unverified">Unverified</option>
            </select>
          </div>
        </div>
      )}

      {/* Request VP Modal */}
      <Modal
        isOpen={showRequestVPModal}
        onClose={handleCloseRequestVPModal}
        title="Request Verifiable Presentation"
        maxWidth="1000px"
        minHeight="700px"
      >
        <div className="px-8 py-6">
          {/* DID Input Section */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* DID Prefix */}
            <div>
              <ThemedText className="text-sm text-gray-600 mb-2">
                DID Prefix<span className="text-red-500">*</span>
              </ThemedText>
              <select
                value={vpDidPrefix}
                onChange={(e) => setVpDidPrefix(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 cursor-pointer bg-white"
              >
                {didPrefixes.map((prefix) => (
                  <option key={prefix} value={prefix}>
                    {prefix}
                  </option>
                ))}
              </select>
            </div>

            {/* Holder DID */}
            <div>
              <ThemedText className="text-sm text-gray-600 mb-2">
                Holder DID<span className="text-red-500">*</span>
              </ThemedText>
              <input
                type="text"
                value={vpHolderDid}
                onChange={(e) => setVpHolderDid(e.target.value)}
                placeholder="abcdefghijklmnopqrstuvwxyz1234567890"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
              />
            </div>
          </div>

          {/* Schemas Selection Table */}
          {isSchemasLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                <ThemedText className="text-gray-600">Loading schemas...</ThemedText>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <ThemedText fontSize={16} fontWeight={600} className="text-gray-900 mb-3">
                  Select Credentials to Request
                </ThemedText>
                <DataTable<SchemaWithCompositeId>
                  data={filteredSchemas.filter((s) => s.compositeId)}
                  columns={schemaColumns}
                  searchPlaceholder="Search schemas..."
                  onSearch={handleSchemaSearch}
                  enableSelection={true}
                  onSelectionChange={handleCredentialSelection}
                  selectedIds={selectedCredentials}
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
              </div>
            </>
          )}

          {/* Selected Schemas Summary */}
          {selectedCredentialsList.length > 0 && (
            <div className="mb-6">
              <ThemedText fontSize={16} fontWeight={600} className="text-gray-900 mb-3">
                Selected Schemas ({selectedCredentialsList.length})
              </ThemedText>
              <div className="bg-gray-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  {selectedCredentialsList.map((schema) => (
                    <div
                      key={schema.compositeId}
                      className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200"
                    >
                      <div className="flex flex-col">
                        <ThemedText className="text-sm font-medium text-gray-900">
                          {schema.name} v{schema.version}
                        </ThemedText>
                        <ThemedText className="text-xs text-gray-500">
                          {schema.issuer_name}
                        </ThemedText>
                      </div>
                      <button
                        onClick={() => handleRemoveFromSelection(schema.compositeId)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                        aria-label="Remove schema"
                      >
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
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Purpose Input */}
          <div className="mb-6">
            <ThemedText className="block text-sm font-medium text-gray-900 mb-2">
              Purpose <span className="text-red-500">*</span>
            </ThemedText>
            <textarea
              value={vpPurpose}
              onChange={(e) => setVpPurpose(e.target.value)}
              placeholder="Enter the purpose for requesting this Verifiable Presentation..."
              rows={4}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleCloseRequestVPModal}
              disabled={isSubmittingVP}
              className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitVPRequest}
              disabled={
                !vpHolderDid ||
                selectedCredentials.size === 0 ||
                !vpPurpose.trim() ||
                isSubmittingVP
              }
              className={`px-6 py-2.5 rounded-lg transition-colors text-sm font-medium ${
                vpHolderDid && selectedCredentials.size > 0 && vpPurpose.trim() && !isSubmittingVP
                  ? 'bg-purple-500 text-white hover:bg-purple-600'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isSubmittingVP ? 'Requesting...' : 'Request VP'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Info Modal */}
      <InfoModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title={infoModalConfig.title}
        message={infoModalConfig.message}
        buttonColor={infoModalConfig.buttonColor}
        showCancelButton={infoModalConfig.showCancelButton}
        onConfirm={infoModalConfig.onConfirm}
        confirmButtonText={infoModalConfig.confirmButtonText}
      />

      {/* View VP Detail Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedVPDetail(null);
        }}
        title="Verifiable Presentation Details"
        maxWidth="1200px"
        minHeight="600px"
      >
        <div className="px-8 py-6">
          {isLoadingVPDetail ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                <ThemedText className="text-gray-600">Loading VP details...</ThemedText>
              </div>
            </div>
          ) : selectedVPDetail ? (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <ThemedText className="text-sm text-gray-600 mb-1">VP ID</ThemedText>
                    <ThemedText fontSize={14} fontWeight={600} className="text-gray-900 font-mono">
                      {selectedVPDetail.vpSharing.vp_id}
                    </ThemedText>
                  </div>
                  <div>
                    <ThemedText className="text-sm text-gray-600 mb-1">VP Request ID</ThemedText>
                    <ThemedText fontSize={14} fontWeight={600} className="text-gray-900 font-mono">
                      {selectedVPDetail.requestDetail.id}
                    </ThemedText>
                  </div>
                  <div>
                    <ThemedText className="text-sm text-gray-600 mb-1">
                      Verification Status
                    </ThemedText>
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                        selectedVPDetail.requestDetail.verify_status === 'VERIFIED'
                          ? 'bg-green-100 text-green-700'
                          : selectedVPDetail.requestDetail.verify_status === 'REJECTED'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {selectedVPDetail.requestDetail.verify_status.replace('_', ' ')}
                    </span>
                  </div>
                  <div>
                    <ThemedText className="text-sm text-gray-600 mb-1">Request Status</ThemedText>
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                        selectedVPDetail.requestDetail.status === 'ACCEPT'
                          ? 'bg-green-100 text-green-700'
                          : selectedVPDetail.requestDetail.status === 'REJECT'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {selectedVPDetail.requestDetail.status}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <ThemedText className="text-sm text-gray-600 mb-1">Holder DID</ThemedText>
                    <ThemedText fontSize={12} className="text-gray-900 font-mono break-all">
                      {selectedVPDetail.requestDetail.holder_did}
                    </ThemedText>
                  </div>
                </div>
                <div className="mt-4">
                  <ThemedText className="text-sm text-gray-600 mb-1">Purpose</ThemedText>
                  <ThemedText fontSize={14} className="text-gray-900">
                    {selectedVPDetail.requestDetail.purpose}
                  </ThemedText>
                </div>
              </div>

              {/* Credentials Comparison */}
              <div className="bg-white rounded-xl border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <ThemedText fontSize={18} fontWeight={600} className="text-gray-900">
                    Credentials Comparison
                  </ThemedText>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-2 gap-6">
                    {/* Requested Credentials */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <ThemedText fontSize={16} fontWeight={600} className="text-gray-900">
                          Requested Credentials
                        </ThemedText>
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                          {selectedVPDetail.requestDetail.requested_credentials.length} Required
                        </span>
                      </div>
                      <div className="space-y-3">
                        {selectedVPDetail.requestDetail.requested_credentials.map(
                          (cred, idx: number) => {
                            const isShared = selectedVPDetail.vpSharing.credentials.some(
                              (s) =>
                                s.schema_id === cred.schema_id &&
                                s.schema_version === cred.schema_version
                            );
                            return (
                              <div
                                key={idx}
                                className={`p-4 rounded-lg border-2 ${
                                  isShared
                                    ? 'border-green-200 bg-green-50'
                                    : 'border-red-200 bg-red-50'
                                }`}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <ThemedText
                                      fontSize={14}
                                      fontWeight={600}
                                      className="text-gray-900"
                                    >
                                      {cred.schema_name}
                                    </ThemedText>
                                    <ThemedText fontSize={12} className="text-gray-600 mt-1">
                                      Version {cred.schema_version}
                                    </ThemedText>
                                    <ThemedText
                                      fontSize={11}
                                      className="text-gray-500 mt-1 font-mono"
                                    >
                                      {cred.schema_id.substring(0, 24)}...
                                    </ThemedText>
                                  </div>
                                  <div>
                                    {isShared ? (
                                      <div className="flex items-center gap-1 text-green-600">
                                        <svg
                                          className="w-5 h-5"
                                          fill="currentColor"
                                          viewBox="0 0 20 20"
                                        >
                                          <path
                                            fillRule="evenodd"
                                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                            clipRule="evenodd"
                                          />
                                        </svg>
                                        <span className="text-xs font-medium">Shared</span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1 text-red-600">
                                        <svg
                                          className="w-5 h-5"
                                          fill="currentColor"
                                          viewBox="0 0 20 20"
                                        >
                                          <path
                                            fillRule="evenodd"
                                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                            clipRule="evenodd"
                                          />
                                        </svg>
                                        <span className="text-xs font-medium">Missing</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    </div>

                    {/* Shared Credentials */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <ThemedText fontSize={16} fontWeight={600} className="text-gray-900">
                          Shared Credentials
                        </ThemedText>
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                          {selectedVPDetail.vpSharing.credentials.length} Shared
                        </span>
                      </div>
                      <div className="space-y-3">
                        {selectedVPDetail.vpSharing.credentials.map((cred, idx: number) => {
                          const isRequested =
                            selectedVPDetail.requestDetail.requested_credentials.some(
                              (r) =>
                                r.schema_id === cred.schema_id &&
                                r.schema_version === cred.schema_version
                            );
                          return (
                            <div
                              key={idx}
                              className={`p-4 rounded-lg border-2 ${
                                isRequested
                                  ? 'border-green-200 bg-green-50'
                                  : 'border-orange-200 bg-orange-50'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <ThemedText
                                    fontSize={14}
                                    fontWeight={600}
                                    className="text-gray-900"
                                  >
                                    {cred.schema_name}
                                  </ThemedText>
                                  <ThemedText fontSize={12} className="text-gray-600 mt-1">
                                    Version {cred.schema_version}
                                  </ThemedText>
                                  <ThemedText
                                    fontSize={11}
                                    className="text-gray-500 mt-1 font-mono"
                                  >
                                    {cred.schema_id.substring(0, 24)}...
                                  </ThemedText>
                                </div>
                                <div>
                                  {isRequested ? (
                                    <div className="flex items-center gap-1 text-green-600">
                                      <svg
                                        className="w-5 h-5"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                      >
                                        <path
                                          fillRule="evenodd"
                                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                      <span className="text-xs font-medium">Matched</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1 text-orange-600">
                                      <svg
                                        className="w-5 h-5"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                      >
                                        <path
                                          fillRule="evenodd"
                                          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                      <span className="text-xs font-medium">Extra</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    {(() => {
                      const comparison = compareCredentials(
                        selectedVPDetail.requestDetail.requested_credentials,
                        selectedVPDetail.vpSharing.credentials
                      );
                      return (
                        <div className="flex items-start gap-3">
                          {comparison.isComplete ? (
                            <>
                              <svg
                                className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <div>
                                <ThemedText
                                  fontSize={14}
                                  fontWeight={600}
                                  className="text-green-700"
                                >
                                  All credentials matched!
                                </ThemedText>
                                <ThemedText fontSize={13} className="text-gray-600 mt-1">
                                  The holder provided all requested credentials. Ready for
                                  verification.
                                </ThemedText>
                              </div>
                            </>
                          ) : (
                            <>
                              <svg
                                className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <div>
                                <ThemedText
                                  fontSize={14}
                                  fontWeight={600}
                                  className="text-orange-700"
                                >
                                  Credentials mismatch detected
                                </ThemedText>
                                <ThemedText fontSize={13} className="text-gray-600 mt-1">
                                  {comparison.message}
                                </ThemedText>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <ThemedText className="text-sm text-gray-600 mb-1">Request Created</ThemedText>
                  <ThemedText fontSize={14} fontWeight={600} className="text-gray-900">
                    {formatDate(selectedVPDetail.requestDetail.createdAt)}
                  </ThemedText>
                  <ThemedText fontSize={12} className="text-gray-500 mt-1">
                    {new Date(selectedVPDetail.requestDetail.createdAt).toLocaleTimeString()}
                  </ThemedText>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <ThemedText className="text-sm text-gray-600 mb-1">Last Updated</ThemedText>
                  <ThemedText fontSize={14} fontWeight={600} className="text-gray-900">
                    {formatDate(selectedVPDetail.requestDetail.updatedAt)}
                  </ThemedText>
                  <ThemedText fontSize={12} className="text-gray-500 mt-1">
                    {new Date(selectedVPDetail.requestDetail.updatedAt).toLocaleTimeString()}
                  </ThemedText>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setSelectedVPDetail(null);
                  }}
                  className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  Close
                </button>
                {selectedVPDetail.requestDetail.verify_status === 'NOT_VERIFIED' && (
                  <button
                    onClick={() => handleVerify(selectedVPDetail.vpSharing.vp_id)}
                    className="px-6 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
                  >
                    Verify Credentials
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </Modal>

      {/* VP Verification Modal */}
      <Modal
        isOpen={showVerifyModal}
        onClose={() => {}} // Disable closing by clicking outside or X button
        title="Verifiable Presentation Verification"
        maxWidth="1400px"
        minHeight="700px"
        disableClose={true}
      >
        <div className="px-8 py-6">
          {isLoadingVerification ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                <ThemedText className="text-gray-600">Verifying credentials...</ThemedText>
              </div>
            </div>
          ) : vpVerificationData ? (
            <div className="space-y-6">
              {/* Verification Status Banner */}
              <div
                className={`rounded-xl p-6 border-2 ${
                  vpVerificationData.verification.vp_valid
                    ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
                    : 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200'
                }`}
              >
                <div className="flex items-center gap-4">
                  {vpVerificationData.verification.vp_valid ? (
                    <div className="flex-shrink-0 w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  ) : (
                    <div className="flex-shrink-0 w-16 h-16 bg-red-500 rounded-full flex items-center justify-center">
                      <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1">
                    <ThemedText
                      fontSize={24}
                      fontWeight={700}
                      className={
                        vpVerificationData.verification.vp_valid ? 'text-green-700' : 'text-red-700'
                      }
                    >
                      {vpVerificationData.verification.vp_valid
                        ? '✓ Verification Successful'
                        : '✗ Verification Failed'}
                    </ThemedText>
                    <ThemedText fontSize={14} className="text-gray-600 mt-1">
                      {vpVerificationData.verification.vp_valid
                        ? 'All credentials have been verified and are valid.'
                        : 'One or more credentials failed verification.'}
                    </ThemedText>
                  </div>
                </div>
              </div>

              {/* VP Information */}
              <div className="bg-gray-50 rounded-xl p-6">
                <ThemedText fontSize={18} fontWeight={600} className="text-gray-900 mb-4">
                  Presentation Information
                </ThemedText>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <ThemedText className="text-sm text-gray-600 mb-1">Holder DID</ThemedText>
                    <ThemedText fontSize={12} className="text-gray-900 font-mono break-all">
                      {vpVerificationData.verification.holder_did}
                    </ThemedText>
                  </div>
                  <div>
                    <ThemedText className="text-sm text-gray-600 mb-1">
                      Presentation Type
                    </ThemedText>
                    <div className="flex flex-wrap gap-2">
                      {vpVerificationData.vp.type.map((type: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Credentials Verification Details */}
              <div className="bg-white rounded-xl border-2 border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                  <ThemedText fontSize={20} fontWeight={600} className="text-gray-900">
                    Credentials Verification (
                    {vpVerificationData.verification.credentials_verification.length})
                  </ThemedText>
                </div>
                <div className="p-6 space-y-4">
                  {vpVerificationData.verification.credentials_verification.map(
                    (cred, idx: number) => {
                      const vcData = vpVerificationData.vp.verifiableCredential[idx];
                      return (
                        <div
                          key={idx}
                          className={`rounded-xl border-2 overflow-hidden ${
                            cred.valid ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                          }`}
                        >
                          {/* Credential Header */}
                          <div
                            className={`px-6 py-4 border-b ${
                              cred.valid
                                ? 'border-green-200 bg-green-100'
                                : 'border-red-200 bg-red-100'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {cred.valid ? (
                                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                                    <svg
                                      className="w-6 h-6 text-white"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  </div>
                                ) : (
                                  <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                                    <svg
                                      className="w-6 h-6 text-white"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  </div>
                                )}
                                <div>
                                  <ThemedText
                                    fontSize={16}
                                    fontWeight={600}
                                    className={cred.valid ? 'text-green-900' : 'text-red-900'}
                                  >
                                    Credential {idx + 1} -{' '}
                                    {vcData.type
                                      .filter((t: string) => t !== 'VerifiableCredential')
                                      .join(', ')}
                                  </ThemedText>
                                  <ThemedText fontSize={12} className="text-gray-600 mt-1">
                                    {cred.valid ? 'Valid & Verified' : 'Verification Failed'}
                                  </ThemedText>
                                </div>
                              </div>
                              <span
                                className={`px-4 py-2 rounded-full text-sm font-bold ${
                                  cred.valid ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                                }`}
                              >
                                {cred.valid ? 'VALID' : 'INVALID'}
                              </span>
                            </div>
                          </div>

                          {/* Credential Details */}
                          <div className="p-6 bg-white">
                            <div className="grid grid-cols-2 gap-6">
                              {/* Left Column */}
                              <div className="space-y-4">
                                <div>
                                  <ThemedText className="text-xs text-gray-500 mb-1">
                                    CREDENTIAL ID
                                  </ThemedText>
                                  <ThemedText
                                    fontSize={11}
                                    className="text-gray-900 font-mono break-all"
                                  >
                                    {cred.vc_id}
                                  </ThemedText>
                                </div>
                                <div>
                                  <ThemedText className="text-xs text-gray-500 mb-1">
                                    ISSUER
                                  </ThemedText>
                                  <ThemedText
                                    fontSize={12}
                                    fontWeight={600}
                                    className="text-gray-900 mb-1"
                                  >
                                    {vcData.issuerName}
                                  </ThemedText>
                                  <ThemedText
                                    fontSize={11}
                                    className="text-gray-600 font-mono break-all"
                                  >
                                    {cred.issuer}
                                  </ThemedText>
                                </div>
                                <div>
                                  <ThemedText className="text-xs text-gray-500 mb-1">
                                    VALID FROM
                                  </ThemedText>
                                  <ThemedText fontSize={12} className="text-gray-900">
                                    {vcData.validFrom &&
                                      new Date(vcData.validFrom).toLocaleString('en-US', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                  </ThemedText>
                                </div>
                                <div>
                                  <ThemedText className="text-xs text-gray-500 mb-1">
                                    EXPIRES AT
                                  </ThemedText>
                                  <ThemedText fontSize={12} className="text-gray-900">
                                    {vcData.expiredAt &&
                                      new Date(vcData.expiredAt).toLocaleString('en-US', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                  </ThemedText>
                                </div>
                              </div>

                              {/* Right Column */}
                              <div className="space-y-4">
                                <div>
                                  <ThemedText className="text-xs text-gray-500 mb-2">
                                    CREDENTIAL SUBJECT
                                  </ThemedText>
                                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                                    {Object.entries(vcData.credentialSubject)
                                      .filter(([key]) => key !== 'id')
                                      .map(([key, value], subIdx: number) => (
                                        <div
                                          key={subIdx}
                                          className="flex justify-between items-center border-b border-gray-200 pb-2 last:border-0 last:pb-0"
                                        >
                                          <ThemedText
                                            fontSize={12}
                                            fontWeight={600}
                                            className="text-gray-700"
                                          >
                                            {key}:
                                          </ThemedText>
                                          <ThemedText fontSize={12} className="text-gray-900">
                                            {String(value)}
                                          </ThemedText>
                                        </div>
                                      ))}
                                  </div>
                                </div>
                                {vcData.fileUrl && (
                                  <div>
                                    <ThemedText className="text-xs text-gray-500 mb-2">
                                      DOCUMENT
                                    </ThemedText>
                                    <a
                                      href={vcData.fileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                                    >
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
                                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                        />
                                      </svg>
                                      View Document
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Proof Information */}
                            <div className="mt-6 pt-6 border-t border-gray-200">
                              <ThemedText className="text-xs text-gray-500 mb-2">
                                CRYPTOGRAPHIC PROOF
                              </ThemedText>
                              <div className="bg-gray-50 rounded-lg p-4">
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                  <div>
                                    <span className="text-gray-500">Type:</span>
                                    <span className="ml-2 text-gray-900 font-medium">
                                      {vcData.proof.type}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Cryptosuite:</span>
                                    <span className="ml-2 text-gray-900 font-medium">
                                      {vcData.proof.cryptosuite}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Purpose:</span>
                                    <span className="ml-2 text-gray-900 font-medium">
                                      {vcData.proof.proofPurpose}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Created:</span>
                                    <span className="ml-2 text-gray-900 font-medium">
                                      {new Date(vcData.proof.created).toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Close Button */}
              <div className="flex justify-end pt-4 border-t border-gray-200">
                <button
                  onClick={handleCloseVerifyModal}
                  className="px-8 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium shadow-lg"
                >
                  Close Verification
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </Modal>

      {/* Close Confirmation Modal */}
      <InfoModal
        isOpen={showCloseConfirmation}
        onClose={() => setShowCloseConfirmation(false)}
        title="Close Verification?"
        message="⚠️ Warning: Once you close this verification view, you will not be able to see these details again. The VP data will be permanently deleted from your local storage.\n\nAre you sure you want to close?"
        buttonColor="red"
        showCancelButton={true}
        cancelButtonText="Go Back"
        confirmButtonText="Yes, Close and Delete"
        onConfirm={confirmCloseVerifyModal}
      />
    </InstitutionLayout>
  );
}
