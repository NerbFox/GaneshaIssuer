'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { ThemedText } from '@/components/ThemedText';
import Button from '@/components/Button';
import PageHeader from '@/components/PageHeader';
import { useRouter } from 'next/navigation';

export default function RegistrationSuccessPage() {
  const router = useRouter();
  const t = useTranslations('auth.register.success');

  return (
    <div className="min-h-screen bg-[#0D2B45] flex items-center justify-center relative py-28 px-4">
      <PageHeader showBack={false} />

      <div className="bg-white rounded-4xl w-full max-w-2xl shadow-xl p-8 md:p-12 relative z-10">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center">
            <Image src="/GWallet.svg" width={50} height={50} alt="GaneshaWallet Logo" />
            <ThemedText fontSize={20} fontWeight={700} className="pl-2 text-[#0C2D48]">
              GaneshaWallet
            </ThemedText>
          </div>
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <ThemedText fontSize={36} fontWeight={700} className="text-black mb-4 block">
            {t('title')}
          </ThemedText>
          <ThemedText fontSize={16} className="text-gray-700 leading-relaxed block">
            {t('subtitle')}
          </ThemedText>
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
            <div>
              <ThemedText fontSize={14} fontWeight={600} className="text-[#0D2B45] mb-2 block">
                What happens next?
              </ThemedText>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-[#0D2B45] mt-1">•</span>
                  <ThemedText fontSize={14} className="text-gray-700">
                    Our admin team will review your application
                  </ThemedText>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#0D2B45] mt-1">•</span>
                  <ThemedText fontSize={14} className="text-gray-700">
                    You&apos;ll receive a magic link via email once approved
                  </ThemedText>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#0D2B45] mt-1">•</span>
                  <ThemedText fontSize={14} className="text-gray-700">
                    Use the magic link to complete your institution setup
                  </ThemedText>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Back to Home Button */}
        <Button variant="primary" fullWidth onClick={() => router.push('/')}>
          {t('backToHome')}
        </Button>
      </div>
    </div>
  );
}
