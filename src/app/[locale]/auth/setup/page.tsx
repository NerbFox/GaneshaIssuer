// app/wallet-setup/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ThemedText } from '@/components/ThemedText';

export default function WalletSetupPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#0D2B45] flex items-center justify-center relative">
      <div
        className="bg-white rounded-4xl w-7/10 h-7/10 shadow-xl
        justify-between items-center p-10 relative"
      >
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
        <div
          className="flex flex-col md:flex-row justify-between max-w-full 
            py-10 px-5 sm:py-16 sm:px-10 md:py-24 md:px-15 lg:py-35 lg:px-15"
        >
          <div className="max-w-sm text-center md:text-left mb-6 md:mb-0 justify-items-start pr-5 flex-col flex">
            <ThemedText fontSize={40} fontWeight={700} className="text-black">
              Wallet setup
            </ThemedText>
            <ThemedText fontSize={16} className="text-black leading-relaxed">
              Login to your existing wallet or create a new one
            </ThemedText>
          </div>

          {/* Right Section */}
          <div className="flex flex-col space-y-3 w-full max-w-xs">
            <button
              onClick={() => router.push('/auth/setup/create-account')}
              className="bg-[#0D2B45] rounded-xl text-white rounded-md py-3 font-medium hover:opacity-90 transition"
            >
              Create a new wallet
            </button>

            <button
              onClick={() => router.push('/wallet/login')}
              className="bg-[#E9F2F5] rounded-xl text-gray-800 rounded-md py-3 font-medium hover:bg-[#DDE8EB] transition"
            >
              Login to existing wallet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
