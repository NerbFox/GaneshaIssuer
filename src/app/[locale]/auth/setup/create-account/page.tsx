'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ThemedText } from '@/components/ThemedText';
import { StepIndicator } from '@/components/StepIndicator';
import Link from 'next/dist/client/link';

export default function CreateAccountPage() {
  const [name, setName] = useState('');
  const [country, setCountry] = useState('Indonesia');

  const handleContinue = () => {
    // Handle form submission and navigation to next step
    console.log({ name, country });
    // router.push("/auth/setup/secure-wallet");
  };

  return (
    <div className="min-h-screen bg-[#0D2B45] flex items-center justify-center relative">
      <div className="bg-white rounded-4xl w-7/10 h-7/10 shadow-xl justify-between items-center p-10 relative">
        {/* Logo top-right */}
        <div className="top-6 right-6 flex flex-col items-end">
          <div className="flex">
            <Image src="/GWallet.svg" width={50} height={50} alt="GaneshaWallet Logo" />
            <ThemedText
              fontSize={20}
              fontWeight={700}
              className="pl-2 flex items-center text-[#0C2D48]"
            >
              GaneshaWallet
            </ThemedText>
          </div>
        </div>

        {/* Step Indicator at the top */}
        <div className="max-w-4xl mx-auto pt-4 pb-4">
          <StepIndicator currentStep={1} />
        </div>

        <div className="flex flex-col md:flex-row justify-between max-w-full py-4 px-2 sm:py-6 sm:px-6 md:py-8 md:px-6 lg:py-6 lg:px-15">
          {/* Left Section */}
          <div className="max-w-sm text-center md:text-left mb-6 md:mb-12 justify-items-center md:justify-center pr-5 flex-col flex ">
            <ThemedText
              fontSize={40}
              fontWeight={700}
              className="text-black text-xl md:text-4xl sm:text-2xl"
            >
              Create an Account
            </ThemedText>
            <ThemedText fontSize={16} className="text-black leading-relaxed mt-2">
              Get an account to get started
            </ThemedText>
          </div>

          {/* Right Section - Form */}
          <div className="flex flex-col w-full max-w-sm">
            {/* Form Fields */}
            <div className="space-y-4">
              {/* Name Field */}
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 pt-8 pb-2 bg-[#E9F2F5] border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D2B45] text-black"
                  style={{ fontSize: '14px' }}
                  placeholder="John Doe"
                />
                <label className="absolute left-4 top-2">
                  <ThemedText fontSize={12} fontWeight={500} className="text-gray-700">
                    Name<span className="text-red-500">*</span>
                  </ThemedText>
                </label>
              </div>

              {/* Country Field */}
              <div className="relative">
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-4 pt-8 pb-2 bg-[#E9F2F5] border-none rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-[#0D2B45] cursor-pointer text-black"
                  style={{ fontSize: '14px', fontWeight: 400 }}
                >
                  <option value="Indonesia">Indonesia</option>
                  <option value="United States">United States</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Singapore">Singapore</option>
                  <option value="Malaysia">Malaysia</option>
                  <option value="Thailand">Thailand</option>
                  <option value="Japan">Japan</option>
                  <option value="South Korea">South Korea</option>
                  <option value="Australia">Australia</option>
                </select>
                <label className="absolute left-4 top-2 pointer-events-none">
                  <ThemedText fontSize={12} fontWeight={500} className="text-gray-700">
                    Country<span className="text-red-500">*</span>
                  </ThemedText>
                </label>
                {/* Custom dropdown arrow */}
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                  <svg
                    className="w-4 h-4 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>

              {/* Privacy Policy Notice */}
              <div className="text-center pt-2">
                <ThemedText fontSize={12} className="text-gray-600">
                  By continuing, you agree to the{' '}
                  <Link href="/privacy-policy" className="text-[#0D9AB8] hover:underline">
                    Privacy Policy
                  </Link>
                </ThemedText>
              </div>

              {/* Continue Button */}
              <button
                onClick={handleContinue}
                className="w-full bg-[#0D2B45] text-white rounded-xl py-3 font-medium hover:opacity-90 transition mt-4"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
