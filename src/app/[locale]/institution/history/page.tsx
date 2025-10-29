'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import InstitutionLayout from '@/components/InstitutionLayout';
import { ThemedText } from '@/components/ThemedText';
import { redirectIfJWTInvalid } from '@/utils/auth';

export default function HistoryPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check authentication with JWT verification on component mount
  useEffect(() => {
    const checkAuth = async () => {
      const redirected = await redirectIfJWTInvalid(router);
      if (!redirected) {
        setIsAuthenticated(true);
      }
    };

    checkAuth();
  }, [router]);

  // Show loading screen while checking authentication
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0D2B45] mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  return (
    <InstitutionLayout activeTab="history">
      <div className="p-12">
        <ThemedText fontSize={40} fontWeight={700} className="text-black mb-8">
          History
        </ThemedText>

        {/* Filter Section */}
        <div className="mb-6 flex gap-4">
          <select className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm">
            <option value="all">All Activities</option>
            <option value="issued">Issued</option>
            <option value="revoked">Revoked</option>
            <option value="verified">Verified</option>
          </select>
          <input
            type="date"
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm"
            placeholder="From Date"
          />
          <input
            type="date"
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm"
            placeholder="To Date"
          />
        </div>

        {/* Content Area */}
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📁</div>
            <ThemedText fontSize={20} fontWeight={600} className="text-gray-900 mb-2">
              No History Yet
            </ThemedText>
            <ThemedText className="text-gray-500">
              Your activity history will appear here
            </ThemedText>
          </div>
        </div>
      </div>
    </InstitutionLayout>
  );
}
