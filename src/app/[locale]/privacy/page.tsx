'use client';

import { useTranslations, useLocale } from 'next-intl';
import Image from 'next/image';
import { ThemedText } from '@/components/shared/ThemedText';
import Button from '@/components/shared/Button';
import { useRouter } from 'next/navigation';
import LanguageSwitcher from '@/components/shared/LanguageSwitcher';
import { privacyContent as privacyContentEn } from '@/content/privacy/en';
import { privacyContent as privacyContentId } from '@/content/privacy/id';
import { privacyContent as privacyContentKo } from '@/content/privacy/ko';

export default function PrivacyPolicyPage() {
  const router = useRouter();
  const t = useTranslations('privacy');
  const locale = useLocale();

  const getContent = () => {
    switch (locale) {
      case 'id':
        return privacyContentId;
      case 'ko':
        return privacyContentKo;
      default:
        return privacyContentEn;
    }
  };

  const content = getContent();

  return (
    <div className="min-h-screen bg-[#0D2B45]">
      <div className="container mx-auto py-20 px-4 max-w-4xl">
        <div className="bg-white rounded-4xl shadow-xl p-8 md:p-12">
          {/* Header with Logo and Language Switcher */}
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-[#0D2B45] rounded-full opacity-10"></div>
                <div className="relative">
                  <Image src="/GWallet.svg" width={50} height={50} alt="GaneshaWallet Logo" />
                </div>
              </div>
              <ThemedText fontSize={20} fontWeight={700} className="text-[#0C2D48]">
                GaneshaWallet
              </ThemedText>
            </div>
            <LanguageSwitcher preserveQuery={true} />
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <ThemedText fontSize={40} fontWeight={700} className="text-black block mb-4">
              {t('title')}
            </ThemedText>
            <ThemedText fontSize={14} className="text-gray-600 block">
              {t('lastUpdated')}
            </ThemedText>
          </div>

          {/* Content */}
          <div className="space-y-6 text-gray-700">
            {content.sections.map((section, index) => (
              <section key={index}>
                <ThemedText fontSize={20} fontWeight={700} className="text-black block mb-3">
                  {section.title}
                </ThemedText>
                <ThemedText fontSize={14} className="block leading-relaxed whitespace-pre-line">
                  {section.content}
                </ThemedText>
              </section>
            ))}
          </div>

          {/* Back Button */}
          <div className="mt-10 text-center">
            <Button variant="primary" onClick={() => router.push('/institution/register')}>
              {t('back')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
