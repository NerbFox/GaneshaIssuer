'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { ThemedText } from '@/components/ThemedText';
import LanguageSwitcher from '@/components/LanguageSwitcher';

interface InstitutionData {
  id: string;
  email: string;
  name: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const [institutionData, setInstitutionData] = useState<InstitutionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Cek apakah institution sudah login
    const token = localStorage.getItem('institutionToken');
    const institution = localStorage.getItem('institutionData');

    if (!token || !institution) {
      // Jika belum login, redirect ke home
      router.push('/');
      return;
    }

    setInstitutionData(JSON.parse(institution));
    setLoading(false);
  }, [router]);

  const handleLogout = () => {
    if (confirm(t('confirmLogout'))) {
      localStorage.removeItem('institutionToken');
      localStorage.removeItem('institutionData');
      router.push('/');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D2B45] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4 text-white">{tCommon('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D2B45]">
      {/* Header */}
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Image src="/GWallet.svg" width={40} height={40} alt="GaneshaWallet Logo" />
              <div className="ml-3">
                <ThemedText fontSize={20} fontWeight={700} className="text-[#0C2D48] block">
                  GaneshaWallet
                </ThemedText>
                {institutionData && (
                  <ThemedText fontSize={12} className="text-gray-600">
                    {institutionData.name}
                  </ThemedText>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <LanguageSwitcher />
              <button
                onClick={handleLogout}
                className="bg-[#0D2B45] text-white px-4 py-2 rounded-lg hover:opacity-90 transition cursor-pointer"
              >
                {tCommon('logout')}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="min-h-screen bg-[#0D2B45]">
        <div className="container mx-auto py-20 px-4">
          <div className="mb-8">
            <ThemedText className="block mb-2" fontSize={40} fontWeight={700}>
              {t('welcome')}
            </ThemedText>
            <ThemedText fontSize={16}>{t('overview')}</ThemedText>
          </div>

          {/* Dashboard Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-4xl shadow-xl p-8">
              <div className="flex items-center justify-between">
                <div>
                  <ThemedText className="text-gray-500 block mb-1" fontSize={12}>
                    {t('totalCertificates')}
                  </ThemedText>
                  <ThemedText className="text-gray-900 block" fontSize={32} fontWeight={700}>
                    0
                  </ThemedText>
                </div>
                <div className="bg-blue-100 p-3 rounded-lg">
                  <svg
                    className="w-8 h-8 text-blue-600"
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
                </div>
              </div>
            </div>

            <div className="bg-white rounded-4xl shadow-xl p-8">
              <div className="flex items-center justify-between">
                <div>
                  <ThemedText className="text-gray-500 block mb-1" fontSize={12}>
                    {t('activeCertificates')}
                  </ThemedText>
                  <ThemedText className="text-gray-900 block" fontSize={32} fontWeight={700}>
                    0
                  </ThemedText>
                </div>
                <div className="bg-green-100 p-3 rounded-lg">
                  <svg
                    className="w-8 h-8 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-4xl shadow-xl p-8">
              <div className="flex items-center justify-between">
                <div>
                  <ThemedText className="text-gray-500 block mb-1" fontSize={12}>
                    {t('pendingRequests')}
                  </ThemedText>
                  <ThemedText className="text-gray-900 block" fontSize={32} fontWeight={700}>
                    0
                  </ThemedText>
                </div>
                <div className="bg-yellow-100 p-3 rounded-lg">
                  <svg
                    className="w-8 h-8 text-yellow-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-4xl shadow-xl p-8 mb-8">
            <ThemedText className="block mb-4" fontSize={20} fontWeight={700}>
              {t('quickActions')}
            </ThemedText>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <button className="flex items-center space-x-3 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer">
                <div className="bg-blue-100 p-2 rounded">
                  <svg
                    className="w-6 h-6 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </div>
                <ThemedText className="text-gray-700" fontSize={14} fontWeight={500}>
                  {t('issueCertificate')}
                </ThemedText>
              </button>

              <button className="flex items-center space-x-3 p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all cursor-pointer">
                <div className="bg-green-100 p-2 rounded">
                  <svg
                    className="w-6 h-6 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <ThemedText className="text-gray-700" fontSize={14} fontWeight={500}>
                  {t('verifyCertificate')}
                </ThemedText>
              </button>

              <button className="flex items-center space-x-3 p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all cursor-pointer">
                <div className="bg-purple-100 p-2 rounded">
                  <svg
                    className="w-6 h-6 text-purple-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </div>
                <ThemedText className="text-gray-700" fontSize={14} fontWeight={500}>
                  {t('viewTemplates')}
                </ThemedText>
              </button>

              <button className="flex items-center space-x-3 p-4 border-2 border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-all cursor-pointer">
                <div className="bg-orange-100 p-2 rounded">
                  <svg
                    className="w-6 h-6 text-orange-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <ThemedText className="text-gray-700" fontSize={14} fontWeight={500}>
                  {t('settings')}
                </ThemedText>
              </button>
            </div>
          </div>

          {/* Info Banner */}
          <div className="bg-white rounded-4xl shadow-xl p-8">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <svg
                  className="w-6 h-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <ThemedText className="text-blue-900 block mb-2" fontSize={18} fontWeight={600}>
                  {t('comingSoon')}
                </ThemedText>
                <ThemedText className="text-blue-800" fontSize={14}>
                  {t('comingSoonDescription')}
                </ThemedText>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
