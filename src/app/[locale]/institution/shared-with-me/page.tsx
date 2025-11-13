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

interface SharedCredential {
  id: string;
  credentialType: string;
  holderDid: string;
  sharedDate: string;
  expiryDate: string;
  status: 'Active' | 'Expired' | 'Revoked';
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

export default function SharedWithMePage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [credentials, setCredentials] = useState<SharedCredential[]>([]);
  const [filteredCredentials, setFilteredCredentials] = useState<SharedCredential[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'Active' | 'Expired' | 'Revoked'>('all');
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
    buttonColor: 'blue' as 'blue' | 'green' | 'red' | 'yellow',
  });

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

  // Check authentication with JWT verification on component mount
  useEffect(() => {
    const checkAuth = async () => {
      const redirected = await redirectIfJWTInvalid(router);
      if (!redirected) {
        setIsAuthenticated(true);
        setIsLoading(false);
        // TODO: Fetch shared credentials from API
        // For now, using empty array
        setCredentials([]);
        setFilteredCredentials([]);
      }
    };

    checkAuth();
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

  const applyFilters = (
    status: 'all' | 'Active' | 'Expired' | 'Revoked',
    verified: 'all' | 'verified' | 'unverified'
  ) => {
    let filtered = credentials;

    if (status !== 'all') {
      filtered = filtered.filter((credential) => credential.status === status);
    }

    if (verified === 'verified') {
      filtered = filtered.filter((credential) => credential.verified === true);
    } else if (verified === 'unverified') {
      filtered = filtered.filter((credential) => credential.verified === false);
    }

    setFilteredCredentials(filtered);
  };

  const handleStatusChange = (status: 'all' | 'Active' | 'Expired' | 'Revoked') => {
    setFilterStatus(status);
    applyFilters(status, filterVerified);
  };

  const handleVerifiedChange = (verified: 'all' | 'verified' | 'unverified') => {
    setFilterVerified(verified);
    applyFilters(filterStatus, verified);
  };

  const handleView = (id: string) => {
    console.log('View credential:', id);
    // TODO: Implement view credential details
  };

  const handleVerify = (id: string) => {
    console.log('Verify credential:', id);
    // TODO: Implement verify credential
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
      id: 'credentialType',
      label: 'CREDENTIAL TYPE',
      sortKey: 'credentialType',
      render: (row) => (
        <ThemedText className="text-sm font-medium text-gray-900">{row.credentialType}</ThemedText>
      ),
    },
    {
      id: 'holderDid',
      label: 'HOLDER DID',
      sortKey: 'holderDid',
      render: (row) => (
        <ThemedText className="text-sm text-gray-900">
          {row.holderDid.substring(0, 25)}...
        </ThemedText>
      ),
    },
    {
      id: 'sharedDate',
      label: 'SHARED DATE',
      sortKey: 'sharedDate',
      render: (row) => (
        <ThemedText className="text-sm text-gray-900">{formatDate(row.sharedDate)}</ThemedText>
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
      id: 'verified',
      label: 'VERIFIED',
      sortKey: 'verified',
      render: (row) => (
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
            row.verified ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
          }`}
        >
          {row.verified ? 'Yes' : 'No'}
        </span>
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
      render: (row) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleView(row.id)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
          >
            VIEW
          </button>
          {!row.verified && row.status === 'Active' && (
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
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-black"
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
      />
    </InstitutionLayout>
  );
}
