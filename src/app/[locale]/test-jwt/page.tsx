'use client';

import { useState } from 'react';
import { ThemedText } from '@/components/ThemedText';
import Button from '@/components/Button';
import { decodeJWT, verifyJWT, validateJWTClaims } from '@/utils/jwt-es256';
import { hexToBytes } from '@/utils/seedphrase-p256';

export default function TestJWTPage() {
  const [jwt, setJwt] = useState('');
  const [result, setResult] = useState<{
    valid: boolean;
    payload: Record<string, unknown> | null;
    errors: string[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const verifyJWTWithLocalKey = async (
    token: string
  ): Promise<{
    valid: boolean;
    payload: Record<string, unknown> | null;
    errors: string[];
  }> => {
    const errors: string[] = [];

    try {
      // Get public key from localStorage
      const publicKeyHex = localStorage.getItem('institutionSigningPublicKey');

      if (!publicKeyHex) {
        errors.push('Public key not found in localStorage. Please log in first.');
        return { valid: false, payload: null, errors };
      }

      // Step 1: Decode JWT (without verification)
      const decoded = decodeJWT(token);

      // Step 2: Validate JWT claims (expiration, etc.)
      const claimsValidation = validateJWTClaims(decoded.payload);
      if (!claimsValidation.valid) {
        errors.push(...claimsValidation.errors);
        return { valid: false, payload: null, errors };
      }

      // Step 3: Verify JWT signature using local public key
      const publicKeyBytes = hexToBytes(publicKeyHex);
      const isValid = await verifyJWT(token, publicKeyBytes);

      if (!isValid) {
        errors.push('JWT signature verification failed');
        return { valid: false, payload: null, errors };
      }

      // All checks passed
      return {
        valid: true,
        payload: decoded.payload,
        errors: [],
      };
    } catch (error) {
      errors.push(
        `Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return { valid: false, payload: null, errors };
    }
  };

  const handleVerify = async () => {
    if (!jwt.trim()) {
      alert('Please enter a JWT token');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const verificationResult = await verifyJWTWithLocalKey(jwt.trim());
      setResult(verificationResult);
    } catch (error) {
      setResult({
        valid: false,
        payload: null,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestStoredToken = async () => {
    const storedToken = localStorage.getItem('institutionToken');

    if (!storedToken) {
      alert('No token found in localStorage');
      return;
    }

    setJwt(storedToken);
    setLoading(true);
    setResult(null);

    try {
      const verificationResult = await verifyJWTWithLocalKey(storedToken);
      setResult(verificationResult);
    } catch (error) {
      setResult({
        valid: false,
        payload: null,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <ThemedText fontSize={32} fontWeight={700} className="text-black mb-8">
          JWT Verification Test
        </ThemedText>

        {/* Test Stored Token Button */}
        <div className="mb-6">
          <Button onClick={handleTestStoredToken} variant="secondary" disabled={loading}>
            Test Stored Institution Token
          </Button>
        </div>

        {/* JWT Input */}
        <div className="mb-6">
          <label className="block mb-2">
            <ThemedText fontSize={16} fontWeight={600} className="text-gray-700">
              JWT Token
            </ThemedText>
          </label>
          <textarea
            value={jwt}
            onChange={(e) => setJwt(e.target.value)}
            placeholder="Paste JWT token here..."
            className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            disabled={loading}
          />
        </div>

        {/* Verify Button */}
        <Button onClick={handleVerify} variant="primary" disabled={loading || !jwt.trim()}>
          {loading ? 'Verifying...' : 'Verify JWT'}
        </Button>

        {/* Results */}
        {result && (
          <div className="mt-8">
            <div
              className={`p-6 rounded-lg border-2 ${
                result.valid ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'
              }`}
            >
              <div className="flex items-center gap-3 mb-4">
                {result.valid ? (
                  <svg
                    className="w-8 h-8 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-8 h-8 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                )}
                <ThemedText
                  fontSize={24}
                  fontWeight={700}
                  className={result.valid ? 'text-green-700' : 'text-red-700'}
                >
                  {result.valid ? 'Valid JWT ✓' : 'Invalid JWT ✗'}
                </ThemedText>
              </div>

              {/* Payload */}
              {result.valid && result.payload && (
                <div className="mb-4">
                  <ThemedText fontSize={16} fontWeight={600} className="text-gray-700 mb-2">
                    Payload:
                  </ThemedText>
                  <pre className="bg-white p-4 rounded border border-gray-300 overflow-x-auto text-sm">
                    {JSON.stringify(result.payload, null, 2)}
                  </pre>
                </div>
              )}

              {/* Errors */}
              {!result.valid && result.errors.length > 0 && (
                <div>
                  <ThemedText fontSize={16} fontWeight={600} className="text-red-700 mb-2">
                    Errors:
                  </ThemedText>
                  <ul className="list-disc list-inside space-y-1">
                    {result.errors.map((error, index) => (
                      <li key={index} className="text-red-600 text-sm">
                        {error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
          <ThemedText fontSize={18} fontWeight={600} className="text-blue-900 mb-3">
            How JWT Verification Works:
          </ThemedText>
          <ol className="list-decimal list-inside space-y-2 text-blue-800 text-sm">
            <li>Retrieves the public key from localStorage (institutionSigningPublicKey)</li>
            <li>Decodes the JWT to extract header and payload</li>
            <li>Validates JWT claims (expiration, issued time, etc.)</li>
            <li>Verifies the JWT signature using the local public key (P-256 ES256)</li>
            <li>Returns verification result with payload or errors</li>
          </ol>
          <div className="mt-4 p-3 bg-blue-100 rounded">
            <ThemedText fontSize={14} fontWeight={600} className="text-blue-900 mb-1">
              Note:
            </ThemedText>
            <p className="text-blue-800 text-sm">
              This test uses the public key from localStorage (same as the optimized auth flow). No
              API calls are made for verification.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
