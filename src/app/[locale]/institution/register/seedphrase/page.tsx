'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/shared/Button';
import AuthContainer from '@/components/shared/AuthContainer';
import { generateMnemonic, validateMnemonic, ENTROPY_BITS_24_WORDS } from '@/utils/seedphrase-p256';
import { redirectIfNotAuthenticated } from '@/utils/auth';

type Step = 'create' | 'confirm';

export default function SeedPhrasePage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('create');
  const [mnemonic, setMnemonic] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [clickedGroups, setClickedGroups] = useState<Set<number>>(new Set());
  const [groupClickOrder, setGroupClickOrder] = useState<number[]>([]);
  const [scrambledGroups, setScrambledGroups] = useState<string[][]>([]);
  const [error, setError] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const createWordGroups = (words: string[]) => {
    // Divide 24 words into 4 groups of 6 words each
    const groups: string[][] = [];
    for (let i = 0; i < 4; i++) {
      const startIndex = i * 6;
      const group = words.slice(startIndex, startIndex + 6);
      groups.push(group);
    }
    return groups;
  };

  const scrambleGroups = useCallback((words: string[]) => {
    // Create 4 groups of 6 words each
    const originalGroups = createWordGroups(words);

    // Shuffle the groups (not the words within groups)
    const groupIndices = [0, 1, 2, 3];

    // Fisher-Yates shuffle for groups
    for (let i = groupIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [groupIndices[i], groupIndices[j]] = [groupIndices[j], groupIndices[i]];
    }

    // Create scrambled groups based on shuffled indices
    const scrambled = groupIndices.map((index) => originalGroups[index]);
    setScrambledGroups(scrambled);
  }, []);

  const generateSeedPhrase = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      // Generate 24-word mnemonic (256-bit entropy) for high security
      const newMnemonic = await generateMnemonic(ENTROPY_BITS_24_WORDS);

      // Validate the generated mnemonic immediately
      const isValid = await validateMnemonic(newMnemonic);
      if (!isValid) {
        throw new Error('Generated mnemonic is invalid');
      }

      setMnemonic(newMnemonic);
      // Create scrambled groups for confirm step
      scrambleGroups(newMnemonic);
    } catch (err) {
      setError('Failed to generate seed phrase. Please try again.');
      console.error('Error generating seed phrase:', err);
    } finally {
      setIsLoading(false);
    }
  }, [scrambleGroups]);

  // Check authentication on component mount
  useEffect(() => {
    // Check if institution has a token (is in registration process)
    const shouldRedirect = redirectIfNotAuthenticated(router);
    if (!shouldRedirect) {
      setIsAuthenticated(true);
    }
  }, [router]);

  // Generate mnemonic only after authentication is verified
  useEffect(() => {
    if (isAuthenticated) {
      generateSeedPhrase();
    }
  }, [isAuthenticated, generateSeedPhrase]);

  const handleContinue = () => {
    setStep('confirm');
    setClickedGroups(new Set()); // Reset clicked groups when moving to confirm
    setGroupClickOrder([]); // Reset group click order
    // Scramble groups for confirm step
    if (mnemonic.length > 0) {
      scrambleGroups(mnemonic);
    }
  };

  const handleConfirm = async () => {
    // Check if user clicked all 4 groups in correct order
    if (groupClickOrder.length !== 4) {
      setError(
        `Please click all 4 groups in the correct order. You clicked ${groupClickOrder.length}/4 groups.`
      );
      return;
    }

    // Check if groups were clicked in correct order using the same validation function
    const isCorrectOrder = checkGroupOrderCorrectness(groupClickOrder);

    if (!isCorrectOrder) {
      setError('Please click the groups in the correct order: Group 1, Group 2, Group 3, Group 4.');
      return;
    }

    // Validate the mnemonic using BIP39 validation
    const isValid = await validateMnemonic(mnemonic);
    if (!isValid) {
      setError('Invalid seed phrase. Please regenerate.');
      return;
    }

    // Derive keys and DID from mnemonic, then save only derived keys (not the seed phrase)
    try {
      setIsSaving(true);

      // Verify token still exists
      const token = localStorage.getItem('institutionToken');
      if (!token) {
        setError('Session expired. Please start registration again.');
        router.push('/institution/register');
        return;
      }

      // Generate wallet from mnemonic to get derived keys and DID
      const { generateWalletFromMnemonic } = await import('@/utils/seedphrase-p256');
      const wallet = await generateWalletFromMnemonic(mnemonic, 'i', '', 0);

      // ⚠️ DEVELOPMENT MODE: Store private key in localStorage
      // WARNING: This is INSECURE for production! Use non-extractable CryptoKey in production.
      localStorage.setItem('institutionDID', wallet.did);
      localStorage.setItem('institutionSigningPrivateKey', wallet.signingKey.privateKeyHex);
      localStorage.setItem('institutionSigningPublicKey', wallet.signingKey.publicKeyHex);

      // Store mnemonic in sessionStorage temporarily for registration flow
      // SessionStorage is cleared when browser closes, more secure than localStorage
      // This allows us to regenerate the wallet in confirm page to create a new JWT
      sessionStorage.setItem('tempRegistrationMnemonic', JSON.stringify(mnemonic));

      // Navigate to confirmation page
      router.push('/institution/register/confirm');
    } catch (err) {
      console.error('Error deriving keys:', err);
      setError('Failed to derive keys. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const checkGroupOrderCorrectness = (currentOrder: number[]) => {
    // In confirm step, we need to check if user is clicking scrambled groups
    // in the order that represents the original sequence [0, 1, 2, 3]
    if (step !== 'confirm' || scrambledGroups.length === 0) {
      return true;
    }

    // Find which scrambled group position contains each original group
    const originalGroups = createWordGroups(mnemonic);
    const correctClickOrder: number[] = [];

    // For each original group (0, 1, 2, 3), find where it appears in scrambled groups
    for (let originalGroupIndex = 0; originalGroupIndex < 4; originalGroupIndex++) {
      const originalGroup = originalGroups[originalGroupIndex];

      // Find this original group in the scrambled groups
      for (let scrambledIndex = 0; scrambledIndex < scrambledGroups.length; scrambledIndex++) {
        const scrambledGroup = scrambledGroups[scrambledIndex];

        // Check if this scrambled group matches the original group
        if (
          originalGroup.length === scrambledGroup.length &&
          originalGroup.every((word, index) => word === scrambledGroup[index])
        ) {
          correctClickOrder.push(scrambledIndex);
          break;
        }
      }
    }

    // Now check if user's current order matches the correct click order
    for (let i = 0; i < currentOrder.length; i++) {
      if (currentOrder[i] !== correctClickOrder[i]) {
        return false;
      }
    }
    return true;
  };

  const isContinueButtonDisabled =
    isLoading ||
    (step === 'confirm' &&
      (groupClickOrder.length < 4 || !checkGroupOrderCorrectness(groupClickOrder)));

  const getWordNumberForGroup = (groupIndex: number, wordIndexInGroup: number) => {
    if (step === 'create') {
      // In create step, use natural order
      return groupIndex * 6 + wordIndexInGroup + 1;
    } else {
      // In confirm step, calculate based on user's click order
      const clickPosition = groupClickOrder.indexOf(groupIndex);
      if (clickPosition === -1) {
        // Group not clicked yet, don't show numbers
        return null;
      }
      // Calculate word number based on click position (1-based)
      return clickPosition * 6 + wordIndexInGroup + 1;
    }
  };

  const handleGroupClick = (groupIndex: number) => {
    if (step === 'confirm' && !isSaving) {
      const wasClicked = clickedGroups.has(groupIndex);

      if (wasClicked) {
        // If already clicked, remove it (undo the click)
        setClickedGroups((prev) => {
          const newSet = new Set(prev);
          newSet.delete(groupIndex);
          return newSet;
        });
        // Remove from click order
        setGroupClickOrder((prevOrder) => prevOrder.filter((index) => index !== groupIndex));
      } else {
        // If not clicked, add it to clicked groups and click order
        setClickedGroups((prev) => {
          const newSet = new Set(prev);
          newSet.add(groupIndex);
          return newSet;
        });
        setGroupClickOrder((prevOrder) => [...prevOrder, groupIndex]);
      }

      // Clear any existing error when user clicks
      setError('');
    }
  };

  const copyToClipboard = async () => {
    if (mnemonic.length === 0) {
      setError('No seed phrase to copy');
      return;
    }

    const seedPhraseText = mnemonic.join(' ');

    try {
      await navigator.clipboard.writeText(seedPhraseText);
      setIsCopied(true);
      // Reset copied state after 3 seconds
      setTimeout(() => setIsCopied(false), 3000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      setError('Failed to copy to clipboard');
    }
  };

  const handleBack = () => {
    setStep('create');
    setClickedGroups(new Set()); // Reset clicked groups when going back
    setGroupClickOrder([]); // Reset group click order
    setError('');
  };

  const renderWordGroup = (groupIndex: number) => {
    let groupWords: string[] = [];
    let isClickable = false;
    let isClicked = false;
    let clickPosition = 0;
    let groupLabel = `Group ${groupIndex + 1}`;

    if (step === 'create') {
      // Create step: show original groups
      groupWords = Array.from({ length: 6 }).map((_, wordIndex) => {
        const absoluteWordIndex = groupIndex * 6 + wordIndex;
        return mnemonic[absoluteWordIndex] || '';
      });
    } else {
      // Confirm step: show scrambled groups
      if (scrambledGroups[groupIndex]) {
        groupWords = scrambledGroups[groupIndex];
        isClickable = true;
        isClicked = clickedGroups.has(groupIndex);
        clickPosition = groupClickOrder.indexOf(groupIndex) + 1;
        groupLabel = isClicked ? `Group ${clickPosition}` : 'Group ?';
      }
    }

    const isOrderCorrect = step === 'confirm' ? checkGroupOrderCorrectness(groupClickOrder) : true;

    const cardBgColor =
      step === 'create'
        ? 'bg-slate-50'
        : isClicked
          ? isOrderCorrect
            ? 'bg-blue-50'
            : 'bg-red-50'
          : 'bg-slate-50';

    const borderColor =
      step === 'create'
        ? 'border-slate-200'
        : isClicked
          ? isOrderCorrect
            ? 'border-blue-300'
            : 'border-red-300'
          : 'border-slate-200';

    return (
      <div
        key={groupIndex}
        className={`flex-1 rounded-xl border p-4 cursor-pointer transition-colors ${borderColor} ${cardBgColor} ${
          isClickable ? 'hover:shadow-md' : ''
        }`}
        onClick={() => isClickable && handleGroupClick(groupIndex)}
      >
        {/* Group Header */}
        <div className="mb-3 flex flex-row items-center justify-between">
          <p className="text-base font-semibold text-slate-700">{groupLabel}</p>
          {step === 'create' && (
            <div className="rounded-md bg-slate-200 px-2 py-1">
              <span className="text-slate-600">
                {groupIndex * 6 + 1}-{groupIndex * 6 + 6}
              </span>
            </div>
          )}
          {step === 'confirm' && isClicked && (
            <div
              className={`h-6 w-6 items-center justify-center rounded-full flex ${
                isOrderCorrect ? 'bg-blue-500' : 'bg-red-500'
              }`}
            >
              <span className="text-2xl font-bold text-white">{clickPosition}</span>
            </div>
          )}
        </div>

        {/* Words Grid - Vertical Layout */}
        <div className="flex flex-col gap-2">
          {groupWords.map((word, wordIndex) => {
            const wordNumber = getWordNumberForGroup(groupIndex, wordIndex);

            return (
              <div
                key={wordIndex}
                className="flex flex-row overflow-hidden rounded-lg border border-slate-100 bg-white"
              >
                {(step === 'create' || (step === 'confirm' && wordNumber !== null)) && (
                  <div
                    className={`w-[40px] items-center justify-center px-2 py-2 flex ${
                      step === 'create'
                        ? 'bg-slate-100'
                        : isOrderCorrect
                          ? 'bg-blue-100'
                          : 'bg-red-100'
                    }`}
                  >
                    <span className="text-sm">{wordNumber}</span>
                  </div>
                )}

                <div className="flex-1 items-center justify-center px-3 py-2 flex">
                  <span className="text-sm">{word}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Show loading screen while checking authentication
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0D2B45] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4 text-white">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (step === 'create') {
    return (
      <AuthContainer backHref="/institution/register">
        {/* Title */}
        <div className="mb-8">
          <span className="text-[32px] font-bold text-black mb-1 block">
            Write down your Seed Phrase
          </span>
          <span className="text-base text-gray-600 block">
            Write down this 24-word Seed Phrase organized in 4 groups. Save it in a place that you
            trust and only you can access.
          </span>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <span className="text-sm">{error}</span>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <span className="text-gray-600">Generating secure 24-word seed phrase...</span>
            </div>
          </div>
        ) : (
          <>
            {/* 2x2 Grid Layout */}
            <div className="mb-6 space-y-4">
              {/* First Row: Group 1 and Group 2 */}
              <div className="flex flex-col md:flex-row gap-4">
                {[0, 1].map((groupIndex) => renderWordGroup(groupIndex))}
              </div>
              {/* Second Row: Group 3 and Group 4 */}
              <div className="flex flex-col md:flex-row gap-4">
                {[2, 3].map((groupIndex) => renderWordGroup(groupIndex))}
              </div>
            </div>

            {/* Copy Button */}
            <div className="mb-6 flex justify-end">
              <button
                onClick={copyToClipboard}
                disabled={isLoading || mnemonic.length === 0}
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

            {/* Continue Button */}
            <Button
              type="button"
              onClick={handleContinue}
              variant="primary"
              fullWidth
              disabled={isContinueButtonDisabled}
            >
              I have written it down
            </Button>
          </>
        )}
      </AuthContainer>
    );
  }

  // Confirmation step
  return (
    <AuthContainer backHref="/institution/register">
      {/* Title */}
      <div className="mb-8">
        <span className="text-[32px] font-bold text-black mb-1 block">
          Confirm your Seed Phrase
        </span>
        <span className="text-base text-gray-600 block">
          The groups are now scrambled. Click on them in the correct order: Group 1, Group 2, Group
          3, Group 4.
        </span>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* 2x2 Grid Layout for Confirmation */}
      <div className="mb-6 space-y-4">
        {/* First Row: Group 1 and Group 2 */}
        <div className="flex flex-col md:flex-row gap-4">
          {[0, 1].map((groupIndex) => renderWordGroup(groupIndex))}
        </div>
        {/* Second Row: Group 3 and Group 4 */}
        <div className="flex flex-col md:flex-row gap-4">
          {[2, 3].map((groupIndex) => renderWordGroup(groupIndex))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          type="button"
          onClick={handleBack}
          variant="secondary"
          disabled={isSaving}
          className="flex-1"
        >
          Back to view seed phrase
        </Button>
        <Button
          type="button"
          onClick={handleConfirm}
          variant="primary"
          disabled={isContinueButtonDisabled || isSaving}
          className="flex-1"
        >
          {isSaving ? 'Processing...' : 'Confirm Seed Phrase'}
        </Button>
      </div>
    </AuthContainer>
  );
}
