'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { buildApiUrl, API_ENDPOINTS } from '@/utils/api';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function VerifyMagicLinkPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('common');
  const tVerify = useTranslations('verify');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  const verifyToken = useCallback(
    async (token: string) => {
      try {
        const response = await fetch(buildApiUrl(API_ENDPOINTS.AUTH.VERIFY_MAGIC_LINK), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        let data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || tVerify('verificationFailed'));
        }

        data = data.data;

        // Validate response data
        if (!data.sessionToken || !data.institution) {
          throw new Error('Invalid response: missing token or institution data');
        }

        // Save session token and institution data
        localStorage.setItem('institutionToken', data.sessionToken);
        localStorage.setItem('institutionData', JSON.stringify(data.institution));

        setStatus('success');
        setMessage(tVerify('verificationSuccess'));

        // Redirect ke dashboard setelah 2 detik
        setTimeout(() => {
          router.push('/institution/register/seedphrase');
        }, 2000);
      } catch (err) {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : tVerify('verificationFailed'));
      }
    },
    [router, tVerify]
  );

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setMessage(tVerify('tokenNotFound'));
      return;
    }

    verifyToken(token);
  }, [searchParams, tVerify, verifyToken]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher preserveQuery={true} />
      </div>

      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {status === 'loading' && (
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{tVerify('verifying')}</h2>
              <p className="text-gray-600">{tVerify('pleaseWait')}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <div className="mb-4">
                <svg
                  className="mx-auto h-16 w-16 text-green-500"
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
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('success')}</h2>
              <p className="text-gray-600">{message}</p>
              <div className="mt-4">
                <div className="animate-pulse flex justify-center space-x-2">
                  <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
                  <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
                  <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
                </div>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <div className="mb-4">
                <svg
                  className="mx-auto h-16 w-16 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('error')}</h2>
              <p className="text-red-600 mb-6">{message}</p>
              <div className="space-y-3">
                <button
                  onClick={() => router.push('/register')}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {tVerify('registerNewInstitution')}
                </button>
                <button
                  onClick={() => router.push('/')}
                  className="w-full bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  {tVerify('goToHomepage')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <svg
              className="w-5 h-5 text-blue-600 mt-0.5"
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
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">{tVerify('aboutMagicLinks')}</p>
              <p>{tVerify('magicLinkDescription')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
