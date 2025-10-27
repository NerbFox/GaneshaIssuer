'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { buildApiUrl, API_ENDPOINTS } from '@/utils/api';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { ThemedText } from '@/components/ThemedText';
import Button from '@/components/Button';

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
  const [processingId, setProcessingId] = useState<string | null>(null);
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

        const response = await fetch(buildApiUrl(API_ENDPOINTS.AUTH.PENDING_INSTITUTIONS), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

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

    setProcessingId(institutionId);
    try {
      if (devBypass) {
        // Simulate API call in development mode
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('DEV MODE: Approving institution', institutionId);
        alert(t('approveSuccess'));
        // Remove institution from list
        setInstitutions((prev) => prev.filter((inst) => inst.id !== institutionId));
        setProcessingId(null);
        return;
      }

      const response = await fetch(buildApiUrl(API_ENDPOINTS.AUTH.APPROVE(institutionId)), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          approvedBy: adminData?.name || 'Admin',
        }),
      });

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
      setProcessingId(null);
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

    setProcessingId(institutionId);
    try {
      if (devBypass) {
        // Simulate API call in development mode
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('DEV MODE: Rejecting institution', institutionId);
        alert(t('rejectSuccess'));
        // Remove institution from list
        setInstitutions((prev) => prev.filter((inst) => inst.id !== institutionId));
        setProcessingId(null);
        return;
      }

      const response = await fetch(buildApiUrl(API_ENDPOINTS.AUTH.REJECT(institutionId)), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

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
      setProcessingId(null);
    }
  };

  const handleLogout = () => {
    if (confirm(t('confirmLogout'))) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminData');
      router.push('/admin/login');
    }
  };

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
          <div className="bg-white rounded-4xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-[#E9F2F5]">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-[#0D2B45] uppercase tracking-wider">
                      {t('table.name')}
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-[#0D2B45] uppercase tracking-wider">
                      {t('table.email')}
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-[#0D2B45] uppercase tracking-wider">
                      {t('table.phone')}
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-[#0D2B45] uppercase tracking-wider">
                      {t('table.country')}
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-[#0D2B45] uppercase tracking-wider">
                      {t('table.website')}
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-[#0D2B45] uppercase tracking-wider">
                      {t('table.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {institutions.map((institution) => (
                    <tr key={institution.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <ThemedText
                            fontSize={14}
                            fontWeight={600}
                            className="text-gray-900 block"
                          >
                            {institution.name}
                          </ThemedText>
                          <ThemedText fontSize={12} className="text-gray-500 block">
                            {institution.address}
                          </ThemedText>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <ThemedText fontSize={14} className="text-gray-900">
                          {institution.email}
                        </ThemedText>
                      </td>
                      <td className="px-6 py-4">
                        <ThemedText fontSize={14} className="text-gray-900">
                          {institution.phone}
                        </ThemedText>
                      </td>
                      <td className="px-6 py-4">
                        <ThemedText fontSize={14} className="text-gray-900">
                          {institution.country}
                        </ThemedText>
                      </td>
                      <td className="px-6 py-4">
                        <a
                          href={institution.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#0D2B45] hover:underline font-medium"
                        >
                          <ThemedText fontSize={14}>{institution.website}</ThemedText>
                        </a>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleApprove(institution.id)}
                            disabled={processingId === institution.id}
                            variant="primary"
                            className="bg-green-600 hover:bg-green-700 text-white text-sm py-2 px-4"
                          >
                            {processingId === institution.id
                              ? t('table.processing')
                              : t('table.approve')}
                          </Button>
                          <Button
                            onClick={() => handleReject(institution.id)}
                            disabled={processingId === institution.id}
                            variant="outline"
                            className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white text-sm py-2 px-4"
                          >
                            {t('table.reject')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
