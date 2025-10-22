'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ThemedText } from '@/components/ThemedText';
import Button from '@/components/Button';
import AuthContainer from '@/components/AuthContainer';

export default function InstitutionSetupPage() {
  const router = useRouter();
  const t = useTranslations('auth.setup');

  return (
    <AuthContainer>
      {/* Two Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        {/* Left Side - Text */}
        <div>
          <ThemedText fontSize={32} fontWeight={700} className="text-black block mb-1">
            {t('title')}
          </ThemedText>
          <ThemedText fontSize={16} className="text-gray-600 block">
            {t('subtitle')}
          </ThemedText>
        </div>

        {/* Right Side - Buttons */}
        <div className="flex flex-col space-y-4">
          <Button onClick={() => router.push('/institution/register')} variant="primary" fullWidth>
            {t('createWallet')}
          </Button>

          <Button onClick={() => router.push('/institution/login')} variant="secondary" fullWidth>
            {t('loginWallet')}
          </Button>
        </div>
      </div>
    </AuthContainer>
  );
}
