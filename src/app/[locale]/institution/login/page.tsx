'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ThemedText } from '@/components/ThemedText';
import Button from '@/components/Button';
import AuthContainer from '@/components/AuthContainer';
import { Link } from '@/i18n/routing';
import { validateMnemonic, mnemonicToSeed, deriveDIDIdentifierKey } from '@/utils/seedphrase';

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

      // Generate seed from mnemonic
      const seed = await mnemonicToSeed(words);

      // Derive DID identifier key (private key)
      const { privateKey } = deriveDIDIdentifierKey(seed);

      // For demonstration purposes, we'll create a simple public key representation
      // In a real implementation, you'd use proper Ed25519 or secp256k1 key generation
      const publicKeyHex = Array.from(privateKey.slice(0, 32))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      // Log the public key (as requested)
      console.log('Generated Public Key:', publicKeyHex);
      console.log('Private Key Length:', privateKey.length);
      console.log('Seed Length:', seed.length);

      // Store authentication state (you can expand this)
      sessionStorage.setItem('isAuthenticated', 'true');
      sessionStorage.setItem('publicKey', publicKeyHex);

      // Navigate to dashboard
      router.push('/dashboard');
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
