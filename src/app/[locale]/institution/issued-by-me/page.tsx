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
import { redirectIfJWTInvalid } from '@/utils/auth';
import { API_ENDPOINTS, buildApiUrlWithParams } from '@/utils/api';
import { authenticatedGet } from '@/utils/api-client';

interface IssuedCredential {
  id: string;
  holderDid: string;
  schemaName: string;
  status: string;
  lastUpdated: string;
  activeUntil: string;
  schemaId: string;
  schemaVersion: number;
}

interface ApiCredentialResponse {
  success: boolean;
  message: string;
  data: {
    message: string;
    count: number;
    data: {
      id: string;
      encrypted_body: string;
      issuer_did: string;
      holder_did: string;
      status: string;
      createdAt: string;
      updatedAt: string;
      deletedAt: string | null;
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
      createdAt: string;
      updatedAt: string;
    }[];
  };
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
  const [schemas, setSchemas] = useState<
    {
      id: string;
      name: string;
      version: number;
      attributes: {
        name: string;
        type: string;
        required: boolean;
        description?: string;
      }[];
    }[]
  >([]);

  const filterModalRef = useRef<HTMLDivElement>(null);

  const activeCount = credentials.filter((c) => c.status === 'APPROVED').length;

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

  // Fetch credentials from API
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchCredentials = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const institutionDID = localStorage.getItem('institutionDID');
        if (!institutionDID) {
          throw new Error('Institution DID not found. Please log in again.');
        }

        // Fetch credentials
        const credentialsUrl = buildApiUrlWithParams(API_ENDPOINTS.CREDENTIAL.GET_REQUESTS, {
          type: 'ISSUANCE',
          issuer_did: institutionDID,
        });

        const credentialsResponse = await authenticatedGet(credentialsUrl);

        if (!credentialsResponse.ok) {
          throw new Error('Failed to fetch credentials');
        }

        const credentialsResult: ApiCredentialResponse = await credentialsResponse.json();

        // Fetch schemas to get schema names
        const schemasUrl = buildApiUrlWithParams(API_ENDPOINTS.SCHEMA.BASE, {
          issuerDid: institutionDID,
          isActive: 'true',
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
          attributes: Object.entries(schema.schema.properties).map(([key, prop]) => ({
            name: key,
            type: prop.type,
            required: schema.schema.required.includes(key),
            description: prop.description,
          })),
        }));
        setSchemas(transformedSchemas);

        // Transform API data to match IssuedCredential interface
        const transformedCredentials: IssuedCredential[] = credentialsResult.data.data
          .filter((credential) => credential.status !== 'PENDING') // Filter out PENDING requests
          .map((credential) => {
            // Parse encrypted_body to get schema_id and schema_version
            let schemaId = '';
            let schemaVersion = 1;
            try {
              const encryptedBody = JSON.parse(credential.encrypted_body);
              schemaId = encryptedBody.schema_id || '';
              schemaVersion = encryptedBody.schema_version || 1;
            } catch (error) {
              console.error('Failed to parse encrypted_body:', error);
            }

            // Get schema name from the map
            const schemaInfo = schemaMap.get(schemaId);
            const schemaName = schemaInfo?.name || 'Unknown Schema';
            const expiredIn = schemaInfo?.expiredIn || 5;

            // Calculate active until date
            const activeUntilDate = new Date(credential.createdAt);
            activeUntilDate.setFullYear(activeUntilDate.getFullYear() + expiredIn);

            return {
              id: credential.id,
              holderDid: credential.holder_did,
              schemaName: schemaName,
              status: credential.status,
              lastUpdated: credential.updatedAt,
              activeUntil: activeUntilDate.toISOString(),
              schemaId: schemaId,
              schemaVersion: schemaVersion,
            };
          });

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

    fetchCredentials();
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
    console.log('Update credential:', id);
    // TODO: Implement update credential
  };

  const handleRevoke = (id: string) => {
    console.log('Revoke credential:', id);
    // TODO: Implement revoke credential
  };

  const handleNewCredential = () => {
    setShowIssueModal(true);
  };

  const handleIssueCredential = async (data: IssueNewCredentialFormData) => {
    try {
      console.log('Issuing new credential:', data);
      // TODO: Implement API call to issue credential
      // For now, just close the modal
      alert(
        `Credential will be issued to:\nHolder DID: ${data.holderDid}\nSchema: ${data.schemaName} v${data.version}`
      );
      setShowIssueModal(false);
    } catch (error) {
      console.error('Error issuing credential:', error);
      alert(
        `Failed to issue credential: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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
    return date
      .toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      .replace(/\//g, '/');
  };

  const columns: Column<IssuedCredential>[] = [
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
      id: 'schemaName',
      label: 'SCHEMA NAME',
      sortKey: 'schemaName',
      render: (row) => (
        <ThemedText className="text-sm font-medium text-gray-900">{row.schemaName}</ThemedText>
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
          {getStatusLabel(row.status)}
        </span>
      ),
    },
    {
      id: 'lastUpdated',
      label: 'LAST UPDATED',
      sortKey: 'lastUpdated',
      render: (row) => (
        <ThemedText className="text-sm text-gray-900">{formatDate(row.lastUpdated)}</ThemedText>
      ),
    },
    {
      id: 'activeUntil',
      label: 'ACTIVE UNTIL',
      sortKey: 'activeUntil',
      render: (row) => (
        <ThemedText className="text-sm text-gray-900">{formatDate(row.activeUntil)}</ThemedText>
      ),
    },
    {
      id: 'action',
      label: 'ACTION',
      render: (row) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleUpdate(row.id)}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium cursor-pointer"
          >
            UPDATE
          </button>
          {row.status === 'APPROVED' && (
            <button
              onClick={() => handleRevoke(row.id)}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium cursor-pointer"
            >
              REVOKE
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
            topRightButton={{
              label: 'New Credential',
              onClick: handleNewCredential,
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              ),
            }}
            enableSelection={true}
            totalCount={filteredCredentials.length}
            rowsPerPageOptions={[5, 10, 25, 50, 100]}
            idKey="id"
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
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
    </InstitutionLayout>
  );
}
