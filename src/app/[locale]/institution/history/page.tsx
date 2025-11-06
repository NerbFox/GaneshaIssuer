'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import InstitutionLayout from '@/components/InstitutionLayout';
import { ThemedText } from '@/components/ThemedText';
import { DataTable, Column } from '@/components/DataTable';
import { redirectIfJWTInvalid } from '@/utils/auth';
import { API_ENDPOINTS, buildApiUrlWithParams, buildApiUrl } from '@/utils/api';
import { authenticatedGet } from '@/utils/api-client';
import { decryptWithPrivateKey } from '@/utils/encryptUtils';

interface HistoryRequest {
  id: string;
  request_type: string;
  issuer_did: string;
  holder_did: string;
  status: string;
  encrypted_body: string;
  createdAt: string;
}

interface SchemaApiResponse {
  success: boolean;
  message: string;
  data: {
    id: string;
    name: string;
    version: number;
  };
}

interface ApiResponse {
  success: boolean;
  message: string;
  data: {
    count: number;
    requests: HistoryRequest[];
  };
}

interface HistoryActivity {
  id: string;
  date: string;
  holderDid: string;
  requestType: string;
  actionType: string;
  status: string;
  schemaName: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activities, setActivities] = useState<HistoryActivity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<HistoryActivity[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterActionType, setFilterActionType] = useState<
    'all' | 'PENDING' | 'APPROVED' | 'REJECTED'
  >('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterButtonPosition, setFilterButtonPosition] = useState({ top: 0, left: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filterModalRef = useRef<HTMLDivElement>(null);

  const totalActivities = activities.length;
  const approvedCount = activities.filter((a) => a.actionType === 'APPROVED').length;

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

  // Fetch history from issuer-history API endpoint
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchHistory = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const issuerDid = localStorage.getItem('institutionDID');
        if (!issuerDid) {
          throw new Error('Institution DID not found. Please log in again.');
        }

        const url = buildApiUrlWithParams(API_ENDPOINTS.CREDENTIALS.ISSUER_HISTORY, {
          issuer_did: issuerDid,
        });

        const response = await authenticatedGet(url);

        if (!response.ok) {
          throw new Error('Failed to fetch history');
        }

        const apiResponse: ApiResponse = await response.json();

        // Extract the requests array
        const requestsData = apiResponse.data.requests;

        // Helper function to parse encrypted_body - attempts decryption with private key
        const parseEncryptedBody = async (
          encryptedBody: string
        ): Promise<{ schema_id: string; schema_version: number } | null> => {
          // Only decrypt if we have a private key available
          if (typeof window !== 'undefined') {
            const privateKeyHex = localStorage.getItem('institutionSigningPrivateKey');
            if (privateKeyHex) {
              try {
                const decryptedBody = await decryptWithPrivateKey(encryptedBody, privateKeyHex);
                return {
                  schema_id: String(decryptedBody.schema_id || ''),
                  schema_version: Number(decryptedBody.schema_version || 1),
                };
              } catch {
                // Silently handle decryption error - do nothing
              }
            }
          }

          // If no private key available or not in browser, silently return null
          return null;
        };

        // Extract unique schema IDs for batch fetching
        const schemaIds = new Set<string>();
        for (const request of requestsData) {
          const parsedBody = await parseEncryptedBody(request.encrypted_body);
          if (parsedBody?.schema_id) {
            schemaIds.add(parsedBody.schema_id);
          }
        }

        // Fetch all schemas in parallel
        const schemaNameMap = new Map<string, string>();
        const schemaFetchPromises = Array.from(schemaIds).map(async (schemaId) => {
          try {
            // Get schema version from encrypted_body or default to version 1
            const request = await Promise.all(
              requestsData.map(async (r) => {
                const parsed = await parseEncryptedBody(r.encrypted_body);
                return parsed?.schema_id === schemaId ? r : null;
              })
            ).then((results) => results.find((r) => r !== null));

            const parsedBody = await parseEncryptedBody(request?.encrypted_body || '');
            const schemaVersion = parsedBody?.schema_version || 1;

            const schemaUrl = buildApiUrl(
              API_ENDPOINTS.SCHEMAS.BY_VERSION(schemaId, schemaVersion)
            );
            const schemaResponse = await authenticatedGet(schemaUrl);
            if (schemaResponse.ok) {
              const schemaData: SchemaApiResponse = await schemaResponse.json();
              schemaNameMap.set(schemaId, schemaData.data.name);
            }
          } catch (err) {
            console.error(`Error fetching schema ${schemaId}:`, err);
          }
        });
        await Promise.all(schemaFetchPromises);

        // Transform to HistoryActivity format
        const transformedActivities: HistoryActivity[] = await Promise.all(
          requestsData.map(async (request) => {
            const parsedBody = await parseEncryptedBody(request.encrypted_body);
            const schemaId = parsedBody?.schema_id || '';
            const schemaName = schemaNameMap.get(schemaId) || 'Unknown Schema';

            return {
              id: request.id,
              date: request.createdAt,
              holderDid: request.holder_did,
              requestType: request.request_type,
              actionType: request.status,
              status: request.status,
              schemaName: schemaName,
            };
          })
        );

        console.log('Fetched history:', transformedActivities);
        setActivities(transformedActivities);
        setFilteredActivities(transformedActivities);
      } catch (err) {
        console.error('Error fetching history:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
        setActivities([]);
        setFilteredActivities([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
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
    const filtered = activities.filter((activity) => {
      const searchLower = value.toLowerCase();
      return (
        activity.requestType.toLowerCase().includes(searchLower) ||
        activity.actionType.toLowerCase().includes(searchLower) ||
        activity.holderDid.toLowerCase().includes(searchLower) ||
        activity.schemaName.toLowerCase().includes(searchLower)
      );
    });
    setFilteredActivities(filtered);
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
    actionType: 'all' | 'PENDING' | 'APPROVED' | 'REJECTED',
    dateFrom: string,
    dateTo: string
  ) => {
    let filtered = activities;

    if (actionType !== 'all') {
      filtered = filtered.filter((activity) => activity.actionType === actionType);
    }

    if (dateFrom) {
      filtered = filtered.filter((activity) => new Date(activity.date) >= new Date(dateFrom));
    }

    if (dateTo) {
      filtered = filtered.filter((activity) => new Date(activity.date) <= new Date(dateTo));
    }

    setFilteredActivities(filtered);
  };

  const handleActionTypeChange = (actionType: 'all' | 'PENDING' | 'APPROVED' | 'REJECTED') => {
    setFilterActionType(actionType);
    applyFilters(actionType, filterDateFrom, filterDateTo);
  };

  const handleDateFromChange = (dateFrom: string) => {
    setFilterDateFrom(dateFrom);
    applyFilters(filterActionType, dateFrom, filterDateTo);
  };

  const handleDateToChange = (dateTo: string) => {
    setFilterDateTo(dateTo);
    applyFilters(filterActionType, filterDateFrom, dateTo);
  };

  const getActionTypeColor = (type: string) => {
    switch (type) {
      case 'APPROVED':
        return 'bg-green-100 text-green-700';
      case 'REJECTED':
        return 'bg-red-100 text-red-700';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getRequestTypeColor = (type: string) => {
    switch (type.toUpperCase()) {
      case 'ISSUANCE':
        return 'bg-blue-100 text-blue-700';
      case 'RENEWAL':
        return 'bg-purple-100 text-purple-700';
      case 'UPDATE':
        return 'bg-cyan-100 text-cyan-700';
      case 'REVOCATION':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const datePart = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const timePart = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    return `${datePart} ${timePart}`;
  };

  const truncateDid = (did: string, maxLength: number = 25): string => {
    if (did.length <= maxLength) {
      return did;
    }
    return did.substring(0, maxLength) + '...';
  };

  const formatText = (text: string): string => {
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  };

  const columns: Column<HistoryActivity>[] = [
    {
      id: 'date',
      label: 'DATETIME',
      sortKey: 'date',
      render: (row) => (
        <ThemedText className="text-sm text-gray-900">{formatDateTime(row.date)}</ThemedText>
      ),
    },
    {
      id: 'holderDid',
      label: 'HOLDER DID',
      sortKey: 'holderDid',
      render: (row) => (
        <ThemedText className="text-sm text-gray-900">{truncateDid(row.holderDid)}</ThemedText>
      ),
    },
    {
      id: 'schemaName',
      label: 'SCHEMA NAME',
      sortKey: 'schemaName',
      render: (row) => <ThemedText className="text-sm text-gray-900">{row.schemaName}</ThemedText>,
    },
    {
      id: 'requestType',
      label: 'REQUEST TYPE',
      sortKey: 'requestType',
      render: (row) => (
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getRequestTypeColor(row.requestType)}`}
        >
          {formatText(row.requestType)}
        </span>
      ),
    },
    {
      id: 'actionType',
      label: 'ACTION TYPE',
      sortKey: 'actionType',
      render: (row) => (
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getActionTypeColor(row.actionType)}`}
        >
          {formatText(row.actionType)}
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
    <InstitutionLayout activeTab="history">
      <div className="p-12">
        <ThemedText fontSize={40} fontWeight={700} className="text-black mb-8">
          History
        </ThemedText>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-6 mb-8 pt-4">
          <div className="bg-blue-50 grid grid-row-2 rounded-2xl p-6">
            <ThemedText className="text-sm text-gray-600 mb-2">Total Activities</ThemedText>
            <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
              {totalActivities}
            </ThemedText>
          </div>
          <div className="bg-blue-50 grid grid-row-2 rounded-2xl p-6">
            <ThemedText className="text-sm text-gray-600 mb-2">Approved Requests</ThemedText>
            <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
              {approvedCount}
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
            data={filteredActivities}
            columns={columns}
            onFilter={handleFilter}
            searchPlaceholder="Search..."
            onSearch={handleSearch}
            enableSelection={true}
            totalCount={filteredActivities.length}
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
              Filter History
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

          {/* Action Type Filter */}
          <div className="mb-4">
            <ThemedText className="block text-sm font-medium text-gray-900 mb-2">
              Action Type
            </ThemedText>
            <select
              value={filterActionType}
              onChange={(e) =>
                handleActionTypeChange(
                  e.target.value as 'all' | 'PENDING' | 'APPROVED' | 'REJECTED'
                )
              }
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="all">All Actions</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* Date From Filter */}
          <div className="mb-4">
            <ThemedText className="block text-sm font-medium text-gray-900 mb-2">
              From Date
            </ThemedText>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => handleDateFromChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          {/* Date To Filter */}
          <div>
            <ThemedText className="block text-sm font-medium text-gray-900 mb-2">
              To Date
            </ThemedText>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => handleDateToChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
        </div>
      )}
    </InstitutionLayout>
  );
}
