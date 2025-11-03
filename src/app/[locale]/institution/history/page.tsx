'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import InstitutionLayout from '@/components/InstitutionLayout';
import { ThemedText } from '@/components/ThemedText';
import { DataTable, Column } from '@/components/DataTable';
import { redirectIfJWTInvalid } from '@/utils/auth';
import { API_ENDPOINTS, buildApiUrlWithParams } from '@/utils/api';

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
  success: boolean;
  message: string;
  data: {
    message: string;
    count: number;
    data: IssueRequest[];
  };
}

interface HistoryActivity {
  id: string;
  activityType: 'Issued' | 'Revoked';
  credentialType: string;
  targetDid: string;
  timestamp: string;
  status: 'APPROVED' | 'REJECTED';
}

export default function HistoryPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activities, setActivities] = useState<HistoryActivity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<HistoryActivity[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterActivityType, setFilterActivityType] = useState<
    'all' | 'Issued' | 'Revoked'
  >('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterButtonPosition, setFilterButtonPosition] = useState({ top: 0, left: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const filterModalRef = useRef<HTMLDivElement>(null);

  const totalActivities = activities.length;
  const approvedCount = activities.filter((a) => a.status === 'APPROVED').length;

  // Helper function to parse encrypted_body
  const parseEncryptedBody = (
    encryptedBody: string
  ): { schema_id: string; schema_version: number } | null => {
    try {
      const parsed = JSON.parse(encryptedBody);
      return {
        schema_id: parsed.schema_id || '',
        schema_version: parsed.schema_version || 1,
      };
    } catch (error) {
      console.error('Failed to parse encrypted_body:', error);
      return null;
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

  // Fetch APPROVED and REJECTED requests from API
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const issuerDid = localStorage.getItem('institutionDID');
        if (!issuerDid) {
          throw new Error('Institution DID not found. Please log in again.');
        }

        const url = buildApiUrlWithParams(API_ENDPOINTS.CREDENTIAL.GET_REQUESTS, {
          type: 'ISSUANCE',
          issuer_did: issuerDid,
        });

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            accept: 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch history');
        }

        const apiResponse: ApiResponse = await response.json();

        // Extract the actual data array from nested structure
        const requestsData = apiResponse.data.data;

        // Filter to show only APPROVED and REJECTED requests
        const historyRequests = requestsData.filter(
          (r) => r.status === 'APPROVED' || r.status === 'REJECTED'
        );

        // Transform to HistoryActivity format
        const transformedActivities: HistoryActivity[] = historyRequests.map((request) => {
          const parsedBody = parseEncryptedBody(request.encrypted_body);
          const schemaId = parsedBody?.schema_id || 'Unknown Schema';

          return {
            id: request.id,
            activityType: request.status === 'APPROVED' ? 'Issued' : 'Revoked',
            credentialType: schemaId,
            targetDid: request.holder_did,
            timestamp: request.updatedAt,
            status: request.status as 'APPROVED' | 'REJECTED',
          };
        });

        console.log('Fetched history:', transformedActivities);
        setActivities(transformedActivities);
        setFilteredActivities(transformedActivities);
      } catch (err) {
        console.error('Error fetching history:', err);
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
        activity.activityType.toLowerCase().includes(searchLower) ||
        activity.credentialType.toLowerCase().includes(searchLower) ||
        activity.targetDid.toLowerCase().includes(searchLower)
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
    activityType: 'all' | 'Issued' | 'Revoked',
    dateFrom: string,
    dateTo: string
  ) => {
    let filtered = activities;

    if (activityType !== 'all') {
      filtered = filtered.filter((activity) => activity.activityType === activityType);
    }

    if (dateFrom) {
      filtered = filtered.filter((activity) => new Date(activity.timestamp) >= new Date(dateFrom));
    }

    if (dateTo) {
      filtered = filtered.filter((activity) => new Date(activity.timestamp) <= new Date(dateTo));
    }

    setFilteredActivities(filtered);
  };

  const handleActivityTypeChange = (
    activityType: 'all' | 'Issued' | 'Revoked'
  ) => {
    setFilterActivityType(activityType);
    applyFilters(activityType, filterDateFrom, filterDateTo);
  };

  const handleDateFromChange = (dateFrom: string) => {
    setFilterDateFrom(dateFrom);
    applyFilters(filterActivityType, dateFrom, filterDateTo);
  };

  const handleDateToChange = (dateTo: string) => {
    setFilterDateTo(dateTo);
    applyFilters(filterActivityType, filterDateFrom, dateTo);
  };

  const handleView = (id: string) => {
    console.log('View activity:', id);
    // TODO: Implement view activity details
  };

  const getActivityTypeColor = (type: string) => {
    switch (type) {
      case 'Issued':
        return 'bg-green-100 text-green-700';
      case 'Revoked':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-700';
      case 'REJECTED':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const columns: Column<HistoryActivity>[] = [
    {
      id: 'activityType',
      label: 'ACTIVITY TYPE',
      sortKey: 'activityType',
      render: (row) => (
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getActivityTypeColor(row.activityType)}`}
        >
          {row.activityType}
        </span>
      ),
    },
    {
      id: 'credentialType',
      label: 'CREDENTIAL TYPE',
      sortKey: 'credentialType',
      render: (row) => (
        <ThemedText className="text-sm font-medium text-gray-900">{row.credentialType}</ThemedText>
      ),
    },
    {
      id: 'targetDid',
      label: 'TARGET DID',
      sortKey: 'targetDid',
      render: (row) => (
        <ThemedText className="text-sm text-gray-900">
          {row.targetDid.substring(0, 25)}...
        </ThemedText>
      ),
    },
    {
      id: 'timestamp',
      label: 'TIMESTAMP',
      sortKey: 'timestamp',
      render: (row) => (
        <ThemedText className="text-sm text-gray-900">{formatDateTime(row.timestamp)}</ThemedText>
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
        <button
          onClick={() => handleView(row.id)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
        >
          VIEW
        </button>
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

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
              <ThemedText className="text-gray-600">Loading history...</ThemedText>
            </div>
          </div>
        ) : (
          <>
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

            {/* Data Table */}
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
              Filter History
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

          {/* Activity Type Filter */}
          <div className="mb-4">
            <ThemedText className="block text-sm font-medium text-gray-900 mb-2">
              Activity Type
            </ThemedText>
            <select
              value={filterActivityType}
              onChange={(e) =>
                handleActivityTypeChange(
                  e.target.value as 'all' | 'Issued' | 'Revoked'
                )
              }
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="all">All Activities</option>
              <option value="Issued">Issued</option>
              <option value="Revoked">Revoked</option>
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
