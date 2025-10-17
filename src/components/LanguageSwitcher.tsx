'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';

const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'id', name: 'Indonesia', flag: '🇮🇩' },
];

interface LanguageSwitcherProps {
  preserveQuery?: boolean;
}

export default function LanguageSwitcher({ preserveQuery = false }: LanguageSwitcherProps) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);

  const currentLanguage = languages.find((lang) => lang.code === locale) || languages[0];

  const handleLanguageChange = (newLocale: string) => {
    startTransition(() => {
      // Get current path without locale prefix
      const pathWithoutLocale = pathname.replace(/^\/(en|ko|id)/, '');
      
      // Build new path with new locale
      let newPath = `/${newLocale}${pathWithoutLocale}`;
      
      // Preserve query parameters if needed
      if (preserveQuery && searchParams.toString()) {
        newPath += `?${searchParams.toString()}`;
      }
      
      router.push(newPath);
      setIsOpen(false);
    });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
        className="flex items-center space-x-2 px-4 py-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-all border border-gray-200 disabled:opacity-50"
      >
        <span className="text-xl">{currentLanguage.flag}</span>
        <span className="font-medium text-gray-700">{currentLanguage.name}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-20">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                disabled={isPending}
                className={`w-full flex items-center space-x-3 px-4 py-2 hover:bg-gray-100 transition-colors ${
                  locale === lang.code ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                } disabled:opacity-50`}
              >
                <span className="text-xl">{lang.flag}</span>
                <span className="font-medium">{lang.name}</span>
                {locale === lang.code && (
                  <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
