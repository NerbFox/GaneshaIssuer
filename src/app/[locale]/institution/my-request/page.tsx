'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import InstitutionLayout from '@/components/InstitutionLayout';
import { ThemedText } from '@/components/ThemedText';
import { DataTable, Column } from '@/components/DataTable';
import { redirectIfJWTInvalid } from '@/utils/auth';

interface CredentialRequest {
  id: string;
  credentialType: string;
  issuerDid: string;
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
  const [filterType, setFilterType] = useState('');
  const [filterButtonPosition, setFilterButtonPosition] = useState({ top: 0, left: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const filterModalRef = useRef<HTMLDivElement>(null);

  const pendingCount = requests.filter((r) => r.status === 'Pending').length;
  const approvedCount = requests.filter((r) => r.status === 'Approved').length;

  // Check authentication with JWT verification on component mount
  useEffect(() => {
    const checkAuth = async () => {
      const redirected = await redirectIfJWTInvalid(router);
      if (!redirected) {
        setIsAuthenticated(true);
        setIsLoading(false);
        // TODO: Fetch requests from API
        // For now, using empty array
        setRequests([]);
        setFilteredRequests([]);
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
    const filtered = requests.filter((request) => {
      const searchLower = value.toLowerCase();
      return (
        request.credentialType.toLowerCase().includes(searchLower) ||
        request.issuerDid.toLowerCase().includes(searchLower) ||
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

  const applyFilters = (status: 'all' | 'Pending' | 'Approved' | 'Rejected', type: string) => {
    let filtered = requests;

    if (status !== 'all') {
      filtered = filtered.filter((request) => request.status === status);
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
    applyFilters(status, filterType);
  };

  const handleTypeChange = (type: string) => {
    setFilterType(type);
    applyFilters(filterStatus, type);
  };

  const handleView = (id: string) => {
    console.log('View request:', id);
    // TODO: Implement view request details
  };

  const handleCancel = (id: string) => {
    console.log('Cancel request:', id);
    // TODO: Implement cancel request
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

  const columns: Column<CredentialRequest>[] = [
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
      id: 'requestedDate',
      label: 'REQUESTED DATE',
      sortKey: 'requestedDate',
      render: (row) => (
        <ThemedText className="text-sm text-gray-900">{formatDate(row.requestedDate)}</ThemedText>
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
          {row.status === 'Pending' && (
            <button
              onClick={() => handleCancel(row.id)}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
            >
              CANCEL
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
    <InstitutionLayout activeTab="my-request">
      <div className="p-12">
        <ThemedText fontSize={40} fontWeight={700} className="text-black mb-8">
          My Request
        </ThemedText>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
              <ThemedText className="text-gray-600">Loading requests...</ThemedText>
            </div>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-6 mb-8 pt-4">
              <div className="bg-blue-50 grid grid-row-2 rounded-2xl p-6">
                <ThemedText className="text-sm text-gray-600 mb-2">Total Requests</ThemedText>
                <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
                  {requests.length}
                </ThemedText>
              </div>
              <div className="bg-blue-50 grid grid-row-2 rounded-2xl p-6">
                <ThemedText className="text-sm text-gray-600 mb-2">Pending</ThemedText>
                <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
                  {pendingCount}
                </ThemedText>
              </div>
            </div>

            {/* Data Table */}
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
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="all">All</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
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
    </InstitutionLayout>
  );
}
