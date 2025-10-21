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

export default function AdminPage() {
  const router = useRouter();
  const t = useTranslations('admin.dashboard');
  const tCommon = useTranslations('common');
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [adminData, setAdminData] = useState<AdminData | null>(null);

  const fetchPendingInstitutions = useCallback(
    async (token: string) => {
      try {
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
      }
    },
    [router]
  );

  useEffect(() => {
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

  const handleApprove = async (institutionId: string) => {
    if (!confirm(t('confirmApprove'))) {
      return;
    }

    const token = localStorage.getItem('adminToken');
    if (!token) {
      router.push('/admin/login');
      return;
    }

    setProcessingId(institutionId);
    try {
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
      fetchPendingInstitutions(token);
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

    const token = localStorage.getItem('adminToken');
    if (!token) {
      router.push('/admin/login');
      return;
    }

    setProcessingId(institutionId);
    try {
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
      fetchPendingInstitutions(token);
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
    <div className="min-h-screen bg-[#0D2B45] py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header with Logo, Title, Language Switcher and Logout */}
        <div className="mb-8">
          {/* Top Bar: Logo, Language Switcher, Logout */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center">
              <Image src="/GWallet.svg" width={50} height={50} alt="GaneshaWallet Logo" />
              <ThemedText fontSize={24} fontWeight={700} className="pl-3 text-white">
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
          <div className="text-center">
            <ThemedText fontSize={40} fontWeight={700} className="text-white mb-2">
              {t('title')}
            </ThemedText>
            <ThemedText fontSize={16} className="text-gray-300 mb-2">
              {t('subtitle')}
            </ThemedText>
            {adminData && (
              <ThemedText fontSize={14} className="text-gray-400">
                {t('loggedInAs')}: <span className="font-medium text-white">{adminData.name}</span>{' '}
                ({adminData.email})
              </ThemedText>
            )}
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
                        <ThemedText fontSize={14} fontWeight={600} className="text-gray-900 mb-1">
                          {institution.name}
                        </ThemedText>
                        <ThemedText fontSize={12} className="text-gray-500">
                          {institution.address}
                        </ThemedText>
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
