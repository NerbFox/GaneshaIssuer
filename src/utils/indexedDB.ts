/**
 * IndexedDB utility for storing Verifiable Credentials
 * Database: CredentialsDB
 * Store: credentials
 */

import { SignedVerifiableCredentialDB } from './vcSigner';

const DB_NAME = 'CredentialsDB';
const STORE_NAME = 'credentials';
const VP_SHARINGS_STORE = 'vp_sharings';
const SCHEMA_DATA_STORE = 'schema_data';
const DB_VERSION = 3; // Increment version to add schema_data store

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

export interface SchemaData {
  vc_id: string; // Foreign key to VerifiableCredential.id (1-to-1)
  id: string;
  version: number;
  name: string;
  schema: Record<string, unknown>;
  issuer_did: string;
  issuer_name: string;
  image_link: string | null;
  expired_in: number;
  isActive: boolean;
}

export interface VPSharing {
  vp_id: string;
  holder_did: string;
  vp_request_id: string;
  credentials: Array<{
    schema_id: string;
    schema_name: string;
    schema_version: number;
  }>;
  created_at: string;
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

      // Create VP sharings object store if it doesn't exist
      if (!db.objectStoreNames.contains(VP_SHARINGS_STORE)) {
        const vpSharingsStore = db.createObjectStore(VP_SHARINGS_STORE, { keyPath: 'vp_id' });

        // Create indexes for efficient querying
        vpSharingsStore.createIndex('holder_did', 'holder_did', { unique: false });
        vpSharingsStore.createIndex('vp_request_id', 'vp_request_id', { unique: false });
        vpSharingsStore.createIndex('created_at', 'created_at', { unique: false });
      }

      // Create schema_data object store if it doesn't exist
      if (!db.objectStoreNames.contains(SCHEMA_DATA_STORE)) {
        const schemaDataStore = db.createObjectStore(SCHEMA_DATA_STORE, { keyPath: 'vc_id' });

        // Create indexes for efficient querying
        schemaDataStore.createIndex('id', 'id', { unique: false });
        schemaDataStore.createIndex('issuer_did', 'issuer_did', { unique: false });
        schemaDataStore.createIndex('name', 'name', { unique: false });
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

/**
 * Store multiple VP sharings in IndexedDB
 */
export const storeVPSharings = async (vpSharings: VPSharing[]): Promise<string[]> => {
  try {
    const db = await openDB();
    const storedIds: string[] = [];

    // Validate all VP sharings have required 'vp_id' field
    const invalidVPs: number[] = [];
    vpSharings.forEach((vp, index) => {
      if (!vp || !vp.vp_id) {
        invalidVPs.push(index);
        console.error(`[IndexedDB] VP at index ${index} is missing required 'vp_id' field:`, vp);
      }
    });

    if (invalidVPs.length > 0) {
      throw new Error(
        `${invalidVPs.length} VP(s) missing required 'vp_id' field at indices: ${invalidVPs.join(', ')}`
      );
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([VP_SHARINGS_STORE], 'readwrite');
      const objectStore = transaction.objectStore(VP_SHARINGS_STORE);

      let completed = 0;
      let hasError = false;
      const errors: string[] = [];

      vpSharings.forEach((vp, index) => {
        const request = objectStore.put(vp);

        request.onsuccess = () => {
          storedIds.push(vp.vp_id);
          completed++;
          console.log(
            `[IndexedDB] VP stored successfully: ${vp.vp_id} (${completed}/${vpSharings.length})`
          );

          if (completed === vpSharings.length && !hasError) {
            resolve(storedIds);
          }
        };

        request.onerror = () => {
          hasError = true;
          const errorMsg = `VP at index ${index} (id: ${vp.vp_id}): ${request.error?.message}`;
          errors.push(errorMsg);
          console.error(`[IndexedDB] Failed to store VP: ${vp.vp_id}`, request.error);
        };
      });

      transaction.onerror = () => {
        reject(new Error('Transaction failed while storing VP sharings'));
      };

      transaction.oncomplete = () => {
        db.close();
        if (hasError) {
          reject(new Error(`Some VPs failed to store: ${errors.join('; ')}`));
        }
      };
    });
  } catch (error) {
    console.error('[IndexedDB] Error storing VP sharings:', error);
    throw error;
  }
};

/**
 * Get all VP sharings from IndexedDB
 */
export const getAllVPSharings = async (): Promise<VPSharing[]> => {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([VP_SHARINGS_STORE], 'readonly');
      const objectStore = transaction.objectStore(VP_SHARINGS_STORE);
      const request = objectStore.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get all VP sharings: ${request.error?.message}`));
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[IndexedDB] Error getting all VP sharings:', error);
    throw error;
  }
};

/**
 * Get a single VP sharing by ID
 */
export const getVPSharingById = async (vpId: string): Promise<VPSharing | null> => {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([VP_SHARINGS_STORE], 'readonly');
      const objectStore = transaction.objectStore(VP_SHARINGS_STORE);
      const request = objectStore.get(vpId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get VP sharing: ${request.error?.message}`));
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[IndexedDB] Error getting VP sharing:', error);
    throw error;
  }
};

/**
 * Delete a single VP sharing by ID
 */
export const deleteVPSharing = async (vpId: string): Promise<boolean> => {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([VP_SHARINGS_STORE], 'readwrite');
      const objectStore = transaction.objectStore(VP_SHARINGS_STORE);
      const request = objectStore.delete(vpId);

      request.onsuccess = () => {
        console.log(`[IndexedDB] VP sharing deleted successfully: ${vpId}`);
        resolve(true);
      };

      request.onerror = () => {
        reject(new Error(`Failed to delete VP sharing: ${request.error?.message}`));
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[IndexedDB] Error deleting VP sharing:', error);
    throw error;
  }
};

/**
 * Clear all VP sharings from IndexedDB
 */
export const clearAllVPSharings = async (): Promise<boolean> => {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([VP_SHARINGS_STORE], 'readwrite');
      const objectStore = transaction.objectStore(VP_SHARINGS_STORE);
      const request = objectStore.clear();

      request.onsuccess = () => {
        console.log('[IndexedDB] All VP sharings cleared successfully');
        resolve(true);
      };

      request.onerror = () => {
        reject(new Error(`Failed to clear VP sharings: ${request.error?.message}`));
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[IndexedDB] Error clearing VP sharings:', error);
    throw error;
  }
};

/**
 * Store a single schema_data in IndexedDB
 * The vc_id is used as the primary key to maintain 1-to-1 relationship with VC
 */
export const storeSchemaData = async (schemaData: SchemaData): Promise<boolean> => {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SCHEMA_DATA_STORE], 'readwrite');
      const objectStore = transaction.objectStore(SCHEMA_DATA_STORE);
      const request = objectStore.put(schemaData);

      request.onsuccess = () => {
        console.log(`[IndexedDB] Schema data stored successfully for VC: ${schemaData.vc_id}`);
        resolve(true);
      };

      request.onerror = () => {
        console.error(
          `[IndexedDB] Failed to store schema data for VC: ${schemaData.vc_id}`,
          request.error
        );
        reject(new Error(`Failed to store schema data: ${request.error?.message}`));
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[IndexedDB] Error storing schema data:', error);
    throw error;
  }
};

/**
 * Store multiple schema_data in IndexedDB
 */
export const storeSchemaDataBatch = async (schemaDataList: SchemaData[]): Promise<string[]> => {
  try {
    const db = await openDB();
    const storedVcIds: string[] = [];

    // Validate all schema_data have required 'vc_id' field
    const invalidSchemas: number[] = [];
    schemaDataList.forEach((schemaData, index) => {
      if (!schemaData || !schemaData.vc_id) {
        invalidSchemas.push(index);
        console.error(
          `[IndexedDB] Schema data at index ${index} is missing required 'vc_id' field:`,
          schemaData
        );
      }
    });

    if (invalidSchemas.length > 0) {
      throw new Error(
        `${invalidSchemas.length} schema_data missing required 'vc_id' field at indices: ${invalidSchemas.join(', ')}`
      );
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SCHEMA_DATA_STORE], 'readwrite');
      const objectStore = transaction.objectStore(SCHEMA_DATA_STORE);

      let completed = 0;
      let hasError = false;
      const errors: string[] = [];

      schemaDataList.forEach((schemaData, index) => {
        const request = objectStore.put(schemaData);

        request.onsuccess = () => {
          storedVcIds.push(schemaData.vc_id);
          completed++;
          console.log(
            `[IndexedDB] Schema data stored successfully for VC: ${schemaData.vc_id} (${completed}/${schemaDataList.length})`
          );

          if (completed === schemaDataList.length && !hasError) {
            resolve(storedVcIds);
          }
        };

        request.onerror = () => {
          hasError = true;
          const errorMsg = `Schema data at index ${index} (vc_id: ${schemaData.vc_id}): ${request.error?.message}`;
          errors.push(errorMsg);
          console.error(
            `[IndexedDB] Failed to store schema data for VC: ${schemaData.vc_id}`,
            request.error
          );
        };
      });

      transaction.onerror = () => {
        reject(new Error('Transaction failed while storing schema data'));
      };

      transaction.oncomplete = () => {
        db.close();
        if (hasError) {
          reject(new Error(`Some schema data failed to store: ${errors.join('; ')}`));
        }
      };
    });
  } catch (error) {
    console.error('[IndexedDB] Error storing schema data batch:', error);
    throw error;
  }
};

/**
 * Get schema_data by VerifiableCredential.id
 * This maintains the 1-to-1 relationship between VC and schema_data
 */
export const getSchemaDataByVCId = async (vcId: string): Promise<SchemaData | null> => {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SCHEMA_DATA_STORE], 'readonly');
      const objectStore = transaction.objectStore(SCHEMA_DATA_STORE);
      const request = objectStore.get(vcId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get schema data: ${request.error?.message}`));
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[IndexedDB] Error getting schema data by VC ID:', error);
    throw error;
  }
};

/**
 * Get all schema_data from IndexedDB
 */
export const getAllSchemaData = async (): Promise<SchemaData[]> => {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SCHEMA_DATA_STORE], 'readonly');
      const objectStore = transaction.objectStore(SCHEMA_DATA_STORE);
      const request = objectStore.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get all schema data: ${request.error?.message}`));
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[IndexedDB] Error getting all schema data:', error);
    throw error;
  }
};

/**
 * Delete schema_data by VC ID
 */
export const deleteSchemaData = async (vcId: string): Promise<boolean> => {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SCHEMA_DATA_STORE], 'readwrite');
      const objectStore = transaction.objectStore(SCHEMA_DATA_STORE);
      const request = objectStore.delete(vcId);

      request.onsuccess = () => {
        console.log(`[IndexedDB] Schema data deleted successfully for VC: ${vcId}`);
        resolve(true);
      };

      request.onerror = () => {
        reject(new Error(`Failed to delete schema data: ${request.error?.message}`));
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[IndexedDB] Error deleting schema data:', error);
    throw error;
  }
};

/**
 * Clear all schema_data from IndexedDB
 */
export const clearAllSchemaData = async (): Promise<boolean> => {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SCHEMA_DATA_STORE], 'readwrite');
      const objectStore = transaction.objectStore(SCHEMA_DATA_STORE);
      const request = objectStore.clear();

      request.onsuccess = () => {
        console.log('[IndexedDB] All schema data cleared successfully');
        resolve(true);
      };

      request.onerror = () => {
        reject(new Error(`Failed to clear schema data: ${request.error?.message}`));
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[IndexedDB] Error clearing schema data:', error);
    throw error;
  }
};
