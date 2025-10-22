'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ThemedText } from '@/components/ThemedText';
import Button from '@/components/Button';
import AuthContainer from '@/components/AuthContainer';

export default function RegistrationConfirmPage() {
  const router = useRouter();
  const [didId, setDidId] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  // Generate a mock DID on component mount
  useEffect(() => {
    // In a real implementation, this would come from your DID generation process
    const mockDid = 'did:git:abcdefghijklmnopqrstuvwxyzABC123';
    setDidId(mockDid);
  }, []);

  const copyToClipboard = async () => {
    if (!didId) return;

    try {
      await navigator.clipboard.writeText(didId);
      setIsCopied(true);
      // Reset copied state after 3 seconds
      setTimeout(() => setIsCopied(false), 3000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleDownload = () => {
    // Create a simple text file with DID information
    const content = `Your DID: ${didId}\n\nGenerated on: ${new Date().toLocaleDateString()}\n\nKeep this information safe and secure.`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'did-information.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleContinue = () => {
    // Navigate to dashboard or next step
    router.push('/dashboard');
  };

  return (
    <AuthContainer>
      {/* GaneshaWallet Logo */}
      <div className="mb-8 flex justify-end">
        <div className="flex items-center gap-2">
          <Image
            src="/GWallet.svg"
            alt="GaneshaWallet"
            width={24}
            height={24}
            className="w-6 h-6"
          />
          <ThemedText fontSize={16} fontWeight={600} className="text-gray-800">
            GaneshaWallet
          </ThemedText>
        </div>
      </div>

      {/* Title */}
      <div className="mb-6">
        <ThemedText fontSize={32} fontWeight={700} className="text-black mb-1 block">
          Congratulations!
        </ThemedText>
        <ThemedText fontSize={16} className="text-gray-600 block">
          Your wallet is protected and ready to use. You can change your security preference in the
          Settings.
        </ThemedText>
      </div>

      <ThemedText fontSize={16} className="text-gray-600">
        This is your DID:
      </ThemedText>

      {/* DID Information Section */}
      <div className="mt-2 mb-2">
        <div className="relative">
          <div className="text-black w-full px-4 py-3 bg-[#E9F2F5] rounded-lg border-0 text-sm font-mono break-all">
            {didId}
          </div>
          <label className="absolute top-2 left-4"></label>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mb-6 flex gap-3 justify-center">
        {/* Copy Button */}
        <div className="flex justify-end">
          <button
            onClick={copyToClipboard}
            disabled={!didId}
            className="inline-flex items-center gap-2 py-2 px-4 bg-transparent hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCopied ? (
              <div className="text-green-600 whitespace-nowrap text-sm flex items-center gap-2 font-semibold">
                <svg
                  className="w-[18px] h-[18px] text-green-600 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Copied to Clipboard
              </div>
            ) : (
              <div className="text-[#007ACC] whitespace-nowrap text-sm flex items-center gap-2 font-semibold">
                <svg
                  className="w-[18px] h-[18px] text-[#007ACC] flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                Copy to Clipboard
              </div>
            )}
          </button>
        </div>

        {/* Download Button */}
        <div className="flex justify-end">
          <button
            onClick={handleDownload}
            disabled={!didId}
            className="inline-flex items-center gap-2 py-2 px-4 bg-transparent hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="text-[#007ACC] whitespace-nowrap text-sm flex items-center gap-2 font-semibold">
              <svg
                className="w-[18px] h-[18px] text-[#007ACC] flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Download as .txt
            </div>
          </button>
        </div>
      </div>

      {/* Continue Button */}
      <Button
        type="button"
        onClick={handleContinue}
        variant="primary"
        fullWidth
        className="bg-[#0D2B45] text-white py-3"
      >
        Continue
      </Button>
    </AuthContainer>
  );
}
