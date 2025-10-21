'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import Image from 'next/image';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { ThemedText } from '@/components/ThemedText';

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
          <ThemedText fontSize={48} fontWeight={700} className="block mb-4">
            {tHome('title')}
          </ThemedText>
          <ThemedText fontSize={20} className="text-gray-300 block">
            {tHome('subtitle')}
          </ThemedText>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <Link
            href="/admin/login"
            className="bg-white p-8 rounded-4xl shadow-xl hover:shadow-2xl transition-all text-center group cursor-pointer"
          >
            <div className="text-5xl mb-4">🔐</div>
            <ThemedText
              fontSize={24}
              fontWeight={700}
              className="text-gray-900 block mb-2 group-hover:text-[#0D2B45] transition"
            >
              {t('admin')}
            </ThemedText>
            <ThemedText fontSize={14} className="text-gray-600 block">
              {tHome('adminAccess')}
            </ThemedText>
          </Link>

          <Link
            href="/institution/setup"
            className="bg-white p-8 rounded-4xl shadow-xl hover:shadow-2xl transition-all text-center group cursor-pointer"
          >
            <div className="text-5xl mb-4">🏛️</div>
            <ThemedText
              fontSize={24}
              fontWeight={700}
              className="text-gray-900 block mb-2 group-hover:text-[#0D2B45] transition"
            >
              {t('institution')}
            </ThemedText>
            <ThemedText fontSize={14} className="text-gray-600 block">
              {tHome('registerInstitution')}
            </ThemedText>
          </Link>
        </div>
      </div>
    </div>
  );
}
