'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import InstitutionLayout from '@/components/shared/InstitutionLayout';
import { DataTable, Column } from '@/components/shared/DataTable';
import Modal from '@/components/shared/Modal';
import { redirectIfJWTInvalid } from '@/utils/auth';
import { formatDate, formatTime } from '@/utils/dateUtils';
import { buildApiUrlWithParams, API_ENDPOINTS } from '@/utils/api';
import { authenticatedGet } from '@/utils/api-client';

interface RequestedCredential {
  schema_id: string;
  schema_name: string;
  schema_version: number;
}

interface VerificationRequest {
  id: string;
  holder_did: string;
  verifier_did: string;
  verifier_name: string;
  purpose: string;
  status: 'PENDING' | 'ACCEPT' | 'DECLINE';
  requested_credentials: RequestedCredential[];
  vp_id: string | null;
  verify_status: string;
  createdAt: string;
  updatedAt: string;
}

export default function VerifyRequestPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<VerificationRequest[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<
    'all' | 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'VERIFIED' | 'NOT_VERIFIED'
  >('all');
  const [filterType, setFilterType] = useState('');
  const [filterButtonPosition, setFilterButtonPosition] = useState({ top: 0, left: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [copyNotification, setCopyNotification] = useState(false);

  const filterModalRef = useRef<HTMLDivElement>(null);

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;
  const acceptedCount = requests.filter((r) => r.status === 'ACCEPT').length;
  const rejectedCount = requests.filter((r) => r.status === 'DECLINE').length;
  const verifiedCount = requests.filter((r) => r.verify_status === 'VALID_VERIFICATION').length;

  // Fetch verification requests from API
  const fetchVerificationRequests = async () => {
    try {
      setIsLoading(true);
      const institutionDID = localStorage.getItem('institutionDID');

      if (!institutionDID) {
        console.error('No institution DID found');
        return;
      }

      const url = buildApiUrlWithParams(API_ENDPOINTS.PRESENTATIONS.REQUEST, {
        verifier_did: institutionDID,
      });

      const response = await authenticatedGet(url);
      const result = await response.json();

      if (result.success && result.data?.requests) {
        setRequests(result.data.requests);
        setFilteredRequests(result.data.requests);
        setLastRefresh(new Date());
      }
    } catch (error) {
      console.error('Error fetching verification requests:', error);
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
        await fetchVerificationRequests();
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
        request.purpose.toLowerCase().includes(searchLower) ||
        request.holder_did.toLowerCase().includes(searchLower) ||
        request.status.toLowerCase().includes(searchLower) ||
        request.requested_credentials.some((cred) =>
          cred.schema_name.toLowerCase().includes(searchLower)
        )
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
    status: 'all' | 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'VERIFIED' | 'NOT_VERIFIED',
    type: string
  ) => {
    let filtered = requests;

    if (status !== 'all') {
      if (status === 'PENDING') {
        filtered = filtered.filter((request) => request.status === 'PENDING');
      } else if (status === 'ACCEPTED') {
        filtered = filtered.filter((request) => request.status === 'ACCEPT');
      } else if (status === 'REJECTED') {
        filtered = filtered.filter((request) => request.status === 'DECLINE');
      } else if (status === 'VERIFIED') {
        filtered = filtered.filter((request) => request.verify_status === 'VALID_VERIFICATION');
      } else if (status === 'NOT_VERIFIED') {
        filtered = filtered.filter(
          (request) =>
            request.verify_status !== 'VALID_VERIFICATION' && request.verify_status !== ''
        );
      }
    }

    if (type) {
      filtered = filtered.filter((request) =>
        request.requested_credentials.some((cred) =>
          cred.schema_name.toLowerCase().includes(type.toLowerCase())
        )
      );
    }

    setFilteredRequests(filtered);
  };

  const handleStatusChange = (
    status: 'all' | 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'VERIFIED' | 'NOT_VERIFIED'
  ) => {
    setFilterStatus(status);
    applyFilters(status, filterType);
  };

  const handleTypeChange = (type: string) => {
    setFilterType(type);
    applyFilters(filterStatus, type);
  };

  const toggleRowExpansion = (id: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set<string>();
      // If clicking the same row, close it. Otherwise, open the new row
      if (!prev.has(id)) {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleViewDetails = (request: VerificationRequest) => {
    setSelectedRequest(request);
    setShowDetailsModal(true);
  };

  const handleCopyDID = (did: string) => {
    navigator.clipboard.writeText(did);
    setCopyNotification(true);
    setTimeout(() => setCopyNotification(false), 2000);
  };

  // Define columns for DataTable
  const columns: Column<VerificationRequest>[] = [
    {
      id: 'purpose',
      label: 'PURPOSE',
      sortKey: 'purpose',
      render: (row) => <span className="text-sm font-medium text-gray-900">{row.purpose}</span>,
    },
    {
      id: 'holder_did',
      label: 'HOLDER DID',
      sortKey: 'holder_did',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 font-mono">
            {row.holder_did.substring(0, 20)}...
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopyDID(row.holder_did);
            }}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Copy DID"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </button>
        </div>
      ),
    },
    {
      id: 'credentials',
      label: 'CREDENTIALS REQUESTED',
      render: (row) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {row.requested_credentials.length} credential
          {row.requested_credentials.length !== 1 ? 's' : ''}
        </span>
      ),
    },
    {
      id: 'status',
      label: 'STATUS',
      sortKey: 'status',
      render: (row) => (
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
            row.status
          )}`}
        >
          {getStatusDisplay(row.status)}
        </span>
      ),
    },
    {
      id: 'createdAt',
      label: 'CREATED AT',
      sortKey: 'createdAt',
      render: (row) => <span className="text-sm text-gray-600">{formatDate(row.createdAt)}</span>,
    },
    {
      id: 'action',
      label: 'ACTION',
      render: (row) => (
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleViewDetails(row);
            }}
            className="px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-xs font-medium"
          >
            View Details
          </button>
        </div>
      ),
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-700';
      case 'ACCEPT':
        return 'bg-green-100 text-green-700';
      case 'DECLINE':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'Pending';
      case 'ACCEPT':
        return 'Accepted';
      case 'DECLINE':
        return 'Declined';
      case 'VERIFIED':
        return 'Verified';
      default:
        return status;
    }
  };

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
    <InstitutionLayout activeTab="verify-request">
      <div className="p-12">
        <span className="text-[40px] font-bold text-black mb-8">Verify Request</span>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
            </div>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8 pt-4">
              <div className="bg-blue-50 grid grid-row-2 rounded-2xl p-6">
                <span className="text-sm text-gray-600 mb-2">Total Requests</span>
                <span className="text-[32px] font-semibold text-gray-900">{requests.length}</span>
              </div>
              <div className="bg-yellow-50 grid grid-row-2 rounded-2xl p-6">
                <ThemedText className="text-sm text-gray-600 mb-2">Pending</ThemedText>
                <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
                  {pendingCount}
                </ThemedText>
              </div>
              <div className="bg-purple-50 grid grid-row-2 rounded-2xl p-6">
                <ThemedText className="text-sm text-gray-600 mb-2">Accepted</ThemedText>
                <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
                  {acceptedCount}
                </ThemedText>
              </div>
              <div className="bg-red-50 grid grid-row-2 rounded-2xl p-6">
                <ThemedText className="text-sm text-gray-600 mb-2">Rejected</ThemedText>
                <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
                  {rejectedCount}
                </ThemedText>
              </div>
              <div className="bg-green-50 grid grid-row-2 rounded-2xl p-6">
                <ThemedText className="text-sm text-gray-600 mb-2">Verified</ThemedText>
                <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
                  {verifiedCount}
                </ThemedText>
              </div>
            </div>

            {/* DataTable with expandable rows */}
            <DataTable
              data={filteredRequests}
              columns={columns}
              onFilter={handleFilter}
              searchPlaceholder="Search by purpose, holder DID, or credential type..."
              onSearch={handleSearch}
              enableSelection={false}
              totalCount={filteredRequests.length}
              rowsPerPageOptions={[5, 10, 25, 50, 100]}
              idKey="id"
              defaultSortColumn="createdAt"
              defaultSortDirection="desc"
              topRightButtons={
                <div className="flex gap-3 items-center">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="text-xs text-gray-500">
                      Last updated: {formatTime(lastRefresh)}
                    </span>
                  </div>
                  <button
                    onClick={async () => {
                      setIsLoading(true);
                      try {
                        await fetchVerificationRequests();
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
              expandableRows={{
                expandedRowId: expandedRows.size === 1 ? Array.from(expandedRows)[0] : null,
                renderExpandedContent: (row) => (
                  <div className="space-y-3 py-4">
                    <span className="text-gray-900 mb-3">Requested Credentials</span>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
                      {row.requested_credentials.map((cred, index) => (
                        <div
                          key={`${cred.schema_id}-${index}`}
                          className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <span className="text-[32px] font-semibold text-gray-900">
                              {cred.schema_name}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-xs text-gray-600">
                              v{cred.schema_version}
                            </span>
                          </div>
                          <span className="text-gray-500 font-mono break-all">
                            {cred.schema_id}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="grid grid-cols-2 gap-6 text-sm">
                        <div className="space-x-3">
                          <span className="text-gray-500">Verify Status:</span>
                          <span className="text-[32px] font-semibold text-gray-900">
                            {row.verify_status}
                          </span>
                        </div>
                        <div className="space-x-3">
                          <span className="text-gray-500">Last Updated:</span>
                          <span className="text-[32px] font-semibold text-gray-900">
                            {formatDate(row.updatedAt)}
                          </span>
                        </div>
                        {row.vp_id && (
                          <div className="col-span-2 space-x-3">
                            <span className="text-gray-500">VP ID:</span>
                            <span className="text-gray-900 font-mono break-all">{row.vp_id}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ),
              }}
              onRowClick={(row) => toggleRowExpansion(row.id)}
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
            <span className="text-[32px] font-semibold text-gray-900">Filter Requests</span>
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
            <span className="block text-sm font-medium text-gray-900 mb-2">Status</span>
            <select
              value={filterStatus}
              onChange={(e) =>
                handleStatusChange(
                  e.target.value as
                    | 'all'
                    | 'PENDING'
                    | 'ACCEPTED'
                    | 'REJECTED'
                    | 'VERIFIED'
                    | 'NOT_VERIFIED'
                )
              }
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-black cursor-pointer"
            >
              <option value="all">All</option>
              <option value="PENDING">Pending</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="REJECTED">Rejected</option>
              <option value="VERIFIED">Verified</option>
              <option value="NOT_VERIFIED">Not Verified</option>
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <span className="block text-sm font-medium text-gray-900 mb-2">Credential Type</span>
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

      {/* Details Modal */}
      <Modal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title="Verification Request Details"
        maxWidth="1000px"
        minHeight="400px"
      >
        {selectedRequest && (
          <div className="px-8 py-6 space-y-6">
            {/* Request Information */}
            <div className="bg-gray-50 rounded-xl p-6">
              <p className="text-base font-semibold text-gray-900 mb-4">Request Information</p>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-x-3">
                  <span className="text-sm text-gray-500">Request ID</span>
                  <span className="text-sm font-mono text-gray-900 break-all">
                    {selectedRequest.id}
                  </span>
                </div>
                <div className="space-x-3">
                  <span className="text-sm text-gray-500">Status</span>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                      selectedRequest.status
                    )}`}
                  >
                    {getStatusDisplay(selectedRequest.status)}
                  </span>
                </div>
                <div className="space-x-3">
                  <span className="text-sm text-gray-500">Purpose</span>
                  <span className="text-[32px] font-semibold text-gray-900">
                    {selectedRequest.purpose}
                  </span>
                </div>
                <div className="space-x-3">
                  <span className="text-sm text-gray-500">Verify Status</span>
                  <span className="text-[32px] font-semibold text-gray-900">
                    {selectedRequest.verify_status}
                  </span>
                </div>
                <div className="space-x-3">
                  <span className="text-sm text-gray-500">Created At</span>
                  <span className="text-gray-900">{formatDate(selectedRequest.createdAt)}</span>
                </div>
                <div className="space-x-3">
                  <span className="text-sm text-gray-500">Updated At</span>
                  <span className="text-gray-900">{formatDate(selectedRequest.updatedAt)}</span>
                </div>
              </div>
            </div>

            {/* Holder Information */}
            <div className="bg-blue-50 rounded-xl p-6">
              <p className="text-base font-semibold text-gray-900 mb-4">Holder Information</p>
              <div className="space-y-3">
                <span className="text-sm text-gray-500">Holder DID</span>
                <div className="flex items-center gap-2 bg-white rounded-lg p-3 border border-blue-200">
                  <span className="text-sm font-mono text-gray-900 break-all flex-1">
                    {selectedRequest.holder_did}
                  </span>
                  <button
                    onClick={() => handleCopyDID(selectedRequest.holder_did)}
                    className="text-blue-500 hover:text-blue-700 transition-colors flex-shrink-0"
                    title="Copy DID"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Verifier Information */}
            <div className="bg-green-50 rounded-xl p-6">
              <p className="text-base font-semibold text-gray-900 mb-4">Verifier Information</p>
              <div className="space-y-4">
                <div className="space-x-3">
                  <span className="text-sm text-gray-500">Verifier Name</span>
                  <span className="text-[32px] font-semibold text-gray-900">
                    {selectedRequest.verifier_name}
                  </span>
                </div>
                <div className="space-y-3">
                  <span className="text-sm text-gray-500">Verifier DID</span>
                  <div className="flex items-center gap-2 bg-white rounded-lg p-3 border border-green-200">
                    <span className="text-sm font-mono text-gray-900 break-all flex-1">
                      {selectedRequest.verifier_did}
                    </span>
                    <button
                      onClick={() => handleCopyDID(selectedRequest.verifier_did)}
                      className="text-green-500 hover:text-green-700 transition-colors flex-shrink-0"
                      title="Copy DID"
                    >
                      <svg
                        className="w-5 h-5"
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
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Requested Credentials */}
            <div>
              <p className="text-base font-semibold text-gray-900 mb-4">
                Requested Credentials ({selectedRequest.requested_credentials.length})
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
                {selectedRequest.requested_credentials.map((cred, index) => (
                  <div
                    key={`${cred.schema_id}-${index}`}
                    className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-[32px] font-semibold text-gray-900">
                        {cred.schema_name}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        v{cred.schema_version}
                      </span>
                    </div>
                    <div className="space-x-3">
                      <span className="text-xs text-gray-500">Schema ID</span>
                      <span className="text-xs font-mono text-gray-600 break-all bg-gray-50 p-2 rounded">
                        {cred.schema_id}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedRequest.vp_id && (
              <div className="bg-purple-50 rounded-xl p-6">
                <p className="text-base font-semibold text-gray-900 mb-4">
                  Presentation Information
                </p>
                <div className="space-x-3 space-y-5 pt-5">
                  <span className="text-sm text-gray-500">VP ID</span>
                  <span className="text-sm font-mono text-gray-900 break-all bg-white p-3 rounded-lg border border-purple-200">
                    {selectedRequest.vp_id}
                  </span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-6 pt-6 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Copy Notification Toast */}
      {copyNotification && (
        <div className="fixed bottom-8 right-8 bg-gray-900 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-fade-in">
          <svg
            className="w-5 h-5 text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-white">DID copied to clipboard!</span>
        </div>
      )}
    </InstitutionLayout>
  );
}
