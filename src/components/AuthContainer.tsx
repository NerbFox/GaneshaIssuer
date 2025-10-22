import { ReactNode } from 'react';
import Image from 'next/image';
import PageHeader from '@/components/PageHeader';
import { ThemedText } from '@/components/ThemedText';

interface AuthContainerProps {
  children: ReactNode;
  backHref?: string;
}

export default function AuthContainer({ children, backHref = '/' }: AuthContainerProps) {
  return (
    <div className="min-h-screen bg-[#0D2B45] flex items-center justify-center relative py-28 px-4">
      {backHref && <PageHeader backHref={backHref} />}

      <div className="bg-white rounded-4xl w-full max-w-4xl min-h-[37rem] shadow-xl p-12 md:p-16 relative flex items-center justify-center">
        {/* Logo - Absolute positioned */}
        <div className="absolute top-8 right-8">
          <div className="flex items-center">
            <Image src="/GWallet.svg" width={50} height={50} alt="GaneshaWallet Logo" />
            <ThemedText fontSize={20} fontWeight={700} className="pl-2 text-[#0C2D48]">
              GaneshaWallet
            </ThemedText>
          </div>
        </div>

        {/* Centered children */}
        <div className="w-full">{children}</div>
      </div>
    </div>
  );
}
