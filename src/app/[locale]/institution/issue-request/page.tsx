'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import InstitutionLayout from '@/components/InstitutionLayout';
import { ThemedText } from '@/components/ThemedText';
import { DataTable, Column } from '@/components/DataTable';
import Modal from '@/components/Modal';
import FillIssueRequestForm, { IssueRequestFormData } from '@/components/FillIssueRequestForm';
import ViewSchemaForm from '@/components/ViewSchemaForm';
import { AttributePositionData, QRCodePosition } from '@/components/AttributePositionEditor';
import { DateTimePicker } from '@/components/DateTimePicker';
import InfoModal from '@/components/InfoModal';
import ConfirmationModal from '@/components/ConfirmationModal';
import { API_ENDPOINTS, buildApiUrlWithParams, buildApiUrl } from '@/utils/api';
import { createVC, hashVC } from '@/utils/vcUtils';
import { signVCWithStoredKey } from '@/utils/vcSigner';
import { redirectIfNotAuthenticated } from '@/utils/auth';
import { authenticatedGet, authenticatedPost } from '@/utils/api-client';
import { decryptWithPrivateKey, encryptWithPublicKey } from '@/utils/encryptUtils';

interface IssueRequest {
  id: string;
  encrypted_body: string;
  issuer_did: string;
  holder_did: string;
  version: number;
  status: string;
  type: string; // ISSUANCE, RENEWAL, UPDATE, REVOKE
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
  attribute_positions?: AttributePositionData;
  qr_code_position?: QRCodePosition;
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
    image_link: string | null;
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
  image_link: string | null;
  expired_in: number;
  created_at?: string;
  updated_at?: string;
  attribute_positions?: AttributePositionData;
  qr_code_position?: QRCodePosition;
}

interface RejectRequestBody extends Record<string, unknown> {
  request_id: string;
  action: 'REJECTED';
}

interface IssueRequestBody extends Record<string, unknown> {
  request_id: string;
  action: 'APPROVED';
  vc_id: string;
  schema_id: string;
  schema_version: number;
  vc_hash: string;
  encrypted_body: string;
  expired_at: string | null;
}

interface UpdateRequestBody extends Record<string, unknown> {
  request_id: string;
  action: 'APPROVED';
  vc_id: string;
  new_vc_id: string;
  vc_type: string;
  schema_id: string;
  schema_version: number;
  new_vc_hash: string;
  encrypted_body: string;
  expired_at: string | null;
}

interface RenewRequestBody extends Record<string, unknown> {
  request_id: string;
  action: 'APPROVED';
  vc_id: string;
  encrypted_body: string;
  expired_at: string | null;
}

interface RevokeRequestBody extends Record<string, unknown> {
  request_id: string;
  action: 'APPROVED';
  vc_id: string;
}

export default function IssueRequestPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<IssueRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<IssueRequest[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSchemaStatus, setFilterSchemaStatus] = useState<string>('all');
  const [filterRequestedOnStart, setFilterRequestedOnStart] = useState<string>('');
  const [filterRequestedOnEnd, setFilterRequestedOnEnd] = useState<string>('');
  const [filterSchemaExpiresStart, setFilterSchemaExpiresStart] = useState<string>('');
  const [filterSchemaExpiresEnd, setFilterSchemaExpiresEnd] = useState<string>('');
  const [filterButtonPosition, setFilterButtonPosition] = useState({ top: 0, left: 0 });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showSchemaModal, setShowSchemaModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<IssueRequest | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [schemaData, setSchemaData] = useState<Schema | null>(null);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);
  const [isSubmittingCredential, setIsSubmittingCredential] = useState(false);
  const [requestAttributes, setRequestAttributes] = useState<
    Record<string, string | number | boolean>
  >({});
  const [currentVcId, setCurrentVcId] = useState<string | null>(null); // For UPDATE, RENEWAL, REVOKE requests
  const [schemaNames, setSchemaNames] = useState<Map<string, string>>(new Map());
  const [schemaExpiredIns, setSchemaExpiredIns] = useState<Map<string, number>>(new Map());
  const [schemaIsActive, setSchemaIsActive] = useState<Map<string, boolean>>(new Map());
  const [parsedBodies, setParsedBodies] = useState<
    Map<string, { schema_id: string; schema_version: number } | null>
  >(new Map());
  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<string>>(new Set());
  const [isBulkRejecting, setIsBulkRejecting] = useState(false);
  const [bulkRemainingCount, setBulkRemainingCount] = useState(0);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoModalConfig, setInfoModalConfig] = useState({
    title: '',
    message: '',
    buttonColor: 'blue' as 'blue' | 'green' | 'red' | 'yellow',
  });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const filterModalRef = useRef<HTMLDivElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);

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
          console.log('decryptedBody', decryptedBody);
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
  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const issuerDid = localStorage.getItem('institutionDID');
      if (!issuerDid) {
        throw new Error('Institution DID not found. Please log in again.');
      }

      // Fetch all request types
      const requestTypes = ['ISSUANCE', 'RENEWAL', 'UPDATE', 'REVOKE'];
      const allRequests: IssueRequest[] = [];

      // Fetch requests for each type in parallel
      const fetchPromises = requestTypes.map(async (type) => {
        try {
          const url = buildApiUrlWithParams(API_ENDPOINTS.CREDENTIALS.REQUESTS, {
            type,
            issuer_did: issuerDid,
          });

          const response = await authenticatedGet(url);

          if (response.ok) {
            const apiResponse: ApiResponse = await response.json();
            // Add type to each request
            const requestsWithType = apiResponse.data.data.map((req) => ({
              ...req,
              type,
            }));
            return requestsWithType;
          }
          return [];
        } catch (err) {
          console.error(`Failed to fetch ${type} requests:`, err);
          return [];
        }
      });

      const results = await Promise.all(fetchPromises);
      results.forEach((requests) => allRequests.push(...requests));

      console.log('Fetched all requests:', allRequests);
      console.log('Total count:', allRequests.length);

      // Parse and cache all encrypted bodies
      const parsedBodiesMap = new Map<
        string,
        { schema_id: string; schema_version: number } | null
      >();
      for (const request of allRequests) {
        console.log('request.type', request.type);
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
      const schemaExpiredInMap = new Map<string, number>();
      const schemaIsActiveMap = new Map<string, boolean>();
      const schemaFetchPromises = Array.from(schemaIds).map(async (schemaId) => {
        try {
          // Get schema version from cached parsed bodies or default to version 1
          const request = allRequests.find((r) => {
            const parsed = parsedBodiesMap.get(r.encrypted_body);
            return parsed?.schema_id === schemaId;
          });

          const parsedBody = parsedBodiesMap.get(request?.encrypted_body || '');
          const schemaVersion = parsedBody?.schema_version || 1;

          const schemaUrl = buildApiUrl(API_ENDPOINTS.SCHEMAS.BY_VERSION(schemaId, schemaVersion));
          const schemaResponse = await authenticatedGet(schemaUrl);

          if (schemaResponse.ok) {
            const schemaData: SchemaApiResponse = await schemaResponse.json();
            // Store schema name with version suffix
            const schemaNameWithVersion = `${schemaData.data.name} v${schemaVersion}`;
            schemaNameMap.set(schemaId, schemaNameWithVersion);
            // If expired_in is null or 0, set to 0 for lifetime
            const expiredIn = schemaData.data.schema.expired_in;
            schemaExpiredInMap.set(schemaId, expiredIn || 0);
            schemaIsActiveMap.set(schemaId, schemaData.data.isActive);
          } else {
            // Schema not found or error
            schemaNameMap.set(schemaId, 'Unknown Schema');
            schemaExpiredInMap.set(schemaId, 0);
            schemaIsActiveMap.set(schemaId, false);
          }
        } catch (err) {
          console.error(`Failed to fetch schema ${schemaId}:`, err);
          schemaNameMap.set(schemaId, 'Unknown Schema');
          schemaExpiredInMap.set(schemaId, 0);
          schemaIsActiveMap.set(schemaId, false);
        }
      });

      await Promise.all(schemaFetchPromises);
      setSchemaNames(schemaNameMap);
      setSchemaExpiredIns(schemaExpiredInMap);
      setSchemaIsActive(schemaIsActiveMap);

      // Filter to show only PENDING requests
      const pendingRequests = allRequests.filter((r) => r.status === 'PENDING');
      setRequests(pendingRequests);
      setFilteredRequests(pendingRequests);
    } catch (err) {
      console.error('Error fetching issue requests:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchRequests();
  }, [isAuthenticated, fetchRequests]);

  // Calculate stats from filtered requests
  const totalPendingCount = filteredRequests.length;
  const issuanceCount = filteredRequests.filter((r) => r.type === 'ISSUANCE').length;
  const renewalCount = filteredRequests.filter((r) => r.type === 'RENEWAL').length;
  const updateCount = filteredRequests.filter((r) => r.type === 'UPDATE').length;
  const revocationCount = filteredRequests.filter((r) => r.type === 'REVOKE').length;

  // Count requests with active vs inactive schemas from filtered requests
  const activeSchemaCount = filteredRequests.filter((r) => {
    const parsedBody = getCachedParsedBody(r.encrypted_body);
    const schemaId = parsedBody?.schema_id || '';
    return schemaIsActive.get(schemaId) === true;
  }).length;

  const inactiveSchemaCount = filteredRequests.filter((r) => {
    const parsedBody = getCachedParsedBody(r.encrypted_body);
    const schemaId = parsedBody?.schema_id || '';
    return schemaIsActive.get(schemaId) !== true;
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

  // Update filter modal position when scrolling
  useEffect(() => {
    const updateFilterPosition = () => {
      if (showFilterModal && filterButtonRef.current) {
        const rect = filterButtonRef.current.getBoundingClientRect();
        setFilterButtonPosition({
          top: rect.bottom + 8,
          left: rect.left,
        });
      }
    };

    if (showFilterModal) {
      window.addEventListener('scroll', updateFilterPosition, true);
      window.addEventListener('resize', updateFilterPosition);
    }

    return () => {
      window.removeEventListener('scroll', updateFilterPosition, true);
      window.removeEventListener('resize', updateFilterPosition);
    };
  }, [showFilterModal]);

  const handleSearch = (value: string) => {
    setSearchValue(value);
  };

  const handleFilter = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setFilterButtonPosition({
      top: rect.bottom + 8,
      left: rect.left,
    });
    setShowFilterModal(true);
  };

  // Apply filters whenever values change
  useEffect(() => {
    let filtered = requests;

    // Apply search filter
    if (searchValue) {
      const searchLower = searchValue.toLowerCase();
      filtered = filtered.filter((request) => {
        const parsedBody = getCachedParsedBody(request.encrypted_body);
        const schemaId = parsedBody?.schema_id || '';
        const schemaName = schemaNames.get(schemaId) || '';

        return (
          request.holder_did.toLowerCase().includes(searchLower) ||
          schemaId.toLowerCase().includes(searchLower) ||
          schemaName.toLowerCase().includes(searchLower) ||
          request.type.toLowerCase().includes(searchLower) ||
          request.id.toLowerCase().includes(searchLower)
        );
      });
    }

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter((request) => request.type === filterType);
    }

    // Apply schema status filter
    if (filterSchemaStatus !== 'all') {
      filtered = filtered.filter((request) => {
        const parsedBody = getCachedParsedBody(request.encrypted_body);
        const schemaId = parsedBody?.schema_id || '';
        const isActive = schemaIsActive.get(schemaId);

        if (filterSchemaStatus === 'active') {
          return isActive === true;
        } else if (filterSchemaStatus === 'inactive') {
          return isActive === false || isActive === undefined;
        }
        return true;
      });
    }

    // Apply requested on date filter
    if (filterRequestedOnStart || filterRequestedOnEnd) {
      filtered = filtered.filter((request) => {
        const requestDate = new Date(request.createdAt);
        const startDate = filterRequestedOnStart ? new Date(filterRequestedOnStart) : null;
        const endDate = filterRequestedOnEnd ? new Date(filterRequestedOnEnd) : null;

        if (startDate && endDate) {
          endDate.setHours(23, 59, 59, 999); // Include the entire end date
          return requestDate >= startDate && requestDate <= endDate;
        } else if (startDate) {
          return requestDate >= startDate;
        } else if (endDate) {
          endDate.setHours(23, 59, 59, 999);
          return requestDate <= endDate;
        }
        return true;
      });
    }

    // Apply schema expires date filter
    if (filterSchemaExpiresStart || filterSchemaExpiresEnd) {
      filtered = filtered.filter((request) => {
        const parsedBody = getCachedParsedBody(request.encrypted_body);
        const schemaId = parsedBody?.schema_id || '';
        const expiredIn = schemaExpiredIns.get(schemaId);

        // If expired_in is null or 0, it's lifetime - skip date filtering
        if (!expiredIn || expiredIn === 0) {
          return false;
        }

        const createdDate = new Date(request.createdAt);
        // Convert years to milliseconds: years * 365.25 days * 24 hours * 60 minutes * 60 seconds * 1000 ms
        const expiryDate = new Date(
          createdDate.getTime() + expiredIn * 365.25 * 24 * 60 * 60 * 1000
        );
        const startDate = filterSchemaExpiresStart ? new Date(filterSchemaExpiresStart) : null;
        const endDate = filterSchemaExpiresEnd ? new Date(filterSchemaExpiresEnd) : null;

        if (startDate && endDate) {
          endDate.setHours(23, 59, 59, 999);
          return expiryDate >= startDate && expiryDate <= endDate;
        } else if (startDate) {
          return expiryDate >= startDate;
        } else if (endDate) {
          endDate.setHours(23, 59, 59, 999);
          return expiryDate <= endDate;
        }
        return true;
      });
    }

    // Sort: inactive schemas at the end
    filtered.sort((a, b) => {
      const parsedBodyA = getCachedParsedBody(a.encrypted_body);
      const parsedBodyB = getCachedParsedBody(b.encrypted_body);
      const schemaIdA = parsedBodyA?.schema_id || '';
      const schemaIdB = parsedBodyB?.schema_id || '';
      const isActiveA = schemaIsActive.get(schemaIdA);
      const isActiveB = schemaIsActive.get(schemaIdB);

      // Active schemas come first
      if (isActiveA && !isActiveB) return -1;
      if (!isActiveA && isActiveB) return 1;

      // If both same status, maintain original order (by createdAt)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    setFilteredRequests(filtered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    searchValue,
    filterType,
    filterSchemaStatus,
    filterRequestedOnStart,
    filterRequestedOnEnd,
    filterSchemaExpiresStart,
    filterSchemaExpiresEnd,
    requests,
    schemaNames,
    schemaIsActive,
    schemaExpiredIns,
    parsedBodies,
  ]);

  const clearFilters = () => {
    setSearchValue('');
    setFilterType('all');
    setFilterSchemaStatus('all');
    setFilterRequestedOnStart('');
    setFilterRequestedOnEnd('');
    setFilterSchemaExpiresStart('');
    setFilterSchemaExpiresEnd('');
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filterType !== 'all') count++;
    if (filterSchemaStatus !== 'all') count++;
    if (filterRequestedOnStart) count++;
    if (filterRequestedOnEnd) count++;
    if (filterSchemaExpiresStart) count++;
    if (filterSchemaExpiresEnd) count++;
    return count;
  };

  const handleSelectionChange = (
    selectedIndexes: number[],
    selectedIdValues?: (string | number)[]
  ) => {
    if (selectedIdValues) {
      // Allow selection of all requests (including those with inactive/unknown schemas)
      // Users can now reject requests even if the schema is inactive or unknown
      const validIds = selectedIdValues.filter((id) => {
        const request = filteredRequests.find((r) => r.id === String(id));
        return request !== undefined;
      });

      setSelectedRequestIds(new Set(validIds.map(String)));
    } else {
      setSelectedRequestIds(new Set());
    }
  };

  const handleUnselectAll = () => {
    setSelectedRequestIds(new Set());
  };

  const handleViewRequest = (requestId: string) => {
    const request = requests.find((r) => r.id === requestId);
    if (request) {
      setSelectedRequest(request);
      setShowViewModal(true);
    }
  };

  const handleViewSchema = async (schemaId: string, schemaVersion: number) => {
    try {
      setIsLoadingSchema(true);
      const schemaUrl = buildApiUrl(API_ENDPOINTS.SCHEMAS.BY_VERSION(schemaId, schemaVersion));
      const schemaResponse = await authenticatedGet(schemaUrl);

      if (schemaResponse.ok) {
        const schemaApiData: SchemaApiResponse = await schemaResponse.json();

        if (schemaApiData.success && schemaApiData.data) {
          const { id, name, schema, version, isActive, createdAt, updatedAt } = schemaApiData.data;

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
            image_link: schemaApiData.data.image_link,
            expired_in: schema.expired_in,
            created_at: createdAt,
            updated_at: updatedAt,
            attribute_positions: schema.attribute_positions,
            qr_code_position: schema.qr_code_position,
          });

          setShowSchemaModal(true);
        } else {
          throw new Error('Invalid schema response');
        }
      } else {
        throw new Error('Failed to fetch schema details');
      }
    } catch (err) {
      console.error('Error fetching schema details:', err);
      alert('Failed to load schema details');
    } finally {
      setIsLoadingSchema(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedRequestIds.size === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to reject ${selectedRequestIds.size} selected request(s)?`
    );

    if (!confirmed) return;

    setIsBulkRejecting(true);
    setBulkRemainingCount(selectedRequestIds.size);

    const selectedArray = Array.from(selectedRequestIds);
    let successCount = 0;
    let failCount = 0;

    for (const requestId of selectedArray) {
      try {
        const request = requests.find((r) => r.id === requestId);
        if (!request) {
          failCount++;
          continue;
        }

        const requestType = request.type;

        // Determine which API endpoint to use based on request type
        let rejectUrl: string;
        let requestBody: RejectRequestBody;

        if (requestType === 'UPDATE') {
          requestBody = {
            request_id: request.id,
            action: 'REJECTED',
          };
          rejectUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.UPDATE_VC);
        } else if (requestType === 'RENEWAL') {
          requestBody = {
            request_id: request.id,
            action: 'REJECTED',
          };
          rejectUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.RENEW_VC);
        } else if (requestType === 'REVOKE') {
          requestBody = {
            request_id: request.id,
            action: 'REJECTED',
          };
          rejectUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.REVOKE_VC);
        } else {
          // ISSUANCE
          requestBody = {
            request_id: request.id,
            action: 'REJECTED',
          };
          rejectUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.ISSUE_VC);
        }

        const response = await authenticatedPost(rejectUrl, requestBody);
        if (response.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        console.error(`Error rejecting request ${requestId}:`, error);
        failCount++;
      } finally {
        setBulkRemainingCount((prev) => prev - 1);
      }
    }

    setIsBulkRejecting(false);
    setBulkRemainingCount(0);
    setSelectedRequestIds(new Set());

    // Refresh the requests list
    if (successCount > 0) {
      setRequests((prev) => prev.filter((r) => !selectedArray.includes(r.id)));
      setFilteredRequests((prev) => prev.filter((r) => !selectedArray.includes(r.id)));
    }

    alert(`Bulk reject completed!\nSuccess: ${successCount}\nFailed: ${failCount}`);
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
        // Decrypt the full encrypted_body to get all data including attributes
        let fullDecryptedBody: Record<string, unknown> | null = null;
        if (typeof window !== 'undefined') {
          const privateKeyHex = localStorage.getItem('institutionSigningPrivateKey');
          if (privateKeyHex) {
            try {
              fullDecryptedBody = await decryptWithPrivateKey(
                request.encrypted_body,
                privateKeyHex
              );
              console.log('Full decrypted body:', fullDecryptedBody);
            } catch (err) {
              console.error('Failed to decrypt encrypted_body:', err);
              throw new Error('Failed to decrypt encrypted_body');
            }
          } else {
            throw new Error('Institution signing private key not found');
          }
        }

        if (!fullDecryptedBody) {
          throw new Error('Failed to decrypt encrypted_body');
        }

        const schemaId = fullDecryptedBody.schema_id;
        const schemaVersion = fullDecryptedBody.schema_version;

        console.log('Parsed schema ID:', schemaId);
        console.log('Parsed schema version:', schemaVersion);

        // Fetch schema details using parsed schema_id and schema_version
        const schemaUrl = buildApiUrl(
          API_ENDPOINTS.SCHEMAS.BY_VERSION(String(schemaId), Number(schemaVersion))
        );
        const schemaResponse = await authenticatedGet(schemaUrl);

        if (schemaResponse.ok) {
          const schemaApiData: SchemaApiResponse = await schemaResponse.json();

          if (schemaApiData.success && schemaApiData.data) {
            const { id, name, schema, version, isActive, createdAt, updatedAt } =
              schemaApiData.data;

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
              image_link: schemaApiData.data.image_link,
              expired_in: schema.expired_in,
              created_at: createdAt,
              updated_at: updatedAt,
              attribute_positions: schema.attribute_positions,
              qr_code_position: schema.qr_code_position,
            });

            // Extract current attribute values from decrypted body
            // For UPDATE, RENEWAL, and REVOKE requests, pre-populate with current values
            const currentAttributes: Record<string, string | number | boolean> = {};
            if (
              fullDecryptedBody.attributes &&
              typeof fullDecryptedBody.attributes === 'object' &&
              fullDecryptedBody.attributes !== null
            ) {
              const attrs = fullDecryptedBody.attributes as Record<string, unknown>;
              Object.keys(attrs).forEach((key) => {
                const value = attrs[key];
                if (
                  typeof value === 'string' ||
                  typeof value === 'number' ||
                  typeof value === 'boolean'
                ) {
                  currentAttributes[key] = value;
                }
              });
            }
            console.log('Current attributes from decrypted body:', currentAttributes);
            setRequestAttributes(currentAttributes);

            // Store the current vc_id for UPDATE, RENEWAL, REVOKE requests
            if (fullDecryptedBody.vc_id && typeof fullDecryptedBody.vc_id === 'string') {
              console.log('Current VC ID from decrypted body:', fullDecryptedBody.vc_id);
              setCurrentVcId(fullDecryptedBody.vc_id);
            } else {
              setCurrentVcId(null);
            }
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
      setIsSubmittingCredential(true);

      // Upload PDF if exists
      let fileId: string | null = null;
      let fileUrl: string | null = null;

      if (data.pdfBlob) {
        try {
          const formData = new FormData();
          formData.append('file', data.pdfBlob, `credential_${Date.now()}.pdf`);

          const uploadUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.UPLOAD_FILE);

          // Get authentication token
          const token = localStorage.getItem('institutionToken');
          if (!token) {
            throw new Error('No authentication token found');
          }

          // Upload file using fetch with multipart/form-data
          const uploadResponse = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              // Don't set Content-Type header - browser will set it with boundary
            },
            body: formData,
          });

          if (!uploadResponse.ok) {
            const uploadError = await uploadResponse.json();
            throw new Error(
              `Failed to upload PDF: ${uploadError.message || uploadResponse.statusText}`
            );
          }

          const uploadResult = await uploadResponse.json();

          if (uploadResult.success && uploadResult.data) {
            fileId = uploadResult.data.file_id;
            fileUrl = uploadResult.data.file_url;
          } else {
            throw new Error('Invalid upload response format');
          }
        } catch (uploadError) {
          throw new Error(
            `Failed to upload PDF: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`
          );
        }
      }

      const requestType = selectedRequest.type;
      console.log('Processing request type:', requestType);

      // For REVOKE requests, we don't need to create a new VC
      if (requestType === 'REVOKE') {
        if (!currentVcId) {
          throw new Error('Missing VC ID for revocation');
        }

        const requestBody = {
          request_id: selectedRequest.id,
          action: 'APPROVED',
          vc_id: currentVcId,
        };

        console.log('Revoke request body:', requestBody);

        const revokeUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.REVOKE_VC);
        const response = await authenticatedPost(revokeUrl, requestBody);

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Error response:', errorData);
          throw new Error(errorData.message || `Failed to revoke credential (${response.status})`);
        }

        const result = await response.json();
        console.log('Revoke VC result:', result);

        if (result.success) {
          setInfoModalConfig({
            title: 'Success',
            message: `Credential revoked successfully!`,
            buttonColor: 'green',
          });
          setShowInfoModal(true);

          // Remove the request from the list
          setRequests((prev) => prev.filter((request) => request.id !== selectedRequest.id));
          setFilteredRequests((prev) =>
            prev.filter((request) => request.id !== selectedRequest.id)
          );

          // Close modal
          setShowReviewModal(false);
          setSchemaData(null);
          setRequestAttributes({});
          setCurrentVcId(null);
        }
        return;
      }

      // For UPDATE, RENEWAL, and ISSUANCE requests, we need to create a new VC
      // Convert form attributes to credential data
      const credentialData: Record<string, string | number | boolean> = {};
      data.attributes.forEach((attr) => {
        credentialData[attr.name] = attr.value;
      });

      // Fetch DID Document to get issuer name
      let issuerName = 'Issuer Institution'; // Default fallback
      try {
        const didDocumentUrl = buildApiUrl(API_ENDPOINTS.DIDS.DOCUMENT(selectedRequest.issuer_did));
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

      // Fetch holder's DID Document to get public key for encryption
      let holderPublicKeyHex: string;
      try {
        console.log('Fetching DID document for:', selectedRequest.holder_did);
        const didDocumentUrl = buildApiUrl(API_ENDPOINTS.DIDS.DOCUMENT(selectedRequest.holder_did));

        const didResponse = await fetch(didDocumentUrl, {
          headers: {
            accept: 'application/json',
          },
        });

        if (!didResponse.ok) {
          const didResult = await didResponse.json();
          const errorMessage =
            didResult.message || didResult.error || 'Failed to fetch DID document';
          throw new Error(errorMessage);
        }

        const didResult = await didResponse.json();
        console.log('DID document fetched:', didResult);

        if (!didResult.success || !didResult.data) {
          throw new Error('Invalid DID document response');
        }

        // Extract the public key from the DID document
        const keyId = didResult.data.keyId; // e.g., "#key-1"
        const publicKeyHex = didResult.data[keyId]; // Get the public key using keyId

        if (!publicKeyHex) {
          throw new Error(`Public key not found for keyId: ${keyId}`);
        }

        holderPublicKeyHex = publicKeyHex;
        console.log(
          'Extracted holder public key (first 20 chars):',
          holderPublicKeyHex.substring(0, 20)
        );
      } catch (holderDidError) {
        console.error('Error fetching holder DID document:', holderDidError);
        throw new Error(
          `Failed to get holder public key: ${holderDidError instanceof Error ? holderDidError.message : 'Unknown error'}`
        );
      }

      // Generate unique vc_id with timestamp and random component
      const timestamp = Date.now();
      const newVcId = `${schemaData.id}:${schemaData.version}:${selectedRequest.holder_did}:${timestamp}`;
      console.log('Generated unique VC ID:', newVcId);

      // Calculate expired_at based on schemaData.expired_in (in years)
      const now = new Date();
      let expiredAt: string | null = null;

      if (schemaData.expired_in > 0) {
        // expired_in is in years, convert to milliseconds and add to current datetime
        // years * 365.25 days * 24 hours * 60 minutes * 60 seconds * 1000 ms
        const expirationDate = new Date(
          now.getTime() + schemaData.expired_in * 365.25 * 24 * 60 * 60 * 1000
        );
        expiredAt = expirationDate.toISOString();
        console.log(
          `Calculated expired_at: ${expiredAt} (${schemaData.expired_in} years from now)`
        );
      } else {
        // expired_in is 0 or null, set expired_at to null for lifetime credential
        expiredAt = null;
        console.log('expired_in is 0 or null (lifetime), setting expired_at to null');
      }

      // Create Verifiable Credential
      const vc = createVC({
        id: newVcId,
        vcType: schemaData.name.replace(/\s+/g, ''), // Remove spaces for type name
        issuerDid: selectedRequest.issuer_did,
        expiredAt: expiredAt,
        imageLink: schemaData.image_link,
        issuerName: issuerName,
        holderDid: selectedRequest.holder_did,
        credentialData: credentialData,
        fileId: fileId,
        fileUrl: fileUrl,
      });

      console.log('Created VC (unsigned):', vc);

      // Sign the VC with stored private key
      const signedVC = await signVCWithStoredKey(vc);
      console.log('Signed VC with proof:', signedVC);

      // Hash the signed VC
      const vcHash = hashVC(signedVC);
      console.log('VC Hash:', vcHash);

      console.info('VC full signed: ', signedVC);

      // Encrypt the signed VC with holder's public key
      // SignedVC is JSON-serializable, so we can safely cast it
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const encryptedBody = await encryptWithPublicKey(signedVC as any, holderPublicKeyHex);
      console.log('Encrypted body (encrypted signed VC):', encryptedBody);
      console.log('Encrypted body length:', encryptedBody.length);

      // Route to appropriate API based on request type
      let apiUrl: string;
      let requestBody: IssueRequestBody | UpdateRequestBody | RenewRequestBody | RevokeRequestBody;

      if (requestType === 'UPDATE') {
        if (!currentVcId) {
          throw new Error('Missing current VC ID for update');
        }

        // Extract vc_type from schema name (remove spaces and version info)
        const vcType = schemaData.name.replace(/\s+/g, '').replace(/v\d+$/, '');

        requestBody = {
          request_id: selectedRequest.id,
          action: 'APPROVED',
          vc_id: currentVcId, // Old VC ID
          new_vc_id: newVcId,
          vc_type: vcType,
          schema_id: schemaData.id,
          schema_version: parseInt(schemaData.version),
          new_vc_hash: vcHash,
          encrypted_body: encryptedBody,
          expired_at: expiredAt,
        };

        apiUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.UPDATE_VC);
        console.log('UPDATE VC - Request body:', requestBody);
      } else if (requestType === 'RENEWAL') {
        if (!currentVcId) {
          throw new Error('Missing current VC ID for renewal');
        }

        requestBody = {
          request_id: selectedRequest.id,
          action: 'APPROVED',
          vc_id: currentVcId, // Existing VC ID to renew
          encrypted_body: encryptedBody,
          expired_at: expiredAt,
        };

        apiUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.RENEW_VC);
        console.log('RENEW VC - Request body:', requestBody);
      } else {
        // ISSUANCE (default)
        requestBody = {
          request_id: selectedRequest.id,
          action: 'APPROVED',
          vc_id: newVcId,
          schema_id: schemaData.id,
          schema_version: parseInt(schemaData.version),
          vc_hash: vcHash,
          encrypted_body: encryptedBody,
          expired_at: expiredAt,
        };

        apiUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.ISSUE_VC);
        console.log('ISSUE VC - Request body:', requestBody);
      }

      // Send POST request
      console.log('Sending request to:', apiUrl);
      const response = await authenticatedPost(apiUrl, requestBody);

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

        throw new Error(errorData.message || `Failed to process credential (${response.status})`);
      }

      const result = await response.json();
      console.log('API result:', result);

      if (result.success) {
        const actionWord =
          requestType === 'UPDATE' ? 'updated' : requestType === 'RENEWAL' ? 'renewed' : 'issued';

        setInfoModalConfig({
          title: 'Success',
          message: `Credential ${actionWord} successfully!`,
          buttonColor: 'green',
        });
        setShowInfoModal(true);

        // Remove the request from the list
        setRequests((prev) => prev.filter((request) => request.id !== selectedRequest.id));
        setFilteredRequests((prev) => prev.filter((request) => request.id !== selectedRequest.id));

        // Close modal and reset state
        setShowReviewModal(false);
        setSchemaData(null);
        setRequestAttributes({});
        setCurrentVcId(null);
      }
    } catch (err) {
      console.error('Error processing credential:', err);
      setInfoModalConfig({
        title: 'Error',
        message: `Failed to process credential: ${err instanceof Error ? err.message : 'Unknown error'}`,
        buttonColor: 'red',
      });
      setShowInfoModal(true);
    } finally {
      setIsSubmittingCredential(false);
    }
  };

  const handleReject = async (requestId: string) => {
    console.log('Reject request:', requestId);

    const request = requests.find((r) => r.id === requestId);
    if (!request) {
      console.error('Request not found');
      return;
    }

    // Show confirmation modal
    setConfirmModalConfig({
      title: 'Confirm Rejection',
      message: 'Are you sure you want to reject this credential request?',
      onConfirm: () => executeReject(requestId),
    });
    setShowConfirmModal(true);
  };

  const executeReject = async (requestId: string) => {
    setShowConfirmModal(false);

    const request = requests.find((r) => r.id === requestId);
    if (!request) {
      console.error('Request not found');
      return;
    }

    try {
      setIsLoading(true);

      const requestType = request.type;
      console.log('Rejecting request type:', requestType);

      // Determine which API endpoint to use based on request type
      let rejectUrl: string;
      let requestBody: RejectRequestBody;

      if (requestType === 'UPDATE') {
        // For UPDATE rejections, use the UPDATE_VC endpoint
        requestBody = {
          request_id: request.id,
          action: 'REJECTED',
        };
        rejectUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.UPDATE_VC);
      } else if (requestType === 'RENEWAL') {
        // For RENEWAL rejections, use the RENEW_VC endpoint
        requestBody = {
          request_id: request.id,
          action: 'REJECTED',
        };
        rejectUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.RENEW_VC);
      } else if (requestType === 'REVOKE') {
        // For REVOKE rejections, use the REVOKE_VC endpoint
        requestBody = {
          request_id: request.id,
          action: 'REJECTED',
        };
        rejectUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.REVOKE_VC);
      } else {
        // For ISSUANCE rejections, use the ISSUE_VC endpoint (existing behavior)
        requestBody = {
          request_id: request.id,
          action: 'REJECTED',
        };
        rejectUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.ISSUE_VC);
      }

      console.log('Rejection request body:', requestBody);
      console.log('Rejection URL:', rejectUrl);

      // Send rejection request to API
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

      setInfoModalConfig({
        title: 'Success',
        message: 'Credential request rejected successfully',
        buttonColor: 'green',
      });
      setShowInfoModal(true);
    } catch (err) {
      console.error('Error rejecting request:', err);
      setInfoModalConfig({
        title: 'Error',
        message: `Failed to reject request: ${err instanceof Error ? err.message : 'Unknown error'}`,
        buttonColor: 'red',
      });
      setShowInfoModal(true);
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
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
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
      case 'REVOKE':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const columns: Column<IssueRequest>[] = [
    {
      id: 'holderDid',
      label: 'HOLDER DID',
      sortKey: 'holder_did',
      render: (row) => (
        <div className="flex items-center gap-2">
          <ThemedText className="text-sm text-gray-900">{truncateDid(row.holder_did)}</ThemedText>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopyDid(row.holder_did, row.id);
            }}
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
      id: 'schemaName',
      label: 'SCHEMA NAME',
      sortKey: 'encrypted_body',
      render: (row) => {
        const parsedBody = getCachedParsedBody(row.encrypted_body);
        const schemaId = parsedBody?.schema_id || '';
        const schemaName = schemaNames.get(schemaId) || schemaId || 'Unknown Schema';
        const isActive = schemaIsActive.get(schemaId);
        const isUnknown = schemaName === 'Unknown Schema';

        // If unknown schema, just show text without button
        if (isUnknown) {
          return <ThemedText className="text-sm text-red-600">{schemaName} (Not Found)</ThemedText>;
        }

        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleViewSchema(schemaId, parsedBody?.schema_version || 1);
            }}
            className={`text-sm hover:underline text-left cursor-pointer ${
              isActive === false ? 'text-red-600' : 'text-blue-600 hover:text-blue-800'
            }`}
          >
            {schemaName}
            {isActive === false && ' (Inactive)'}
          </button>
        );
      },
    },
    {
      id: 'requestType',
      label: 'REQUEST TYPE',
      sortKey: 'type',
      render: (row) => (
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getRequestTypeColor(row.type)}`}
        >
          {row.type.charAt(0) + row.type.slice(1).toLowerCase()}
        </span>
      ),
    },
    {
      id: 'requestedAt',
      label: 'REQUESTED AT',
      sortKey: 'createdAt',
      render: (row) => (
        <ThemedText className="text-sm text-gray-900">{formatDate(row.createdAt)}</ThemedText>
      ),
    },
    {
      id: 'expiredAt',
      label: 'EXPIRED AT',
      sortKey: 'createdAt',
      render: (row) => {
        const parsedBody = getCachedParsedBody(row.encrypted_body);
        const schemaId = parsedBody?.schema_id || '';
        const expiredIn = schemaExpiredIns.get(schemaId);

        // Handle lifetime (0 or null/undefined)
        if (!expiredIn || expiredIn === 0) {
          return <ThemedText className="text-sm text-gray-900">Lifetime</ThemedText>;
        }

        // Calculate expiry from request createdAt + expired_in (in years)
        const createdDate = new Date(row.createdAt);
        // Convert years to milliseconds: years * 365.25 days * 24 hours * 60 minutes * 60 seconds * 1000 ms
        const expiryDate = new Date(
          createdDate.getTime() + expiredIn * 365.25 * 24 * 60 * 60 * 1000
        );

        return (
          <ThemedText className="text-sm text-gray-900">
            {expiryDate.toLocaleString('en-US', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false,
            })}
          </ThemedText>
        );
      },
    },
    {
      id: 'action',
      label: 'ACTION',
      render: (row) => {
        const parsedBody = getCachedParsedBody(row.encrypted_body);
        const schemaId = parsedBody?.schema_id || '';
        const isSchemaActive = schemaIsActive.get(schemaId);

        // If schema is inactive or unknown, show only REJECT button
        if (isSchemaActive === false || isSchemaActive === undefined) {
          return (
            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => handleReject(row.id)}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={row.status !== 'PENDING'}
              >
                REJECT
              </button>
            </div>
          );
        }

        // For active schema, show both REVIEW and REJECT buttons
        return (
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => handleReview(row.id)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={row.status !== 'PENDING'}
            >
              REVIEW
            </button>
            <button
              onClick={() => handleReject(row.id)}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={row.status !== 'PENDING'}
            >
              REJECT
            </button>
          </div>
        );
      },
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
        <div className="space-y-6 mb-8 pt-4">
          {/* First Row: Total, Active, Inactive */}
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-blue-50 grid grid-row-2 rounded-2xl p-6">
              <ThemedText className="text-sm text-gray-600 mb-2">Total Pending</ThemedText>
              <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
                {totalPendingCount.toLocaleString()}
              </ThemedText>
            </div>
            <div className="bg-green-50 grid grid-row-2 rounded-2xl p-6">
              <ThemedText className="text-sm text-gray-600 mb-2">Active Schema Requests</ThemedText>
              <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
                {activeSchemaCount.toLocaleString()}
              </ThemedText>
            </div>
            <div className="bg-red-50 grid grid-row-2 rounded-2xl p-6">
              <ThemedText className="text-sm text-gray-600 mb-2">
                Inactive Schema Requests
              </ThemedText>
              <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
                {inactiveSchemaCount.toLocaleString()}
              </ThemedText>
            </div>
          </div>

          {/* Second Row: Issuance, Renewal, Update, Revoke */}
          <div className="grid grid-cols-4 gap-6">
            <div className="bg-purple-50 grid grid-row-2 rounded-2xl p-6">
              <ThemedText className="text-sm text-gray-600 mb-2">Issuance</ThemedText>
              <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
                {issuanceCount.toLocaleString()}
              </ThemedText>
            </div>
            <div className="bg-cyan-50 grid grid-row-2 rounded-2xl p-6">
              <ThemedText className="text-sm text-gray-600 mb-2">Renewal</ThemedText>
              <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
                {renewalCount.toLocaleString()}
              </ThemedText>
            </div>
            <div className="bg-orange-50 grid grid-row-2 rounded-2xl p-6">
              <ThemedText className="text-sm text-gray-600 mb-2">Update</ThemedText>
              <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
                {updateCount.toLocaleString()}
              </ThemedText>
            </div>
            <div className="bg-rose-50 grid grid-row-2 rounded-2xl p-6">
              <ThemedText className="text-sm text-gray-600 mb-2">Revoke</ThemedText>
              <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
                {revocationCount.toLocaleString()}
              </ThemedText>
            </div>
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
            activeFilterCount={getActiveFilterCount()}
            searchPlaceholder="Search by holder DID, schema, type, or ID..."
            onSearch={handleSearch}
            enableSelection={true}
            onSelectionChange={handleSelectionChange}
            selectedIds={selectedRequestIds}
            onRowClick={(row) => handleViewRequest(row.id)}
            totalCount={filteredRequests.length}
            rowsPerPageOptions={[5, 10, 25, 50, 100]}
            idKey="id"
            filterButtonRef={filterButtonRef}
            defaultSortColumn="createdAt"
            defaultSortDirection="desc"
            topRightButtons={
              <div className="flex items-center gap-3 justify-end">
                {selectedRequestIds.size > 0 ? (
                  <>
                    <button
                      onClick={handleBulkReject}
                      disabled={isBulkRejecting}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isBulkRejecting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Rejecting ({bulkRemainingCount} remaining)
                        </>
                      ) : (
                        `Reject Selected (${selectedRequestIds.size})`
                      )}
                    </button>
                    <div className="h-8 w-px bg-gray-200" />
                    <button
                      onClick={handleUnselectAll}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium cursor-pointer"
                    >
                      Unselect All
                    </button>
                    <div className="h-8 w-px bg-gray-200" />
                  </>
                ) : null}
                <button
                  onClick={fetchRequests}
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      Refresh
                    </>
                  )}
                </button>
              </div>
            }
          />
        )}
      </div>

      {/* Filter Popup */}
      {showFilterModal && (
        <div
          ref={filterModalRef}
          className="fixed bg-white rounded-lg shadow-xl border border-gray-200 w-[640px] z-50 max-h-[85vh] overflow-hidden flex flex-col"
          style={{
            top: `${filterButtonPosition.top}px`,
            left: `${filterButtonPosition.left}px`,
          }}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <ThemedText fontSize={18} fontWeight={600} className="text-gray-900">
              Filter Requests
            </ThemedText>
            <button
              onClick={() => setShowFilterModal(false)}
              className="text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
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

          {/* Scrollable Content */}
          <div className="overflow-y-auto flex-1 px-6 py-4">
            <div className="space-y-4">
              {/* Request Type Filter */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <ThemedText className="block text-sm font-medium text-gray-900 mb-1.5">
                    Request Type
                  </ThemedText>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
                  >
                    <option value="all">All</option>
                    <option value="ISSUANCE">Issuance</option>
                    <option value="RENEWAL">Renewal</option>
                    <option value="UPDATE">Update</option>
                    <option value="REVOKE">Revoke</option>
                  </select>
                </div>

                {/* Schema Status Filter */}
                <div>
                  <ThemedText className="block text-sm font-medium text-gray-900 mb-1.5">
                    Schema Status
                  </ThemedText>
                  <select
                    value={filterSchemaStatus}
                    onChange={(e) => setFilterSchemaStatus(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
                  >
                    <option value="all">All</option>
                    <option value="active">Active Schema Requests</option>
                    <option value="inactive">Inactive Schema Requests</option>
                  </select>
                </div>
              </div>

              {/* Requested On Date Filter */}
              <div>
                <ThemedText className="block text-sm font-medium text-gray-900 mb-1.5">
                  Requested On
                </ThemedText>
                <div className="grid grid-cols-2 gap-4">
                  <DateTimePicker
                    value={filterRequestedOnStart}
                    onChange={setFilterRequestedOnStart}
                  />
                  <DateTimePicker value={filterRequestedOnEnd} onChange={setFilterRequestedOnEnd} />
                </div>
              </div>

              {/* Schema Expires Date Filter */}
              <div>
                <ThemedText className="block text-sm font-medium text-gray-900 mb-1.5">
                  Schema Expires
                </ThemedText>
                <div className="grid grid-cols-2 gap-4">
                  <DateTimePicker
                    value={filterSchemaExpiresStart}
                    onChange={setFilterSchemaExpiresStart}
                  />
                  <DateTimePicker
                    value={filterSchemaExpiresEnd}
                    onChange={setFilterSchemaExpiresEnd}
                  />
                </div>
              </div>
            </div>
            {/* End of Scrollable Content */}
          </div>

          {/* Clear Filters Button */}
          <div className="px-6 py-4 border-t border-gray-200">
            <button
              onClick={clearFilters}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium cursor-pointer"
            >
              Clear All Filters
            </button>
          </div>
        </div>
      )}

      {/* Review Modal */}
      <Modal
        isOpen={showReviewModal}
        onClose={() => {
          if (!isLoadingSchema && !isSubmittingCredential) {
            setShowReviewModal(false);
            setSchemaData(null);
            setRequestAttributes({});
            setCurrentVcId(null);
          }
        }}
        title={
          selectedRequest?.type === 'RENEWAL'
            ? 'Review Renew Request'
            : selectedRequest?.type === 'UPDATE'
              ? 'Review Update Request'
              : selectedRequest?.type === 'REVOKE'
                ? 'Review Revoke Request'
                : 'Review Issue Request'
        }
        maxWidth="1000px"
      >
        {isLoadingSchema ? (
          <div className="flex items-center justify-center gap-3 py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <ThemedText className="text-gray-600">Loading schema and preparing form...</ThemedText>
          </div>
        ) : selectedRequest && schemaData ? (
          <FillIssueRequestForm
            schemaId={schemaData.id}
            schemaName={schemaData.name}
            version={schemaData.version}
            status={schemaData.status}
            expiredIn={schemaData.expired_in}
            createdAt={schemaData.created_at}
            updatedAt={schemaData.updated_at}
            imageUrl={schemaData.image_link || undefined}
            holderDid={selectedRequest.holder_did}
            requestType={selectedRequest.type}
            initialAttributes={schemaData.attributes.map((attr, index) => ({
              id: index + 1,
              name: attr.name,
              type: attr.type,
              value: requestAttributes[attr.name] || '',
              required: attr.required,
            }))}
            attributePositions={schemaData.attribute_positions}
            qrCodePosition={schemaData.qr_code_position}
            onSubmit={handleIssueCredential}
            onCancel={() => {
              setShowReviewModal(false);
              setSchemaData(null);
              setRequestAttributes({});
              setCurrentVcId(null);
            }}
            isSubmitting={isSubmittingCredential}
          />
        ) : null}
      </Modal>

      {/* View Request Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedRequest(null);
        }}
        title="View Request Details"
        maxWidth="800px"
      >
        {selectedRequest && (
          <div className="px-8 py-6">
            {/* Request Information Grid */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              {/* Request ID */}
              <div>
                <label className="block mb-2">
                  <ThemedText className="text-sm font-medium text-gray-700">Request ID</ThemedText>
                </label>
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                  {selectedRequest.id}
                </div>
              </div>

              {/* Request Type */}
              <div>
                <label className="block mb-2">
                  <ThemedText className="text-sm font-medium text-gray-700">
                    Request Type
                  </ThemedText>
                </label>
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getRequestTypeColor(selectedRequest.type)}`}
                  >
                    {selectedRequest.type.charAt(0) + selectedRequest.type.slice(1).toLowerCase()}
                  </span>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block mb-2">
                  <ThemedText className="text-sm font-medium text-gray-700">Status</ThemedText>
                </label>
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                      selectedRequest.status === 'PENDING'
                        ? 'bg-yellow-100 text-yellow-700'
                        : selectedRequest.status === 'APPROVED'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {selectedRequest.status}
                  </span>
                </div>
              </div>

              {/* Requested On */}
              <div>
                <label className="block mb-2">
                  <ThemedText className="text-sm font-medium text-gray-700">
                    Requested On
                  </ThemedText>
                </label>
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                  {formatDate(selectedRequest.createdAt)}
                </div>
              </div>

              {/* Holder DID */}
              <div className="col-span-2">
                <label className="block mb-2">
                  <ThemedText className="text-sm font-medium text-gray-700">Holder DID</ThemedText>
                </label>
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 flex items-center gap-2">
                  <span className="break-all flex-1">{selectedRequest.holder_did}</span>
                  <button
                    onClick={() => handleCopyDid(selectedRequest.holder_did, selectedRequest.id)}
                    className="flex-shrink-0 p-1 hover:bg-gray-200 rounded transition-colors cursor-pointer"
                  >
                    {copiedId === selectedRequest.id ? (
                      <svg
                        className="w-4 h-4 text-green-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-4 h-4 text-gray-500"
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
              </div>

              {/* Issuer DID */}
              <div className="col-span-2">
                <label className="block mb-2">
                  <ThemedText className="text-sm font-medium text-gray-700">Issuer DID</ThemedText>
                </label>
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
                  {selectedRequest.issuer_did}
                </div>
              </div>

              {(() => {
                const parsedBody = getCachedParsedBody(selectedRequest.encrypted_body);
                console.log('parsedBody', parsedBody);
                const schemaId = parsedBody?.schema_id || '';
                const schemaName = schemaNames.get(schemaId) || 'Unknown Schema';
                const expiredIn = schemaExpiredIns.get(schemaId);

                // Calculate schema expires properly
                let schemaExpiresText = 'Lifetime';
                if (expiredIn && expiredIn !== 0) {
                  const createdDate = new Date(selectedRequest.createdAt);
                  const expiryDate = new Date(createdDate.getTime() + expiredIn * 1000);
                  schemaExpiresText = expiryDate.toLocaleString('en-GB', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                  });
                }

                return (
                  <>
                    {/* Schema Name */}
                    <div>
                      <label className="block mb-2">
                        <ThemedText className="text-sm font-medium text-gray-700">
                          Schema Name
                        </ThemedText>
                      </label>
                      <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                        {schemaName}
                      </div>
                    </div>

                    {/* Schema Expires */}
                    <div>
                      <label className="block mb-2">
                        <ThemedText className="text-sm font-medium text-gray-700">
                          Schema Expires
                        </ThemedText>
                      </label>
                      <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                        {schemaExpiresText}
                      </div>
                    </div>

                    {/* Schema ID */}
                    <div className="col-span-2">
                      <label className="block mb-2">
                        <ThemedText className="text-sm font-medium text-gray-700">
                          Schema ID
                        </ThemedText>
                      </label>
                      <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 break-all">
                        {schemaId || 'N/A'}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedRequest(null);
                }}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium cursor-pointer"
              >
                CLOSE
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* View Schema Modal */}
      <Modal
        isOpen={showSchemaModal}
        onClose={() => {
          setShowSchemaModal(false);
          setSchemaData(null);
        }}
        title="View Schema"
      >
        {schemaData && (
          <ViewSchemaForm
            onClose={() => {
              setShowSchemaModal(false);
              setSchemaData(null);
            }}
            schemaData={{
              id: schemaData.id,
              schemaName: schemaData.name,
              version: schemaData.version,
              expiredIn: schemaData.expired_in,
              isActive: schemaData.status,
              createdAt: schemaData.created_at,
              updatedAt: schemaData.updated_at || new Date().toISOString(),
              attributes: schemaData.attributes.map((attr, index) => ({
                id: index + 1,
                name: attr.name,
                type: attr.type,
                description: attr.description || '',
                required: attr.required,
              })),
              imageUrl: schemaData.image_link || undefined,
              attributePositions: schemaData.attribute_positions,
              qrCodePosition: schemaData.qr_code_position,
            }}
          />
        )}
      </Modal>

      {/* Info Modal */}
      <InfoModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title={infoModalConfig.title}
        message={infoModalConfig.message}
        buttonColor={infoModalConfig.buttonColor}
      />

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={confirmModalConfig.onConfirm}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        confirmText="Reject"
        cancelText="Cancel"
        confirmButtonColor="red"
      />
    </InstitutionLayout>
  );
}
