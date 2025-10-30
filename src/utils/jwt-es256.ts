/**
 * JWT (JSON Web Token) Signing and Verification with ES256
 *
 * This module provides JWT operations using ECDSA P-256 (ES256) with SubtleCrypto.
 * Private keys are non-extractable CryptoKeys, making them secure from XSS attacks.
 *
 * Features:
 * - ES256 algorithm (ECDSA with P-256 and SHA-256)
 * - Non-extractable private keys (secure storage)
 * - Standard JWT format: header.payload.signature
 * - Base64url encoding (RFC 4648)
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface JWTHeader {
  alg: 'ES256'; // ECDSA using P-256 curve and SHA-256 hash
  typ: 'JWT';
  kid?: string; // Key ID (optional, for key rotation)
}

export interface JWTPayload {
  // Standard claims (RFC 7519)
  iss?: string; // Issuer (DID)
  sub?: string; // Subject (DID)
  aud?: string | string[]; // Audience
  exp?: number; // Expiration time (Unix timestamp)
  nbf?: number; // Not before (Unix timestamp)
  iat?: number; // Issued at (Unix timestamp)
  jti?: string; // JWT ID (unique identifier)

  // Custom claims (your application-specific data)
  [key: string]: any;
}

export interface DecodedJWT {
  header: JWTHeader;
  payload: JWTPayload;
  signature: string;
}

// =============================================================================
// BASE64URL ENCODING/DECODING (RFC 4648)
// =============================================================================

/**
 * Base64url encode (URL-safe base64 without padding)
 */
function base64UrlEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Base64url decode
 */
function base64UrlDecode(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const binaryString = atob(base64 + padding);
  return Uint8Array.from(binaryString, (char) => char.charCodeAt(0));
}

/**
 * Encode object to base64url JSON
 */
function encodeJsonToBase64Url(obj: any): string {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  return base64UrlEncode(bytes);
}

/**
 * Decode base64url to JSON object
 */
function decodeBase64UrlToJson<T = any>(base64url: string): T {
  const bytes = base64UrlDecode(base64url);
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json);
}

// =============================================================================
// JWT SIGNING
// =============================================================================

/**
 * Sign a JWT using ES256 with CryptoKey or raw private key
 *
 * @param payload - JWT payload (claims)
 * @param privateKey - CryptoKey or raw private key bytes (Uint8Array) or hex string
 * @param kid - Optional Key ID for header
 * @returns Signed JWT string (header.payload.signature)
 */
export async function signJWT(
  payload: JWTPayload,
  privateKey: CryptoKey | Uint8Array | string,
  kid?: string
): Promise<string> {
  // Create JWT header
  const header: JWTHeader = {
    alg: 'ES256',
    typ: 'JWT',
  };

  if (kid) {
    header.kid = kid;
  }

  // Encode header and payload
  const encodedHeader = encodeJsonToBase64Url(header);
  const encodedPayload = encodeJsonToBase64Url(payload);

  // Create signing input: header.payload
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signingInputBytes = new TextEncoder().encode(signingInput);

  let signatureBuffer: ArrayBuffer;

  // Handle different private key types
  if (privateKey instanceof CryptoKey) {
    // CryptoKey (non-extractable) - use SubtleCrypto
    if (!privateKey.usages.includes('sign')) {
      throw new Error('CryptoKey does not have sign usage');
    }

    signatureBuffer = await window.crypto.subtle.sign(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' },
      },
      privateKey,
      signingInputBytes
    );
  } else {
    // Raw private key (Uint8Array or hex string) - import then sign
    let privateKeyBytes: Uint8Array;

    if (typeof privateKey === 'string') {
      // Convert hex string to Uint8Array
      privateKeyBytes = hexToBytes(privateKey);
    } else {
      privateKeyBytes = privateKey;
    }

    // Import private key to SubtleCrypto (extractable for development)
    const { importPrivateKeyToSubtleCrypto } = await import('@/utils/seedphrase-p256');
    const cryptoKey = await importPrivateKeyToSubtleCrypto(privateKeyBytes);

    signatureBuffer = await window.crypto.subtle.sign(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' },
      },
      cryptoKey,
      signingInputBytes
    );
  }

  // Encode signature to base64url
  const signature = base64UrlEncode(new Uint8Array(signatureBuffer));

  // Return complete JWT
  return `${signingInput}.${signature}`;
}

/**
 * Convert hexadecimal string to Uint8Array
 * Helper function for JWT signing with hex private keys
 */
function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Hex string must have even length');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Create a JWT with automatic timestamps
 *
 * @param payload - JWT payload
 * @param privateKey - CryptoKey or raw private key (Uint8Array or hex string)
 * @param options - JWT options
 * @returns Signed JWT string
 */
export async function createJWT(
  payload: JWTPayload,
  privateKey: CryptoKey | Uint8Array | string,
  options: {
    issuer?: string; // DID of issuer
    subject?: string; // DID of subject
    audience?: string | string[];
    expiresIn?: number; // Expiration in seconds (e.g., 3600 for 1 hour)
    kid?: string; // Key ID
  } = {}
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // Build complete payload with timestamps
  const completePayload: JWTPayload = {
    ...payload,
    iat: now, // Issued at
  };

  if (options.issuer) {
    completePayload.iss = options.issuer;
  }

  if (options.subject) {
    completePayload.sub = options.subject;
  }

  if (options.audience) {
    completePayload.aud = options.audience;
  }

  if (options.expiresIn) {
    completePayload.exp = now + options.expiresIn;
  }

  return signJWT(completePayload, privateKey, options.kid);
}

// =============================================================================
// JWT VERIFICATION
// =============================================================================

/**
 * Decode JWT without verification (for inspection only)
 *
 * ⚠️ WARNING: This does NOT verify the signature. Use verifyJWT for security.
 *
 * @param jwt - JWT string
 * @returns Decoded JWT components
 */
export function decodeJWT(jwt: string): DecodedJWT {
  const parts = jwt.split('.');

  if (parts.length !== 3) {
    throw new Error('Invalid JWT format. Expected 3 parts separated by dots.');
  }

  const [encodedHeader, encodedPayload, signature] = parts;

  try {
    const header = decodeBase64UrlToJson<JWTHeader>(encodedHeader);
    const payload = decodeBase64UrlToJson<JWTPayload>(encodedPayload);

    return {
      header,
      payload,
      signature,
    };
  } catch (error) {
    throw new Error('Failed to decode JWT. Invalid base64url encoding.');
  }
}

/**
 * Verify JWT signature using public key
 *
 * @param jwt - JWT string to verify
 * @param publicKey - CryptoKey (public key) or raw public key bytes
 * @returns True if signature is valid
 */
export async function verifyJWT(jwt: string, publicKey: CryptoKey | Uint8Array): Promise<boolean> {
  const parts = jwt.split('.');

  if (parts.length !== 3) {
    return false;
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  try {
    // Decode header to verify algorithm
    const header = decodeBase64UrlToJson<JWTHeader>(encodedHeader);

    if (header.alg !== 'ES256') {
      console.error('Unsupported algorithm:', header.alg);
      return false;
    }

    // Prepare signing input
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const signingInputBytes = new TextEncoder().encode(signingInput);

    // Decode signature
    const signatureBytes = base64UrlDecode(encodedSignature);

    // Import public key if it's raw bytes
    let cryptoPublicKey: CryptoKey;

    if (publicKey instanceof Uint8Array) {
      cryptoPublicKey = await importPublicKey(publicKey);
    } else {
      cryptoPublicKey = publicKey;
    }

    // Verify signature
    const isValid = await window.crypto.subtle.verify(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' },
      },
      cryptoPublicKey,
      signatureBytes as BufferSource,
      signingInputBytes as BufferSource
    );

    return isValid;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return false;
  }
}

/**
 * Verify JWT and decode payload (if valid)
 *
 * @param jwt - JWT string
 * @param publicKey - CryptoKey or raw public key bytes
 * @returns Decoded payload if valid, null if invalid
 */
export async function verifyAndDecodeJWT(
  jwt: string,
  publicKey: CryptoKey | Uint8Array
): Promise<JWTPayload | null> {
  const isValid = await verifyJWT(jwt, publicKey);

  if (!isValid) {
    return null;
  }

  const decoded = decodeJWT(jwt);
  return decoded.payload;
}

/**
 * Validate JWT claims (expiration, not before, etc.)
 *
 * @param payload - JWT payload
 * @returns Validation result with detailed errors
 */
export function validateJWTClaims(payload: JWTPayload): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const now = Math.floor(Date.now() / 1000);

  // Check expiration
  if (payload.exp !== undefined) {
    if (payload.exp < now) {
      errors.push(`Token expired at ${new Date(payload.exp * 1000).toISOString()}`);
    }
  }

  // Check not before
  if (payload.nbf !== undefined) {
    if (payload.nbf > now) {
      errors.push(`Token not valid before ${new Date(payload.nbf * 1000).toISOString()}`);
    }
  }

  // Check issued at (should not be in the future)
  if (payload.iat !== undefined) {
    const futureThreshold = now + 60; // Allow 60 seconds clock skew
    if (payload.iat > futureThreshold) {
      errors.push('Token issued in the future (clock skew issue)');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// PUBLIC KEY UTILITIES
// =============================================================================

/**
 * Import raw P-256 public key bytes to CryptoKey for verification
 *
 * @param publicKeyBytes - Raw public key (33 or 65 bytes)
 * @returns CryptoKey for verification
 */
export async function importPublicKey(publicKeyBytes: Uint8Array): Promise<CryptoKey> {
  // Ensure public key is in uncompressed format (65 bytes)
  let uncompressedKey = publicKeyBytes;

  if (publicKeyBytes.length === 33) {
    // Compressed format - need to convert to uncompressed
    // For now, throw error - SubtleCrypto expects uncompressed or SPKI format
    throw new Error(
      'Compressed public keys not supported yet. Please use uncompressed (65 bytes) or provide CryptoKey directly.'
    );
  }

  if (publicKeyBytes.length !== 65) {
    throw new Error('Public key must be 65 bytes (uncompressed) or 33 bytes (compressed)');
  }

  // Create SPKI format for import
  const spkiHeader = new Uint8Array([
    0x30,
    0x59, // SEQUENCE
    0x30,
    0x13, // SEQUENCE
    0x06,
    0x07,
    0x2a,
    0x86,
    0x48,
    0xce,
    0x3d,
    0x02,
    0x01, // OID: ecPublicKey
    0x06,
    0x08,
    0x2a,
    0x86,
    0x48,
    0xce,
    0x3d,
    0x03,
    0x01,
    0x07, // OID: P-256
    0x03,
    0x42,
    0x00, // BIT STRING
  ]);

  const spkiKey = new Uint8Array(spkiHeader.length + uncompressedKey.length);
  spkiKey.set(spkiHeader, 0);
  spkiKey.set(uncompressedKey, spkiHeader.length);

  try {
    const cryptoKey = await window.crypto.subtle.importKey(
      'spki',
      spkiKey,
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true, // Public keys can be extractable
      ['verify']
    );

    return cryptoKey;
  } catch (error) {
    console.error('Failed to import public key:', error);
    throw new Error('Public key import failed');
  }
}

/**
 * Import public key from PEM format
 *
 * @param pem - PEM-encoded public key
 * @returns CryptoKey for verification
 */
export async function importPublicKeyFromPem(pem: string): Promise<CryptoKey> {
  // Remove PEM headers and whitespace
  const pemContents = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s/g, '');

  // Decode base64
  const binaryString = atob(pemContents);
  const bytes = Uint8Array.from(binaryString, (char) => char.charCodeAt(0));

  try {
    const cryptoKey = await window.crypto.subtle.importKey(
      'spki',
      bytes,
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['verify']
    );

    return cryptoKey;
  } catch (error) {
    console.error('Failed to import PEM public key:', error);
    throw new Error('PEM public key import failed');
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get JWT expiration date from token
 *
 * @param jwt - JWT string
 * @returns Expiration Date or null if no exp claim
 */
export function getJWTExpiration(jwt: string): Date | null {
  try {
    const decoded = decodeJWT(jwt);
    if (decoded.payload.exp) {
      return new Date(decoded.payload.exp * 1000);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if JWT is expired
 *
 * @param jwt - JWT string
 * @returns True if expired or invalid
 */
export function isJWTExpired(jwt: string): boolean {
  const expiration = getJWTExpiration(jwt);
  if (!expiration) {
    return false; // No expiration claim
  }
  return expiration < new Date();
}

/**
 * Extract DID from JWT (issuer or subject)
 *
 * @param jwt - JWT string
 * @param claim - Which claim to extract ('iss' or 'sub')
 * @returns DID string or null
 */
export function extractDIDFromJWT(jwt: string, claim: 'iss' | 'sub' = 'iss'): string | null {
  try {
    const decoded = decodeJWT(jwt);
    return decoded.payload[claim] || null;
  } catch {
    return null;
  }
}
