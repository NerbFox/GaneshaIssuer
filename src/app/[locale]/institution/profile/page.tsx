'use client';

import { useState, useRef, useEffect } from 'react';
import InstitutionLayout from '@/components/InstitutionLayout';
import { ThemedText } from '@/components/ThemedText';
import { DataTable, Column } from '@/components/DataTable';

interface Schema {
  id: string;
  schemaName: string;
  attributes: number;
  status: 'Active' | 'Inactive';
  lastUpdated: string;
}

const DUMMY_SCHEMAS: Schema[] = [
  {
    id: 'SCH001',
    schemaName: 'KTP v1',
    attributes: 3,
    status: 'Active',
    lastUpdated: '2025/08/07',
  },
  {
    id: 'SCH002',
    schemaName: 'KTP v2',
    attributes: 4,
    status: 'Inactive',
    lastUpdated: '2025/08/07',
  },
  {
    id: 'SCH003',
    schemaName: 'KTP v3',
    attributes: 5,
    status: 'Active',
    lastUpdated: '2025/08/07',
  },
  {
    id: 'SCH004',
    schemaName: 'KTP v1',
    attributes: 6,
    status: 'Inactive',
    lastUpdated: '2025/08/07',
  },
  {
    id: 'SCH005',
    schemaName: 'KTP v1',
    attributes: 5,
    status: 'Active',
    lastUpdated: '2025/08/07',
  },
  {
    id: 'SCH006',
    schemaName: 'KTP v1',
    attributes: 5,
    status: 'Inactive',
    lastUpdated: '2025/08/07',
  },
  {
    id: 'SCH007',
    schemaName: 'KTP v1',
    attributes: 3,
    status: 'Active',
    lastUpdated: '2025/08/07',
  },
  {
    id: 'SCH008',
    schemaName: 'KTP v1',
    attributes: 5,
    status: 'Inactive',
    lastUpdated: '2025/08/07',
  },
  {
    id: 'SCH009',
    schemaName: 'Passport v1',
    attributes: 8,
    status: 'Active',
    lastUpdated: '2025/08/10',
  },
  {
    id: 'SCH010',
    schemaName: 'Passport v2',
    attributes: 8,
    status: 'Active',
    lastUpdated: '2025/08/12',
  },
  {
    id: 'SCH011',
    schemaName: 'Driver License v1',
    attributes: 6,
    status: 'Active',
    lastUpdated: '2025/08/15',
  },
  {
    id: 'SCH012',
    schemaName: 'Driver License v2',
    attributes: 7,
    status: 'Inactive',
    lastUpdated: '2025/08/16',
  },
  {
    id: 'SCH013',
    schemaName: 'Birth Certificate v1',
    attributes: 10,
    status: 'Active',
    lastUpdated: '2025/08/20',
  },
  {
    id: 'SCH014',
    schemaName: 'Marriage Certificate v1',
    attributes: 12,
    status: 'Active',
    lastUpdated: '2025/08/22',
  },
  {
    id: 'SCH015',
    schemaName: 'Tax ID v1',
    attributes: 4,
    status: 'Inactive',
    lastUpdated: '2025/08/25',
  },
  {
    id: 'SCH016',
    schemaName: 'Health Insurance v1',
    attributes: 9,
    status: 'Active',
    lastUpdated: '2025/09/01',
  },
  {
    id: 'SCH017',
    schemaName: 'Student ID v1',
    attributes: 7,
    status: 'Active',
    lastUpdated: '2025/09/05',
  },
  {
    id: 'SCH018',
    schemaName: 'Employee ID v1',
    attributes: 11,
    status: 'Inactive',
    lastUpdated: '2025/09/10',
  },
  {
    id: 'SCH019',
    schemaName: 'Voter ID v1',
    attributes: 5,
    status: 'Active',
    lastUpdated: '2025/09/15',
  },
  {
    id: 'SCH020',
    schemaName: 'Social Security v1',
    attributes: 6,
    status: 'Active',
    lastUpdated: '2025/09/20',
  },
];

export default function SchemaPage() {
  const [schemas, setSchemas] = useState<Schema[]>(DUMMY_SCHEMAS);
  const [filteredSchemas, setFilteredSchemas] = useState<Schema[]>(DUMMY_SCHEMAS);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'Active' | 'Inactive'>('all');
  const [filterSchemaId, setFilterSchemaId] = useState('');
  const [filterButtonPosition, setFilterButtonPosition] = useState({ top: 0, left: 0 });

  const filterModalRef = useRef<HTMLDivElement>(null);

  const activeCount = schemas.filter((s) => s.status === 'Active').length;

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

  const handleToggleStatus = (schemaId: string) => {
    setSchemas((prev) =>
      prev.map((schema) =>
        schema.id === schemaId
          ? {
              ...schema,
              status: schema.status === 'Active' ? 'Inactive' : 'Active',
            }
          : schema
      )
    );
    setFilteredSchemas((prev) =>
      prev.map((schema) =>
        schema.id === schemaId
          ? {
              ...schema,
              status: schema.status === 'Active' ? 'Inactive' : 'Active',
            }
          : schema
      )
    );
  };

  const handleNewSchema = () => {
    console.log('Create new schema');
    // Implement create new schema logic
  };

  const columns: Column<Schema>[] = [
    {
      id: 'schemaName',
      label: 'Schema Name',
      sortKey: 'schemaName',
      render: (row) => (
        <ThemedText className="text-sm font-medium text-gray-900">{row.schemaName}</ThemedText>
      ),
    },
    {
      id: 'attributes',
      label: '# Attributes',
      sortKey: 'attributes',
      render: (row) => <ThemedText className="text-sm text-gray-900">{row.attributes}</ThemedText>,
    },
    {
      id: 'status',
      label: 'Status',
      sortKey: 'status',
      render: (row) => (
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
            row.status === 'Active' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
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
      render: (row) => <ThemedText className="text-sm text-gray-900">{row.lastUpdated}</ThemedText>,
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
        />
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
    </InstitutionLayout>
  );
}
