/**
 * IndexedDB utility for storing Verifiable Credentials
 * Database: CredentialsDB
 * Store: credentials
 */

import { SignedVerifiableCredentialDB } from './vcSigner';

const DB_NAME = 'CredentialsDB';
const STORE_NAME = 'credentials';
const DB_VERSION = 1;

export interface VerifiableCredential {
  '@context': string[];
  id: string;
  type: string[];
  issuer: string;
  issuerName: string;
  validFrom: string;
  expiredAt: string | null;
  imageLink: string | null;
  claimId?: string; // Request ID from the claim batch API
  source?: string;
  credentialSubject: {
    id: string;
    [key: string]: unknown;
  };
  proof: {
    type: string;
    cryptosuite: string;
    created: string;
    verificationMethod: string;
    proofPurpose: string;
    proofValue: string;
  };
}

/**
 * Open or create the IndexedDB database
 */
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });

        // Create indexes for efficient querying
        objectStore.createIndex('issuer', 'issuer', { unique: false });
        objectStore.createIndex('expiredAt', 'expiredAt', { unique: false });
        objectStore.createIndex('validFrom', 'validFrom', { unique: false });
      }
    };
  });
};

/**
 * Store a single Verifiable Credential in IndexedDB
 */
export const storeVC = async (vc: VerifiableCredential): Promise<boolean> => {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.put(vc);

      request.onsuccess = () => {
        console.log(`[IndexedDB] VC stored successfully: ${vc.id}`);
        resolve(true);
      };

      request.onerror = () => {
        console.error(`[IndexedDB] Failed to store VC: ${vc.id}`, request.error);
        reject(new Error(`Failed to store VC: ${request.error?.message}`));
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[IndexedDB] Error storing VC:', error);
    throw error;
  }
};

/**
 * Store multiple Verifiable Credentials in IndexedDB
 */
export const storeVCBatch = async (vcs: VerifiableCredential[]): Promise<string[]> => {
  try {
    const db = await openDB();
    const storedIds: string[] = [];

    // Validate all VCs have required 'id' field before attempting to store
    const invalidVCs: number[] = [];
    vcs.forEach((vc, index) => {
      if (!vc || !vc.id) {
        invalidVCs.push(index);
        console.error(`[IndexedDB] VC at index ${index} is missing required 'id' field:`, vc);
      }
    });

    if (invalidVCs.length > 0) {
      throw new Error(
        `${invalidVCs.length} VC(s) missing required 'id' field at indices: ${invalidVCs.join(', ')}`
      );
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);

      let completed = 0;
      let hasError = false;
      const errors: string[] = [];

      vcs.forEach((vc, index) => {
        const request = objectStore.put(vc);

        request.onsuccess = () => {
          storedIds.push(vc.id);
          completed++;
          console.log(`[IndexedDB] VC stored successfully: ${vc.id} (${completed}/${vcs.length})`);

          if (completed === vcs.length && !hasError) {
            resolve(storedIds);
          }
        };

        request.onerror = () => {
          hasError = true;
          const errorMsg = `VC at index ${index} (id: ${vc.id}): ${request.error?.message}`;
          errors.push(errorMsg);
          console.error(`[IndexedDB] Failed to store VC: ${vc.id}`, request.error);
        };
      });

      transaction.onerror = () => {
        reject(new Error('Transaction failed while storing VCs'));
      };

      transaction.oncomplete = () => {
        db.close();
        if (hasError) {
          reject(new Error(`Some VCs failed to store: ${errors.join('; ')}`));
        }
      };
    });
  } catch (error) {
    console.error('[IndexedDB] Error storing VC batch:', error);
    throw error;
  }
};

/**
 * Get a single Verifiable Credential by ID
 */
export const getVCById = async (id: string): Promise<SignedVerifiableCredentialDB | null> => {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get VC: ${request.error?.message}`));
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[IndexedDB] Error getting VC:', error);
    throw error;
  }
};

/**
 * Get all Verifiable Credentials
 */
export const getAllVCs = async (): Promise<VerifiableCredential[]> => {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get all VCs: ${request.error?.message}`));
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[IndexedDB] Error getting all VCs:', error);
    throw error;
  }
};

/**
 * Verify if a VC is stored in IndexedDB
 */
export const isVCStored = async (id: string): Promise<boolean> => {
  try {
    const vc = await getVCById(id);
    return vc !== null;
  } catch (error) {
    console.error('[IndexedDB] Error checking if VC is stored:', error);
    return false;
  }
};

/**
 * Verify if multiple VCs are stored in IndexedDB
 */
export const areVCsStored = async (
  ids: string[]
): Promise<{ stored: string[]; missing: string[] }> => {
  try {
    const stored: string[] = [];
    const missing: string[] = [];

    for (const id of ids) {
      const isStored = await isVCStored(id);
      if (isStored) {
        stored.push(id);
      } else {
        missing.push(id);
      }
    }

    return { stored, missing };
  } catch (error) {
    console.error('[IndexedDB] Error checking VCs:', error);
    throw error;
  }
};

/**
 * Get VCs by request IDs
 * Returns array of objects containing claimId and source for successfully stored VCs
 */
export const getVCsByRequestIds = async (
  claimIds: string[]
): Promise<Array<{ claimId: string; source: string }>> => {
  try {
    const db = await openDB();
    const storedRequestData: Array<{ claimId: string; source: string }> = [];

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const getAllRequest = objectStore.getAll();

      getAllRequest.onsuccess = () => {
        const allVCs: VerifiableCredential[] = getAllRequest.result || [];

        // Filter VCs that have matching claimIds
        claimIds.forEach((claimId) => {
          const found = allVCs.find((vc) => vc.claimId === claimId);
          if (found && found.source) {
            storedRequestData.push({
              claimId: claimId,
              source: found.source,
            });
          }
        });

        resolve(storedRequestData);
      };

      getAllRequest.onerror = () => {
        reject(new Error(`Failed to get VCs: ${getAllRequest.error?.message}`));
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[IndexedDB] Error getting VCs by request IDs:', error);
    throw error;
  }
};

/**
 * Verify if VCs with given request IDs are stored in IndexedDB
 */
export const areVCsStoredByRequestIds = async (
  requestIds: string[]
): Promise<{ items: Array<{ claimId: string; source: string }>; missing: string[] }> => {
  try {
    const storedRequestData = await getVCsByRequestIds(requestIds);
    const storedClaimIds = storedRequestData.map((item) => item.claimId);
    const missing = requestIds.filter((id) => !storedClaimIds.includes(id));

    return { items: storedRequestData, missing };
  } catch (error) {
    console.error('[IndexedDB] Error checking VCs by request IDs:', error);
    throw error;
  }
};

/**
 * Delete a single Verifiable Credential by ID
 */
export const deleteVC = async (id: string): Promise<boolean> => {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.delete(id);

      request.onsuccess = () => {
        console.log(`[IndexedDB] VC deleted successfully: ${id}`);
        resolve(true);
      };

      request.onerror = () => {
        reject(new Error(`Failed to delete VC: ${request.error?.message}`));
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[IndexedDB] Error deleting VC:', error);
    throw error;
  }
};

/**
 * Clear all Verifiable Credentials from IndexedDB
 */
export const clearAllVCs = async (): Promise<boolean> => {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.clear();

      request.onsuccess = () => {
        console.log('[IndexedDB] All VCs cleared successfully');
        resolve(true);
      };

      request.onerror = () => {
        reject(new Error(`Failed to clear VCs: ${request.error?.message}`));
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[IndexedDB] Error clearing VCs:', error);
    throw error;
  }
};

/**
 * Count total number of VCs in IndexedDB
 */
export const countVCs = async (): Promise<number> => {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.count();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error(`Failed to count VCs: ${request.error?.message}`));
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[IndexedDB] Error counting VCs:', error);
    throw error;
  }
};
