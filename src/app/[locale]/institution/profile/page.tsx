'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import InstitutionLayout from '@/components/InstitutionLayout';
import { ThemedText } from '@/components/ThemedText';
import { redirectIfNotAuthenticated } from '@/utils/auth';

interface InstitutionData {
  id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  website: string;
  address: string;
  status: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export default function InstitutionProfilePage() {
  const router = useRouter();
  const [did, setDid] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [institutionData, setInstitutionData] = useState<InstitutionData | null>(null);
  const [error, setError] = useState<string>('');

  // Check authentication on component mount
  useEffect(() => {
    const shouldRedirect = redirectIfNotAuthenticated(router);
    if (!shouldRedirect) {
      setIsAuthenticated(true);
    }
  }, [router]);

  useEffect(() => {
    if (!isAuthenticated) return;

    try {
      // Retrieve DID from localStorage
      const storedDid = localStorage.getItem('institutionDID');
      if (storedDid) {
        setDid(storedDid);
      }

      // Retrieve institution data from localStorage
      const storedInstitutionData = localStorage.getItem('institutionData');
      if (storedInstitutionData) {
        const parsedData = JSON.parse(storedInstitutionData);
        setInstitutionData(parsedData);
      } else {
        setError('Institution data not found');
      }
    } catch (err) {
      console.error('Error loading profile data:', err);
      setError('Failed to load profile data');
    }
  }, [isAuthenticated]);

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
    <InstitutionLayout activeTab="profile">
      {/* Profile Content */}
      <div className="p-12 max-w-4xl">
        <ThemedText fontSize={40} fontWeight={700} className="text-black mb-12">
          Profile
        </ThemedText>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <ThemedText fontSize={14}>{error}</ThemedText>
          </div>
        )}

        {/* Institution Name Field */}
        <div className="mt-5 mb-5">
          <ThemedText className="block text-sm font-medium text-gray-900 mb-3">
            Institution Name
          </ThemedText>
          <input
            type="text"
            value={institutionData?.name || ''}
            readOnly
            className="w-full px-4 py-3 bg-[#F4F7FC] border border-gray-200 rounded-lg text-gray-500 text-sm"
          />
        </div>

        {/* Email Field */}
        <div className="mb-5">
          <ThemedText className="block text-sm font-medium text-gray-900 mb-3">Email</ThemedText>
          <input
            type="email"
            value={institutionData?.email || ''}
            readOnly
            className="w-full px-4 py-3 bg-[#F4F7FC] border border-gray-200 rounded-lg text-gray-500 text-sm"
          />
        </div>

        {/* Phone Number Field */}
        <div className="mb-5">
          <ThemedText className="block text-sm font-medium text-gray-900 mb-3">
            Phone Number
          </ThemedText>
          <input
            type="tel"
            value={institutionData?.phone || ''}
            readOnly
            className="w-full px-4 py-3 bg-[#F4F7FC] border border-gray-200 rounded-lg text-gray-500 text-sm"
          />
        </div>

        {/* Country Field */}
        <div className="mb-5">
          <ThemedText className="block text-sm font-medium text-gray-900 mb-3">Country</ThemedText>
          <input
            type="text"
            value={institutionData?.country || ''}
            readOnly
            className="w-full px-4 py-3 bg-[#F4F7FC] border border-gray-200 rounded-lg text-gray-500 text-sm"
          />
        </div>

        {/* Address Field */}
        <div className="mb-5">
          <ThemedText className="block text-sm font-medium text-gray-900 mb-3">Address</ThemedText>
          <input
            type="text"
            value={institutionData?.address || ''}
            readOnly
            className="w-full px-4 py-3 bg-[#F4F7FC] border border-gray-200 rounded-lg text-gray-500 text-sm"
          />
        </div>

        {/* Website Field */}
        <div className="mb-5">
          <ThemedText className="block text-sm font-medium text-gray-900 mb-3">Website</ThemedText>
          <input
            type="text"
            value={institutionData?.website || ''}
            readOnly
            className="w-full px-4 py-3 bg-[#F4F7FC] border border-gray-200 rounded-lg text-gray-500 text-sm"
          />
        </div>

        {/* DID Field */}
        <div className="mb-5">
          <ThemedText className="block text-sm font-medium text-gray-900 mb-3">DID</ThemedText>
          <input
            type="text"
            value={did}
            readOnly
            className="w-full px-4 py-3 bg-[#F4F7FC] border border-gray-200 rounded-lg text-gray-500 text-sm"
          />
        </div>
      </div>
    </InstitutionLayout>
  );
}
