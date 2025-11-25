'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { buildApiUrl, API_ENDPOINTS } from '@/utils/api';
import PageHeader from '@/components/shared/PageHeader';
import Button from '@/components/shared/Button';
import Input from '@/components/shared/Input';
import { Link } from '@/i18n/routing';

export default function AdminLoginPage() {
  const router = useRouter();
  const t = useTranslations('auth.login');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Development bypass: Check if DEV_BYPASS environment variable is set or use query param
      const urlParams = new URLSearchParams(window.location.search);
      const devBypass =
        process.env.NEXT_PUBLIC_DEV_BYPASS === 'true' || urlParams.get('dev') === 'true';

      if (devBypass) {
        // Use dummy data in development mode
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('DEV MODE: Bypassing admin login', formData);

        const dummyAdmin = {
          id: 'dev-admin-1',
          email: 'dev@ganeshadcert.com',
          name: 'Dev Admin',
        };

        localStorage.setItem('adminToken', 'dev-token');
        localStorage.setItem('adminData', JSON.stringify(dummyAdmin));

        router.push('/admin');
        return;
      }

      const response = await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_AUTH.LOGIN), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || t('loginFailed'));
      }

      // Simpan token ke localStorage
      localStorage.setItem('adminToken', data.data.token);
      localStorage.setItem('adminData', JSON.stringify(data.data.admin));

      // Redirect ke admin dashboard
      router.push('/admin');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('loginFailed');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen bg-[#0D2B45] flex items-center justify-center relative py-28 px-4">
      <PageHeader backHref="/" />

      <div className="bg-white rounded-4xl w-full max-w-md shadow-xl p-8 md:p-12 relative z-10">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center">
            <Image src="/GWallet.svg" width={50} height={50} alt="GaneshaWallet Logo" />
            <span className="text-xl font-bold pl-2 text-[#0C2D48]">GaneshaWallet</span>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <span className="text-[40px] font-bold text-black mb-2 block">{t('title')}</span>
          <span className="text-base text-gray-600 block">{t('subtitle')}</span>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            id="email"
            name="email"
            type="email"
            label={t('email')}
            placeholder={t('emailPlaceholder')}
            value={formData.email}
            onChange={handleChange}
            required
            disabled={loading}
          />

          <Input
            id="password"
            name="password"
            type="password"
            label={t('password')}
            placeholder={t('passwordPlaceholder')}
            value={formData.password}
            onChange={handleChange}
            required
            disabled={loading}
          />

          {/* Register Link */}
          <div className="text-center">
            <span className="text-xs text-gray-600">
              {t('forInstitution')}{' '}
              <Link href="/institution" className="text-[#0D2B45] hover:underline font-medium">
                {t('registerHere')}
              </Link>
            </span>
          </div>

          {/* Submit Button */}
          <Button type="submit" variant="primary" fullWidth disabled={loading}>
            {loading ? t('processing') : t('loginButton')}
          </Button>
        </form>
      </div>
    </div>
  );
}
