'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { ThemedText } from '@/components/ThemedText';
import Button from '@/components/Button';
import { useRouter } from 'next/navigation';

export default function PrivacyPolicyPage() {
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
              Privacy Policy
            </ThemedText>
            <ThemedText fontSize={14} className="text-gray-600 block">
              Last Updated: October 21, 2025
            </ThemedText>
          </div>

          {/* Content */}
          <div className="space-y-6 text-gray-700">
            <section>
              <ThemedText fontSize={20} fontWeight={700} className="text-black block mb-3">
                1. Information We Collect
              </ThemedText>
              <ThemedText fontSize={14} className="block leading-relaxed mb-2">
                We collect the following types of information:
              </ThemedText>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>
                  <ThemedText fontSize={14}>
                    <strong>Institution Information:</strong> Name, email, phone number, country,
                    website, and address
                  </ThemedText>
                </li>
                <li>
                  <ThemedText fontSize={14}>
                    <strong>Account Information:</strong> Username, password, and authentication
                    credentials
                  </ThemedText>
                </li>
                <li>
                  <ThemedText fontSize={14}>
                    <strong>Usage Data:</strong> Log data, IP addresses, browser type, and access
                    times
                  </ThemedText>
                </li>
                <li>
                  <ThemedText fontSize={14}>
                    <strong>Certificate Data:</strong> Information related to certificates issued
                    and managed through our platform
                  </ThemedText>
                </li>
              </ul>
            </section>

            <section>
              <ThemedText fontSize={20} fontWeight={700} className="text-black block mb-3">
                2. How We Use Your Information
              </ThemedText>
              <ThemedText fontSize={14} className="block leading-relaxed mb-2">
                We use your information to:
              </ThemedText>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>
                  <ThemedText fontSize={14}>Provide and maintain our service</ThemedText>
                </li>
                <li>
                  <ThemedText fontSize={14}>
                    Process institution registration and approval
                  </ThemedText>
                </li>
                <li>
                  <ThemedText fontSize={14}>
                    Communicate with you about your account and service updates
                  </ThemedText>
                </li>
                <li>
                  <ThemedText fontSize={14}>Improve our service and user experience</ThemedText>
                </li>
                <li>
                  <ThemedText fontSize={14}>Ensure security and prevent fraud</ThemedText>
                </li>
              </ul>
            </section>

            <section>
              <ThemedText fontSize={20} fontWeight={700} className="text-black block mb-3">
                3. Data Security
              </ThemedText>
              <ThemedText fontSize={14} className="block leading-relaxed">
                We implement appropriate technical and organizational measures to protect your
                personal information against unauthorized access, alteration, disclosure, or
                destruction. This includes encryption, secure servers, and regular security audits.
              </ThemedText>
            </section>

            <section>
              <ThemedText fontSize={20} fontWeight={700} className="text-black block mb-3">
                4. Data Sharing and Disclosure
              </ThemedText>
              <ThemedText fontSize={14} className="block leading-relaxed">
                We do not sell or rent your personal information to third parties. We may share your
                information only in the following circumstances: with your consent, to comply with
                legal obligations, to protect our rights and safety, or with service providers who
                assist us in operating our platform.
              </ThemedText>
            </section>

            <section>
              <ThemedText fontSize={20} fontWeight={700} className="text-black block mb-3">
                5. Data Retention
              </ThemedText>
              <ThemedText fontSize={14} className="block leading-relaxed">
                We retain your personal information for as long as necessary to provide our services
                and fulfill the purposes outlined in this policy, unless a longer retention period
                is required by law.
              </ThemedText>
            </section>

            <section>
              <ThemedText fontSize={20} fontWeight={700} className="text-black block mb-3">
                6. Your Rights
              </ThemedText>
              <ThemedText fontSize={14} className="block leading-relaxed mb-2">
                You have the right to:
              </ThemedText>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>
                  <ThemedText fontSize={14}>Access your personal information</ThemedText>
                </li>
                <li>
                  <ThemedText fontSize={14}>Correct inaccurate information</ThemedText>
                </li>
                <li>
                  <ThemedText fontSize={14}>Request deletion of your information</ThemedText>
                </li>
                <li>
                  <ThemedText fontSize={14}>Object to processing of your information</ThemedText>
                </li>
                <li>
                  <ThemedText fontSize={14}>Request data portability</ThemedText>
                </li>
              </ul>
            </section>

            <section>
              <ThemedText fontSize={20} fontWeight={700} className="text-black block mb-3">
                7. Cookies and Tracking
              </ThemedText>
              <ThemedText fontSize={14} className="block leading-relaxed">
                We use cookies and similar tracking technologies to track activity on our service
                and store certain information. You can instruct your browser to refuse all cookies
                or to indicate when a cookie is being sent.
              </ThemedText>
            </section>

            <section>
              <ThemedText fontSize={20} fontWeight={700} className="text-black block mb-3">
                8. Changes to This Policy
              </ThemedText>
              <ThemedText fontSize={14} className="block leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any
                changes by posting the new policy on this page and updating the &quot;Last
                Updated&quot; date.
              </ThemedText>
            </section>

            <section>
              <ThemedText fontSize={20} fontWeight={700} className="text-black block mb-3">
                9. Contact Us
              </ThemedText>
              <ThemedText fontSize={14} className="block leading-relaxed">
                If you have questions about this Privacy Policy, please contact us at
                privacy@ganeshadcert.com
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
