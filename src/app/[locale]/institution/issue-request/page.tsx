'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import InstitutionLayout from '@/components/InstitutionLayout';
import { ThemedText } from '@/components/ThemedText';
import { DataTable, Column } from '@/components/DataTable';
import Modal from '@/components/Modal';
import FillIssueRequestForm, { IssueRequestFormData } from '@/components/FillIssueRequestForm';
import { API_ENDPOINTS, buildApiUrlWithParams, buildApiUrl } from '@/utils/api';
import { createVC, hashVC } from '@/utils/vcUtils';
import { redirectIfJWTInvalid } from '@/utils/auth';
import { authenticatedGet, authenticatedPost } from '@/utils/api-client';

interface IssueRequest {
  id: string;
  encrypted_body: string;
  issuer_did: string;
  holder_did: string;
  version: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface ApiResponse {
  message: string;
  count: number;
  data: IssueRequest[];
}

interface SchemaProperty {
  type: string;
  description: string;
}

interface SchemaDefinition {
  type: string;
  required: string[];
  properties: Record<string, SchemaProperty>;
}

interface SchemaApiResponse {
  success: boolean;
  data: {
    id: string;
    name: string;
    schema: SchemaDefinition;
    issuer_did: string;
    version: number;
    isActive: boolean;
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
}

export default function IssueRequestPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<IssueRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<IssueRequest[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'PENDING' | 'APPROVED' | 'REJECTED'>('all');
  const [filterSchema, setFilterSchema] = useState('');
  const [filterButtonPosition, setFilterButtonPosition] = useState({ top: 0, left: 0 });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<IssueRequest | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [schemaData, setSchemaData] = useState<Schema | null>(null);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);
  const [requestAttributes, setRequestAttributes] = useState<
    Record<string, string | number | boolean>
  >({});

  const filterModalRef = useRef<HTMLDivElement>(null);

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

  // Fetch issue requests from API
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchRequests = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const issuerDid = localStorage.getItem('institutionDID');
        if (!issuerDid) {
          throw new Error('Institution DID not found. Please log in again.');
        }

        const url = buildApiUrlWithParams(API_ENDPOINTS.CREDENTIAL.GET_REQUESTS, {
          type: 'ISSUANCE',
          issuer_did: issuerDid,
        });

        const response = await authenticatedGet(url);

        if (!response.ok) {
          throw new Error('Failed to fetch issue requests');
        }

        const data: ApiResponse = await response.json();
        setRequests(data.data);
        setFilteredRequests(data.data);
      } catch (err) {
        console.error('Error fetching issue requests:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRequests();
  }, [isAuthenticated]);

  const activeCount = requests.filter((r) => r.status === 'PENDING').length;
  const expiringCount = 0; // Implement expiring logic based on your requirements

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
    const filtered = requests.filter(
      (request) =>
        request.holder_did.toLowerCase().includes(value.toLowerCase()) ||
        request.encrypted_body.toLowerCase().includes(value.toLowerCase()) ||
        request.status.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredRequests(filtered);
  };

  const handleFilter = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setFilterButtonPosition({
      top: rect.bottom + 8,
      left: rect.left,
    });
    setShowFilterModal(true);
  };

  const applyFilters = (type: 'all' | 'PENDING' | 'APPROVED' | 'REJECTED', schema: string) => {
    let filtered = requests;

    if (type !== 'all') {
      filtered = filtered.filter((request) => request.status === type);
    }

    if (schema) {
      filtered = filtered.filter((request) =>
        request.encrypted_body.toLowerCase().includes(schema.toLowerCase())
      );
    }

    setFilteredRequests(filtered);
  };

  const handleTypeChange = (type: 'all' | 'PENDING' | 'APPROVED' | 'REJECTED') => {
    setFilterType(type);
    applyFilters(type, filterSchema);
  };

  const handleSchemaChange = (schema: string) => {
    setFilterSchema(schema);
    applyFilters(filterType, schema);
  };

  const handleReview = async (requestId: string) => {
    console.log('Review request:', requestId);
    const request = requests.find((r) => r.id === requestId);
    if (request) {
      setSelectedRequest(request);
      setShowReviewModal(true);

      // Fetch schema data
      setIsLoadingSchema(true);
      try {
        // Fetch schema details using encrypted_body as schema ID
        const schemaUrl = buildApiUrl(
          API_ENDPOINTS.SCHEMA.DETAIL(request.encrypted_body, request.version)
        );
        const schemaResponse = await authenticatedGet(schemaUrl);

        if (schemaResponse.ok) {
          const schemaApiData: SchemaApiResponse = await schemaResponse.json();

          if (schemaApiData.success && schemaApiData.data) {
            const { id, name, schema, version, isActive } = schemaApiData.data;

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
            });

            // Set empty attributes for now - you can fetch actual values from another endpoint
            setRequestAttributes({});
          } else {
            throw new Error('Invalid schema response');
          }
        } else {
          throw new Error('Failed to fetch schema details');
        }
      } catch (err) {
        console.error('Error fetching schema details:', err);
        // Use mock data as fallback
        setSchemaData({
          id: request.encrypted_body,
          name: 'KTP Indonesia',
          version: '1',
          status: 'Active',
          attributes: [
            {
              name: 'nik',
              type: 'string',
              required: true,
              description: 'Nomor Induk Kependudukan',
            },
            { name: 'fullName', type: 'string', required: true, description: 'Full name' },
            { name: 'placeOfBirth', type: 'string', required: true, description: 'Place of birth' },
            { name: 'dateOfBirth', type: 'string', required: true, description: 'Date of birth' },
            { name: 'gender', type: 'string', required: true, description: 'Gender' },
            { name: 'address', type: 'string', required: true, description: 'Address' },
            { name: 'citizenship', type: 'string', required: true, description: 'Citizenship' },
          ],
        });
        setRequestAttributes({});
      } finally {
        setIsLoadingSchema(false);
      }
    }
  };

  const handleIssueCredential = async (data: IssueRequestFormData) => {
    if (!selectedRequest || !schemaData) {
      console.error('No selected request or schema data');
      return;
    }

    try {
      setIsLoadingSchema(true);

      // Convert form attributes to credential data
      const credentialData: Record<string, string | number | boolean> = {};
      data.attributes.forEach((attr) => {
        credentialData[attr.name] = attr.value;
      });

      // Create Verifiable Credential
      const vc = createVC({
        id: selectedRequest.id,
        vcType: schemaData.name.replace(/\s+/g, ''), // Remove spaces for type name
        issuerDid: selectedRequest.issuer_did,
        holderDid: selectedRequest.holder_did,
        credentialData: credentialData,
      });

      // Hash the VC
      const vcHash = hashVC(vc);

      console.log('Created VC:', vc);
      console.log('VC Hash:', vcHash);

      // Generate vc_id as concatenation of schema_id and holder_did
      const vcId = `${schemaData.id}:${selectedRequest.holder_did}`;

      // Prepare request body
      const requestBody = {
        request_id: selectedRequest.id,
        issuer_did: selectedRequest.issuer_did,
        holder_did: selectedRequest.holder_did,
        action: 'APPROVED',
        request_type: 'ISSUANCE',
        vc_id: vcId,
        vc_type: schemaData.name.replace(/\s+/g, ''),
        schema_id: schemaData.id,
        schema_version: parseInt(schemaData.version),
        vc_hash: vcHash,
        encrypted_body: 'string',
      };

      console.log('Request body:', requestBody);
      console.log('Generated VC ID:', vcId);

      // Send POST request to issue VC
      const issueUrl = buildApiUrl(API_ENDPOINTS.CREDENTIAL.ISSUE_VC);
      const response = await authenticatedPost(issueUrl, requestBody);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to issue credential');
      }

      const result = await response.json();
      console.log('Issue VC result:', result);

      if (result.success) {
        alert(
          `Credential issued successfully!\nTransaction Hash: ${result.data.transaction_hash}\nBlock Number: ${result.data.block_number}`
        );

        // Remove the request from the list
        setRequests((prev) => prev.filter((request) => request.id !== selectedRequest.id));
        setFilteredRequests((prev) => prev.filter((request) => request.id !== selectedRequest.id));

        // Close modal
        setShowReviewModal(false);
        setSchemaData(null);
        setRequestAttributes({});
      }
    } catch (err) {
      console.error('Error issuing credential:', err);
      alert(`Failed to issue credential: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoadingSchema(false);
    }
  };

  const handleReject = (requestId: string) => {
    console.log('Reject request:', requestId);
    // Implement reject logic
    setRequests((prev) => prev.filter((request) => request.id !== requestId));
    setFilteredRequests((prev) => prev.filter((request) => request.id !== requestId));
  };

  const handleCopyDid = async (did: string, id: string) => {
    try {
      await navigator.clipboard.writeText(did);
      setCopiedId(id);
      // Reset after 2 seconds
      setTimeout(() => {
        setCopiedId(null);
      }, 2000);
      console.log('DID copied to clipboard:', did);
    } catch (err) {
      console.error('Failed to copy DID:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'text-orange-600';
      case 'APPROVED':
        return 'text-green-600';
      case 'REJECTED':
        return 'text-red-600';
      default:
        return 'text-gray-600';
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

  const calculateActiveUntil = (requestedOn: string): string => {
    const date = new Date(requestedOn);
    date.setFullYear(date.getFullYear() + 5);
    return formatDate(date.toISOString());
  };

  const truncateDid = (did: string, maxLength: number = 25): string => {
    if (did.length <= maxLength) {
      return did;
    }
    return did.substring(0, maxLength) + '...';
  };

  const columns: Column<IssueRequest>[] = [
    {
      id: 'holder_did',
      label: 'USER DID',
      sortKey: 'holder_did',
      render: (row) => (
        <div className="flex items-center gap-2">
          <ThemedText className="text-sm text-gray-900">{truncateDid(row.holder_did)}</ThemedText>
          <button
            onClick={() => handleCopyDid(row.holder_did, row.id)}
            className={`relative transition-all duration-200 ${
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
                  strokeWidth={2.5}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
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
      id: 'encrypted_body',
      label: 'SCHEMA',
      sortKey: 'encrypted_body',
      render: (row) => (
        <ThemedText className="text-sm text-gray-900">{row.encrypted_body}</ThemedText>
      ),
    },
    {
      id: 'status',
      label: 'TYPE',
      sortKey: 'status',
      render: (row) => (
        <ThemedText className={`text-sm font-medium ${getStatusColor(row.status)}`}>
          {row.status}
        </ThemedText>
      ),
    },
    {
      id: 'createdAt',
      label: 'REQUESTED ON',
      sortKey: 'createdAt',
      render: (row) => (
        <ThemedText className="text-sm text-gray-900">{formatDate(row.createdAt)}</ThemedText>
      ),
    },
    {
      id: 'activeUntil',
      label: 'ACTIVE UNTIL',
      sortKey: 'createdAt',
      render: (row) => (
        <ThemedText className="text-sm text-gray-900">
          {calculateActiveUntil(row.createdAt)}
        </ThemedText>
      ),
    },
    {
      id: 'action',
      label: 'ACTION',
      render: (row) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleReview(row.id)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            disabled={row.status !== 'PENDING'}
          >
            REVIEW
          </button>
          <button
            onClick={() => handleReject(row.id)}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            disabled={row.status !== 'PENDING'}
          >
            REJECT
          </button>
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
    <InstitutionLayout activeTab="issue-request">
      <div className="p-12">
        <ThemedText fontSize={40} fontWeight={700} className="text-black mb-8">
          Issue Request
        </ThemedText>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-6 mb-8 pt-4">
          <div className="bg-blue-50 grid grid-row-2 rounded-2xl p-6">
            <ThemedText className="text-sm text-gray-600 mb-2">Active Requests</ThemedText>
            <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
              {activeCount.toLocaleString()}
            </ThemedText>
          </div>
          <div className="bg-blue-50 grid grid-row-2 rounded-2xl p-6">
            <ThemedText className="text-sm text-gray-600 mb-2">Expired in 24 hours</ThemedText>
            <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
              {expiringCount.toLocaleString()}
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
            data={filteredRequests}
            columns={columns}
            onFilter={handleFilter}
            searchPlaceholder="Search..."
            onSearch={handleSearch}
            enableSelection={true}
            totalCount={filteredRequests.length}
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
              Filter Requests
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
              value={filterType}
              onChange={(e) => handleTypeChange(e.target.value as typeof filterType)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="all">All</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* Schema Filter */}
          <div>
            <ThemedText className="block text-sm font-medium text-gray-900 mb-2">
              Encrypted Body
            </ThemedText>
            <input
              type="text"
              value={filterSchema}
              onChange={(e) => handleSchemaChange(e.target.value)}
              placeholder="Search by encrypted body"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
        </div>
      )}

      {/* Review Modal */}
      <Modal
        isOpen={showReviewModal}
        onClose={() => {
          if (!isLoadingSchema) {
            setShowReviewModal(false);
            setSchemaData(null);
            setRequestAttributes({});
          }
        }}
        title="Review Issue Request"
        maxWidth="1000px"
      >
        {isLoadingSchema ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <ThemedText className="text-gray-600">Loading schema and preparing form...</ThemedText>
          </div>
        ) : selectedRequest && schemaData ? (
          <FillIssueRequestForm
            schemaId={schemaData.id}
            schemaName={schemaData.name}
            version={schemaData.version}
            status={schemaData.status}
            initialAttributes={schemaData.attributes.map((attr, index) => ({
              id: index + 1,
              name: attr.name,
              type: attr.type,
              value: requestAttributes[attr.name] || '',
            }))}
            onSubmit={handleIssueCredential}
            onCancel={() => {
              setShowReviewModal(false);
              setSchemaData(null);
              setRequestAttributes({});
            }}
          />
        ) : null}
      </Modal>
    </InstitutionLayout>
  );
}
