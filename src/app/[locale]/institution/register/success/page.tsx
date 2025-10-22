'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Button from '@/components/Button';
import AuthContainer from '@/components/AuthContainer';
import { useRouter } from 'next/navigation';

export default function RegistrationSuccessPage() {
  const router = useRouter();
  const t = useTranslations('auth.register.success');

  return (
    <AuthContainer backHref="/institution">
      {/* Title */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-black mb-1 block">{t('title')}</h1>
        <p className="text-base text-gray-600 block">{t('subtitle')}</p>
      </div>

      {/* Success Icon */}
      <div className="text-center mb-6">
        <div className="mx-auto h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <svg
            className="h-12 w-12 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>

      {/* Information Box */}
      <div className="bg-[#E9F2F5] rounded-lg p-6 mb-8">
        <div className="flex items-start gap-3">
          <svg
            className="w-6 h-6 text-[#0D2B45] flex-shrink-0 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-[#0D2B45] mb-3 block">
              {t('whatHappensNext')}
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="text-[#0D2B45] font-bold flex-shrink-0">•</span>
                <p className="text-sm text-gray-700 flex-1">{t('step1')}</p>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#0D2B45] font-bold flex-shrink-0">•</span>
                <p className="text-sm text-gray-700 flex-1">{t('step2')}</p>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#0D2B45] font-bold flex-shrink-0">•</span>
                <p className="text-sm text-gray-700 flex-1">{t('step3')}</p>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Back to Home Button */}
      <Button variant="primary" fullWidth onClick={() => router.push('/')}>
        {t('backToHome')}
      </Button>
    </AuthContainer>
  );
}
