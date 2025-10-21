'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { ThemedText } from '@/components/ThemedText';
import Button from '@/components/Button';
import { useRouter } from 'next/navigation';

export default function TermsOfServicePage() {
  const router = useRouter();
  const t = useTranslations('common');

  return (
    <div className="min-h-screen bg-[#0D2B45]">
      <div className="container mx-auto py-20 px-4 max-w-4xl">
        <div className="bg-white rounded-4xl shadow-xl p-8 md:p-12">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="flex items-center">
              <Image src="/GWallet.svg" width={50} height={50} alt="GaneshaWallet Logo" />
              <ThemedText fontSize={20} fontWeight={700} className="pl-2 text-[#0C2D48]">
                GaneshaWallet
              </ThemedText>
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <ThemedText fontSize={40} fontWeight={700} className="text-black block mb-4">
              Terms of Service
            </ThemedText>
            <ThemedText fontSize={14} className="text-gray-600 block">
              Last Updated: October 21, 2025
            </ThemedText>
          </div>

          {/* Content */}
          <div className="space-y-6 text-gray-700">
            <section>
              <ThemedText fontSize={20} fontWeight={700} className="text-black block mb-3">
                1. Introduction
              </ThemedText>
              <ThemedText fontSize={14} className="block leading-relaxed">
                Welcome to GaneshaDCERT. These Terms of Service govern your use of our digital
                certificate management system. By accessing or using our service, you agree to be
                bound by these terms.
              </ThemedText>
            </section>

            <section>
              <ThemedText fontSize={20} fontWeight={700} className="text-black block mb-3">
                2. Service Description
              </ThemedText>
              <ThemedText fontSize={14} className="block leading-relaxed">
                GaneshaDCERT provides a platform for institutions to issue, manage, and verify
                digital certificates. The service includes certificate issuance, verification tools,
                and management dashboards.
              </ThemedText>
            </section>

            <section>
              <ThemedText fontSize={20} fontWeight={700} className="text-black block mb-3">
                3. User Responsibilities
              </ThemedText>
              <ThemedText fontSize={14} className="block leading-relaxed mb-2">
                As a user of our service, you agree to:
              </ThemedText>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>
                  <ThemedText fontSize={14}>
                    Provide accurate and complete information during registration
                  </ThemedText>
                </li>
                <li>
                  <ThemedText fontSize={14}>
                    Maintain the security of your account credentials
                  </ThemedText>
                </li>
                <li>
                  <ThemedText fontSize={14}>
                    Use the service in compliance with applicable laws and regulations
                  </ThemedText>
                </li>
                <li>
                  <ThemedText fontSize={14}>
                    Not misuse or attempt to compromise the security of our service
                  </ThemedText>
                </li>
              </ul>
            </section>

            <section>
              <ThemedText fontSize={20} fontWeight={700} className="text-black block mb-3">
                4. Intellectual Property
              </ThemedText>
              <ThemedText fontSize={14} className="block leading-relaxed">
                All content, features, and functionality of GaneshaDCERT are owned by us and
                protected by international copyright, trademark, and other intellectual property
                laws.
              </ThemedText>
            </section>

            <section>
              <ThemedText fontSize={20} fontWeight={700} className="text-black block mb-3">
                5. Limitation of Liability
              </ThemedText>
              <ThemedText fontSize={14} className="block leading-relaxed">
                GaneshaDCERT is provided &quot;as is&quot; without warranties of any kind. We shall
                not be liable for any indirect, incidental, special, consequential, or punitive
                damages resulting from your use of the service.
              </ThemedText>
            </section>

            <section>
              <ThemedText fontSize={20} fontWeight={700} className="text-black block mb-3">
                6. Changes to Terms
              </ThemedText>
              <ThemedText fontSize={14} className="block leading-relaxed">
                We reserve the right to modify these terms at any time. We will notify users of any
                significant changes via email or through our service.
              </ThemedText>
            </section>

            <section>
              <ThemedText fontSize={20} fontWeight={700} className="text-black block mb-3">
                7. Contact Information
              </ThemedText>
              <ThemedText fontSize={14} className="block leading-relaxed">
                For questions about these Terms of Service, please contact us at
                support@ganeshadcert.com
              </ThemedText>
            </section>

            <div className="border-t pt-6 mt-8">
              <ThemedText fontSize={12} className="text-gray-500 block text-center italic">
                This is a template document. Please update with proper legal content before
                production use.
              </ThemedText>
            </div>
          </div>

          {/* Back Button */}
          <div className="mt-8">
            <Button variant="primary" fullWidth onClick={() => router.back()}>
              {t('back')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
