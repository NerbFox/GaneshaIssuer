'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getApiUrl } from '@/utils/api';

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('Memverifikasi magic link...');
  const [institutionData, setInstitutionData] = useState<any>(null);

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setMessage('Token tidak ditemukan');
      return;
    }

    verifyMagicLink(token);
  }, [searchParams]);

  const verifyMagicLink = async (token: string) => {
    try {
      const response = await fetch(`${getApiUrl()}/api/auth/verify-magic-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Verifikasi gagal');
      }

      // Simpan session token ke localStorage
      localStorage.setItem('sessionToken', data.data.sessionToken);
      localStorage.setItem('institution', JSON.stringify(data.data.institution));

      setStatus('success');
      setMessage('Login berhasil! Mengalihkan ke dashboard...');
      setInstitutionData(data.data.institution);

      // Redirect ke dashboard setelah 2 detik
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
        {status === 'verifying' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Memverifikasi</h2>
            <p className="text-gray-600">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Login Berhasil!</h2>
            <p className="text-gray-600 mb-4">{message}</p>
            {institutionData && (
              <div className="text-left bg-gray-50 p-4 rounded mb-4">
                <p className="text-sm text-gray-600">Selamat datang,</p>
                <p className="text-lg font-semibold text-gray-900">{institutionData.name}</p>
              </div>
            )}
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Verifikasi Gagal</h2>
            <p className="text-red-600 mb-6">{message}</p>
            <button
              onClick={() => router.push('/')}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
            >
              Kembali ke Beranda
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}
