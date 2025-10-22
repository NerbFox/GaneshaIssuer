'use client';

import { useState, ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { sidebarNavigation, NavigationSection, NavigationItem } from '@/constants/navigation';
import { ThemedText } from './ThemedText';

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
      <div
        className={`absolute top-0 left-0 w-16 h-16 bg-[#F5F5F5] rounded-br-3xl flex items-center justify-center hover:bg-gray-200 shadow-lg z-50 transition-all duration-500 ease-in-out ${
          isCollapsed
            ? 'opacity-100 translate-x-0'
            : 'opacity-0 -translate-x-20 pointer-events-none'
        }`}
      >
        <button
          onClick={() => setIsCollapsed(false)}
          className="w-full h-full flex items-center justify-center group"
          aria-label="Open sidebar"
        >
          <Image
            src="/SidebarIcon.svg"
            alt="Sidebar"
            width={24}
            height={24}
            className="transition-transform duration-300 group-hover:scale-110 group-hover:rotate-180"
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
                  className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-200 transition-all duration-300 group"
                  aria-label="Close sidebar"
                >
                <Image
                  src="/SidebarIcon.svg"
                  alt="Sidebar"
                  width={24}
                  height={24}
                  className="transition-transform duration-300 group-hover:scale-110 group-hover:rotate-180"
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
                  <Image
                    src="/GWallet.svg"
                    alt="GaneshaWallet"
                    width={24}
                    height={24}
                  />
                </div>
                <ThemedText fontSize={20} fontWeight={700} className="text-[#0C2D48]">GaneshaWallet</ThemedText>
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