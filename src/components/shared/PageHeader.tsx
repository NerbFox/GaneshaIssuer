'use client';

import { Link } from '@/i18n/routing';
import LanguageSwitcher from '@/components/shared/LanguageSwitcher';

interface PageHeaderProps {
  backHref?: string;
  showBack?: boolean;
}

export default function PageHeader({ backHref = '/', showBack = true }: PageHeaderProps) {
  return (
    <>
      {/* Language Switcher - Top Right */}
      <div className="absolute top-6 right-6 z-30">
        <LanguageSwitcher />
      </div>

      {/* Back Button - Top Left */}
      {showBack && (
        <div className="absolute top-6 left-6 z-30">
          <Link
            href={backHref}
            className="flex items-center text-white hover:text-gray-200 transition-colors cursor-pointer"
          >
            <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            <span className="font-medium">Back</span>
          </Link>
        </div>
      )}
    </>
  );
}
