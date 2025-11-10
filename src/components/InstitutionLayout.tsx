'use client';

import { useState, ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { sidebarNavigation, NavigationSection, NavigationItem } from '@/constants/navigation';
import { ThemedText } from './ThemedText';
import ConfirmationModal from './ConfirmationModal';
import { clearAllVCs } from '@/utils/indexedDB';

interface InstitutionLayoutProps {
  children: ReactNode;
  activeTab?: string;
}

export default function InstitutionLayout({ children, activeTab }: InstitutionLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (item: NavigationItem) => {
    if (activeTab) {
      return item.id === activeTab;
    }
    return pathname.includes(item.href);
  };

  const handleLogout = async () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    // Close the confirmation modal
    setShowLogoutConfirm(false);

    try {
      // Clear all credentials from IndexedDB
      console.log('[Logout] Clearing all credentials from IndexedDB...');
      await clearAllVCs();
      console.log('[Logout] All credentials cleared successfully');
    } catch (error) {
      console.error('[Logout] Error clearing credentials:', error);
      // Continue with logout even if clearing fails
    }

    // Clear all data from localStorage
    localStorage.clear();

    // Clear all cookies
    document.cookie.split(';').forEach((cookie) => {
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    });

    // Extract locale from pathname (e.g., /en/institution/... -> en)
    const locale = pathname.split('/')[1] || 'en';

    // Redirect to base URL with locale
    router.push(`/${locale}`);
  };

  return (
    <div className="min-h-screen bg-[#0C2D48] relative">
      {/* Sidebar closed button - sticks to top-left corner */}
      <div
        className={`absolute top-0 left-0 w-16 h-16 bg-[#F5F5F5] rounded-br-3xl flex items-center justify-center hover:bg-gray-200 shadow-lg z-50 transition-all duration-500 ease-in-out ${
          isCollapsed
            ? 'opacity-100 translate-x-0'
            : 'opacity-0 -translate-x-20 pointer-events-none'
        }`}
      >
        <button
          onClick={() => setIsCollapsed(false)}
          className="w-full h-full flex items-center justify-center group cursor-pointer"
          aria-label="Open sidebar"
        >
          <Image
            src="/SidebarIcon.svg"
            alt="Sidebar"
            width={24}
            height={24}
            className="transition-transform duration-300 group-hover:scale-125 group-hover:translate-x-1"
          />
        </button>
      </div>

      <div className="p-5 flex gap-5 h-screen">
        {/* Sidebar */}
        {!isCollapsed && (
          <aside className="w-56 bg-[#F5F5F5] rounded-3xl flex flex-col overflow-hidden">
            {/* Header with toggle */}
            <div className="p-4 border-gray-200">
              <div className="flex items-center justify-end">
                {/* Toggle button */}
                <button
                  onClick={() => setIsCollapsed(true)}
                  className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-200 transition-all duration-300 group cursor-pointer"
                  aria-label="Close sidebar"
                >
                  <Image
                    src="/SidebarIcon.svg"
                    alt="Sidebar"
                    width={24}
                    height={24}
                    className="transition-transform duration-300 group-hover:scale-125 group-hover:-translate-x-1"
                  />
                </button>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4 px-3">
              {sidebarNavigation.map((section: NavigationSection, sectionIndex: number) => (
                <div key={sectionIndex} className="mb-5">
                  {section.title && (
                    <div className="px-2 mb-2">
                      <ThemedText fontSize={14} className="text-xs font-normal text-gray-500">
                        {section.title}
                      </ThemedText>
                    </div>
                  )}
                  <ul className="space-y-0.5">
                    {section.items.map((item: NavigationItem) => (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          className={`flex items-center gap-2 px-2 py-2 rounded transition-colors ${
                            isActive(item)
                              ? 'bg-gray-300 text-gray-900'
                              : 'text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {/* Icon */}
                          <div className="w-4 h-4 flex items-center justify-center">
                            {item.icon && (
                              <Image
                                src={`/${item.icon}`}
                                alt={item.label}
                                width={16}
                                height={16}
                                className="object-contain"
                              />
                            )}
                          </div>
                          <ThemedText className="text-sm text-black">{item.label}</ThemedText>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>

            {/* GaneshaWallet Footer */}
            <div className="p-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 flex items-center justify-center">
                  <Image src="/GWallet.svg" alt="GaneshaWallet" width={24} height={24} />
                </div>
                <ThemedText fontSize={20} fontWeight={700} className="text-[#0C2D48]">
                  GaneshaWallet
                </ThemedText>
              </div>
            </div>
          </aside>
        )}

        {/* Main Content Canvas */}
        <main
          className={`bg-white rounded-3xl overflow-auto ${isCollapsed ? 'w-full h-full' : 'flex-1'} flex flex-col`}
        >
          {/* Navbar */}
          <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-end">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium cursor-pointer"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Logout
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto">{children}</div>
        </main>
      </div>

      {/* Logout Confirmation Modal */}
      <ConfirmationModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={confirmLogout}
        title="Confirm Logout"
        message="Are you sure you want to logout? All unsaved changes will be lost."
        confirmText="Logout"
        cancelText="Cancel"
        confirmButtonColor="red"
      />
    </div>
  );
}
