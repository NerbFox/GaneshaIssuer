'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { ThemedText } from '@/components/ThemedText';
import Button from '@/components/Button';
import PageHeader from '@/components/PageHeader';

export default function InstitutionSetupPage() {
  const router = useRouter();
  const t = useTranslations('auth.setup');

  return (
    <div className="min-h-screen bg-[#0D2B45] flex items-center justify-center relative py-28 px-4">
      <PageHeader backHref="/" />

      <div className="bg-white rounded-4xl w-full max-w-5xl shadow-xl p-12 md:p-16 relative z-10">
        {/* Logo */}
        <div className="flex justify-end mb-8">
          <div className="flex items-center">
            <Image src="/GWallet.svg" width={50} height={50} alt="GaneshaWallet Logo" />
            <ThemedText fontSize={20} fontWeight={700} className="pl-2 text-[#0C2D48]">
              GaneshaWallet
            </ThemedText>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center py-8">
          {/* Left Side - Text */}
          <div>
            <ThemedText fontSize={40} fontWeight={700} className="text-black block mb-4">
              {t('title')}
            </ThemedText>
            <ThemedText fontSize={16} className="text-gray-600 block">
              {t('subtitle')}
            </ThemedText>
          </div>

          {/* Right Side - Buttons */}
          <div className="flex flex-col space-y-4">
            <Button
              onClick={() => router.push('/institution/register')}
              variant="primary"
              fullWidth
            >
              {t('createWallet')}
            </Button>

            <Button onClick={() => router.push('/institution/login')} variant="secondary" fullWidth>
              {t('loginWallet')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
