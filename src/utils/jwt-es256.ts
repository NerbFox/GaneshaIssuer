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
  [key: string]: unknown;
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

// =============================================================================
// ECDSA SIGNATURE FORMAT CONVERSION (P-256)
// =============================================================================

/**
 * Convert DER-encoded ECDSA signature to raw format (r||s)
 *
 * DER format: 0x30 [total-length] 0x02 [r-length] [r] 0x02 [s-length] [s]
 * Raw format: [r (32 bytes)] || [s (32 bytes)] = 64 bytes total
 *
 * @param derSignature - DER-encoded signature
 * @returns Raw signature (64 bytes)
 */
function derToRawSignature(derSignature: Uint8Array): Uint8Array {
  // If already 64 bytes, assume it's raw format
  if (derSignature.length === 64) {
    return derSignature;
  }

  let offset = 0;

  // Check for SEQUENCE tag (0x30)
  if (derSignature[offset++] !== 0x30) {
    throw new Error('Invalid DER signature: missing SEQUENCE tag');
  }

  // Skip total length
  offset++;

  // Check for INTEGER tag for r (0x02)
  if (derSignature[offset++] !== 0x02) {
    throw new Error('Invalid DER signature: missing r INTEGER tag');
  }

  // Get r length and value
  const rLength = derSignature[offset++];
  let r = derSignature.slice(offset, offset + rLength);
  offset += rLength;

  // Check for INTEGER tag for s (0x02)
  if (derSignature[offset++] !== 0x02) {
    throw new Error('Invalid DER signature: missing s INTEGER tag');
  }

  // Get s length and value
  const sLength = derSignature[offset++];
  let s = derSignature.slice(offset, offset + sLength);

  // Remove leading zeros from r and s (DER encoding adds 0x00 if high bit is set)
  // But ensure we keep at least 32 bytes for P-256
  while (r.length > 32 && r[0] === 0x00) {
    r = r.slice(1);
  }
  while (s.length > 32 && s[0] === 0x00) {
    s = s.slice(1);
  }

  // Pad to 32 bytes if needed
  const rPadded = new Uint8Array(32);
  const sPadded = new Uint8Array(32);
  rPadded.set(r, 32 - r.length);
  sPadded.set(s, 32 - s.length);

  // Concatenate r and s
  const rawSignature = new Uint8Array(64);
  rawSignature.set(rPadded, 0);
  rawSignature.set(sPadded, 32);

  return rawSignature;
}

/**
 * Convert raw ECDSA signature (r||s) to DER format
 *
 * Raw format: [r (32 bytes)] || [s (32 bytes)] = 64 bytes total
 * DER format: 0x30 [total-length] 0x02 [r-length] [r] 0x02 [s-length] [s]
 *
 * @param rawSignature - Raw signature (64 bytes)
 * @returns DER-encoded signature
 */
function rawToDerSignature(rawSignature: Uint8Array): Uint8Array {
  if (rawSignature.length !== 64) {
    throw new Error('Raw signature must be exactly 64 bytes');
  }

  let r = rawSignature.slice(0, 32);
  let s = rawSignature.slice(32, 64);

  // Remove leading zeros from r (but keep at least one byte)
  let rStart = 0;
  while (rStart < r.length - 1 && r[rStart] === 0) {
    rStart++;
  }
  r = r.slice(rStart);

  // Remove leading zeros from s (but keep at least one byte)
  let sStart = 0;
  while (sStart < s.length - 1 && s[sStart] === 0) {
    sStart++;
  }
  s = s.slice(sStart);

  // Add 0x00 prefix if high bit is set (to maintain positive integer in DER)
  if (r[0] & 0x80) {
    const temp = new Uint8Array(r.length + 1);
    temp[0] = 0x00;
    temp.set(r, 1);
    r = temp;
  }
  if (s[0] & 0x80) {
    const temp = new Uint8Array(s.length + 1);
    temp[0] = 0x00;
    temp.set(s, 1);
    s = temp;
  }

  // Build DER sequence
  const totalLength = 2 + r.length + 2 + s.length;
  const derSignature = new Uint8Array(2 + totalLength);

  let offset = 0;
  derSignature[offset++] = 0x30; // SEQUENCE tag
  derSignature[offset++] = totalLength; // Total length
  derSignature[offset++] = 0x02; // INTEGER tag for r
  derSignature[offset++] = r.length; // r length
  derSignature.set(r, offset); // r value
  offset += r.length;
  derSignature[offset++] = 0x02; // INTEGER tag for s
  derSignature[offset++] = s.length; // s length
  derSignature.set(s, offset); // s value

  return derSignature;
}

/**
 * Encode object to base64url JSON
 */
function encodeJsonToBase64Url(obj: object): string {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  return base64UrlEncode(bytes);
}

/**
 * Decode base64url to JSON object
 */
function decodeBase64UrlToJson<T = Record<string, unknown>>(base64url: string): T {
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

  // Convert signature to Uint8Array
  const signatureBytes = new Uint8Array(signatureBuffer);

  // IMPORTANT: SubtleCrypto.sign() returns raw signature (r||s) for ECDSA
  // For P-256, this should be exactly 64 bytes
  if (signatureBytes.length !== 64) {
    console.warn(`⚠️ Unexpected signature length: ${signatureBytes.length} bytes (expected 64)`);
    console.warn(
      'Signature (hex):',
      Array.from(signatureBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    );
  }

  // CRITICAL: Convert raw signature to DER format for backend compatibility
  // Backend (Node.js crypto) expects DER-encoded signatures
  const derSignature = rawToDerSignature(signatureBytes);

  console.log('[JWT Sign] Raw signature:', signatureBytes.length, 'bytes');
  console.log('[JWT Sign] DER signature:', derSignature.length, 'bytes');

  // Encode DER signature to base64url
  const signature = base64UrlEncode(derSignature);

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
  } catch {
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

    // Decode signature from base64url
    const signatureBytes = base64UrlDecode(encodedSignature);

    console.log('[JWT Verify] Signature length:', signatureBytes.length, 'bytes');
    console.log(
      '[JWT Verify] Signature (first 10 bytes hex):',
      Array.from(signatureBytes.slice(0, 10))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    );

    // CRITICAL: Signatures are DER-encoded for backend compatibility
    // SubtleCrypto expects raw format, so convert DER → raw
    let rawSignature: Uint8Array;

    if (signatureBytes.length > 64 && signatureBytes[0] === 0x30) {
      // DER-encoded signature (expected format), convert to raw for SubtleCrypto
      console.log('[JWT Verify] Converting DER signature to raw format for SubtleCrypto');
      rawSignature = derToRawSignature(signatureBytes);
      console.log('[JWT Verify] Raw signature length:', rawSignature.length, 'bytes');
    } else if (signatureBytes.length === 64) {
      // Already raw format (legacy/fallback)
      console.log('[JWT Verify] Using raw signature format (64 bytes)');
      rawSignature = signatureBytes;
    } else {
      console.error(
        '[JWT Verify] Invalid signature length:',
        signatureBytes.length,
        'bytes (expected DER ~70-72 bytes or raw 64 bytes)'
      );
      return false;
    }

    // Import public key if it's raw bytes
    let cryptoPublicKey: CryptoKey;

    if (publicKey instanceof Uint8Array) {
      console.log('[JWT Verify] Public key length:', publicKey.length, 'bytes');
      console.log(
        '[JWT Verify] Public key (first 33 bytes):',
        Array.from(publicKey.slice(0, 33))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
      );
      cryptoPublicKey = await importPublicKey(publicKey);
    } else {
      cryptoPublicKey = publicKey;
    }

    console.log('[JWT Verify] Signing input length:', signingInput.length, 'chars');
    console.log('[JWT Verify] Signing input (first 50):', signingInput.substring(0, 50));

    // Verify signature using SubtleCrypto
    // SubtleCrypto expects raw signature format (r||s) for ECDSA
    const isValid = await window.crypto.subtle.verify(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' },
      },
      cryptoPublicKey,
      rawSignature as BufferSource,
      signingInputBytes as BufferSource
    );

    console.log('[JWT Verify] Verification result:', isValid);

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
  const uncompressedKey = publicKeyBytes;

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
