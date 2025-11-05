'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import InstitutionLayout from '@/components/InstitutionLayout';
import { ThemedText } from '@/components/ThemedText';
import { DataTable, Column } from '@/components/DataTable';
import { redirectIfJWTInvalid } from '@/utils/auth';
import Modal from '@/components/Modal';
import { buildApiUrlWithParams, buildApiUrl, API_ENDPOINTS } from '@/utils/api';
import { encryptWithPublicKey } from '@/utils/encryptUtils';

interface Credential {
  id: string;
  credentialType: string;
  issuerDid: string;
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
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [filteredSchemas, setFilteredSchemas] = useState<Schema[]>([]);
  const [isSchemasLoading, setIsSchemasLoading] = useState(false);
  const [expandedSchemaId, setExpandedSchemaId] = useState<string | null>(null);

  const filterModalRef = useRef<HTMLDivElement>(null);

  const activeCount = credentials.filter((c) => c.status === 'Active').length;

  // Check authentication with JWT verification on component mount
  useEffect(() => {
    const checkAuth = async () => {
      const redirected = await redirectIfJWTInvalid(router);
      if (!redirected) {
        setIsAuthenticated(true);
        setIsLoading(false);
        // TODO: Fetch credentials from API
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
        credential.issuerDid.toLowerCase().includes(searchLower) ||
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

  const handleView = (id: string) => {
    console.log('View credential:', id);
    // TODO: Implement view credential details
  };

  const handleShare = (id: string) => {
    console.log('Share credential:', id);
    // TODO: Implement share credential
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

      const url = buildApiUrlWithParams(API_ENDPOINTS.SCHEMA.BASE, { isActive: true });

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
        setSchemas(result.data.data);
        setFilteredSchemas(result.data.data);
      }
    } catch (error) {
      console.error('Error fetching schemas:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to fetch schemas: ${errorMessage}`);
    } finally {
      setIsSchemasLoading(false);
    }
  };

  const handleRequestCredential = async (schemaId: string, issuerDid: string) => {
    try {
      const holderDid = localStorage.getItem('institutionDID');
      const token = localStorage.getItem('institutionToken');

      if (!holderDid) {
        alert('Holder DID not found. Please login again.');
        return;
      }

      if (!token) {
        alert('Authentication token not found. Please login again.');
        return;
      }

      // Find the schema to get its version
      const schema = schemas.find((s) => s.id === schemaId);
      if (!schema) {
        alert('Schema not found');
        return;
      }

      // Step 1: Fetch the DID document to get the public key
      console.log('Fetching DID document for:', issuerDid);
      const didDocumentUrl = buildApiUrl(API_ENDPOINTS.DID.DOCUMENT(issuerDid));

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

      const url = buildApiUrl(API_ENDPOINTS.CREDENTIAL.REQUESTS);

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
        alert(
          `Credential request successful! Request ID: ${result.data.request_id}\nStatus: ${result.data.status}`
        );
        setShowRequestModal(false);
      } else {
        throw new Error(result.message || 'Request failed');
      }
    } catch (error) {
      console.error('Error requesting credential:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(
        `Failed to request credential: ${errorMessage}\n\nPlease check the console for more details.`
      );
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
    setFilteredSchemas(filtered);
  };

  const toggleExpandSchema = (schemaId: string) => {
    setExpandedSchemaId(expandedSchemaId === schemaId ? null : schemaId);
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
      render: (row) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleView(row.id)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
          >
            VIEW
          </button>
          {row.status === 'Active' && (
            <button
              onClick={() => handleShare(row.id)}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
            >
              SHARE
            </button>
          )}
        </div>
      ),
    },
  ];

  // Helper functions to prepare data for DataTables
  const getVCInfoData = (schema: Schema): VCInfoItem[] => {
    return [
      {
        id: '1',
        name: 'Schema ID',
        value: schema.id,
      },
      {
        id: '2',
        name: 'VC Duration',
        value: `${schema.schema.expired_in} Years`,
      },
    ];
  };

  const getAttributesData = (schema: Schema): AttributeItem[] => {
    return Object.entries(schema.schema.properties).map(([key, value], index) => ({
      id: `${index + 1}`,
      name: key,
      type: value.type,
    }));
  };

  // Schema columns for Request Modal
  const schemaColumns: Column<Schema>[] = [
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
            onClick={() => handleRequestCredential(row.id, row.issuer_did)}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
          >
            REQUEST
          </button>
          <button
            onClick={() => toggleExpandSchema(row.id)}
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

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
              <ThemedText className="text-gray-600">Loading credentials...</ThemedText>
            </div>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-6 mb-8 pt-4">
              <div className="bg-blue-50 grid grid-row-2 rounded-2xl p-6">
                <ThemedText className="text-sm text-gray-600 mb-2">Total Credentials</ThemedText>
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
              topRightButton={{
                label: 'Request New Credential',
                onClick: handleOpenRequestModal,
              }}
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
              <DataTable
                data={filteredSchemas}
                columns={schemaColumns}
                searchPlaceholder="Search schemas..."
                onSearch={handleSchemaSearch}
                enableSelection={true}
                totalCount={filteredSchemas.length}
                rowsPerPageOptions={[5, 10, 25]}
                idKey="id"
                expandableRows={{
                  expandedRowId: expandedSchemaId,
                  renderExpandedContent: (schema: Schema) => (
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

      {/* Filter Popup */}
    </InstitutionLayout>
  );
}
