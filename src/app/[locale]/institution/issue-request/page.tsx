'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import InstitutionLayout from '@/components/InstitutionLayout';
import { ThemedText } from '@/components/ThemedText';
import { DataTable, Column } from '@/components/DataTable';
import Modal from '@/components/Modal';
import FillIssueRequestForm, { IssueRequestFormData } from '@/components/FillIssueRequestForm';
import { API_ENDPOINTS, buildApiUrlWithParams, buildApiUrl } from '@/utils/api';
import { createVC, hashVC } from '@/utils/vcUtils';
import { signVCWithStoredKey, stringifySignedVC } from '@/utils/vcSigner';
import { redirectIfNotAuthenticated } from '@/utils/auth';
import { authenticatedGet, authenticatedPost } from '@/utils/api-client';
import { decryptWithPrivateKey } from '@/utils/encryptUtils';

interface IssueRequest {
  id: string;
  encrypted_body: string;
  issuer_did: string;
  holder_did: string;
  version: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface ApiResponse {
  success: boolean;
  message: string;
  data: {
    message: string;
    count: number;
    data: IssueRequest[];
  };
}

interface SchemaProperty {
  type: string;
  description: string;
}

interface SchemaDefinition {
  type: string;
  required: string[];
  properties: Record<string, SchemaProperty>;
  expired_in: number;
}

interface SchemaApiResponse {
  success: boolean;
  data: {
    id: string;
    name: string;
    schema: SchemaDefinition;
    issuer_did: string;
    version: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
}

interface SchemaAttribute {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

interface Schema {
  id: string;
  name: string;
  version: string;
  status: string;
  attributes: SchemaAttribute[];
  expired_in: number;
}

export default function IssueRequestPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<IssueRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<IssueRequest[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterSchema, setFilterSchema] = useState('');
  const [filterButtonPosition, setFilterButtonPosition] = useState({ top: 0, left: 0 });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<IssueRequest | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [schemaData, setSchemaData] = useState<Schema | null>(null);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);
  const [requestAttributes, setRequestAttributes] = useState<
    Record<string, string | number | boolean>
  >({});
  const [schemaNames, setSchemaNames] = useState<Map<string, string>>(new Map());
  const [parsedBodies, setParsedBodies] = useState<
    Map<string, { schema_id: string; schema_version: number } | null>
  >(new Map());

  const filterModalRef = useRef<HTMLDivElement>(null);

  // Helper function to parse encrypted_body - attempts decryption with private key
  const parseEncryptedBody = async (
    encryptedBody: string
  ): Promise<{ schema_id: string; schema_version: number } | null> => {
    // Only decrypt if we have a private key available
    if (typeof window !== 'undefined') {
      const privateKeyHex = localStorage.getItem('institutionSigningPrivateKey');
      if (privateKeyHex) {
        try {
          const decryptedBody = await decryptWithPrivateKey(encryptedBody, privateKeyHex);
          return {
            schema_id: String(decryptedBody.schema_id || ''),
            schema_version: Number(decryptedBody.schema_version || 1),
          };
        } catch {
          // Silently handle decryption error - do nothing
        }
      }
    }

    // If no private key available or not in browser, silently return null
    return null;
  };

  // Synchronous helper to get cached parsed body
  const getCachedParsedBody = (
    encryptedBody: string
  ): { schema_id: string; schema_version: number } | null => {
    return parsedBodies.get(encryptedBody) || null;
  };

  // Check authentication on component mount
  useEffect(() => {
    const shouldRedirect = redirectIfNotAuthenticated(router);
    if (!shouldRedirect) {
      setIsAuthenticated(true);
    }
  }, [router]);

  // Fetch issue requests from API
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchRequests = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const issuerDid = localStorage.getItem('institutionDID');
        if (!issuerDid) {
          throw new Error('Institution DID not found. Please log in again.');
        }

        const url = buildApiUrlWithParams(API_ENDPOINTS.CREDENTIAL.GET_REQUESTS, {
          type: 'ISSUANCE',
          issuer_did: issuerDid,
        });

        const response = await authenticatedGet(url);

        if (!response.ok) {
          throw new Error('Failed to fetch issue requests');
        }

        const apiResponse: ApiResponse = await response.json();

        // Extract the actual data array from nested structure
        const requestsData = apiResponse.data.data;

        console.log('Fetched requests:', requestsData);
        console.log('Total count:', apiResponse.data.count);

        // Parse and cache all encrypted bodies
        const parsedBodiesMap = new Map<
          string,
          { schema_id: string; schema_version: number } | null
        >();
        for (const request of requestsData) {
          const parsedBody = await parseEncryptedBody(request.encrypted_body);
          parsedBodiesMap.set(request.encrypted_body, parsedBody);
        }
        setParsedBodies(parsedBodiesMap);

        // Extract unique schema IDs from parsed bodies
        const schemaIds = new Set<string>();
        for (const [, parsedBody] of parsedBodiesMap.entries()) {
          if (parsedBody?.schema_id) {
            schemaIds.add(parsedBody.schema_id);
          }
        }

        // Fetch schema names for all unique schema IDs
        const schemaNameMap = new Map<string, string>();
        const schemaFetchPromises = Array.from(schemaIds).map(async (schemaId) => {
          try {
            // Get schema version from cached parsed bodies or default to version 1
            const request = requestsData.find((r) => {
              const parsed = parsedBodiesMap.get(r.encrypted_body);
              return parsed?.schema_id === schemaId;
            });

            const parsedBody = parsedBodiesMap.get(request?.encrypted_body || '');
            const schemaVersion = parsedBody?.schema_version || 1;

            const schemaUrl = buildApiUrl(API_ENDPOINTS.SCHEMA.DETAIL(schemaId, schemaVersion));
            const schemaResponse = await authenticatedGet(schemaUrl);

            if (schemaResponse.ok) {
              const schemaData: SchemaApiResponse = await schemaResponse.json();
              schemaNameMap.set(schemaId, schemaData.data.name);
            }
          } catch (err) {
            console.error(`Failed to fetch schema ${schemaId}:`, err);
            schemaNameMap.set(schemaId, 'Unknown Schema');
          }
        });

        await Promise.all(schemaFetchPromises);
        setSchemaNames(schemaNameMap);

        // Filter to show only PENDING requests
        const pendingRequests = requestsData.filter((r) => r.status === 'PENDING');
        setRequests(pendingRequests);
        setFilteredRequests(pendingRequests);
      } catch (err) {
        console.error('Error fetching issue requests:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRequests();
  }, [isAuthenticated]);

  const activeCount = requests.filter((r) => r.status === 'PENDING').length;

  // Calculate credentials expiring within 24 hours
  const expiringCount = requests.filter((request) => {
    const activeUntilDate = new Date(request.createdAt);
    activeUntilDate.setFullYear(activeUntilDate.getFullYear() + 5); // 5 years from request date

    const now = new Date();
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Check if activeUntil is between now and 24 hours from now
    return activeUntilDate <= twentyFourHoursFromNow && activeUntilDate > now;
  }).length;

  // Close filter modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showFilterModal &&
        filterModalRef.current &&
        !filterModalRef.current.contains(event.target as Node)
      ) {
        setShowFilterModal(false);
      }
    };

    if (showFilterModal) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFilterModal]);

  const handleSearch = (value: string) => {
    const filtered = requests.filter((request) => {
      const searchLower = value.toLowerCase();

      // Get cached parsed body to get schema_id for searching
      const parsedBody = getCachedParsedBody(request.encrypted_body);
      const schemaId = parsedBody?.schema_id || '';

      return (
        request.holder_did.toLowerCase().includes(searchLower) ||
        schemaId.toLowerCase().includes(searchLower) ||
        request.status.toLowerCase().includes(searchLower)
      );
    });
    setFilteredRequests(filtered);
  };

  const handleFilter = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setFilterButtonPosition({
      top: rect.bottom + 8,
      left: rect.left,
    });
    setShowFilterModal(true);
  };

  const applyFilters = (schema: string) => {
    let filtered = requests;

    if (schema) {
      filtered = filtered.filter((request) => {
        const parsedBody = getCachedParsedBody(request.encrypted_body);
        const schemaId = parsedBody?.schema_id || '';
        return schemaId.toLowerCase().includes(schema.toLowerCase());
      });
    }

    setFilteredRequests(filtered);
  };

  const handleSchemaChange = (schema: string) => {
    setFilterSchema(schema);
    applyFilters(schema);
  };

  const handleReview = async (requestId: string) => {
    console.log('Review request:', requestId);
    const request = requests.find((r) => r.id === requestId);
    if (request) {
      setSelectedRequest(request);
      setShowReviewModal(true);

      // Fetch schema data
      setIsLoadingSchema(true);
      try {
        // Parse encrypted_body to get schema_id and schema_version
        const parsedBody = await parseEncryptedBody(request.encrypted_body);

        if (!parsedBody) {
          throw new Error('Failed to parse encrypted_body');
        }

        const { schema_id: schemaId, schema_version: schemaVersion } = parsedBody;

        console.log('Parsed schema ID:', schemaId);
        console.log('Parsed schema version:', schemaVersion);

        // Fetch schema details using parsed schema_id and schema_version
        const schemaUrl = buildApiUrl(API_ENDPOINTS.SCHEMA.DETAIL(schemaId, schemaVersion));
        const schemaResponse = await authenticatedGet(schemaUrl);

        if (schemaResponse.ok) {
          const schemaApiData: SchemaApiResponse = await schemaResponse.json();

          if (schemaApiData.success && schemaApiData.data) {
            const { id, name, schema, version, isActive } = schemaApiData.data;

            // Transform schema properties into attributes array
            const attributes: SchemaAttribute[] = Object.entries(schema.properties).map(
              ([key, prop]) => ({
                name: key,
                type: prop.type,
                required: schema.required.includes(key),
                description: prop.description,
              })
            );

            setSchemaData({
              id: id,
              name: name,
              version: version.toString(),
              status: isActive ? 'Active' : 'Inactive',
              attributes: attributes,
              expired_in: schema.expired_in,
            });

            // Set empty attributes for now - you can fetch actual values from another endpoint
            setRequestAttributes({});
          } else {
            throw new Error('Invalid schema response');
          }
        } else {
          throw new Error('Failed to fetch schema details');
        }
      } catch (err) {
        console.error('Error fetching schema details:', err);
        setRequestAttributes({});
      } finally {
        setIsLoadingSchema(false);
      }
    }
  };

  const handleIssueCredential = async (data: IssueRequestFormData) => {
    if (!selectedRequest || !schemaData) {
      console.error('No selected request or schema data');
      return;
    }

    try {
      setIsLoadingSchema(true);

      // Convert form attributes to credential data
      const credentialData: Record<string, string | number | boolean> = {};
      data.attributes.forEach((attr) => {
        credentialData[attr.name] = attr.value;
      });

      // Fetch DID Document to get issuer name
      let issuerName = 'Issuer Institution'; // Default fallback
      try {
        const didDocumentUrl = buildApiUrl(API_ENDPOINTS.DID.DOCUMENT(selectedRequest.issuer_did));
        console.log('Fetching DID Document from:', didDocumentUrl);

        const didDocResponse = await authenticatedGet(didDocumentUrl);

        if (didDocResponse.ok) {
          const didDocData = await didDocResponse.json();
          console.log('DID Document response:', didDocData);

          // Extract issuer name from DID Document
          if (didDocData.data?.details?.name) {
            issuerName = didDocData.data.details.name;
            console.log('Extracted issuer name:', issuerName);
          } else {
            console.warn('Issuer name not found in DID Document, using default');
          }
        } else {
          console.warn('Failed to fetch DID Document, using default issuer name');
        }
      } catch (didError) {
        console.error('Error fetching DID Document:', didError);
        console.warn('Using default issuer name');
      }

      // Create Verifiable Credential
      const vc = createVC({
        id: selectedRequest.id,
        vcType: schemaData.name.replace(/\s+/g, ''), // Remove spaces for type name
        issuerDid: selectedRequest.issuer_did,
        issuerName: issuerName,
        holderDid: selectedRequest.holder_did,
        credentialData: credentialData,
      });

      console.log('Created VC (unsigned):', vc);

      // Sign the VC with stored private key
      const signedVC = await signVCWithStoredKey(vc);
      console.log('Signed VC with proof:', signedVC);

      // Hash the original VC (before signing)
      const vcHash = hashVC(vc);
      console.log('VC Hash:', vcHash);

      // Convert signed VC to JSON string for encrypted_body
      const encryptedBody = stringifySignedVC(signedVC);
      console.log('Encrypted body (signed VC as JSON):', encryptedBody);
      console.log('Encrypted body length:', encryptedBody.length);

      // Generate unique vc_id with timestamp and random component
      const timestamp = Date.now();
      const vcId = `${schemaData.id}:${selectedRequest.holder_did}:${timestamp}`;
      console.log('Generated unique VC ID:', vcId);

      // Prepare request body
      const requestBody = {
        request_id: selectedRequest.id,
        issuer_did: selectedRequest.issuer_did,
        holder_did: selectedRequest.holder_did,
        action: 'APPROVED',
        request_type: 'ISSUANCE',
        vc_id: vcId,
        vc_type: schemaData.name.replace(/\s+/g, ''),
        schema_id: schemaData.id,
        schema_version: parseInt(schemaData.version),
        vc_hash: vcHash,
        encrypted_body: encryptedBody, // Send signed VC as stringified JSON
        expired_in: schemaData.expired_in || 0, // Default to 0 (lifetime) if null or empty
      };

      // Validate request body
      console.log('Validating request body...');
      console.log('- request_id:', requestBody.request_id);
      console.log('- issuer_did:', requestBody.issuer_did);
      console.log('- holder_did:', requestBody.holder_did);
      console.log('- action:', requestBody.action);
      console.log('- request_type:', requestBody.request_type);
      console.log('- vc_id:', requestBody.vc_id);
      console.log('- vc_type:', requestBody.vc_type);
      console.log('- schema_id:', requestBody.schema_id);
      console.log('- schema_version:', requestBody.schema_version);
      console.log('- vc_hash:', requestBody.vc_hash);
      console.log('- encrypted_body type:', typeof requestBody.encrypted_body);
      console.log(
        '- encrypted_body preview:',
        requestBody.encrypted_body.substring(0, 100) + '...'
      );

      console.log('Request body:', requestBody);

      // Send POST request to issue VC
      const issueUrl = buildApiUrl(API_ENDPOINTS.CREDENTIAL.ISSUE_VC);
      console.log('Sending request to:', issueUrl);
      console.log('Request body:', JSON.stringify(requestBody, null, 2));

      const response = await authenticatedPost(issueUrl, requestBody);

      console.log('Response status:', response.status);
      console.log('Response statusText:', response.statusText);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);

        // Check if there are validation errors
        if (errorData.errors) {
          const validationErrors = JSON.stringify(errorData.errors, null, 2);
          throw new Error(`Validation failed:\n${validationErrors}`);
        }

        throw new Error(errorData.message || `Failed to issue credential (${response.status})`);
      }

      const result = await response.json();
      console.log('Issue VC result:', result);

      if (result.success) {
        alert(
          `Credential issued successfully!\nTransaction Hash: ${result.data.transaction_hash}\nBlock Number: ${result.data.block_number}`
        );

        // Remove the request from the list
        setRequests((prev) => prev.filter((request) => request.id !== selectedRequest.id));
        setFilteredRequests((prev) => prev.filter((request) => request.id !== selectedRequest.id));

        // Close modal
        setShowReviewModal(false);
        setSchemaData(null);
        setRequestAttributes({});
      }
    } catch (err) {
      console.error('Error issuing credential:', err);
      alert(`Failed to issue credential: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoadingSchema(false);
    }
  };

  const handleReject = async (requestId: string) => {
    console.log('Reject request:', requestId);

    const request = requests.find((r) => r.id === requestId);
    if (!request) {
      console.error('Request not found');
      return;
    }

    // Confirm rejection
    const confirmed = window.confirm('Are you sure you want to reject this credential request?');
    if (!confirmed) {
      return;
    }

    try {
      setIsLoading(true);

      // Generate unique vc_id for rejection tracking
      const timestamp = Date.now();
      const randomComponent = Math.random().toString(36).substring(2, 10);
      const parsedBody = await parseEncryptedBody(request.encrypted_body);
      const schemaId = parsedBody?.schema_id || 'unknown';
      const schemaVersion = parsedBody?.schema_version || 1;
      const vcId = `${schemaId}:${request.holder_did}:${timestamp}:${randomComponent}`;

      console.log('Generated unique VC ID for rejection:', vcId);

      // Fetch schema details to get expired_in
      let expiredIn = 0; // Default lifetime
      try {
        const schemaUrl = buildApiUrl(API_ENDPOINTS.SCHEMA.DETAIL(schemaId, schemaVersion));
        const schemaResponse = await authenticatedGet(schemaUrl);

        if (schemaResponse.ok) {
          const schemaApiData: SchemaApiResponse = await schemaResponse.json();
          if (schemaApiData.success && schemaApiData.data) {
            expiredIn = schemaApiData.data.schema.expired_in;
            console.log('Fetched expired_in from schema:', expiredIn);
          }
        }
      } catch (schemaError) {
        console.warn('Failed to fetch schema for expired_in, using default:', schemaError);
      }

      // Prepare rejection request body
      const requestBody = {
        request_id: request.id,
        issuer_did: request.issuer_did,
        holder_did: request.holder_did,
        action: 'REJECTED',
        request_type: 'ISSUANCE',
        vc_id: vcId,
        expired_in: expiredIn,
      };

      console.log('Rejection request body:', requestBody);

      // Send rejection request to API
      const rejectUrl = buildApiUrl(API_ENDPOINTS.CREDENTIAL.ISSUE_VC);
      const response = await authenticatedPost(rejectUrl, requestBody);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        throw new Error(errorData.message || `Failed to reject request (${response.status})`);
      }

      const result = await response.json();
      console.log('Reject result:', result);

      // Remove the request from the list
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      setFilteredRequests((prev) => prev.filter((r) => r.id !== requestId));

      alert('Credential request rejected successfully');
    } catch (err) {
      console.error('Error rejecting request:', err);
      alert(`Failed to reject request: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyDid = async (did: string, id: string) => {
    try {
      await navigator.clipboard.writeText(did);
      setCopiedId(id);
      // Reset after 2 seconds
      setTimeout(() => {
        setCopiedId(null);
      }, 2000);
      console.log('DID copied to clipboard:', did);
    } catch (err) {
      console.error('Failed to copy DID:', err);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date
      .toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      .replace(/\//g, '/');
  };

  const calculateActiveUntil = (requestedOn: string, expiredIn: number): string => {
    const date = new Date(requestedOn);
    date.setFullYear(date.getFullYear() + 5); // check expiredIn from schema if available
    if (expiredIn) {
      date.setSeconds(date.getSeconds() + expiredIn);
    }
    return formatDate(date.toISOString());
  };

  const truncateDid = (did: string, maxLength: number = 25): string => {
    if (did.length <= maxLength) {
      return did;
    }
    return did.substring(0, maxLength) + '...';
  };

  const getRequestTypeColor = (type: string) => {
    switch (type.toUpperCase()) {
      case 'ISSUANCE':
        return 'bg-blue-100 text-blue-700';
      case 'RENEWAL':
        return 'bg-purple-100 text-purple-700';
      case 'UPDATE':
        return 'bg-cyan-100 text-cyan-700';
      case 'REVOCATION':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const columns: Column<IssueRequest>[] = [
    {
      id: 'holder_did',
      label: 'HOLDER DID',
      sortKey: 'holder_did',
      render: (row) => (
        <div className="flex items-center gap-2">
          <ThemedText className="text-sm text-gray-900">{truncateDid(row.holder_did)}</ThemedText>
          <button
            onClick={() => handleCopyDid(row.holder_did, row.id)}
            className={`relative transition-all duration-200 cursor-pointer ${
              copiedId === row.id
                ? 'text-green-500 scale-110'
                : 'text-blue-500 hover:text-blue-600 hover:scale-110'
            }`}
            title={copiedId === row.id ? 'Copied!' : 'Copy to clipboard'}
          >
            {copiedId === row.id ? (
              <svg
                className="w-4 h-4 animate-[scale-in_0.3s_cubic-bezier(0.68,-0.55,0.265,1.55)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4 transition-transform"
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
            )}
          </button>
        </div>
      ),
    },
    {
      id: 'encrypted_body',
      label: 'SCHEMA NAME',
      sortKey: 'encrypted_body',
      render: (row) => {
        const parsedBody = getCachedParsedBody(row.encrypted_body);
        const schemaId = parsedBody?.schema_id || '';
        const schemaName = schemaNames.get(schemaId) || schemaId || 'Unknown Schema';
        return <ThemedText className="text-sm text-gray-900">{schemaName}</ThemedText>;
      },
    },
    {
      id: 'request_type',
      label: 'TYPE',
      render: () => (
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getRequestTypeColor('ISSUANCE')}`}
        >
          Issuance
        </span>
      ),
    },
    {
      id: 'createdAt',
      label: 'REQUESTED ON',
      sortKey: 'createdAt',
      render: (row) => (
        <ThemedText className="text-sm text-gray-900">{formatDate(row.createdAt)}</ThemedText>
      ),
    },
    {
      id: 'activeUntil',
      label: 'ACTIVE UNTIL',
      sortKey: 'createdAt',
      render: (row) => {
        // Default to 5 years (157680000 seconds) if no schema data available
        const expiredIn = schemaData?.expired_in || 157680000;
        return (
          <ThemedText className="text-sm text-gray-900">
            {calculateActiveUntil(row.createdAt, expiredIn)}
          </ThemedText>
        );
      },
    },
    {
      id: 'action',
      label: 'ACTION',
      render: (row) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleReview(row.id)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer"
            disabled={row.status !== 'PENDING'}
          >
            REVIEW
          </button>
          <button
            onClick={() => handleReject(row.id)}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer"
            disabled={row.status !== 'PENDING'}
          >
            REJECT
          </button>
        </div>
      ),
    },
  ];

  // Show loading screen while checking authentication
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0D2B45] mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  return (
    <InstitutionLayout activeTab="issue-request">
      <div className="p-12">
        <ThemedText fontSize={40} fontWeight={700} className="text-black mb-8">
          Issue Request
        </ThemedText>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-6 mb-8 pt-4">
          <div className="bg-blue-50 grid grid-row-2 rounded-2xl p-6">
            <ThemedText className="text-sm text-gray-600 mb-2">Active Requests</ThemedText>
            <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
              {activeCount.toLocaleString()}
            </ThemedText>
          </div>
          <div className="bg-blue-50 grid grid-row-2 rounded-2xl p-6">
            <ThemedText className="text-sm text-gray-600 mb-2">Expired in 24 hours</ThemedText>
            <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
              {expiringCount.toLocaleString()}
            </ThemedText>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <ThemedText className="text-red-800">Error: {error}</ThemedText>
          </div>
        )}

        {/* Data Table */}
        {!isLoading && !error && (
          <DataTable
            data={filteredRequests}
            columns={columns}
            onFilter={handleFilter}
            searchPlaceholder="Search..."
            onSearch={handleSearch}
            enableSelection={true}
            totalCount={filteredRequests.length}
            rowsPerPageOptions={[5, 10, 25, 50, 100]}
            idKey="id"
          />
        )}
      </div>

      {/* Filter Popup */}
      {showFilterModal && (
        <div
          ref={filterModalRef}
          className="fixed bg-white rounded-lg shadow-xl border border-gray-200 p-6 w-80 z-50"
          style={{
            top: `${filterButtonPosition.top}px`,
            left: `${filterButtonPosition.left}px`,
          }}
        >
          <div className="flex items-center justify-between mb-6">
            <ThemedText fontSize={18} fontWeight={600} className="text-gray-900">
              Filter Requests
            </ThemedText>
            <button
              onClick={() => setShowFilterModal(false)}
              className="text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Schema Filter */}
          <div>
            <ThemedText className="block text-sm font-medium text-gray-900 mb-2">
              Encrypted Body
            </ThemedText>
            <input
              type="text"
              value={filterSchema}
              onChange={(e) => handleSchemaChange(e.target.value)}
              placeholder="Search by encrypted body"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
        </div>
      )}

      {/* Review Modal */}
      <Modal
        isOpen={showReviewModal}
        onClose={() => {
          if (!isLoadingSchema) {
            setShowReviewModal(false);
            setSchemaData(null);
            setRequestAttributes({});
          }
        }}
        title="Review Issue Request"
        maxWidth="1000px"
      >
        {isLoadingSchema ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <ThemedText className="text-gray-600">Loading schema and preparing form...</ThemedText>
          </div>
        ) : selectedRequest && schemaData ? (
          <FillIssueRequestForm
            schemaId={schemaData.id}
            schemaName={schemaData.name}
            version={schemaData.version}
            status={schemaData.status}
            initialAttributes={schemaData.attributes.map((attr, index) => ({
              id: index + 1,
              name: attr.name,
              type: attr.type,
              value: requestAttributes[attr.name] || '',
            }))}
            onSubmit={handleIssueCredential}
            onCancel={() => {
              setShowReviewModal(false);
              setSchemaData(null);
              setRequestAttributes({});
            }}
          />
        ) : null}
      </Modal>
    </InstitutionLayout>
  );
}
