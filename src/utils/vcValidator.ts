/**
 * Validator for Verifiable Credentials
 *
 * RECENT UPDATES (2025-11-19):
 * - Added validation for optional VC fields: claimId, source, fileId, fileUrl
 * - Enhanced console logging throughout validation process for better debugging
 * - Added detailed hash comparison logging when blockchain validation fails
 * - Improved error messages to be more specific about validation failures
 * - Fixed hash mismatch issue by excluding metadata fields (source, claimId)
 *
 * VALIDATION STAGES:
 * 1. Structure validation - Validates JSON structure and required fields
 * 2. API validation - Validates against blockchain using hash comparison
 * 3. Duplicate check - Ensures VC doesn't already exist in IndexedDB
 *
 * HASH GENERATION:
 * - Uses hashVC() from vcUtils which expects a SignedVerifiableCredential
 * - Hash is generated from the complete VC including proof
 * - SHA-256 algorithm produces a 64-character hex string
 * - Hash must match the blockchain-stored hash for validation to pass
 *
 * IMPORTANT - METADATA FIELDS:
 * - 'source' and 'claimId' are metadata fields added AFTER signing/hashing
 * - These fields are used for IndexedDB storage tracking only
 * - They MUST be excluded from hash calculation to match blockchain hash
 * - 'fileId' and 'fileUrl' ARE included in hash (set before signing)
 */

import { VerifiableCredential, getVCById } from './indexedDB';
import { hashVC } from './vcUtils';
import { buildApiUrl, API_ENDPOINTS } from './api';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate if the uploaded file is a valid Verifiable Credential
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const validateVC = (data: any): ValidationResult => {
  const errors: string[] = [];

  // Check required top-level properties
  if (!data['@context'] || !Array.isArray(data['@context'])) {
    errors.push('@context must be an array');
  }

  if (!data.id || typeof data.id !== 'string') {
    errors.push('id must be a string');
  }

  if (!data.type || !Array.isArray(data.type)) {
    errors.push('type must be an array');
  }

  if (!data.issuer || typeof data.issuer !== 'string') {
    errors.push('issuer must be a string');
  }

  if (!data.issuerName || typeof data.issuerName !== 'string') {
    errors.push('issuerName must be a string');
  }

  if (!data.validFrom || typeof data.validFrom !== 'string') {
    errors.push('validFrom must be a string');
  }

  // expiredAt can be null or string
  if (
    data.expiredAt !== null &&
    data.expiredAt !== undefined &&
    typeof data.expiredAt !== 'string'
  ) {
    errors.push('expiredAt must be null or a string');
  }

  // imageLink can be null or string
  if (
    data.imageLink !== null &&
    data.imageLink !== undefined &&
    typeof data.imageLink !== 'string'
  ) {
    errors.push('imageLink must be null or a string');
  }

  // claimId is optional (can be undefined or string)
  if (data.claimId !== undefined && typeof data.claimId !== 'string') {
    errors.push('claimId must be a string if provided');
  }

  // source is optional (can be undefined or string)
  if (data.source !== undefined && typeof data.source !== 'string') {
    errors.push('source must be a string if provided');
  }

  // fileId is optional (can be undefined, null, or string)
  if (data.fileId !== undefined && data.fileId !== null && typeof data.fileId !== 'string') {
    errors.push('fileId must be null or a string if provided');
  }

  // fileUrl is optional (can be undefined, null, or string)
  if (data.fileUrl !== undefined && data.fileUrl !== null && typeof data.fileUrl !== 'string') {
    errors.push('fileUrl must be null or a string if provided');
  }

  // Check credentialSubject
  if (!data.credentialSubject || typeof data.credentialSubject !== 'object') {
    errors.push('credentialSubject must be an object');
  } else {
    if (!data.credentialSubject.id || typeof data.credentialSubject.id !== 'string') {
      errors.push('credentialSubject.id must be a string');
    }
  }

  // Check proof
  if (!data.proof || typeof data.proof !== 'object') {
    errors.push('proof must be an object');
  } else {
    const proof = data.proof;

    if (!proof.type || typeof proof.type !== 'string') {
      errors.push('proof.type must be a string');
    }

    if (!proof.cryptosuite || typeof proof.cryptosuite !== 'string') {
      errors.push('proof.cryptosuite must be a string');
    }

    if (!proof.created || typeof proof.created !== 'string') {
      errors.push('proof.created must be a string');
    }

    if (!proof.verificationMethod || typeof proof.verificationMethod !== 'string') {
      errors.push('proof.verificationMethod must be a string');
    }

    if (!proof.proofPurpose || typeof proof.proofPurpose !== 'string') {
      errors.push('proof.proofPurpose must be a string');
    }

    if (!proof.proofValue || typeof proof.proofValue !== 'string') {
      errors.push('proof.proofValue must be a string');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Parse and validate a VC from a JSON file
 */
export const parseAndValidateVC = (
  fileContent: string
): {
  isValid: boolean;
  errors: string[];
  vc?: VerifiableCredential;
} => {
  try {
    const data = JSON.parse(fileContent);
    const validation = validateVC(data);

    if (validation.isValid) {
      return {
        isValid: true,
        errors: [],
        vc: data as VerifiableCredential,
      };
    }

    return {
      isValid: false,
      errors: validation.errors,
    };
  } catch {
    return {
      isValid: false,
      errors: ['Invalid JSON format'],
    };
  }
};

/**
 * Validate VC against backend API
 */
export const validateVCWithAPI = async (
  vc: VerifiableCredential
): Promise<{
  isValid: boolean;
  errors: string[];
}> => {
  try {
    console.group('🔍 VC API Validation');
    console.log('📄 Full VC Object:', JSON.stringify(vc, null, 2));

    // Get authentication token
    const token = localStorage.getItem('institutionToken');

    if (!token) {
      console.error('❌ Authentication token not found');
      console.groupEnd();
      return {
        isValid: false,
        errors: ['Authentication token not found. Please log in again.'],
      };
    }

    console.log('✅ Authentication token found');

    // Extract required fields
    const vcId = vc.id;
    const credentialSubject = vc.credentialSubject;
    const expiredAt = vc.expiredAt;

    console.log('📋 Extracted fields:', {
      vcId,
      credentialSubjectId: credentialSubject.id,
      expiredAt,
    });

    // Generate VC hash - hashVC expects a SignedVerifiableCredential (VC with proof)
    console.log('🔧 Preparing to hash VC...');
    console.log('📋 VC keys:', Object.keys(vc).sort());

    // IMPORTANT: Remove metadata fields that are added after signing
    // These fields (source, claimId) are added when storing to IndexedDB
    // and are NOT part of the blockchain hash
    const vcForHashing = { ...vc };
    const metadataFields = ['source', 'claimId'];
    const presentMetadataFields = metadataFields.filter((field) => field in vcForHashing);

    if (presentMetadataFields.length > 0) {
      console.warn(
        '⚠️ Metadata fields detected (will be excluded from hash):',
        presentMetadataFields
      );
      presentMetadataFields.forEach((field) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (vcForHashing as any)[field];
      });
      console.log('✓ Removed metadata fields for hash calculation');
    }

    // Note: fileId and fileUrl are included in the hash because they are set before signing
    console.log(
      '📋 VC keys for hashing (after removing metadata):',
      Object.keys(vcForHashing).sort()
    );

    // Create a canonical version for hashing (sorted keys at all levels)
    const canonicalVC = JSON.stringify(vcForHashing, Object.keys(vcForHashing).sort());
    console.log('📝 Canonical VC string (first 200 chars):', canonicalVC.substring(0, 200) + '...');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vcHash = hashVC(vcForHashing as any);

    console.log('🔐 Generated VC Hash:', vcHash);
    console.log('📏 Hash length:', vcHash.length, 'characters');

    // Get holder DID from credentialSubject.id
    const holderDid = credentialSubject.id;

    console.log('👤 Holder DID:', holderDid);

    // Prepare request body
    const requestBody = {
      vc_json: {
        id: vcId,
        expiredAt: expiredAt,
      },
      vc_hash: vcHash,
      holder_did: holderDid,
    };

    console.log('📤 Request body:', JSON.stringify(requestBody, null, 2));

    // Call API endpoint with Bearer token
    const apiUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.VALIDATE_VC);
    console.log('🌐 API URL:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    });

    console.log('📥 Response status:', response.status, response.statusText);

    const data = await response.json();
    console.log('📥 Response data:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error('❌ Response not OK:', data.message || 'API validation failed');
      console.groupEnd();
      return {
        isValid: false,
        errors: [data.message || 'API validation failed'],
      };
    }

    // Check if API response indicates validation success
    if (data.success === false) {
      console.error('❌ API returned success=false:', data.message || 'VC validation failed');
      console.groupEnd();
      return {
        isValid: false,
        errors: [data.message || 'VC validation failed'],
      };
    }

    // Check the data.is_valid field from the response
    if (data.data && data.data.is_valid === false) {
      console.error('❌ VC validation failed. Detailed validation results:');
      console.log('  - DID valid:', data.data.did_valid);
      console.log('  - Expiration valid:', data.data.expiration_valid);
      console.log('  - Hash valid:', data.data.hash_valid);

      if (data.data.hash_valid === false) {
        console.error('🔐 Hash mismatch detected:');
        console.log('  - Client-generated hash:', vcHash);
        console.log(
          '  - Blockchain hash (expected):',
          data.data.blockchain_hash || 'NOT PROVIDED IN API RESPONSE'
        );
        console.log('  - Full validation data:', data.data);

        // Try to extract hash from error message if not in data
        if (!data.data.blockchain_hash && data.message) {
          console.warn('⚠️ Blockchain hash not in data field, check error message:', data.message);
        }
      }

      const errors = [];

      if (data.data.errors && data.data.errors.length > 0) {
        errors.push(...data.data.errors);
        console.error('  - API errors:', data.data.errors);
      } else {
        // Provide specific error messages based on validation flags
        if (data.data.did_valid === false) {
          errors.push('DID validation failed');
        }
        if (data.data.expiration_valid === false) {
          errors.push('Expiration validation failed');
        }
        if (data.data.hash_valid === false) {
          errors.push('Hash validation failed - VC data may have been modified');
        }
        if (errors.length === 0) {
          errors.push(data.message || 'VC validation failed');
        }
      }

      console.groupEnd();
      return {
        isValid: false,
        errors,
      };
    }

    console.log('✅ VC validation successful!');
    console.groupEnd();

    return {
      isValid: true,
      errors: [],
    };
  } catch (error) {
    console.error('❌ Error validating VC with API:', error);
    console.groupEnd();
    return {
      isValid: false,
      errors: [`API validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
};

/**
 * Check if VC already exists in IndexedDB
 */
export const checkVCDuplicate = async (
  vcId: string
): Promise<{
  isDuplicate: boolean;
  error?: string;
}> => {
  try {
    const existingVC = await getVCById(vcId);

    if (existingVC) {
      return {
        isDuplicate: true,
      };
    }

    return {
      isDuplicate: false,
    };
  } catch (error) {
    console.error('Error checking VC duplicate:', error);
    return {
      isDuplicate: false,
      error: `Database check error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

/**
 * Comprehensive VC validation
 * Performs structure validation, API validation, and duplicate check
 */
export const validateVCComprehensive = async (
  fileContent: string
): Promise<{
  isValid: boolean;
  errors: string[];
  vc?: VerifiableCredential;
  stage?: 'structure' | 'api' | 'duplicate';
}> => {
  console.group('🚀 Comprehensive VC Validation');
  console.log('📄 File content length:', fileContent.length, 'characters');

  // Stage 1: Structure validation
  console.log('\n📋 Stage 1: Structure Validation');
  const parseResult = parseAndValidateVC(fileContent);

  if (!parseResult.isValid || !parseResult.vc) {
    console.error('❌ Structure validation failed:', parseResult.errors);
    console.groupEnd();
    return {
      isValid: false,
      errors: parseResult.errors,
      stage: 'structure',
    };
  }

  console.log('✅ Structure validation passed');
  const vc = parseResult.vc;
  console.log('📄 Parsed VC ID:', vc.id);

  // Stage 2: API validation
  console.log('\n🌐 Stage 2: API Validation');
  const apiValidation = await validateVCWithAPI(vc);

  if (!apiValidation.isValid) {
    console.error('❌ API validation failed:', apiValidation.errors);
    console.groupEnd();
    return {
      isValid: false,
      errors: apiValidation.errors,
      vc: vc,
      stage: 'api',
    };
  }

  console.log('✅ API validation passed');

  // Stage 3: Duplicate check
  console.log('\n🔍 Stage 3: Duplicate Check');
  const duplicateCheck = await checkVCDuplicate(vc.id);

  if (duplicateCheck.error) {
    console.error('❌ Duplicate check error:', duplicateCheck.error);
    console.groupEnd();
    return {
      isValid: false,
      errors: [duplicateCheck.error],
      vc: vc,
      stage: 'duplicate',
    };
  }

  if (duplicateCheck.isDuplicate) {
    console.warn('⚠️ Duplicate VC found in storage');
    console.groupEnd();
    return {
      isValid: false,
      errors: ['This credential already exists in your storage'],
      vc: vc,
      stage: 'duplicate',
    };
  }

  console.log('✅ No duplicate found');

  // All validations passed
  console.log('\n✅ All validations passed successfully!');
  console.groupEnd();

  return {
    isValid: true,
    errors: [],
    vc: vc,
  };
};
