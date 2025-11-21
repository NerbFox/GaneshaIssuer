'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import InstitutionLayout from '@/components/shared/InstitutionLayout';
import { ThemedText } from '@/components/shared/ThemedText';
import { DataTable, Column } from '@/components/shared/DataTable';
import { redirectIfJWTInvalid } from '@/utils/auth';
import { formatDate, formatTime } from '@/utils/dateUtils';
import { authenticatedGet } from '@/utils/api-client';
import { buildApiUrlWithParams, API_ENDPOINTS } from '@/utils/api';

interface CredentialRequest {
  id: string;
  credentialType: string;
  issuerDid: string;
  requestType: 'ISSUANCE' | 'RENEWAL' | 'UPDATE' | 'REVOCATION';
  requestedDate: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}

export default function MyRequestPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [requests, setRequests] = useState<CredentialRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<CredentialRequest[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'Pending' | 'Approved' | 'Rejected'>(
    'all'
  );
  const [filterRequestType, setFilterRequestType] = useState<
    'all' | 'ISSUANCE' | 'RENEWAL' | 'UPDATE' | 'REVOCATION'
  >('all');
  const [filterType, setFilterType] = useState('');
  const [filterButtonPosition, setFilterButtonPosition] = useState({ top: 0, left: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const filterModalRef = useRef<HTMLDivElement>(null);

  const pendingCount = requests.filter((r) => r.status === 'Pending').length;

  // Check authentication with JWT verification on component mount
  useEffect(() => {
    const checkAuth = async () => {
      const redirected = await redirectIfJWTInvalid(router);
      if (!redirected) {
        setIsAuthenticated(true);
        await fetchRequests();
      }
    };

    checkAuth();
  }, [router]);

  // Fetch requests from API
  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const institutionDID = localStorage.getItem('institutionDID');

      if (!institutionDID) {
        console.error('No institution DID found in localStorage');
        setIsLoading(false);
        return;
      }

      // Fetch all request types
      const requestTypes = ['ISSUANCE', 'RENEWAL', 'UPDATE'];
      const allRequests: CredentialRequest[] = [];

      for (const type of requestTypes) {
        try {
          const url = buildApiUrlWithParams(API_ENDPOINTS.CREDENTIALS.REQUESTS, {
            type: type,
            holder_did: institutionDID,
          });

          console.log(`Fetching ${type} requests from:`, url);
          const response = await authenticatedGet(url);

          if (response.ok) {
            const responseData = await response.json();
            console.log(`${type} FULL RESPONSE:`, JSON.stringify(responseData, null, 2));

            // Handle the nested structure: response.data.data
            if (responseData.success && responseData.data && responseData.data.data) {
              const items = responseData.data.data;
              console.log(`${type} - Found ${items.length} items in data.data`);

              if (items.length > 0) {
                console.log(`${type} - First item:`, JSON.stringify(items[0], null, 2));
              }

              const mappedData = items.map((item: Record<string, unknown>, index: number) => {
                // Try to parse encrypted_body to get schema info
                let schemaName = 'Unknown';
                try {
                  if (item.encrypted_body && typeof item.encrypted_body === 'string') {
                    const parsedBody = JSON.parse(item.encrypted_body);
                    schemaName = parsedBody.vc_type || parsedBody.schema_id || 'Unknown';
                  }
                } catch {
                  // If parsing fails, encrypted_body might just be the schema_id
                  schemaName = (item.encrypted_body as string) || 'Unknown';
                }

                return {
                  id: item.id || `${type}-${index}-${Date.now()}`,
                  credentialType: schemaName,
                  issuerDid: (item.issuer_did as string) || 'Unknown',
                  requestType: type as 'ISSUANCE' | 'RENEWAL' | 'UPDATE' | 'REVOCATION',
                  requestedDate:
                    (item.createdAt as string) ||
                    (item.created_at as string) ||
                    new Date().toISOString(),
                  status: (((item.status as string) || 'PENDING').charAt(0) +
                    ((item.status as string) || 'PENDING').slice(1).toLowerCase()) as
                    | 'Pending'
                    | 'Approved'
                    | 'Rejected',
                };
              });

              console.log(`${type} - Mapped ${mappedData.length} items:`, mappedData);
              allRequests.push(...mappedData);
            } else {
              console.warn(`${type} - Unexpected response structure`);
            }
          } else if (response.status === 422) {
            // 422 might mean this request type is not supported or has validation issues
            console.warn(
              `Request type ${type} returned 422 - might not be supported or have no data`
            );
          } else {
            const errorData = await response.json().catch(() => null);
            console.error(`Error fetching ${type} requests:`, response.status, errorData);
          }
        } catch (error) {
          console.error(`Error fetching ${type} requests:`, error);
        }
      }

      // Sort by requested date (latest first)
      allRequests.sort((a, b) => {
        return new Date(b.requestedDate).getTime() - new Date(a.requestedDate).getTime();
      });

      console.log('FINAL allRequests array:', allRequests);
      console.log('Total requests found:', allRequests.length);

      setRequests(allRequests);
      setFilteredRequests(allRequests);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
    const filtered = requests.filter((request) => {
      const searchLower = value.toLowerCase();
      return (
        request.id.toLowerCase().includes(searchLower) ||
        request.credentialType.toLowerCase().includes(searchLower) ||
        request.issuerDid.toLowerCase().includes(searchLower) ||
        request.requestType.toLowerCase().includes(searchLower) ||
        request.status.toLowerCase().includes(searchLower)
      );
    });
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

  const applyFilters = (
    status: 'all' | 'Pending' | 'Approved' | 'Rejected',
    requestType: 'all' | 'ISSUANCE' | 'RENEWAL' | 'UPDATE' | 'REVOCATION',
    type: string
  ) => {
    let filtered = requests;

    if (status !== 'all') {
      filtered = filtered.filter((request) => request.status === status);
    }

    if (requestType !== 'all') {
      filtered = filtered.filter((request) => request.requestType === requestType);
    }

    if (type) {
      filtered = filtered.filter((request) =>
        request.credentialType.toLowerCase().includes(type.toLowerCase())
      );
    }

    setFilteredRequests(filtered);
  };

  const handleStatusChange = (status: 'all' | 'Pending' | 'Approved' | 'Rejected') => {
    setFilterStatus(status);
    applyFilters(status, filterRequestType, filterType);
  };

  const handleRequestTypeChange = (
    requestType: 'all' | 'ISSUANCE' | 'RENEWAL' | 'UPDATE' | 'REVOCATION'
  ) => {
    setFilterRequestType(requestType);
    applyFilters(filterStatus, requestType, filterType);
  };

  const handleTypeChange = (type: string) => {
    setFilterType(type);
    applyFilters(filterStatus, filterRequestType, type);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'Approved':
        return 'bg-green-100 text-green-700';
      case 'Rejected':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getRequestTypeColor = (type: string) => {
    switch (type) {
      case 'ISSUANCE':
        return 'bg-blue-100 text-blue-700';
      case 'RENEWAL':
        return 'bg-purple-100 text-purple-700';
      case 'UPDATE':
        return 'bg-orange-100 text-orange-700';
      case 'REVOCATION':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const columns: Column<CredentialRequest>[] = [
    {
      id: 'credentialType',
      label: 'REQUEST ID',
      sortKey: 'credentialType',
      render: (row) => (
        <ThemedText className="text-sm font-medium text-gray-900">{row.id}</ThemedText>
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
      id: 'requestedDate',
      label: 'REQUESTED DATE',
      sortKey: 'requestedDate',
      render: (row) => (
        <ThemedText className="text-sm text-gray-900">{formatDate(row.requestedDate)}</ThemedText>
      ),
    },
    {
      id: 'requestType',
      label: 'REQUEST TYPE',
      sortKey: 'requestType',
      render: (row) => (
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getRequestTypeColor(row.requestType)}`}
        >
          {row.requestType}
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
    <InstitutionLayout activeTab="my-request">
      <div className="p-12">
        <ThemedText fontSize={40} fontWeight={700} className="text-black mb-8">
          My Request
        </ThemedText>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-6 mb-8 pt-4">
          <div className="bg-blue-50 grid grid-row-2 rounded-2xl p-6">
            <ThemedText className="text-sm text-gray-600 mb-2">Total Requests</ThemedText>
            <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
              {isLoading ? 0 : requests.length}
            </ThemedText>
          </div>
          <div className="bg-blue-50 grid grid-row-2 rounded-2xl p-6">
            <ThemedText className="text-sm text-gray-600 mb-2">Pending</ThemedText>
            <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
              {isLoading ? 0 : pendingCount}
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
            data={filteredRequests}
            columns={columns}
            onFilter={handleFilter}
            searchPlaceholder="Search..."
            onSearch={handleSearch}
            enableSelection={true}
            totalCount={filteredRequests.length}
            rowsPerPageOptions={[5, 10, 25, 50, 100]}
            idKey="id"
            topRightButtons={
              <div className="flex gap-3 items-center">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <ThemedText fontSize={12} className="text-gray-500">
                    Last updated: {formatTime(lastRefresh)}
                  </ThemedText>
                </div>
                <button
                  onClick={async () => {
                    setIsLoading(true);
                    try {
                      await fetchRequests();
                    } finally {
                      setIsLoading(false);
                    }
                  }}
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
              value={filterStatus}
              onChange={(e) =>
                handleStatusChange(e.target.value as 'all' | 'Pending' | 'Approved' | 'Rejected')
              }
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-black"
            >
              <option value="all">All</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          {/* Request Type Filter */}
          <div className="mb-4">
            <ThemedText className="block text-sm font-medium text-gray-900 mb-2">
              Request Type
            </ThemedText>
            <select
              value={filterRequestType}
              onChange={(e) =>
                handleRequestTypeChange(
                  e.target.value as 'all' | 'ISSUANCE' | 'RENEWAL' | 'UPDATE' | 'REVOCATION'
                )
              }
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-black"
            >
              <option value="all">All</option>
              <option value="ISSUANCE">Issuance</option>
              <option value="RENEWAL">Renewal</option>
              <option value="UPDATE">Update</option>
              <option value="REVOCATION">Revocation</option>
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
    </InstitutionLayout>
  );
}
