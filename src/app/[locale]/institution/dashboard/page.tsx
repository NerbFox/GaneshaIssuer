'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import InstitutionLayout from '@/components/InstitutionLayout';
import { ThemedText } from '@/components/ThemedText';
import { redirectIfJWTInvalid } from '@/utils/auth';
import { API_ENDPOINTS, buildApiUrlWithParams } from '@/utils/api';
import { authenticatedGet } from '@/utils/api-client';
import { decryptWithPrivateKey } from '@/utils/encryptUtils';

interface DashboardStats {
  // Schema stats
  totalSchemas: number;
  activeSchemas: number;

  // Issue Request stats
  pendingRequests: number;
  issuanceRequests: number;
  renewalRequests: number;
  updateRequests: number;
  revocationRequests: number;
  activeSchemaRequests: number;
  inactiveSchemaRequests: number;

  // Issued by me stats
  totalIssued: number;
  activeCredentials: number;

  // History stats
  totalActivities: number;
  approvedActivities: number;
}

interface RecentActivity {
  id: string;
  date: string;
  holderDid: string;
  requestType: string;
  actionType: string | null;
  schemaName: string;
}

export default function InstitutionPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalSchemas: 0,
    activeSchemas: 0,
    pendingRequests: 0,
    issuanceRequests: 0,
    renewalRequests: 0,
    updateRequests: 0,
    revocationRequests: 0,
    activeSchemaRequests: 0,
    inactiveSchemaRequests: 0,
    totalIssued: 0,
    activeCredentials: 0,
    totalActivities: 0,
    approvedActivities: 0,
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  // Helper function to parse encrypted_body
  const parseEncryptedBody = async (
    encryptedBody: string
  ): Promise<{ schema_id: string; schema_version: number } | null> => {
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
          // Silently handle decryption error
        }
      }
    }
    return null;
  };

  // Fetch all dashboard data
  const fetchDashboardData = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      setIsLoading(true);
      const issuerDid = localStorage.getItem('institutionDID');
      if (!issuerDid) {
        throw new Error('Institution DID not found. Please log in again.');
      }

      // Fetch schemas
      const schemasUrl = buildApiUrlWithParams(API_ENDPOINTS.SCHEMAS.BASE, { issuerDid });
      const schemasResponse = await authenticatedGet(schemasUrl);
      const schemasData = schemasResponse.ok
        ? await schemasResponse.json()
        : { data: { data: [] } };
      const schemas = schemasData.data.data || [];

      // Create schema map for later use
      const schemaMap = new Map<string, { name: string; expiredIn: number; isActive: boolean }>();
      schemas.forEach(
        (schema: {
          id: string;
          name: string;
          schema: { expired_in: number };
          isActive: boolean;
        }) => {
          schemaMap.set(schema.id, {
            name: schema.name,
            expiredIn: schema.schema.expired_in || 0,
            isActive: schema.isActive,
          });
        }
      );

      // Fetch all request types in parallel
      const requestTypes = ['ISSUANCE', 'RENEWAL', 'UPDATE', 'REVOKE'];
      const requestPromises = requestTypes.map(async (type) => {
        try {
          const url = buildApiUrlWithParams(API_ENDPOINTS.CREDENTIALS.REQUESTS, {
            type,
            issuer_did: issuerDid,
          });
          const response = await authenticatedGet(url);
          if (response.ok) {
            const result = await response.json();
            return { type, data: result.data.data || [] };
          }
        } catch (err) {
          console.error(`Failed to fetch ${type} requests:`, err);
        }
        return { type, data: [] };
      });

      const requestResults = await Promise.all(requestPromises);
      const allRequests = requestResults.flatMap((r) =>
        r.data.map((req: { type: string }) => ({ ...req, type: r.type }))
      );

      // Filter pending requests only
      const pendingRequests = allRequests.filter((r: { status: string }) => r.status === 'PENDING');

      // Parse encrypted bodies to get schema info
      const parsedBodiesMap = new Map<
        string,
        { schema_id: string; schema_version: number } | null
      >();
      for (const request of pendingRequests) {
        const parsedBody = await parseEncryptedBody(request.encrypted_body);
        parsedBodiesMap.set(request.encrypted_body, parsedBody);
      }

      // Count requests with active vs inactive schemas
      const activeSchemaRequests = pendingRequests.filter((r: { encrypted_body: string }) => {
        const parsedBody = parsedBodiesMap.get(r.encrypted_body);
        const schemaId = parsedBody?.schema_id || '';
        return schemaMap.get(schemaId)?.isActive === true;
      }).length;

      const inactiveSchemaRequests = pendingRequests.filter((r: { encrypted_body: string }) => {
        const parsedBody = parsedBodiesMap.get(r.encrypted_body);
        const schemaId = parsedBody?.schema_id || '';
        return schemaMap.get(schemaId)?.isActive !== true;
      }).length;

      // Fetch issued credentials (for issued-by-me page)
      const issuedUrl = buildApiUrlWithParams(API_ENDPOINTS.CREDENTIALS.REQUESTS, {
        type: 'ISSUANCE',
        issuer_did: issuerDid,
      });
      const issuedResponse = await authenticatedGet(issuedUrl);
      const issuedData = issuedResponse.ok ? await issuedResponse.json() : { data: { data: [] } };
      const issuedCredentials = (issuedData.data.data || []).filter(
        (c: { status: string }) => c.status !== 'PENDING' && c.status !== 'REJECTED'
      );

      // Fetch history
      const historyUrl = buildApiUrlWithParams(API_ENDPOINTS.CREDENTIALS.ISSUER_HISTORY, {
        issuer_did: issuerDid,
      });
      const historyResponse = await authenticatedGet(historyUrl);
      const historyData = historyResponse.ok
        ? await historyResponse.json()
        : { data: { requests: [] } };
      const historyRequests = historyData.data.requests || [];

      // Transform recent history for display (last 5 activities)
      const recentHistoryActivities: RecentActivity[] = [];
      for (const request of historyRequests.slice(0, 5)) {
        const parsedBody = await parseEncryptedBody(request.encrypted_body);
        const schemaId = parsedBody?.schema_id || '';
        const schemaName = schemaMap.get(schemaId)?.name || 'Unknown Schema';

        recentHistoryActivities.push({
          id: request.id,
          date: request.createdAt,
          holderDid: request.holder_did,
          requestType: request.request_type,
          actionType: request.status,
          schemaName: schemaName,
        });
      }

      // Calculate stats
      const dashboardStats: DashboardStats = {
        // Schema stats
        totalSchemas: schemas.length,
        activeSchemas: schemas.filter((s: { isActive: boolean }) => s.isActive === true).length,

        // Issue Request stats
        pendingRequests: pendingRequests.length,
        issuanceRequests: pendingRequests.filter((r: { type: string }) => r.type === 'ISSUANCE')
          .length,
        renewalRequests: pendingRequests.filter((r: { type: string }) => r.type === 'RENEWAL')
          .length,
        updateRequests: pendingRequests.filter((r: { type: string }) => r.type === 'UPDATE').length,
        revocationRequests: pendingRequests.filter((r: { type: string }) => r.type === 'REVOCATION')
          .length,
        activeSchemaRequests,
        inactiveSchemaRequests,

        // Issued by me stats
        totalIssued: issuedCredentials.length,
        activeCredentials: issuedCredentials.filter(
          (c: { status: string }) => c.status === 'APPROVED'
        ).length,

        // History stats
        totalActivities: historyRequests.length,
        approvedActivities: historyRequests.filter(
          (r: { status: string }) => r.status === 'APPROVED'
        ).length,
      };

      setStats(dashboardStats);
      setRecentActivities(recentHistoryActivities);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const truncateDid = (did: string, maxLength: number = 25): string => {
    if (did.length <= maxLength) return did;
    return did.substring(0, maxLength) + '...';
  };

  const getActionIcon = (actionType: string | null | undefined) => {
    switch (actionType) {
      case 'APPROVED':
        return '✅';
      case 'REJECTED':
        return '❌';
      case 'PENDING':
        return '⏳';
      default:
        return '📝';
    }
  };

  const getRequestTypeLabel = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
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
    <InstitutionLayout activeTab="dashboard">
      <div className="p-12">
        <ThemedText fontSize={40} fontWeight={700} className="text-black mb-8">
          Dashboard
        </ThemedText>

        {/* Stats Cards */}
        <div className="space-y-6 mb-8 pt-4">
          {/* First Row: Key Metrics - 4 cards */}
          <div className="grid grid-cols-4 gap-6">
            <div className="bg-blue-50 grid grid-row-2 rounded-2xl p-6">
              <ThemedText className="text-sm text-gray-600 mb-2">Active Schemas</ThemedText>
              <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
                {isLoading ? 0 : stats.activeSchemas.toLocaleString()}
              </ThemedText>
            </div>
            <div className="bg-purple-50 grid grid-row-2 rounded-2xl p-6">
              <ThemedText className="text-sm text-gray-600 mb-2">Pending Requests</ThemedText>
              <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
                {isLoading ? 0 : stats.pendingRequests.toLocaleString()}
              </ThemedText>
            </div>
            <div className="bg-green-50 grid grid-row-2 rounded-2xl p-6">
              <ThemedText className="text-sm text-gray-600 mb-2">Active Credentials</ThemedText>
              <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
                {isLoading ? 0 : stats.activeCredentials.toLocaleString()}
              </ThemedText>
            </div>
            <div className="bg-amber-50 grid grid-row-2 rounded-2xl p-6">
              <ThemedText className="text-sm text-gray-600 mb-2">Success Rate</ThemedText>
              <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
                {isLoading
                  ? '0%'
                  : stats.totalActivities > 0
                    ? `${Math.round((stats.approvedActivities / stats.totalActivities) * 100)}%`
                    : '0%'}
              </ThemedText>
            </div>
          </div>

          {/* Second Row: Total Counts - 2 cards */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-cyan-50 grid grid-row-2 rounded-2xl p-6">
              <ThemedText className="text-sm text-gray-600 mb-2">Total Issued</ThemedText>
              <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
                {isLoading ? 0 : stats.totalIssued.toLocaleString()}
              </ThemedText>
            </div>
            <div className="bg-teal-50 grid grid-row-2 rounded-2xl p-6">
              <ThemedText className="text-sm text-gray-600 mb-2">Total Activities</ThemedText>
              <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
                {isLoading ? 0 : stats.totalActivities.toLocaleString()}
              </ThemedText>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Recent Activity */}
        {!isLoading && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <ThemedText fontSize={20} fontWeight={600} className="text-gray-900">
                Recent Activity
              </ThemedText>
              <button
                onClick={() => router.push('/en/institution/history')}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
              >
                View All →
              </button>
            </div>
            {recentActivities.length === 0 ? (
              <div className="text-center py-8">
                <ThemedText className="text-gray-500">No recent activities</ThemedText>
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center gap-4 pb-4 border-b border-gray-200 last:border-0"
                  >
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span>{getActionIcon(activity.actionType)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {getRequestTypeLabel(activity.requestType)} request{' '}
                        {activity.actionType?.toLowerCase() || 'processed'} for{' '}
                        <span className="text-blue-600">{activity.schemaName}</span>
                      </p>
                      <p className="text-xs text-gray-500">
                        Holder: {truncateDid(activity.holderDid, 30)} •{' '}
                        {formatDateTime(activity.date)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </InstitutionLayout>
  );
}
