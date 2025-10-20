'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function HomePage() {
  const t = useTranslations('nav');
  const tHome = useTranslations('home');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>

      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">{tHome('title')}</h1>
          <p className="text-xl text-gray-600">{tHome('subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
          <Link
            href="/admin/login"
            className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow text-center"
          >
            <div className="text-4xl mb-4">🔐</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('admin')}</h2>
            <p className="text-gray-600">{tHome('adminAccess')}</p>
          </Link>

          <Link
            href="/register"
            className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow text-center"
          >
            <div className="text-4xl mb-4">📝</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('register')}</h2>
            <p className="text-gray-600">{tHome('registerInstitution')}</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
