'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import InstitutionLayout from '@/components/shared/InstitutionLayout';
import { ThemedText } from '@/components/shared/ThemedText';
import { DataTable, Column } from '@/components/shared/DataTable';
import { redirectIfJWTInvalid } from '@/utils/auth';
import { formatDate, formatTime } from '@/utils/dateUtils';
import { authenticatedGet, authenticatedPost } from '@/utils/api-client';
import { buildApiUrlWithParams, buildApiUrl, API_ENDPOINTS } from '@/utils/api';
import { ViewVPRequestModal } from '@/components/holder/ViewVPRequestModal';
import { getAllVCs, getSchemaDataByVCId } from '@/utils/indexedDB';
import { createVerifiablePresentation, signVPWithStoredKey } from '@/utils/vpSigner';
import InfoModal from '@/components/shared/InfoModal';

interface RequestedCredential {
  schema_id: string;
  schema_name: string;
  schema_version: number;
}

interface VPRequest {
  id: string;
  verifierDid: string;
  verifierName: string;
  purpose: string;
  requestedCredentials: RequestedCredential[];
  requestedDate: string;
  status: 'Pending' | 'Accepted' | 'Declined';
  verifyStatus: string;
}

export default function VPRequestPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [requests, setRequests] = useState<VPRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<VPRequest[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'Pending' | 'Accepted' | 'Declined'>(
    'all'
  );
  const [filterButtonPosition, setFilterButtonPosition] = useState({ top: 0, left: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [selectedRequest, setSelectedRequest] = useState<VPRequest | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoModalConfig, setInfoModalConfig] = useState({
    title: '',
    message: '',
    buttonColor: 'blue' as 'blue' | 'green' | 'red' | 'yellow',
    hideActions: false,
  });

  const filterModalRef = useRef<HTMLDivElement>(null);

  const pendingCount = requests.filter((r) => r.status === 'Pending').length;
  const acceptedCount = requests.filter((r) => r.status === 'Accepted').length;
  const declinedCount = requests.filter((r) => r.status === 'Declined').length;

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

  // Fetch VP requests from API
  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const institutionDID = localStorage.getItem('institutionDID');

      if (!institutionDID) {
        console.error('No institution DID found in localStorage');
        setIsLoading(false);
        return;
      }

      try {
        const url = buildApiUrlWithParams(API_ENDPOINTS.PRESENTATIONS.REQUEST, {
          holder_did: institutionDID,
        });

        console.log('Fetching VP requests from:', url);
        const response = await authenticatedGet(url);

        if (response.ok) {
          const responseData = await response.json();
          console.log('VP FULL RESPONSE:', JSON.stringify(responseData, null, 2));

          if (responseData.success && responseData.data && responseData.data.requests) {
            const items = responseData.data.requests;
            console.log(`Found ${items.length} VP request items`);

            const mappedData = items.map((item: Record<string, unknown>) => {
              return {
                id: item.id as string,
                verifierDid: (item.verifier_did as string) || 'Unknown',
                verifierName: (item.verifier_name as string) || 'Unknown',
                purpose: (item.purpose as string) || '',
                requestedCredentials: (item.requested_credentials as RequestedCredential[]) || [],
                requestedDate: (item.createdAt as string) || new Date().toISOString(),
                status: (() => {
                  const apiStatus = (item.status as string) || 'PENDING';
                  const upperStatus = apiStatus.toUpperCase();
                  // Map API status to display status
                  if (upperStatus === 'ACCEPT') return 'Accepted';
                  if (upperStatus === 'DECLINE') return 'Declined';
                  if (upperStatus === 'PENDING') return 'Pending';
                  // Default: capitalize first letter
                  return (apiStatus.charAt(0) + apiStatus.slice(1).toLowerCase()) as
                    | 'Pending'
                    | 'Accepted'
                    | 'Declined';
                })(),
                verifyStatus: (item.verify_status as string) || 'NOT_VERIFIED',
              };
            });

            // Sort by requested date (latest first)
            mappedData.sort((a: VPRequest, b: VPRequest) => {
              return new Date(b.requestedDate).getTime() - new Date(a.requestedDate).getTime();
            });

            console.log('Mapped VP requests:', mappedData);
            setRequests(mappedData);
            setFilteredRequests(mappedData);
            setLastRefresh(new Date());
          }
        } else {
          console.error('Error fetching VP requests:', response.status);
        }
      } catch (error) {
        console.error('Error fetching VP requests:', error);
      }
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
      const credentialsString = request.requestedCredentials
        .map((c) => c.schema_name)
        .join(' ')
        .toLowerCase();
      return (
        request.id.toLowerCase().includes(searchLower) ||
        request.verifierDid.toLowerCase().includes(searchLower) ||
        request.verifierName.toLowerCase().includes(searchLower) ||
        request.purpose.toLowerCase().includes(searchLower) ||
        credentialsString.includes(searchLower) ||
        request.status.toLowerCase().includes(searchLower)
      );
    });

    // Always sort by most recent first
    filtered.sort((a, b) => {
      return new Date(b.requestedDate).getTime() - new Date(a.requestedDate).getTime();
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

  const applyFilters = (status: 'all' | 'Pending' | 'Accepted' | 'Declined') => {
    let filtered = requests;

    if (status !== 'all') {
      filtered = filtered.filter((request) => request.status === status);
    }

    // Always sort by most recent first
    filtered.sort((a, b) => {
      return new Date(b.requestedDate).getTime() - new Date(a.requestedDate).getTime();
    });

    setFilteredRequests(filtered);
  };

  const handleStatusChange = (status: 'all' | 'Pending' | 'Accepted' | 'Declined') => {
    setFilterStatus(status);
    applyFilters(status);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'Accepted':
        return 'bg-green-100 text-green-700';
      case 'Declined':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const handleViewRequest = (request: VPRequest) => {
    setSelectedRequest(request);
    setShowViewModal(true);
  };

  const handleAcceptRequest = async (request: VPRequest) => {
    try {
      // Show loading modal
      setInfoModalConfig({
        title: 'Creating Verifiable Presentation',
        message: 'Please wait while we prepare your credentials...',
        buttonColor: 'blue',
        hideActions: true,
      });
      setShowInfoModal(true);

      console.log('[VP Request Accept] Starting VP creation for request:', request.id);

      // Step 1: Get holder DID
      const holderDid = localStorage.getItem('institutionDID');
      if (!holderDid) {
        throw new Error('Holder DID not found in localStorage');
      }

      // Step 2: Load all VCs from IndexedDB and find matching credentials
      const allVCs = await getAllVCs();
      console.log('[VP Request Accept] Loaded', allVCs.length, 'VCs from IndexedDB');

      const matchedCredentials = [];

      for (const reqCred of request.requestedCredentials) {
        for (const vc of allVCs) {
          const schema = await getSchemaDataByVCId(vc.id);
          if (
            schema &&
            schema.id === reqCred.schema_id &&
            schema.version === reqCred.schema_version
          ) {
            matchedCredentials.push(vc);
            console.log(
              '[VP Request Accept] Matched credential:',
              vc.id,
              'for schema:',
              schema.name
            );
            break; // Only take the first match for each requested credential
          }
        }
      }

      console.log('[VP Request Accept] Found', matchedCredentials.length, 'matching credentials');

      if (matchedCredentials.length === 0) {
        throw new Error('No matching credentials found');
      }

      // Step 3: Remove metadata fields (source, claimId) before creating VP
      const cleanedCredentials = matchedCredentials.map((credential) => {
        const cleaned = { ...credential };
        const metadataFields = ['source', 'claimId'] as const;
        metadataFields.forEach((field) => {
          if (field in cleaned) {
            console.log(
              '[VP Request Accept] Removing metadata field:',
              field,
              'from',
              credential.id
            );
            delete cleaned[field];
          }
        });
        return cleaned;
      });

      // Step 4: Create unsigned VP
      const unsignedVP = createVerifiablePresentation(holderDid, cleanedCredentials);
      console.log(
        '[VP Request Accept] Unsigned VP created with',
        cleanedCredentials.length,
        'credentials'
      );

      // Step 5: Sign VP
      const signedVP = await signVPWithStoredKey(unsignedVP);
      console.log('[VP Request Accept] VP signed successfully');

      // Step 6: Store VP via API
      const vpString = JSON.stringify(signedVP);
      const url = buildApiUrl(API_ENDPOINTS.PRESENTATIONS.BASE);

      console.log('[VP Request Accept] Storing VP to API:', url);

      const response = await authenticatedPost(url, {
        vp: vpString,
        is_barcode: false,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to store VP');
      }

      const result = await response.json();
      console.log('[VP Request Accept] VP stored successfully:', result);

      if (!result.success || !result.data?.vp_id) {
        throw new Error('Invalid response from API');
      }

      const vpId = result.data.vp_id;
      console.log('='.repeat(80));
      console.log('[VP REQUEST ACCEPT] VP ID:', vpId);
      console.log('='.repeat(80));

      // Step 7: Call accept API with VP ID
      setInfoModalConfig({
        title: 'Accepting VP Request',
        message: 'Submitting your response to the verifier...',
        buttonColor: 'blue',
        hideActions: true,
      });
      setShowInfoModal(true);

      // Prepare credentials array for the accept API
      // IMPORTANT: Only send the credentials that were actually matched and included in the VP
      const credentialsPayload = [];
      for (const matchedCred of matchedCredentials) {
        const schema = await getSchemaDataByVCId(matchedCred.id);
        if (schema) {
          credentialsPayload.push({
            schema_id: schema.id,
            schema_name: schema.name,
            schema_version: schema.version,
          });
        }
      }

      console.log('[VP Request Accept] Calling accept API with:');
      console.log('  - vpReqId:', request.id);
      console.log('  - vpId:', vpId);
      console.log('  - credentials (matched only):', credentialsPayload);

      const acceptUrl = buildApiUrlWithParams(API_ENDPOINTS.PRESENTATIONS.ACCEPT, {
        vpReqId: request.id,
        vpId: vpId,
      });

      const acceptResponse = await authenticatedPost(acceptUrl, {
        credentials: credentialsPayload,
      });

      if (!acceptResponse.ok) {
        const errorData = await acceptResponse.json();
        throw new Error(errorData.message || 'Failed to accept VP request');
      }

      const acceptResult = await acceptResponse.json();
      console.log('[VP Request Accept] Accept API response:', acceptResult);

      // Close loading modal and show success
      setShowInfoModal(false);
      setInfoModalConfig({
        title: 'VP Request Accepted',
        message: `Your VP request has been accepted successfully!\n\nVP ID: ${vpId}\n\nThe verifier will be notified.`,
        buttonColor: 'green',
        hideActions: false,
      });
      setShowInfoModal(true);

      setShowViewModal(false);
      // Refresh the list after accepting
      await fetchRequests();
    } catch (error) {
      console.error('[VP Request Accept] Error:', error);
      setShowInfoModal(false);
      setInfoModalConfig({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to accept VP request',
        buttonColor: 'red',
        hideActions: false,
      });
      setShowInfoModal(true);
    }
  };

  const handleDeclineRequest = async (request: VPRequest) => {
    try {
      // Build the decline API URL with vpReqId parameter
      const url = buildApiUrlWithParams(API_ENDPOINTS.PRESENTATIONS.DECLINE, {
        vpReqId: request.id,
      });

      console.log('Declining VP request:', request.id);
      const response = await authenticatedPost(url, {});

      if (response.ok) {
        const responseData = await response.json();
        console.log('VP request declined successfully:', responseData);
        setShowViewModal(false);
        // Refresh the list after declining
        await fetchRequests();
      } else {
        const errorData = await response.json();
        console.error('Failed to decline VP request:', errorData);
        alert(`Failed to decline request: ${errorData.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error declining VP request:', error);
      alert('An error occurred while declining the request');
    }
  };

  const columns: Column<VPRequest>[] = [
    {
      id: 'purpose',
      label: 'PURPOSE',
      sortKey: 'purpose',
      render: (row) => <ThemedText className="text-sm text-gray-900">{row.purpose}</ThemedText>,
    },
    {
      id: 'verifierName',
      label: 'VERIFIER',
      sortKey: 'verifierName',
      render: (row) => (
        <ThemedText className="text-sm font-medium text-gray-900">{row.verifierName}</ThemedText>
      ),
    },
    {
      id: 'requestedCredentials',
      label: 'REQUESTED CREDENTIALS',
      render: (row) => (
        <div className="flex flex-col gap-1">
          {row.requestedCredentials.slice(0, 2).map((cred, index) => (
            <span
              key={index}
              className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-blue-50 text-blue-700"
            >
              {cred.schema_name} v{cred.schema_version}
            </span>
          ))}
          {row.requestedCredentials.length > 2 && (
            <span className="text-xs text-gray-500">
              +{row.requestedCredentials.length - 2} more
            </span>
          )}
        </div>
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
      id: 'actions',
      label: 'ACTION',
      render: (row) => (
        <button
          onClick={() => handleViewRequest(row)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          View
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
    <InstitutionLayout activeTab="vp-request">
      <div className="p-12">
        <ThemedText fontSize={40} fontWeight={700} className="text-black mb-8">
          VP Request
        </ThemedText>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-6 mb-8 pt-4">
          <div className="bg-blue-50 grid grid-row-2 rounded-2xl p-6">
            <ThemedText className="text-sm text-gray-600 mb-2">Total Requests</ThemedText>
            <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
              {isLoading ? 0 : requests.length}
            </ThemedText>
          </div>
          <div className="bg-yellow-50 grid grid-row-2 rounded-2xl p-6">
            <ThemedText className="text-sm text-gray-600 mb-2">Pending</ThemedText>
            <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
              {isLoading ? 0 : pendingCount}
            </ThemedText>
          </div>
          <div className="bg-green-50 grid grid-row-2 rounded-2xl p-6">
            <ThemedText className="text-sm text-gray-600 mb-2">Accepted</ThemedText>
            <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
              {isLoading ? 0 : acceptedCount}
            </ThemedText>
          </div>
          <div className="bg-red-50 grid grid-row-2 rounded-2xl p-6">
            <ThemedText className="text-sm text-gray-600 mb-2">Declined</ThemedText>
            <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
              {isLoading ? 0 : declinedCount}
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
                handleStatusChange(e.target.value as 'all' | 'Pending' | 'Accepted' | 'Declined')
              }
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-black"
            >
              <option value="all">All</option>
              <option value="Pending">Pending</option>
              <option value="Accepted">Accepted</option>
              <option value="Declined">Declined</option>
            </select>
          </div>
        </div>
      )}

      {/* View VP Request Modal */}
      <ViewVPRequestModal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        request={selectedRequest}
        onAccept={handleAcceptRequest}
        onDecline={handleDeclineRequest}
      />

      {/* Info Modal for loading/success/error messages */}
      <InfoModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title={infoModalConfig.title}
        message={infoModalConfig.message}
        buttonColor={infoModalConfig.buttonColor}
        hideActions={infoModalConfig.hideActions}
      />
    </InstitutionLayout>
  );
}
