'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Button from '@/components/shared/Button';
import AuthContainer from '@/components/shared/AuthContainer';

export default function InstitutionSetupPage() {
  const router = useRouter();
  const t = useTranslations('auth.setup');

  return (
    <AuthContainer>
      {/* Two Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        {/* Left Side - Text */}
        <div>
          <span className="text-[32px] font-bold text-black block mb-1">{t('title')}</span>
          <span className="text-base text-gray-600 block">{t('subtitle')}</span>
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
