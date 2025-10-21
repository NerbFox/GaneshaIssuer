'use client';

import { useState, ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { sidebarNavigation, NavigationSection, NavigationItem } from '@/constants/navigation';

interface InstitutionLayoutProps {
  children: ReactNode;
  activeTab?: string;
}

export default function InstitutionLayout({ children, activeTab }: InstitutionLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  const isActive = (item: NavigationItem) => {
    if (activeTab) {
      return item.id === activeTab;
    }
    return pathname.includes(item.href);
  };

  return (
    <div className="min-h-screen bg-[#0C2D48] relative">
      {/* Sidebar closed button - sticks to top-left corner */}
      {isCollapsed && (
        <button
          onClick={() => setIsCollapsed(false)}
          className="absolute top-0 left-0 w-16 h-16 bg-[#F5F5F5] rounded-br-3xl flex items-center justify-center hover:bg-gray-200 transition-colors shadow-lg z-50"
          aria-label="Open sidebar"
        >
          <Image
            src="/SidebarIcon.svg"
            alt="Sidebar"
            width={24}
            height={24}
          />
        </button>
      )}

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
                  className="w-6 h-6 border border-gray-300 rounded flex items-center justify-center hover:bg-gray-200"
                  aria-label="Close sidebar"
                >
                  <span className="text-xs">✕</span>
                </button>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4 px-3">
              {sidebarNavigation.map((section: NavigationSection, sectionIndex: number) => (
                <div key={sectionIndex} className="mb-5">
                  {section.title && (
                    <div className="px-2 mb-2">
                      <h3 className="text-xs font-normal text-gray-400">
                        {section.title}
                      </h3>
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
                          <span className="text-sm">{item.label}</span>
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
                  <Image
                    src="/GWallet.svg"
                    alt="GaneshaWallet"
                    width={24}
                    height={24}
                  />
                </div>
                <span className="font-semibold text-sm text-gray-900">GaneshaWallet</span>
              </div>
            </div>
          </aside>
        )}

        {/* Main Content Canvas */}
        <main className={`bg-white rounded-3xl overflow-auto ${isCollapsed ? 'w-full h-full' : 'flex-1'}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
