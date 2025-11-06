/**
 * Validator for Verifiable Credentials
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
    // Get authentication token
    const token = localStorage.getItem('institutionToken');

    if (!token) {
      return {
        isValid: false,
        errors: ['Authentication token not found. Please log in again.'],
      };
    }

    // Extract required fields
    const vcId = vc.id;
    const credentialSubject = vc.credentialSubject;
    const expiredAt = vc.expiredAt;

    // Generate VC hash
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vcHash = hashVC(vc as any);

    console.info('vc hash: ', vcHash);

    // Get holder DID from credentialSubject.id
    const holderDid = credentialSubject.id;

    // Prepare request body
    const requestBody = {
      vc_json: {
        id: vcId,
        expiredAt: expiredAt,
      },
      vc_hash: vcHash,
      holder_did: holderDid,
    };

    // Call API endpoint with Bearer token
    const response = await fetch(buildApiUrl(API_ENDPOINTS.CREDENTIALS.VALIDATE_VC), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        isValid: false,
        errors: [data.message || 'API validation failed'],
      };
    }

    // Check if API response indicates validation success
    if (data.valid === false || data.success === false) {
      return {
        isValid: false,
        errors: [data.message || 'VC validation failed'],
      };
    }

    return {
      isValid: true,
      errors: [],
    };
  } catch (error) {
    console.error('Error validating VC with API:', error);
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
  // Stage 1: Structure validation
  const parseResult = parseAndValidateVC(fileContent);

  if (!parseResult.isValid || !parseResult.vc) {
    return {
      isValid: false,
      errors: parseResult.errors,
      stage: 'structure',
    };
  }

  const vc = parseResult.vc;

  // Stage 2: API validation
  const apiValidation = await validateVCWithAPI(vc);

  if (!apiValidation.isValid) {
    return {
      isValid: false,
      errors: apiValidation.errors,
      vc: vc,
      stage: 'api',
    };
  }

  // Stage 3: Duplicate check
  const duplicateCheck = await checkVCDuplicate(vc.id);

  if (duplicateCheck.error) {
    return {
      isValid: false,
      errors: [duplicateCheck.error],
      vc: vc,
      stage: 'duplicate',
    };
  }

  if (duplicateCheck.isDuplicate) {
    return {
      isValid: false,
      errors: ['This credential already exists in your storage'],
      vc: vc,
      stage: 'duplicate',
    };
  }

  // All validations passed
  return {
    isValid: true,
    errors: [],
    vc: vc,
  };
};
