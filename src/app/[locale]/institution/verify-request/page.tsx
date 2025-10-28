'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import InstitutionLayout from '@/components/InstitutionLayout';
import { ThemedText } from '@/components/ThemedText';
import { redirectIfNotAuthenticated } from '@/utils/auth';

export default function VerifyRequestPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check authentication on component mount
  useEffect(() => {
    const shouldRedirect = redirectIfNotAuthenticated(router);
    if (!shouldRedirect) {
      setIsAuthenticated(true);
    }
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
    <InstitutionLayout activeTab="verify-request">
      <div className="p-12">
        <ThemedText fontSize={40} fontWeight={700} className="text-black mb-8">
          Verify Request
        </ThemedText>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-blue-50 rounded-2xl p-6">
            <ThemedText className="text-sm text-gray-600 mb-2">Total Requests</ThemedText>
            <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
              0
            </ThemedText>
          </div>
          <div className="bg-yellow-50 rounded-2xl p-6">
            <ThemedText className="text-sm text-gray-600 mb-2">Pending</ThemedText>
            <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
              0
            </ThemedText>
          </div>
          <div className="bg-green-50 rounded-2xl p-6">
            <ThemedText className="text-sm text-gray-600 mb-2">Verified</ThemedText>
            <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
              0
            </ThemedText>
          </div>
        </div>

        {/* Content Area */}
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">✅</div>
            <ThemedText fontSize={20} fontWeight={600} className="text-gray-900 mb-2">
              No Verification Requests Yet
            </ThemedText>
            <ThemedText className="text-gray-500">
              Verification requests will appear here
            </ThemedText>
          </div>
        </div>
      </div>
    </InstitutionLayout>
  );
}
