'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { buildApiUrl, API_ENDPOINTS } from '@/utils/api';
import LanguageSwitcher from '@/components/LanguageSwitcher';

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{tCommon('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header with Logout and Language Switcher */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
            <p className="text-gray-600 mt-2">{t('subtitle')}</p>
            {adminData && (
              <p className="text-sm text-gray-500 mt-1">
                {t('loggedInAs')}: <span className="font-medium">{adminData.name}</span> (
                {adminData.email})
              </p>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <LanguageSwitcher />
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              {tCommon('logout')}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {institutions.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-600">{t('noPendingInstitutions')}</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('table.name')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('table.email')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('table.phone')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('table.country')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('table.website')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('table.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {institutions.map((institution) => (
                    <tr key={institution.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{institution.name}</div>
                        <div className="text-sm text-gray-500">{institution.address}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {institution.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {institution.phone}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {institution.country}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <a
                          href={institution.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {institution.website}
                        </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleApprove(institution.id)}
                            disabled={processingId === institution.id}
                            className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:bg-gray-400"
                          >
                            {processingId === institution.id
                              ? t('table.processing')
                              : t('table.approve')}
                          </button>
                          <button
                            onClick={() => handleReject(institution.id)}
                            disabled={processingId === institution.id}
                            className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 disabled:bg-gray-400"
                          >
                            {t('table.reject')}
                          </button>
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
