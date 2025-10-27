'use client';

import { useState, useRef, useEffect } from 'react';
import InstitutionLayout from '@/components/InstitutionLayout';
import { ThemedText } from '@/components/ThemedText';
import { DataTable, Column } from '@/components/DataTable';
import Modal from '@/components/Modal';
import CreateSchemaForm, { SchemaFormData } from '@/components/CreateSchemaForm';

interface Schema {
  id: string;
  schemaName: string;
  attributes: number;
  status: 'Active' | 'Inactive';
  lastUpdated: string;
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
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [filteredSchemas, setFilteredSchemas] = useState<Schema[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'Active' | 'Inactive'>('all');
  const [filterSchemaId, setFilterSchemaId] = useState('');
  const [filterButtonPosition, setFilterButtonPosition] = useState({ top: 0, left: 0 });
  const [showCreateSchemaModal, setShowCreateSchemaModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const filterModalRef = useRef<HTMLDivElement>(null);

  const activeCount = schemas.filter((s) => s.status === 'Active').length;

  // Fetch schemas from API
  useEffect(() => {
    const fetchSchemas = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(
          'https://dev-api-dcert.ganeshait.com/api/v1/schemas?issuerDid=did%3Aexample%3Auniversity123&activeOnly=false',
          {
            headers: {
              'accept': 'application/json',
            },
          }
        );
        
        if (!response.ok) {
          throw new Error('Failed to fetch schemas');
        }

        const result: ApiSchemaResponse = await response.json();
        
        // Transform API data to match Schema interface
        const transformedSchemas: Schema[] = result.data.data.map((schema) => ({
          id: schema.id,
          schemaName: `${schema.name} v${schema.version}`,
          attributes: Object.keys(schema.schema.properties).length,
          status: schema.isActive ? 'Active' : 'Inactive',
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
  }, []);

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
    const filtered = schemas.filter((schema) =>
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

  const applyFilters = (status: 'all' | 'Active' | 'Inactive', schemaId: string) => {
    let filtered = schemas;

    if (status !== 'all') {
      filtered = filtered.filter((schema) => schema.status === status);
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

  const handleUpdateSchema = (schemaId: string) => {
    console.log('Update schema:', schemaId);
    // Implement update logic
  };

  const handleToggleStatus = async (schemaId: string) => {
    try {
      const schema = schemas.find((s) => s.id === schemaId);
      if (!schema) return;

      const newStatus = schema.status === 'Active';

      // Update local state optimistically
      setSchemas((prev) =>
        prev.map((s) =>
          s.id === schemaId
            ? {
                ...s,
                status: s.status === 'Active' ? 'Inactive' : 'Active',
              }
            : s
        )
      );
      setFilteredSchemas((prev) =>
        prev.map((s) =>
          s.id === schemaId
            ? {
                ...s,
                status: s.status === 'Active' ? 'Inactive' : 'Active',
              }
            : s
        )
      );

      // Note: Add actual API call here when endpoint is available
      // For now, we're just updating the local state
      console.log(`Toggle status for schema ${schemaId} to ${!newStatus ? 'Active' : 'Inactive'}`);
    } catch (error) {
      console.error('Error toggling schema status:', error);
      // Revert the optimistic update on error
      // You could refresh from API here
    }
  };

  const handleNewSchema = () => {
    setShowCreateSchemaModal(true);
  };

  const handleCreateSchema = async (data: SchemaFormData) => {
    try {
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
        issuer_did: 'did:example:university123',
      };

      const response = await fetch('https://dev-api-dcert.ganeshait.com/api/v1/schemas', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create schema');
      }

      const result = await response.json();
      console.log('Schema created successfully:', result);

      // Refresh the schemas list
      const schemasResponse = await fetch(
        'https://dev-api-dcert.ganeshait.com/api/v1/schemas?issuerDid=did%3Aexample%3Auniversity123&activeOnly=false',
        {
          headers: {
            'accept': 'application/json',
          },
        }
      );

      if (schemasResponse.ok) {
        const schemasResult: ApiSchemaResponse = await schemasResponse.json();
        const transformedSchemas: Schema[] = schemasResult.data.data.map((schema) => ({
          id: schema.id,
          schemaName: `${schema.name} v${schema.version}`,
          attributes: Object.keys(schema.schema.properties).length,
          status: schema.isActive ? 'Active' : 'Inactive',
          lastUpdated: new Date(schema.updatedAt).toLocaleDateString('en-CA'),
        }));
        setSchemas(transformedSchemas);
        setFilteredSchemas(transformedSchemas);
      }

      // Only close modal on success
      setShowCreateSchemaModal(false);
    } catch (error) {
      console.error('Error creating schema:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create schema. Please try again.';
      alert(errorMessage);
      // Don't close modal on error, let user fix the issue
      throw error; // Re-throw to prevent the form from clearing
    }
  };

  const columns: Column<Schema>[] = [
    {
      id: 'schemaName',
      label: 'Schema Name',
      sortKey: 'schemaName',
      render: (row) => (
        <ThemedText className="text-sm font-medium text-gray-900">
          {row.schemaName}
        </ThemedText>
      ),
    },
    {
      id: 'attributes',
      label: '# Attributes',
      sortKey: 'attributes',
      render: (row) => (
        <ThemedText className="text-sm text-gray-900">{row.attributes}</ThemedText>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      sortKey: 'status',
      render: (row) => (
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
            row.status === 'Active'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          {row.status}
        </span>
      ),
    },
    {
      id: 'lastUpdated',
      label: 'Last Updated',
      sortKey: 'lastUpdated',
      render: (row) => (
        <ThemedText className="text-sm text-gray-900">{row.lastUpdated}</ThemedText>
      ),
    },
    {
      id: 'action',
      label: 'Action',
      render: (row) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleUpdateSchema(row.id)}
            className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors text-sm font-medium"
          >
            UPDATE
          </button>
          {row.status === 'Active' ? (
            <button
              onClick={() => handleToggleStatus(row.id)}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
            >
              DEACTIVATE
            </button>
          ) : (
            <button
              onClick={() => handleToggleStatus(row.id)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
            >
              REACTIVATE
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <InstitutionLayout activeTab="schema">
      <div className="p-12">
        <ThemedText fontSize={40} fontWeight={700} className="text-black mb-8">
          Schema
        </ThemedText>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
              <ThemedText className="text-gray-600">Loading schemas...</ThemedText>
            </div>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-6 mb-8 pt-4">
          <div className="bg-blue-50 grid grid-row-2 rounded-2xl p-6">
            <ThemedText className="text-sm text-gray-600 mb-2">
              All Schemas
            </ThemedText>
            <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
              {schemas.length}
            </ThemedText>
          </div>
          <div className="bg-blue-50 grid grid-row-2 rounded-2xl p-6">
            <ThemedText className="text-sm text-gray-600 mb-2">
              Active Schemas
            </ThemedText>
            <ThemedText fontSize={32} fontWeight={600} className="text-gray-900">
              {activeCount.toLocaleString()}
            </ThemedText>
          </div>
        </div>

        {/* Data Table */}
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
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
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
          </>
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
              className="text-gray-400 hover:text-gray-600"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
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
            <ThemedText className="block text-sm font-medium text-gray-900 mb-2">
              Status
            </ThemedText>
            <select
              value={filterStatus}
              onChange={(e) => handleStatusChange(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
    </InstitutionLayout>
  );
}
