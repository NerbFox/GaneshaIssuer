'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import Image from 'next/image';
import LanguageSwitcher from '@/components/shared/LanguageSwitcher';

export default function HomePage() {
  const t = useTranslations('nav');
  const tHome = useTranslations('home');

  return (
    <div className="min-h-screen bg-[#0D2B45] flex items-center justify-center relative">
      <div className="absolute top-6 right-6 z-30">
        <LanguageSwitcher />
      </div>

      <div className="container mx-auto py-20 px-4">
        <div className="text-center mb-12">
          <div className="flex justify-center items-center mb-6">
            <div className="bg-white rounded-full p-6 shadow-xl">
              <Image src="/GWallet.svg" width={80} height={80} alt="GaneshaWallet Logo" />
            </div>
          </div>
          <span className="block mb-4">{tHome('title')}</span>
          <span className="text-gray-300 block">{tHome('subtitle')}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <Link
            href="/admin/login"
            className="bg-white p-8 rounded-4xl shadow-xl hover:shadow-2xl transition-all text-center group cursor-pointer"
          >
            <div className="text-5xl mb-4">🔐</div>
            <span className="text-gray-900 block mb-2 group-hover:text-[#0D2B45] transition">
              {t('admin')}
            </span>
            <span className="text-base text-gray-600 block">{tHome('adminAccess')}</span>
          </Link>

          <Link
            href="/institution"
            className="bg-white p-8 rounded-4xl shadow-xl hover:shadow-2xl transition-all text-center group cursor-pointer"
          >
            <div className="text-5xl mb-4">🏛️</div>
            <span className="text-gray-900 block mb-2 group-hover:text-[#0D2B45] transition">
              {t('institution')}
            </span>
            <span className="text-base text-gray-600 block">{tHome('registerInstitution')}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
