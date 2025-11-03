'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { buildApiUrl, API_ENDPOINTS } from '@/utils/api';
import { adminAuthenticatedGet, adminAuthenticatedPost } from '@/utils/api-client';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { ThemedText } from '@/components/ThemedText';
import Button from '@/components/Button';
import { DataTable, Column } from '@/components/DataTable';

interface Institution {
  id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  website: string;
  address: string;
  status: string;
  createdAt: string;
}

interface AdminData {
  id: string;
  email: string;
  name: string;
}

// Dummy data for development - moved outside component to avoid dependency warnings
const dummyInstitutions: Institution[] = [
  {
    id: '1',
    name: 'University of Indonesia',
    email: 'admin@ui.ac.id',
    phone: '+628123456789',
    country: 'Indonesia',
    website: 'https://ui.ac.id',
    address: 'UI Campus Depok, West Java 16424',
    status: 'pending',
    createdAt: '2025-10-20T10:00:00Z',
  },
  {
    id: '2',
    name: 'Bandung Institute of Technology',
    email: 'admin@itb.ac.id',
    phone: '+628234567890',
    country: 'Indonesia',
    website: 'https://itb.ac.id',
    address: 'Jl. Ganesha No. 10, Bandung, West Java 40132',
    status: 'pending',
    createdAt: '2025-10-20T11:30:00Z',
  },
  {
    id: '3',
    name: 'Gadjah Mada University',
    email: 'admin@ugm.ac.id',
    phone: '+628345678901',
    country: 'Indonesia',
    website: 'https://ugm.ac.id',
    address: 'Bulaksumur, Yogyakarta 55281',
    status: 'pending',
    createdAt: '2025-10-20T14:15:00Z',
  },
];

export default function AdminPage() {
  const router = useRouter();
  const t = useTranslations('admin.dashboard');
  const tCommon = useTranslations('common');
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set()); // Track multiple processing institutions
  const [selectedInstitutionIds, setSelectedInstitutionIds] = useState<Set<string>>(new Set()); // Track selected institutions
  const [isBulkProcessing, setIsBulkProcessing] = useState(false); // Track bulk operations
  const [bulkProcessingAction, setBulkProcessingAction] = useState<'approve' | 'reject' | null>(
    null
  ); // Track which bulk action is in progress
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchPendingInstitutions = useCallback(
    async (token: string, devData?: Institution[]) => {
      try {
        // Development bypass: Check if DEV_BYPASS environment variable is set or use query param
        const urlParams = new URLSearchParams(window.location.search);
        const devBypass =
          process.env.NEXT_PUBLIC_DEV_BYPASS === 'true' || urlParams.get('dev') === 'true';

        if (devBypass && devData) {
          // Use dummy data in development mode
          await new Promise((resolve) => setTimeout(resolve, 500));
          console.log('DEV MODE: Using dummy institution data');
          setInstitutions(devData);
          setLoading(false);
          return;
        }

        const response = await adminAuthenticatedGet(
          buildApiUrl(API_ENDPOINTS.AUTH.PENDING_INSTITUTIONS)
        );

        const data = await response.json();

        if (response.status === 401) {
          localStorage.removeItem('adminToken');
          localStorage.removeItem('adminData');
          router.push('/admin/login');
          return;
        }

        if (!response.ok) {
          throw new Error(data.message || 'Failed to fetch data');
        }

        setInstitutions(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
        setLastRefresh(new Date());
      }
    },
    [router]
  );

  useEffect(() => {
    // Development bypass: Check if DEV_BYPASS environment variable is set or use query param
    const urlParams = new URLSearchParams(window.location.search);
    const devBypass =
      process.env.NEXT_PUBLIC_DEV_BYPASS === 'true' || urlParams.get('dev') === 'true';

    if (devBypass) {
      // Set dummy admin data for development
      const dummyAdmin = {
        id: 'dev-admin-1',
        email: 'dev@ganeshadcert.com',
        name: 'Dev Admin',
      };
      setAdminData(dummyAdmin);
      fetchPendingInstitutions('dev-token', dummyInstitutions);
      return;
    }

    // Cek apakah admin sudah login
    const token = localStorage.getItem('adminToken');
    const admin = localStorage.getItem('adminData');

    if (!token || !admin) {
      router.push('/admin/login');
      return;
    }

    setAdminData(JSON.parse(admin));
    fetchPendingInstitutions(token);
  }, [router, fetchPendingInstitutions]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    // Don't set up auto-refresh if not authenticated or still loading
    if (!adminData) return;

    const intervalId = setInterval(() => {
      const urlParams = new URLSearchParams(window.location.search);
      const devBypass =
        process.env.NEXT_PUBLIC_DEV_BYPASS === 'true' || urlParams.get('dev') === 'true';

      if (devBypass) {
        fetchPendingInstitutions('dev-token', dummyInstitutions);
      } else {
        const token = localStorage.getItem('adminToken');
        if (token) {
          fetchPendingInstitutions(token);
        }
      }
    }, 10000); // 10 seconds

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, [adminData, fetchPendingInstitutions]);

  const handleApprove = async (institutionId: string) => {
    if (!confirm(t('confirmApprove'))) {
      return;
    }

    // Development bypass check
    const urlParams = new URLSearchParams(window.location.search);
    const devBypass =
      process.env.NEXT_PUBLIC_DEV_BYPASS === 'true' || urlParams.get('dev') === 'true';

    const token = localStorage.getItem('adminToken');
    if (!token && !devBypass) {
      router.push('/admin/login');
      return;
    }

    setProcessingIds((prev) => new Set(prev).add(institutionId));
    try {
      if (devBypass) {
        // Simulate API call in development mode
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('DEV MODE: Approving institution', institutionId);
        alert(t('approveSuccess'));
        // Remove institution from list
        setInstitutions((prev) => prev.filter((inst) => inst.id !== institutionId));
        setProcessingIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(institutionId);
          return newSet;
        });
        return;
      }

      const response = await adminAuthenticatedPost(
        buildApiUrl(API_ENDPOINTS.AUTH.APPROVE(institutionId)),
        {
          approvedBy: adminData?.name || 'Admin',
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminData');
        router.push('/admin/login');
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || 'Failed to approve institution');
      }

      alert(t('approveSuccess'));
      fetchPendingInstitutions(token!);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      alert(errorMessage);
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(institutionId);
        return newSet;
      });
    }
  };

  const handleReject = async (institutionId: string) => {
    if (!confirm(t('confirmReject'))) {
      return;
    }

    // Development bypass check
    const urlParams = new URLSearchParams(window.location.search);
    const devBypass =
      process.env.NEXT_PUBLIC_DEV_BYPASS === 'true' || urlParams.get('dev') === 'true';

    const token = localStorage.getItem('adminToken');
    if (!token && !devBypass) {
      router.push('/admin/login');
      return;
    }

    setProcessingIds((prev) => new Set(prev).add(institutionId));
    try {
      if (devBypass) {
        // Simulate API call in development mode
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('DEV MODE: Rejecting institution', institutionId);
        alert(t('rejectSuccess'));
        // Remove institution from list
        setInstitutions((prev) => prev.filter((inst) => inst.id !== institutionId));
        setProcessingIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(institutionId);
          return newSet;
        });
        return;
      }

      const response = await adminAuthenticatedPost(
        buildApiUrl(API_ENDPOINTS.AUTH.REJECT(institutionId)),
        {}
      );

      const data = await response.json();

      if (response.status === 401) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminData');
        router.push('/admin/login');
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || 'Failed to reject institution');
      }

      alert(t('rejectSuccess'));
      fetchPendingInstitutions(token!);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      alert(errorMessage);
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(institutionId);
        return newSet;
      });
    }
  };

  const handleBulkAction = async (action: 'approve' | 'reject') => {
    if (selectedInstitutionIds.size === 0) {
      alert(`Please select at least one institution to ${action}.`);
      return;
    }

    const confirmMessage = `Are you sure you want to ${action} ${selectedInstitutionIds.size} selected institution(s)?`;
    if (!confirm(confirmMessage)) {
      return;
    }

    setIsBulkProcessing(true);
    setBulkProcessingAction(action);
    const results: {
      id: string;
      status: 'success' | 'error';
      message?: string;
    }[] = [];

    // Get selected institutions
    const selectedInstitutions = institutions.filter((inst) => selectedInstitutionIds.has(inst.id));

    // Development bypass check
    const urlParams = new URLSearchParams(window.location.search);
    const devBypass =
      process.env.NEXT_PUBLIC_DEV_BYPASS === 'true' || urlParams.get('dev') === 'true';

    const token = localStorage.getItem('adminToken');

    // Process each selected institution
    for (const institution of selectedInstitutions) {
      try {
        setProcessingIds((prev) => new Set(prev).add(institution.id));

        if (devBypass) {
          // Simulate API call in development mode
          await new Promise((resolve) => setTimeout(resolve, 500));
          console.log(`DEV MODE: ${action}ing institution`, institution.id);
          results.push({
            id: institution.id,
            status: 'success',
          });
        } else {
          const endpoint =
            action === 'approve'
              ? API_ENDPOINTS.AUTH.APPROVE(institution.id)
              : API_ENDPOINTS.AUTH.REJECT(institution.id);

          const body = action === 'approve' ? { approvedBy: adminData?.name || 'Admin' } : {};

          const response = await adminAuthenticatedPost(buildApiUrl(endpoint), body);

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || `Failed to ${action} institution`);
          }

          results.push({
            id: institution.id,
            status: 'success',
          });
        }
      } catch (error) {
        results.push({
          id: institution.id,
          status: 'error',
          message: error instanceof Error ? error.message : `Failed to ${action}`,
        });
      } finally {
        setProcessingIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(institution.id);
          return newSet;
        });
      }
    }

    setIsBulkProcessing(false);
    setBulkProcessingAction(null);

    // Show results summary
    const successCount = results.filter((r) => r.status === 'success').length;
    const failCount = results.filter((r) => r.status === 'error').length;
    const failedInstitutions = results
      .filter((r) => r.status === 'error')
      .map((r) => {
        const inst = institutions.find((i) => i.id === r.id);
        return `- ${inst?.name || r.id}: ${r.message || 'Unknown error'}`;
      })
      .join('\n');

    let resultMessage = `Bulk ${action} completed:\n✓ Success: ${successCount}`;
    if (failCount > 0) {
      resultMessage += `\n✗ Failed: ${failCount}\n\nFailed institutions:\n${failedInstitutions}`;
    }

    alert(resultMessage);

    // Clear selection and refresh data
    setSelectedInstitutionIds(new Set());
    if (devBypass) {
      // In dev mode, remove successful institutions from the list
      const successIds = new Set(results.filter((r) => r.status === 'success').map((r) => r.id));
      setInstitutions((prev) => prev.filter((inst) => !successIds.has(inst.id)));
    } else {
      if (token) {
        fetchPendingInstitutions(token);
      }
    }
  };

  const handleSelectionChange = (
    selectedIndices: number[],
    selectedIdValues?: (string | number)[]
  ) => {
    if (selectedIdValues && selectedIdValues.length > 0) {
      setSelectedInstitutionIds(new Set(selectedIdValues as string[]));
    } else {
      const selectedIds = new Set(
        selectedIndices.map((index) => institutions[index]?.id).filter(Boolean)
      );
      setSelectedInstitutionIds(selectedIds);
    }
  };

  const handleLogout = () => {
    if (confirm(t('confirmLogout'))) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminData');
      router.push('/admin/login');
    }
  };

  // Define columns for DataTable
  const columns: Column<Institution>[] = [
    {
      id: 'name',
      label: t('table.name'),
      render: (row) => (
        <div className="space-y-1">
          <ThemedText fontSize={14} fontWeight={600} className="text-gray-900 block">
            {row.name}
          </ThemedText>
          <ThemedText fontSize={12} className="text-gray-500 block">
            {row.address}
          </ThemedText>
        </div>
      ),
    },
    {
      id: 'email',
      label: t('table.email'),
      render: (row) => (
        <ThemedText fontSize={14} className="text-gray-900">
          {row.email}
        </ThemedText>
      ),
    },
    {
      id: 'phone',
      label: t('table.phone'),
      render: (row) => (
        <ThemedText fontSize={14} className="text-gray-900">
          {row.phone}
        </ThemedText>
      ),
    },
    {
      id: 'country',
      label: t('table.country'),
      render: (row) => (
        <ThemedText fontSize={14} className="text-gray-900">
          {row.country}
        </ThemedText>
      ),
    },
    {
      id: 'website',
      label: t('table.website'),
      render: (row) => (
        <a
          href={row.website}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#0D2B45] hover:underline font-medium"
        >
          <ThemedText fontSize={14}>{row.website}</ThemedText>
        </a>
      ),
    },
    {
      id: 'actions',
      label: t('table.actions'),
      render: (row) => {
        const isProcessing = processingIds.has(row.id);
        return (
          <div className="flex gap-2">
            <button
              onClick={() => handleApprove(row.id)}
              disabled={isProcessing}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>{t('table.processing')}</span>
                </>
              ) : (
                t('table.approve')
              )}
            </button>
            <button
              onClick={() => handleReject(row.id)}
              disabled={isProcessing}
              className="px-4 py-2 border border-red-600 text-red-600 hover:bg-red-600 hover:text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {t('table.reject')}
            </button>
          </div>
        );
      },
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D2B45] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <ThemedText fontSize={16} className="mt-4 text-white">
            {tCommon('loading')}
          </ThemedText>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D2B45] py-8 px-6 md:px-12">
      <div className="max-w-7xl mx-auto">
        {/* Header with Logo, Title, Language Switcher and Logout */}
        <div className="mb-10">
          {/* Top Bar: Logo, Language Switcher, Logout */}
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-white rounded-full"></div>
                <div className="relative">
                  <Image src="/GWallet.svg" width={50} height={50} alt="GaneshaWallet Logo" />
                </div>
              </div>
              <ThemedText fontSize={24} fontWeight={700} className="text-white">
                GaneshaWallet
              </ThemedText>
            </div>
            <div className="flex items-center gap-4">
              <LanguageSwitcher />
              <Button variant="outline" onClick={handleLogout} className="border-white text-white">
                {tCommon('logout')}
              </Button>
            </div>
          </div>

          {/* Title and Admin Info */}
          <div className="space-y-2">
            <ThemedText fontSize={40} fontWeight={700} className="text-white block">
              {t('title')}
            </ThemedText>
            <ThemedText fontSize={18} className="text-gray-300 block">
              {t('subtitle')}
            </ThemedText>
            {adminData && (
              <div className="pt-1">
                <ThemedText fontSize={14} className="text-gray-400 block">
                  {t('loggedInAs')}:{' '}
                  <span className="font-medium text-white">{adminData.name}</span> (
                  {adminData.email})
                </ThemedText>
              </div>
            )}
            {/* Auto-refresh indicator */}
            <div className="pt-2 flex items-center gap-2">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse"></div>
                <ThemedText fontSize={12} className="text-gray-400">
                  Auto-refreshing every 10s
                </ThemedText>
              </div>
              <ThemedText fontSize={12} className="text-gray-500">
                • Last updated: {lastRefresh.toLocaleTimeString()}
              </ThemedText>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <ThemedText fontSize={14}>{error}</ThemedText>
          </div>
        )}

        {institutions.length === 0 ? (
          <div className="bg-white rounded-4xl shadow-xl p-12 text-center">
            <svg
              className="mx-auto h-16 w-16 text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <ThemedText fontSize={18} fontWeight={600} className="text-gray-600">
              {t('noPendingInstitutions')}
            </ThemedText>
          </div>
        ) : (
          <DataTable
            data={institutions}
            columns={columns}
            topRightButtons={
              <div className="flex items-center gap-3">
                {/* Selection indicator */}
                {selectedInstitutionIds.size > 0 && (
                  <ThemedText className="text-sm text-gray-700">
                    {selectedInstitutionIds.size} institution(s) selected
                  </ThemedText>
                )}

                {/* Bulk Action Buttons */}
                {selectedInstitutionIds.size > 0 && (
                  <>
                    <button
                      onClick={() => handleBulkAction('approve')}
                      disabled={isBulkProcessing}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isBulkProcessing && bulkProcessingAction === 'approve' ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          <span>Approving all...</span>
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
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          <span>Approve All</span>
                        </>
                      )}
                    </button>

                    {/* Separator */}
                    <div className="h-8 w-px bg-gray-300"></div>

                    <button
                      onClick={() => handleBulkAction('reject')}
                      disabled={isBulkProcessing}
                      className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isBulkProcessing && bulkProcessingAction === 'reject' ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          <span>Rejecting all...</span>
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
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                          <span>Reject All</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            }
            enableSelection={true}
            onSelectionChange={handleSelectionChange}
            totalCount={institutions.length}
            rowsPerPageOptions={[5, 10, 25, 50, 100]}
            idKey="id"
          />
        )}
      </div>
    </div>
  );
}
