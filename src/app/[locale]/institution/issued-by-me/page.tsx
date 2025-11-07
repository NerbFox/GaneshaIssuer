'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import InstitutionLayout from '@/components/InstitutionLayout';
import { ThemedText } from '@/components/ThemedText';
import { DataTable, Column } from '@/components/DataTable';
import Modal from '@/components/Modal';
import IssueNewCredentialForm, {
  IssueNewCredentialFormData,
} from '@/components/IssueNewCredentialForm';
import UpdateCredentialForm, { UpdateCredentialFormData } from '@/components/UpdateCredentialForm';
import ViewCredentialForm from '@/components/ViewCredentialForm';
import ViewSchemaForm from '@/components/ViewSchemaForm';
import ConfirmationModal from '@/components/ConfirmationModal';
import InfoModal from '@/components/InfoModal';
import { redirectIfJWTInvalid } from '@/utils/auth';
import { API_ENDPOINTS, buildApiUrlWithParams, buildApiUrl } from '@/utils/api';
import { authenticatedGet, authenticatedPost } from '@/utils/api-client';
import { decryptWithPrivateKey } from '@/utils/encryptUtils';

interface IssuedCredential {
  id: string;
  holderDid: string;
  schemaName: string;
  status: string;
  lastUpdated: string;
  activeUntil: string;
  schemaId: string;
  schemaVersion: number;
  encryptedBody?: Record<string, unknown>;
  createdAt: string;
}

interface ApiCredentialResponse {
  success: boolean;
  message: string;
  data: {
    message: string;
    count: number;
    data: {
      id: string;
      encrypted_body: string;
      issuer_did: string;
      holder_did: string;
      status: string;
      createdAt: string;
      updatedAt: string;
      deletedAt: string | null;
    }[];
  };
}

interface SchemaResponse {
  success: boolean;
  data: {
    count: number;
    data: {
      id: string;
      version: number;
      name: string;
      schema: {
        type: string;
        required: string[];
        expired_in: number;
        properties: Record<string, { type: string; description: string }>;
      };
      issuer_did: string;
      issuer_name: string;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
    }[];
  };
}

interface SchemaApiResponse {
  success: boolean;
  data: {
    id: string;
    name: string;
    schema: {
      type: string;
      required: string[];
      properties: Record<string, { type: string; description: string }>;
      expired_in: number;
    };
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
}

export default function IssuedByMePage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [credentials, setCredentials] = useState<IssuedCredential[]>([]);
  const [filteredCredentials, setFilteredCredentials] = useState<IssuedCredential[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'Active' | 'Revoked' | 'Expired'>('all');
  const [filterType, setFilterType] = useState('');
  const [filterButtonPosition, setFilterButtonPosition] = useState({ top: 0, left: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedCredential, setSelectedCredential] = useState<IssuedCredential | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationConfig, setConfirmationConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    confirmButtonColor?: 'blue' | 'green' | 'red' | 'yellow';
  }>({
    title: '',
    message: '',
    onConfirm: () => {},
  });
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoModalConfig, setInfoModalConfig] = useState({
    title: '',
    message: '',
    buttonColor: 'blue' as 'blue' | 'green' | 'red' | 'yellow',
  });
  const [schemas, setSchemas] = useState<
    {
      id: string;
      name: string;
      version: number;
      isActive: boolean;
      attributes: {
        name: string;
        type: string;
        required: boolean;
        description?: string;
      }[];
    }[]
  >([]);
  const [showSchemaModal, setShowSchemaModal] = useState(false);
  const [schemaData, setSchemaData] = useState<Schema | null>(null);

  const filterModalRef = useRef<HTMLDivElement>(null);

  const activeCount = credentials.filter((c) => c.status === 'APPROVED').length;

  // Check authentication with JWT verification on component mount
  useEffect(() => {
    const checkAuth = async () => {
      const redirected = await redirectIfJWTInvalid(router);
      if (!redirected) {
        setIsAuthenticated(true);
      }
    };

    checkAuth();
  }, [router]);

  // Fetch credentials from API
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchCredentials = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const institutionDID = localStorage.getItem('institutionDID');
        if (!institutionDID) {
          throw new Error('Institution DID not found. Please log in again.');
        }

        // Fetch credentials
        const credentialsUrl = buildApiUrlWithParams(API_ENDPOINTS.CREDENTIALS.REQUESTS, {
          type: 'ISSUANCE',
          issuer_did: institutionDID,
        });

        const credentialsResponse = await authenticatedGet(credentialsUrl);

        if (!credentialsResponse.ok) {
          throw new Error('Failed to fetch credentials');
        }

        const credentialsResult: ApiCredentialResponse = await credentialsResponse.json();

        // Fetch schemas to get schema names
        const schemasUrl = buildApiUrlWithParams(API_ENDPOINTS.SCHEMAS.BASE, {
          issuerDid: institutionDID,
        });

        const schemasResponse = await authenticatedGet(schemasUrl);

        if (!schemasResponse.ok) {
          throw new Error('Failed to fetch schemas');
        }

        const schemasResult: SchemaResponse = await schemasResponse.json();

        // Create a map of schema_id to schema name
        const schemaMap = new Map<string, { name: string; expiredIn: number }>();
        schemasResult.data.data.forEach((schema) => {
          schemaMap.set(schema.id, {
            name: schema.name,
            expiredIn: schema.schema.expired_in || 5,
          });
        });

        // Transform schemas for the form
        const transformedSchemas = schemasResult.data.data.map((schema) => ({
          id: schema.id,
          name: schema.name,
          version: schema.version,
          isActive: schema.isActive,
          attributes: Object.entries(schema.schema.properties).map(([key, prop]) => ({
            name: key,
            type: prop.type,
            required: schema.schema.required.includes(key),
            description: prop.description,
          })),
        }));
        setSchemas(transformedSchemas);

        // Parse and cache all encrypted bodies (store full decrypted data)
        const parsedBodiesMap = new Map<
          string,
          { schema_id: string; schema_version: number } | null
        >();
        const decryptedBodiesMap = new Map<string, Record<string, unknown>>();

        const privateKeyHex = localStorage.getItem('institutionSigningPrivateKey');
        for (const credential of credentialsResult.data.data) {
          if (privateKeyHex) {
            try {
              const decryptedBody = await decryptWithPrivateKey(
                credential.encrypted_body,
                privateKeyHex
              );
              // Store schema info for quick access
              parsedBodiesMap.set(credential.encrypted_body, {
                schema_id: String(decryptedBody.schema_id || ''),
                schema_version: Number(decryptedBody.schema_version || 1),
              });
              // Store full decrypted body for forms
              decryptedBodiesMap.set(
                credential.encrypted_body,
                decryptedBody as Record<string, unknown>
              );
            } catch {
              // Silently handle decryption error
              parsedBodiesMap.set(credential.encrypted_body, null);
            }
          } else {
            parsedBodiesMap.set(credential.encrypted_body, null);
          }
        }

        // Transform API data to match IssuedCredential interface
        const transformedCredentials: IssuedCredential[] = credentialsResult.data.data
          .filter(
            (credential) => credential.status !== 'PENDING' && credential.status !== 'REJECTED'
          ) // Filter out PENDING and REJECTED requests
          .map((credential) => {
            // Get parsed body from cache
            const parsedBody = parsedBodiesMap.get(credential.encrypted_body);
            const schemaId = parsedBody?.schema_id || '';
            const schemaVersion = parsedBody?.schema_version || 1;

            // Get decrypted body from cache
            const encryptedBody = decryptedBodiesMap.get(credential.encrypted_body);

            // Get schema name from the map
            const schemaInfo = schemaMap.get(schemaId);
            const schemaName = schemaInfo?.name || 'Unknown Schema';
            const expiredIn = schemaInfo?.expiredIn || 5;
            const isUnknownSchema = !schemaInfo || !schemaId;

            // Calculate active until date (only if schema is known)
            let activeUntil: string;
            let credentialStatus = credential.status;

            if (isUnknownSchema) {
              // For unknown schemas, set active until to '-'
              activeUntil = '-';
            } else {
              const activeUntilDate = new Date(credential.createdAt);
              activeUntilDate.setFullYear(activeUntilDate.getFullYear() + expiredIn);

              // Check if credential is expired based on Active Until date
              const now = new Date();
              if (credential.status === 'APPROVED' && activeUntilDate < now) {
                credentialStatus = 'EXPIRED';
              }

              activeUntil = activeUntilDate.toISOString();
            }

            return {
              id: credential.id,
              holderDid: credential.holder_did,
              // Don't add version suffix for unknown schemas
              schemaName: isUnknownSchema
                ? schemaName
                : schemaVersion > 0
                  ? `${schemaName} v${schemaVersion}`
                  : schemaName,
              status: credentialStatus,
              lastUpdated: credential.updatedAt,
              activeUntil: activeUntil,
              schemaId: schemaId,
              schemaVersion: schemaVersion,
              encryptedBody: encryptedBody,
              createdAt: credential.createdAt,
            };
          });

        setCredentials(transformedCredentials);
        setFilteredCredentials(transformedCredentials);
      } catch (err) {
        console.error('Error fetching credentials:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
        // Keep empty array on error
        setCredentials([]);
        setFilteredCredentials([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCredentials();
  }, [isAuthenticated]);

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
    const filtered = credentials.filter((credential) => {
      const searchLower = value.toLowerCase();
      return (
        credential.schemaName.toLowerCase().includes(searchLower) ||
        credential.holderDid.toLowerCase().includes(searchLower) ||
        credential.status.toLowerCase().includes(searchLower)
      );
    });
    setFilteredCredentials(filtered);
  };

  const handleFilter = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setFilterButtonPosition({
      top: rect.bottom + 8,
      left: rect.left,
    });
    setShowFilterModal(true);
  };

  const applyFilters = (status: 'all' | 'Active' | 'Revoked' | 'Expired', type: string) => {
    let filtered = credentials;

    if (status !== 'all') {
      const statusMap = {
        Active: 'APPROVED',
        Revoked: 'REVOKED',
        Expired: 'EXPIRED',
      };
      filtered = filtered.filter(
        (credential) => credential.status === statusMap[status as keyof typeof statusMap]
      );
    }

    if (type) {
      filtered = filtered.filter((credential) =>
        credential.schemaName.toLowerCase().includes(type.toLowerCase())
      );
    }

    setFilteredCredentials(filtered);
  };

  const handleStatusChange = (status: 'all' | 'Active' | 'Revoked' | 'Expired') => {
    setFilterStatus(status);
    applyFilters(status, filterType);
  };

  const handleTypeChange = (type: string) => {
    setFilterType(type);
    applyFilters(filterStatus, type);
  };

  const handleUpdate = (id: string) => {
    const credential = credentials.find((c) => c.id === id);
    if (!credential) return;

    setSelectedCredential(credential);
    setShowUpdateModal(true);
  };

  const handleUpdateCredential = async (data: UpdateCredentialFormData) => {
    try {
      console.log('Updating credential:', data);

      // Step 1: Revoke the old credential
      console.log('Revoking old credential:', data.credentialId);
      const revokeUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.ISSUER.REVOKE_VC);
      const issuerDid = localStorage.getItem('institutionDID');
      const revokeResponse = await authenticatedPost(revokeUrl, {
        issuer_did: issuerDid,
        vc_id: data.credentialId,
      });

      if (!revokeResponse.ok) {
        throw new Error('Failed to revoke old credential');
      }

      // Step 2: Issue a new credential with updated data
      console.log('Issuing new credential with updated data:', data);
      const issueUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.ISSUER.ISSUE_VC);

      // Transform attributes into the format expected by the API
      const attributesObject: Record<string, string | number | boolean> = {};
      data.attributes.forEach((attr) => {
        attributesObject[attr.name] = attr.value;
      });

      const issueResponse = await authenticatedPost(issueUrl, {
        holder_did: data.holderDid,
        schema_id: data.schemaId,
        schema_version: data.version,
        ...attributesObject,
      });

      if (!issueResponse.ok) {
        throw new Error('Failed to issue new credential');
      }

      // Show success confirmation and close the modal
      setShowUpdateModal(false);
      setSelectedCredential(null);
      setConfirmationConfig({
        title: 'Update Credential',
        message: `The old credential has been revoked and a new credential has been issued.\n\nThe holder will receive the updated credential.`,
        confirmText: 'OK',
        confirmButtonColor: 'green',
        onConfirm: () => {
          setShowConfirmation(false);
          // Refresh the credentials list to show updated data
          window.location.reload();
        },
      });
      setShowConfirmation(true);
    } catch (error) {
      console.error('Error updating credential:', error);
      setConfirmationConfig({
        title: 'Error',
        message: `Failed to update credential: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again.`,
        confirmText: 'OK',
        confirmButtonColor: 'red',
        onConfirm: () => {
          setShowConfirmation(false);
        },
      });
      setShowConfirmation(true);
      throw error;
    }
  };

  const handleRevoke = (id: string) => {
    const credential = credentials.find((c) => c.id === id);
    if (!credential) return;

    setConfirmationConfig({
      title: 'Revoke Credential',
      message: `Are you sure you want to revoke this credential?\n\nThis action cannot be undone.`,
      confirmText: 'Revoke',
      confirmButtonColor: 'red',
      onConfirm: async () => {
        try {
          console.log('Revoke credential:', id);
          const revokeUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.ISSUER.REVOKE_VC);
          const issuerDid = localStorage.getItem('institutionDID');
          const revokeResponse = await authenticatedPost(revokeUrl, {
            issuer_did: issuerDid,
            vc_id: id,
          });

          if (!revokeResponse.ok) {
            throw new Error('Failed to revoke credential');
          }

          setShowConfirmation(false);
          // Refresh the credentials list
          window.location.reload();
        } catch (error) {
          console.error('Error revoking credential:', error);
          setShowConfirmation(false);
          setConfirmationConfig({
            title: 'Error',
            message: `Failed to revoke credential: ${error instanceof Error ? error.message : 'Unknown error'}`,
            confirmText: 'OK',
            confirmButtonColor: 'red',
            onConfirm: () => {
              setShowConfirmation(false);
            },
          });
          setShowConfirmation(true);
        }
      },
    });
    setShowConfirmation(true);
  };

  const handleRenew = (id: string) => {
    const credential = credentials.find((c) => c.id === id);
    if (!credential) return;

    setConfirmationConfig({
      title: 'Renew Credential',
      message: `Are you sure you want to renew this credential?\n\nA new credential with the same data will be issued.`,
      confirmText: 'Renew',
      confirmButtonColor: 'blue',
      onConfirm: async () => {
        try {
          console.log('Renew credential:', id);
          const issueUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.ISSUER.RENEW_VC);

          // Transform attributes into the format expected by the API
          const attributesObject: Record<string, string | number | boolean> = {};
          if (credential.encryptedBody) {
            Object.entries(credential.encryptedBody).forEach(([key, value]) => {
              if (!['schema_id', 'schema_version', 'issuer_did', 'holder_did'].includes(key)) {
                attributesObject[key] = value as string | number | boolean;
              }
            });
          }

          const issueResponse = await authenticatedPost(issueUrl, {
            holder_did: credential.holderDid,
            schema_id: credential.schemaId,
            schema_version: credential.schemaVersion,
            ...attributesObject,
          });

          if (!issueResponse.ok) {
            throw new Error('Failed to renew credential');
          }

          setShowConfirmation(false);
          setConfirmationConfig({
            title: 'Renew Credential',
            message: `A new credential has been issued successfully.\n\nThe holder will receive the renewed credential.`,
            confirmText: 'OK',
            confirmButtonColor: 'green',
            onConfirm: () => {
              setShowConfirmation(false);
              // Refresh the credentials list
              window.location.reload();
            },
          });
          setShowConfirmation(true);
        } catch (error) {
          console.error('Error renewing credential:', error);
          setShowConfirmation(false);
          setConfirmationConfig({
            title: 'Error',
            message: `Failed to renew credential: ${error instanceof Error ? error.message : 'Unknown error'}`,
            confirmText: 'OK',
            confirmButtonColor: 'red',
            onConfirm: () => {
              setShowConfirmation(false);
            },
          });
          setShowConfirmation(true);
        }
      },
    });
    setShowConfirmation(true);
  };

  const handleRowClick = (credential: IssuedCredential) => {
    setSelectedCredential(credential);
    setShowViewModal(true);
  };

  const handleNewCredential = () => {
    setShowIssueModal(true);
  };

  const handleCopyDid = async (did: string, id: string) => {
    try {
      await navigator.clipboard.writeText(did);
      setCopiedId(id);
      // Reset after 2 seconds
      setTimeout(() => {
        setCopiedId(null);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy DID:', error);
    }
  };

  const truncateDid = (did: string, maxLength: number = 25): string => {
    if (did.length <= maxLength) {
      return did;
    }
    return did.substring(0, maxLength) + '...';
  };

  const handleViewSchema = async (schemaId: string, schemaVersion: number) => {
    try {
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
    }
  };

  const handleIssueCredential = async (data: IssueNewCredentialFormData) => {
    try {
      console.log('Issuing new credential:', data);
      // TODO: Implement API call to issue credential
      // For now, just close the modal
      setInfoModalConfig({
        title: 'Success',
        message: `Credential will be issued to:\nHolder DID: ${data.holderDid}\nSchema: ${data.schemaName} v${data.version}`,
        buttonColor: 'green',
      });
      setShowInfoModal(true);
      setShowIssueModal(false);
    } catch (error) {
      console.error('Error issuing credential:', error);
      setInfoModalConfig({
        title: 'Error',
        message: `Failed to issue credential: ${error instanceof Error ? error.message : 'Unknown error'}`,
        buttonColor: 'red',
      });
      setShowInfoModal(true);
      throw error;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-700';
      case 'REVOKED':
        return 'bg-red-100 text-red-700';
      case 'EXPIRED':
        return 'bg-gray-100 text-gray-700';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'Active';
      case 'REVOKED':
        return 'Revoked';
      case 'EXPIRED':
        return 'Expired';
      case 'PENDING':
        return 'Pending';
      default:
        return status;
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
      second: '2-digit',
      hour12: false,
    });
  };

  const columns: Column<IssuedCredential>[] = [
    {
      id: 'holderDid',
      label: 'HOLDER DID',
      sortKey: 'holderDid',
      render: (row) => (
        <div className="flex items-center gap-2">
          <ThemedText className="text-sm text-gray-900">{truncateDid(row.holderDid)}</ThemedText>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopyDid(row.holderDid, row.id);
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
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
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
      sortKey: 'schemaName',
      render: (row) => {
        const isUnknown = row.schemaName.includes('Unknown Schema');

        // If unknown schema, just show text without button
        if (isUnknown || !row.schemaId) {
          return <ThemedText className="text-sm text-red-600">{row.schemaName}</ThemedText>;
        }

        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleViewSchema(row.schemaId, row.schemaVersion);
            }}
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline text-left cursor-pointer"
          >
            {row.schemaName}
          </button>
        );
      },
    },
    {
      id: 'status',
      label: 'STATUS',
      sortKey: 'status',
      render: (row) => (
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(row.status)}`}
        >
          {getStatusLabel(row.status)}
        </span>
      ),
    },
    {
      id: 'lastUpdated',
      label: 'LAST UPDATED',
      sortKey: 'lastUpdated',
      render: (row) => (
        <ThemedText className="text-sm text-gray-900">{formatDate(row.lastUpdated)}</ThemedText>
      ),
    },
    {
      id: 'activeUntil',
      label: 'ACTIVE UNTIL',
      sortKey: 'activeUntil',
      render: (row) => (
        <ThemedText className="text-sm text-gray-900">
          {row.activeUntil === '-' ? '-' : formatDate(row.activeUntil)}
        </ThemedText>
      ),
    },
    {
      id: 'action',
      label: 'ACTION',
      render: (row) => {
        const showUpdateButton = row.schemaName !== 'Unknown Schema' && row.schemaId;
        return (
          <div className="flex gap-2">
            {showUpdateButton && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleUpdate(row.id);
                }}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium cursor-pointer"
              >
                UPDATE
              </button>
            )}
            {showUpdateButton && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRenew(row.id);
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium cursor-pointer"
              >
                RENEW
              </button>
            )}
            {row.status === 'APPROVED' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRevoke(row.id);
                }}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium cursor-pointer"
              >
                REVOKE
              </button>
            )}
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
    <InstitutionLayout activeTab="issued-by-me">
      <div className="p-12">
        <ThemedText fontSize={40} fontWeight={700} className="text-black mb-8">
          Issued By Me
        </ThemedText>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-6 mb-8 pt-4">
          <div className="bg-blue-50 grid grid-row-2 rounded-2xl p-6">
            <ThemedText className="text-sm text-gray-600 mb-2">Total Issued</ThemedText>
            <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
              {credentials.length}
            </ThemedText>
          </div>
          <div className="bg-blue-50 grid grid-row-2 rounded-2xl p-6">
            <ThemedText className="text-sm text-gray-600 mb-2">Active Credentials</ThemedText>
            <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
              {activeCount}
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
            data={filteredCredentials}
            columns={columns}
            onFilter={handleFilter}
            searchPlaceholder="Search..."
            onSearch={handleSearch}
            topRightButton={{
              label: 'New Credential',
              onClick: handleNewCredential,
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              ),
            }}
            enableSelection={true}
            totalCount={filteredCredentials.length}
            rowsPerPageOptions={[5, 10, 25, 50, 100]}
            idKey="id"
            onRowClick={handleRowClick}
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
              Filter Credentials
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

          {/* Status Filter */}
          <div className="mb-4">
            <ThemedText className="block text-sm font-medium text-gray-900 mb-2">Status</ThemedText>
            <select
              value={filterStatus}
              onChange={(e) =>
                handleStatusChange(e.target.value as 'all' | 'Active' | 'Revoked' | 'Expired')
              }
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="all">All</option>
              <option value="Active">Active</option>
              <option value="Revoked">Revoked</option>
              <option value="Expired">Expired</option>
            </select>
          </div>

          {/* Schema Name Filter */}
          <div>
            <ThemedText className="block text-sm font-medium text-gray-900 mb-2">
              Schema Name
            </ThemedText>
            <input
              type="text"
              value={filterType}
              onChange={(e) => handleTypeChange(e.target.value)}
              placeholder="Enter schema name"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
        </div>
      )}

      {/* Issue New Credential Modal */}
      <Modal
        isOpen={showIssueModal}
        onClose={() => setShowIssueModal(false)}
        title="Issue New Credential"
        maxWidth="1000px"
      >
        <IssueNewCredentialForm schemas={schemas} onSubmit={handleIssueCredential} />
      </Modal>

      {/* Update Credential Modal */}
      <Modal
        isOpen={showUpdateModal}
        onClose={() => {
          setShowUpdateModal(false);
          setSelectedCredential(null);
        }}
        title="Update Credential"
        maxWidth="1000px"
      >
        {selectedCredential && (
          <UpdateCredentialForm
            onSubmit={handleUpdateCredential}
            onCancel={() => {
              setShowUpdateModal(false);
              setSelectedCredential(null);
            }}
            credentialData={{
              id: selectedCredential.id,
              holderDid: selectedCredential.holderDid,
              issuerDid: localStorage.getItem('institutionDID') || undefined,
              schemaName: selectedCredential.schemaName,
              schemaId: selectedCredential.schemaId,
              // Use the selected credential's schema version
              schemaVersion: selectedCredential.schemaVersion,
              status: selectedCredential.status,
              issuedAt: selectedCredential.createdAt,
              activeUntil: selectedCredential.activeUntil,
              lastUpdated: selectedCredential.lastUpdated,
              schemaIsActive: (() => {
                // Find the schema with the selected credential's version to check if it's active
                const credentialSchema = schemas.find(
                  (s) =>
                    s.id === selectedCredential.schemaId &&
                    s.version === selectedCredential.schemaVersion
                );
                return credentialSchema?.isActive;
              })(),
              attributes: (() => {
                // Find the schema with the selected credential's version to get attribute types
                const credentialSchema = schemas.find(
                  (s) =>
                    s.id === selectedCredential.schemaId &&
                    s.version === selectedCredential.schemaVersion
                );

                if (selectedCredential.encryptedBody) {
                  // Extract attributes from encryptedBody
                  const extractedAttributes = Object.entries(selectedCredential.encryptedBody)
                    .filter(
                      ([key]) =>
                        !['schema_id', 'schema_version', 'issuer_did', 'holder_did'].includes(key)
                    )
                    .map(([name, value], index) => {
                      // Find the attribute type from schema
                      const schemaAttribute = credentialSchema?.attributes.find(
                        (attr) => attr.name === name
                      );
                      return {
                        id: index + 1,
                        name,
                        type: schemaAttribute?.type || 'string',
                        value: String(value),
                      };
                    });

                  // If we found attributes in encryptedBody, return them
                  if (extractedAttributes.length > 0) {
                    return extractedAttributes;
                  }
                }

                // Fallback: Use schema attributes with empty values
                return (
                  credentialSchema?.attributes.map((attr, index) => ({
                    id: index + 1,
                    name: attr.name,
                    type: attr.type,
                    value: '',
                  })) || []
                );
              })(),
            }}
          />
        )}
      </Modal>

      {/* View Credential Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedCredential(null);
        }}
        title="View Credential"
        maxWidth="1000px"
      >
        {selectedCredential && (
          <ViewCredentialForm
            onClose={() => {
              setShowViewModal(false);
              setSelectedCredential(null);
            }}
            credentialData={{
              id: selectedCredential.id,
              holderDid: selectedCredential.holderDid,
              issuerDid: localStorage.getItem('institutionDID') || undefined,
              schemaName: selectedCredential.schemaName,
              schemaId: selectedCredential.schemaId,
              schemaVersion: selectedCredential.schemaVersion,
              status: selectedCredential.status,
              issuedAt: selectedCredential.createdAt,
              activeUntil: selectedCredential.activeUntil,
              lastUpdated: selectedCredential.lastUpdated,
              attributes: (() => {
                // Find the schema with the selected credential's version to get attribute types
                const credentialSchema = schemas.find(
                  (s) =>
                    s.id === selectedCredential.schemaId &&
                    s.version === selectedCredential.schemaVersion
                );

                if (selectedCredential.encryptedBody) {
                  // Extract attributes from encryptedBody
                  const extractedAttributes = Object.entries(selectedCredential.encryptedBody)
                    .filter(
                      ([key]) =>
                        !['schema_id', 'schema_version', 'issuer_did', 'holder_did'].includes(key)
                    )
                    .map(([name, value], index) => {
                      return {
                        id: index + 1,
                        name,
                        value: String(value),
                      };
                    });

                  // If we found attributes in encryptedBody, return them
                  if (extractedAttributes.length > 0) {
                    return extractedAttributes;
                  }
                }

                // Fallback: Use schema attributes with empty values
                return (
                  credentialSchema?.attributes.map((attr, index) => ({
                    id: index + 1,
                    name: attr.name,
                    value: '',
                  })) || []
                );
              })(),
            }}
          />
        )}
      </Modal>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={confirmationConfig.onConfirm}
        title={confirmationConfig.title}
        message={confirmationConfig.message}
        confirmText={confirmationConfig.confirmText}
        confirmButtonColor={confirmationConfig.confirmButtonColor}
      />

      {/* Info Modal */}
      <InfoModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title={infoModalConfig.title}
        message={infoModalConfig.message}
        buttonColor={infoModalConfig.buttonColor}
      />

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
            }}
          />
        )}
      </Modal>
    </InstitutionLayout>
  );
}
