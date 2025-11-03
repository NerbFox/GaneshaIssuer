'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import InstitutionLayout from '@/components/InstitutionLayout';
import { ThemedText } from '@/components/ThemedText';
import { DataTable, Column } from '@/components/DataTable';
import { redirectIfJWTInvalid } from '@/utils/auth';

interface SharedCredential {
  id: string;
  credentialType: string;
  holderDid: string;
  sharedDate: string;
  expiryDate: string;
  status: 'Active' | 'Expired' | 'Revoked';
  verified: boolean;
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

  const filterModalRef = useRef<HTMLDivElement>(null);

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
    </InstitutionLayout>
  );
}
