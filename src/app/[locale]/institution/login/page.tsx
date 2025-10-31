'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ThemedText } from '@/components/ThemedText';
import Button from '@/components/Button';
import AuthContainer from '@/components/AuthContainer';
import { Link } from '@/i18n/routing';
import { validateMnemonic, generateWalletFromMnemonic } from '@/utils/seedphrase-p256';
import { createJWT } from '@/utils/jwt-es256';
import { buildApiUrl, API_ENDPOINTS } from '@/utils/api';

export default function InstitutionLoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    seedphrase: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate seed phrase input
      if (!formData.seedphrase.trim()) {
        setError('Please enter your seed phrase');
        return;
      }

      // Split seed phrase into words and validate
      const words = formData.seedphrase.trim().split(/\s+/);

      // Validate the seed phrase
      const isValidSeedPhrase = await validateMnemonic(words);
      if (!isValidSeedPhrase) {
        setError('Invalid seed phrase. Please check your words and try again.');
        return;
      }

      // Generate wallet from mnemonic (institution entity type)
      const wallet = await generateWalletFromMnemonic(words, 'i', '', 0);

      // Fetch DID document from API (URL encode the DID)
      const didDocumentUrl = buildApiUrl(API_ENDPOINTS.DID.DOCUMENT(wallet.did));
      const didResponse = await fetch(didDocumentUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const didData = await didResponse.json();

      if (!didData.data.found) {
        setError('Failed to retrieve institution information. Please try again.');
        return;
      }

      // Extract institution details from the response
      const institutionDetails = {
        name: didData.data?.details?.name || '',
        email: didData.data?.details?.email || '',
        phone: didData.data?.details?.phone || '',
        country: didData.data?.details?.country || '',
        address: didData.data?.details?.address || '',
        website: didData.data?.details?.website || '',
      };

      // Create JWT token using the wallet's signing key
      // Following JWT best practices: minimal payload with standard claims
      const jwt = await createJWT(
        {
          role: 'institution', // Custom claim for authorization
        },
        wallet.signingKey.privateKeyHex, // ⚠️ DEVELOPMENT MODE: Using hex private key
        {
          issuer: wallet.did, // Standard claim - identifies issuer
          subject: wallet.did, // Standard claim - identifies subject
          expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
        }
      );

      // ⚠️ DEVELOPMENT MODE: Store private key in localStorage
      // WARNING: This is INSECURE for production! Use non-extractable CryptoKey in production.
      localStorage.setItem('institutionDID', wallet.did);
      localStorage.setItem('institutionSigningPrivateKey', wallet.signingKey.privateKeyHex);
      localStorage.setItem('institutionSigningPublicKey', wallet.signingKey.publicKeyHex);
      localStorage.setItem('institutionToken', jwt);
      localStorage.setItem('institutionData', JSON.stringify(institutionDetails));

      // Navigate to dashboard
      router.push('/institution/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError('Failed to process seed phrase. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <AuthContainer backHref="/institution">
      {/* Title */}
      <div className="mb-8">
        <ThemedText fontSize={32} fontWeight={700} className="text-black mb-1 block">
          Institution Login
        </ThemedText>
        <ThemedText fontSize={16} className="text-gray-600 block">
          Enter your seed phrase to access your institution account
        </ThemedText>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <ThemedText fontSize={14}>{error}</ThemedText>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Seed Phrase Input */}
        <div className="relative">
          <textarea
            id="seedphrase"
            name="seedphrase"
            placeholder="Enter your 24-word seed phrase separated by spaces"
            value={formData.seedphrase}
            onChange={handleChange}
            required
            disabled={loading}
            rows={4}
            className="text-black w-full px-4 pt-7 pb-3 bg-[#E9F2F5] rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-[#0D2B45] disabled:opacity-50 disabled:cursor-not-allowed resize-none text-sm"
          />
          <label htmlFor="seedphrase" className="absolute top-2 left-4">
            <ThemedText fontSize={12} fontWeight={500} className="text-gray-700">
              Seed Phrase<span className="text-red-500">*</span>
            </ThemedText>
          </label>
        </div>

        {/* Privacy Policy Text */}
        <div className="text-center pt-2">
          <ThemedText fontSize={12} className="text-gray-600">
            By continuing, you agree to the{' '}
            <Link href="/privacy" className="text-[#0D73BA] hover:underline">
              Privacy Policy
            </Link>
          </ThemedText>
        </div>

        {/* Submit Button */}
        <Button type="submit" variant="primary" fullWidth disabled={loading}>
          {loading ? 'Processing...' : 'Login with Seed Phrase'}
        </Button>
      </form>
    </AuthContainer>
  );
}
