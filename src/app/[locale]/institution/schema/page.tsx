'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import InstitutionLayout from '@/components/InstitutionLayout';
import { ThemedText } from '@/components/ThemedText';
import { DataTable, Column } from '@/components/DataTable';
import Modal from '@/components/Modal';
import CreateSchemaForm, { SchemaFormData } from '@/components/CreateSchemaForm';
import UpdateSchemaForm, {
  SchemaFormData as UpdateSchemaFormData,
} from '@/components/UpdateSchemaForm';
import { buildApiUrl, buildApiUrlWithParams, API_ENDPOINTS } from '@/utils/api';
import { redirectIfJWTInvalid } from '@/utils/auth';
import { authenticatedFetch, authenticatedGet, authenticatedPost } from '@/utils/api-client';

interface Schema {
  id: string;
  schemaName: string;
  attributes: number;
  isActive: boolean;
  lastUpdated: string;
  schemaDetails?: {
    properties: Record<string, { type: string }>;
    required: string[];
  };
  version: number;
}

interface ApiSchemaResponse {
  success: boolean;
  data: {
    count: number;
    data: {
      id: string;
      name: string;
      schema: {
        type: string;
        required: string[];
        properties: Record<string, unknown>;
      };
      issuer_did: string;
      version: number;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
    }[];
  };
}

export default function SchemaPage() {
  const router = useRouter();
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [filteredSchemas, setFilteredSchemas] = useState<Schema[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'Active' | 'Inactive'>('all');
  const [filterSchemaId, setFilterSchemaId] = useState('');
  const [filterButtonPosition, setFilterButtonPosition] = useState({ top: 0, left: 0 });
  const [showCreateSchemaModal, setShowCreateSchemaModal] = useState(false);
  const [showUpdateSchemaModal, setShowUpdateSchemaModal] = useState(false);
  const [selectedSchema, setSelectedSchema] = useState<Schema | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const filterModalRef = useRef<HTMLDivElement>(null);

  const activeCount = schemas.filter((s) => s.isActive === true).length;

  // Helper function to refresh schemas from API
  const refreshSchemas = async () => {
    try {
      const issuerDid = localStorage.getItem('institutionDID');
      if (!issuerDid) {
        throw new Error('Institution DID not found. Please log in again.');
      }

      const url = buildApiUrlWithParams(API_ENDPOINTS.SCHEMA.BASE, {
        issuerDid,
      });

      const response = await authenticatedGet(url);

      if (!response.ok) {
        throw new Error('Failed to fetch schemas');
      }

      const result: ApiSchemaResponse = await response.json();

      // Transform API data to match Schema interface
      const transformedSchemas: Schema[] = result.data.data.map((schema) => ({
        id: schema.id,
        schemaName: `${schema.name} v${schema.version}`,
        attributes: Object.keys(schema.schema.properties).length,
        isActive: schema.isActive,
        version: schema.version,
        lastUpdated: new Date(schema.updatedAt).toLocaleDateString('en-CA'),
      }));

      // Update schemas state
      setSchemas(transformedSchemas);

      // Apply filters to the new data
      const schemasToFilter = transformedSchemas;
      let filtered = schemasToFilter;

      if (filterStatus !== 'all') {
        filtered = filtered.filter((schema) => schema.isActive === true || false);
      }

      if (filterSchemaId) {
        filtered = filtered.filter((schema) =>
          schema.id.toLowerCase().includes(filterSchemaId.toLowerCase())
        );
      }

      // Update filtered schemas state
      setFilteredSchemas(filtered);

      return transformedSchemas;
    } catch (error) {
      console.error('Error refreshing schemas:', error);
      throw error;
    }
  };

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

  // Fetch schemas from API
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchSchemas = async () => {
      try {
        setIsLoading(true);
        const issuerDid = localStorage.getItem('institutionDID');
        if (!issuerDid) {
          throw new Error('Institution DID not found. Please log in again.');
        }

        const url = buildApiUrlWithParams(API_ENDPOINTS.SCHEMA.BASE, {
          issuerDid,
        });

        const response = await authenticatedGet(url);

        if (!response.ok) {
          throw new Error('Failed to fetch schemas');
        }

        const result: ApiSchemaResponse = await response.json();

        // Transform API data to match Schema interface
        const transformedSchemas: Schema[] = result.data.data.map((schema) => ({
          id: schema.id,
          schemaName: `${schema.name} v${schema.version}`,
          attributes: Object.keys(schema.schema.properties).length,
          isActive: schema.isActive,
          version: schema.version,
          lastUpdated: new Date(schema.updatedAt).toLocaleDateString('en-CA'), // Format as YYYY/MM/DD
        }));

        setSchemas(transformedSchemas);
        setFilteredSchemas(transformedSchemas);
      } catch (error) {
        console.error('Error fetching schemas:', error);
        // Keep empty array on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchSchemas();
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
    const filtered = schemas.filter(
      (schema) =>
        schema.schemaName.toLowerCase().includes(value.toLowerCase()) ||
        schema.id.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredSchemas(filtered);
  };

  const handleFilter = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setFilterButtonPosition({
      top: rect.bottom + 8, // 8px below the button
      left: rect.left,
    });
    setShowFilterModal(true);
  };

  const applyFilters = (
    status: 'all' | 'Active' | 'Inactive',
    schemaId: string,
    sourceSchemas?: Schema[]
  ) => {
    const schemasToFilter = sourceSchemas || schemas;
    let filtered = schemasToFilter;

    if (status !== 'all') {
      filtered = filtered.filter((schema) => schema.isActive === true || false);
    }

    if (schemaId) {
      filtered = filtered.filter((schema) =>
        schema.id.toLowerCase().includes(schemaId.toLowerCase())
      );
    }

    setFilteredSchemas(filtered);
  };

  const handleStatusChange = (status: 'all' | 'Active' | 'Inactive') => {
    setFilterStatus(status);
    applyFilters(status, filterSchemaId);
  };

  const handleSchemaIdChange = (schemaId: string) => {
    setFilterSchemaId(schemaId);
    applyFilters(filterStatus, schemaId);
  };

  const handleUpdateSchema = async (schemaId: string, version: number) => {
    try {
      // Fetch the full schema details from API
      const response = await authenticatedGet(
        buildApiUrl(API_ENDPOINTS.SCHEMA.DETAIL(schemaId, version))
      );

      if (!response.ok) {
        throw new Error('Failed to fetch schema details');
      }

      const result = await response.json();
      const schemaData = result.data;

      // Find the schema in our list for basic info
      const schema = schemas.find((s) => s.id === schemaId);
      if (schema && schemaData) {
        // Add schema details to the schema object
        const schemaWithDetails: Schema = {
          ...schema,
          schemaDetails: {
            properties: schemaData.schema.properties,
            required: schemaData.schema.required,
          },
        };
        setSelectedSchema(schemaWithDetails);
        setShowUpdateSchemaModal(true);
      }
    } catch (error) {
      console.error('Error fetching schema details:', error);
      alert('Failed to load schema details. Please try again.');
    }
  };

  const handleUpdateSchemaSubmit = async (data: UpdateSchemaFormData) => {
    try {
      // Transform the form data to match the API format
      const properties: Record<string, { type: string }> = {};
      const required: string[] = [];

      data.attributes.forEach((attr) => {
        properties[attr.name] = {
          type: attr.type,
        };
        if (attr.required) {
          required.push(attr.name);
        }
      });

      // API expects only the schema object (type, properties, required)
      const payload = {
        schema: {
          type: 'object',
          properties,
          required,
        },
      };

      const response = await authenticatedFetch(
        buildApiUrl(API_ENDPOINTS.SCHEMA.UPDATE(data.schemaId)),
        {
          method: 'PUT',
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to update schema: ${response.statusText}`);
      }

      const result = await response.json();

      // Show success message with transaction hash if available
      if (result.transaction_hash) {
        alert(
          `Schema updated successfully!\nNew version: ${result.data.version}\nTransaction: ${result.transaction_hash.substring(0, 10)}...`
        );
      }

      // Refresh the schema list
      await refreshSchemas();

      // Close modal on success
      setShowUpdateSchemaModal(false);
      setSelectedSchema(null);
    } catch (error) {
      console.error('Error updating schema:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to update schema. Please try again.';
      alert(errorMessage);
      throw error; // Re-throw to prevent the form from clearing
    }
  };

  const handleToggleStatus = async (schemaId: string, schemaVersion: number) => {
    try {
      const schema = schemas.find((s) => s.id === schemaId && s.version === schemaVersion);
      if (!schema) return;

      const isCurrentlyActive = schema.isActive === true;
      const action = isCurrentlyActive ? 'deactivate' : 'reactivate';

      // Show confirmation prompt
      const confirmed = window.confirm(
        `Are you sure you want to ${action} this schema?\n\nSchema: ${schema.schemaName}\nCurrent Status: ${schema.isActive ? 'Active' : 'Inactive'}`
      );

      if (!confirmed) {
        return; // User cancelled the action
      }

      // Call the appropriate API endpoint
      const endpoint = isCurrentlyActive
        ? API_ENDPOINTS.SCHEMA.DEACTIVATE(schemaId, schemaVersion)
        : API_ENDPOINTS.SCHEMA.REACTIVATE(schemaId, schemaVersion);

      const response = await authenticatedFetch(buildApiUrl(endpoint), {
        method: 'PATCH',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${action} schema`);
      }

      const result = await response.json();

      // Refresh the schema list from API to get the latest state
      await refreshSchemas();

      // Show success message with transaction hash if available
      if (result.transaction_hash) {
        alert(
          `Schema ${action}d successfully!\nTransaction: ${result.transaction_hash.substring(0, 10)}...`
        );
      }
    } catch (error) {
      console.error('Error toggling schema status:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to update schema status. Please try again.';
      alert(errorMessage);

      // Try to refresh the schema list to ensure correct state
      try {
        await refreshSchemas();
      } catch (refreshError) {
        console.error('Error refreshing schemas:', refreshError);
      }
    }
  };

  const handleNewSchema = () => {
    setShowCreateSchemaModal(true);
  };

  const handleCreateSchema = async (data: SchemaFormData) => {
    try {
      const issuerDid = localStorage.getItem('institutionDID');
      if (!issuerDid) {
        throw new Error('Institution DID not found. Please log in again.');
      }

      // Transform the form data to match the API format
      const properties: Record<string, { type: string; description: string }> = {};
      const required: string[] = [];

      data.attributes.forEach((attr) => {
        properties[attr.name] = {
          type: attr.type,
          description: attr.description,
        };
        if (attr.required) {
          required.push(attr.name);
        }
      });

      // Note: schemaId, version, and status from the form are not sent to the API
      // Only name, schema structure, and issuer_did are sent
      const payload = {
        name: data.schemaName,
        schema: {
          type: 'object',
          properties,
          required,
        },
        issuer_did: issuerDid,
      };

      const response = await authenticatedPost(buildApiUrl(API_ENDPOINTS.SCHEMA.CREATE), payload);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create schema');
      }

      const result = await response.json();
      console.log('Schema created successfully:', result);

      // Refresh the schemas list
      await refreshSchemas();

      // Only close modal on success
      setShowCreateSchemaModal(false);
    } catch (error) {
      console.error('Error creating schema:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to create schema. Please try again.';
      alert(errorMessage);
      // Don't close modal on error, let user fix the issue
      throw error; // Re-throw to prevent the form from clearing
    }
  };

  const columns: Column<Schema>[] = [
    {
      id: 'schemaName',
      label: 'SCHEMA NAME',
      sortKey: 'schemaName',
      render: (row) => (
        <ThemedText className="text-sm font-medium text-gray-900">{row.schemaName}</ThemedText>
      ),
    },
    {
      id: 'attributes',
      label: '# ATTRIBUTES',
      sortKey: 'attributes',
      render: (row) => <ThemedText className="text-sm text-gray-900">{row.attributes}</ThemedText>,
    },
    {
      id: 'status',
      label: 'STATUS',
      render: (row) => (
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
            row.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}
        >
          {row.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      id: 'lastUpdated',
      label: 'LAST UPDATED',
      sortKey: 'lastUpdated',
      render: (row) => <ThemedText className="text-sm text-gray-900">{row.lastUpdated}</ThemedText>,
    },
    {
      id: 'action',
      label: 'ACTION',
      render: (row) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleUpdateSchema(row.id, row.version)}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium cursor-pointer"
          >
            UPDATE
          </button>
          {row.isActive ? (
            <button
              onClick={() => handleToggleStatus(row.id, row.version)}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium cursor-pointer"
            >
              DEACTIVATE
            </button>
          ) : (
            <button
              onClick={() => handleToggleStatus(row.id, row.version)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium cursor-pointer"
            >
              REACTIVATE
            </button>
          )}
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
    <InstitutionLayout activeTab="schema">
      <div className="p-12">
        <ThemedText fontSize={40} fontWeight={700} className="text-black mb-8">
          Schema
        </ThemedText>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-6 mb-8 pt-4">
          <div className="bg-blue-50 grid grid-row-2 rounded-2xl p-6">
            <ThemedText className="text-sm text-gray-600 mb-2">All Schemas</ThemedText>
            <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
              {schemas.length}
            </ThemedText>
          </div>
          <div className="bg-blue-50 grid grid-row-2 rounded-2xl p-6">
            <ThemedText className="text-sm text-gray-600 mb-2">Active Schemas</ThemedText>
            <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
              {activeCount.toLocaleString()}
            </ThemedText>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Data Table */}
        {!isLoading && (
          <DataTable
              data={filteredSchemas}
              columns={columns}
              onFilter={handleFilter}
              searchPlaceholder="Search..."
              onSearch={handleSearch}
              topRightButton={{
                label: 'New Schema',
                onClick: handleNewSchema,
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
              totalCount={filteredSchemas.length}
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
              Filter Schemas
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

          {/* Status Filter */}
          <div className="mb-4">
            <ThemedText className="block text-sm font-medium text-gray-900 mb-2">Status</ThemedText>
            <select
              value={filterStatus}
              onChange={(e) => handleStatusChange(e.target.value as 'all' | 'Active' | 'Inactive')}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
            >
              <option value="all">All</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          {/* Schema ID Filter */}
          <div>
            <ThemedText className="block text-sm font-medium text-gray-900 mb-2">
              Schema ID
            </ThemedText>
            <input
              type="text"
              value={filterSchemaId}
              onChange={(e) => handleSchemaIdChange(e.target.value)}
              placeholder="Enter Schema ID"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm placeholder:text-gray-500"
            />
          </div>
        </div>
      )}

      {/* Create Schema Modal */}
      <Modal
        isOpen={showCreateSchemaModal}
        onClose={() => setShowCreateSchemaModal(false)}
        title="Create New Schema"
      >
        <CreateSchemaForm
          onSubmit={handleCreateSchema}
          onCancel={() => setShowCreateSchemaModal(false)}
        />
      </Modal>

      {/* Update Schema Modal */}
      <Modal
        isOpen={showUpdateSchemaModal}
        onClose={() => {
          setShowUpdateSchemaModal(false);
          setSelectedSchema(null);
        }}
        title="Update Schema"
      >
        <UpdateSchemaForm
          onSubmit={handleUpdateSchemaSubmit}
          onCancel={() => {
            setShowUpdateSchemaModal(false);
            setSelectedSchema(null);
          }}
          initialData={
            selectedSchema
              ? {
                  ...selectedSchema,
                  isActive: selectedSchema.isActive ? 'Active' : 'Inactive',
                }
              : undefined
          }
        />
      </Modal>
    </InstitutionLayout>
  );
}
