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
import ViewSchemaForm from '@/components/ViewSchemaForm';
import { buildApiUrl, buildApiUrlWithParams, API_ENDPOINTS } from '@/utils/api';
import { redirectIfJWTInvalid } from '@/utils/auth';
import { authenticatedFetch, authenticatedGet, authenticatedPost } from '@/utils/api-client';
import InfoModal from '@/components/InfoModal';

interface Schema {
  id: string;
  schemaName: string;
  attributes: number;
  isActive: boolean;
  expiredIn: number;
  schemaDetails?: {
    properties: Record<string, { type: string }>;
    required: string[];
  };
  version: number;
  uniqueKey: string; // Composite key: id-version
  image_link?: string; // Optional image URL from API
  createdAt: string; // Creation timestamp
  updatedAt: string; // Last update timestamp
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
        expired_in?: number;
      };
      issuer_did: string;
      version: number;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
      image_link?: string; // Optional image URL
    }[];
  };
}

export default function SchemaPage() {
  const router = useRouter();
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [filteredSchemas, setFilteredSchemas] = useState<Schema[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterMinAttributes, setFilterMinAttributes] = useState('');
  const [filterMaxAttributes, setFilterMaxAttributes] = useState('');
  const [filterMinExpiredIn, setFilterMinExpiredIn] = useState('');
  const [filterMaxExpiredIn, setFilterMaxExpiredIn] = useState('');
  const [filterButtonPosition, setFilterButtonPosition] = useState({ top: 0, left: 0 });
  const [showCreateSchemaModal, setShowCreateSchemaModal] = useState(false);
  const [showUpdateSchemaModal, setShowUpdateSchemaModal] = useState(false);
  const [showViewSchemaModal, setShowViewSchemaModal] = useState(false);
  const [selectedSchema, setSelectedSchema] = useState<Schema | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingSchemas, setTogglingSchemas] = useState<Set<string>>(new Set()); // Track multiple schemas being toggled
  const [selectedSchemaKeys, setSelectedSchemaKeys] = useState<Set<string>>(new Set()); // Track selected schemas by uniqueKey
  const [isBulkToggling, setIsBulkToggling] = useState(false); // Track bulk toggle operation
  const [bulkTogglingAction, setBulkTogglingAction] = useState<'reactivate' | 'deactivate' | null>(
    null
  ); // Track which bulk action is in progress
  const [bulkRemainingCount, setBulkRemainingCount] = useState(0); // Track remaining schemas in bulk operation
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoModalConfig, setInfoModalConfig] = useState({
    title: '',
    message: '',
    buttonColor: 'blue' as 'blue' | 'green' | 'red' | 'yellow',
  });

  const filterModalRef = useRef<HTMLDivElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  const activeCount = schemas.filter((s) => s.isActive === true).length;

  // Helper function to refresh schemas from API
  const refreshSchemas = async () => {
    try {
      const issuerDid = localStorage.getItem('institutionDID');
      if (!issuerDid) {
        throw new Error('Institution DID not found. Please log in again.');
      }

      const url = buildApiUrlWithParams(API_ENDPOINTS.SCHEMAS.BASE, {
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
        expiredIn: schema.schema.expired_in ?? 0,
        uniqueKey: `${schema.id}-${schema.version}`, // Composite unique key
        image_link: schema.image_link, // Include image link from API
        createdAt: schema.createdAt,
        updatedAt: schema.updatedAt,
      }));

      // Update schemas state
      setSchemas(transformedSchemas);
      // Don't apply filters here - let the useEffect handle it
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
        setError(null);
        const issuerDid = localStorage.getItem('institutionDID');
        if (!issuerDid) {
          throw new Error('Institution DID not found. Please log in again.');
        }

        const url = buildApiUrlWithParams(API_ENDPOINTS.SCHEMAS.BASE, {
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
          expiredIn: schema.schema.expired_in ?? 0,
          uniqueKey: `${schema.id}-${schema.version}`, // Composite unique key
          image_link: schema.image_link, // Include image link from API
          createdAt: schema.createdAt,
          updatedAt: schema.updatedAt,
        }));

        setSchemas(transformedSchemas);
        setFilteredSchemas(transformedSchemas);
      } catch (err) {
        console.error('Error fetching schemas:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
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
      top: rect.bottom + 8, // 8px below the button
      left: rect.left,
    });
    setShowFilterModal(true);
  };

  const applyFilters = () => {
    let filtered = schemas;

    // Search filter (applies to schema name and ID)
    if (searchValue.trim()) {
      filtered = filtered.filter(
        (schema) =>
          schema.schemaName.toLowerCase().includes(searchValue.toLowerCase()) ||
          schema.id.toLowerCase().includes(searchValue.toLowerCase())
      );
    }

    // Status filter
    if (filterStatus === 'active') {
      filtered = filtered.filter((schema) => schema.isActive === true);
    } else if (filterStatus === 'inactive') {
      filtered = filtered.filter((schema) => schema.isActive === false);
    }

    // Min attributes filter
    if (filterMinAttributes) {
      const minAttr = parseInt(filterMinAttributes);
      if (!isNaN(minAttr)) {
        filtered = filtered.filter((schema) => schema.attributes >= minAttr);
      }
    }

    // Max attributes filter
    if (filterMaxAttributes) {
      const maxAttr = parseInt(filterMaxAttributes);
      if (!isNaN(maxAttr)) {
        filtered = filtered.filter((schema) => schema.attributes <= maxAttr);
      }
    }

    // Min expired in filter
    if (filterMinExpiredIn) {
      const minExp = parseInt(filterMinExpiredIn);
      if (!isNaN(minExp)) {
        filtered = filtered.filter((schema) => schema.expiredIn >= minExp);
      }
    }

    // Max expired in filter
    if (filterMaxExpiredIn) {
      const maxExp = parseInt(filterMaxExpiredIn);
      if (!isNaN(maxExp)) {
        filtered = filtered.filter((schema) => schema.expiredIn <= maxExp);
      }
    }

    setFilteredSchemas(filtered);
  };

  // Apply filters whenever filter values change
  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    searchValue,
    filterStatus,
    filterMinAttributes,
    filterMaxAttributes,
    filterMinExpiredIn,
    filterMaxExpiredIn,
    schemas,
  ]);

  const clearFilters = () => {
    setSearchValue('');
    setFilterStatus('all');
    setFilterMinAttributes('');
    setFilterMaxAttributes('');
    setFilterMinExpiredIn('');
    setFilterMaxExpiredIn('');
  };

  const handleUpdateSchema = async (schemaId: string, version: number) => {
    try {
      // Fetch the full schema details from API
      const response = await authenticatedGet(
        buildApiUrl(API_ENDPOINTS.SCHEMAS.BY_VERSION(schemaId, version))
      );

      if (!response.ok) {
        throw new Error('Failed to fetch schema details');
      }

      const result = await response.json();
      const schemaData = result.data;

      // Find the schema in our list for basic info
      const schema = schemas.find((s) => s.id === schemaId && s.version === version);
      if (schema && schemaData) {
        // Add schema details to the schema object
        const schemaWithDetails: Schema = {
          ...schema,
          schemaDetails: {
            properties: schemaData.schema.properties,
            required: schemaData.schema.required,
          },
          image_link: schemaData.image_link, // Include image link from API
        };
        setSelectedSchema(schemaWithDetails);
        setShowUpdateSchemaModal(true);
      }
    } catch (error) {
      console.error('Error fetching schema details:', error);
      setInfoModalConfig({
        title: 'Error',
        message: 'Failed to load schema details. Please try again.',
        buttonColor: 'red',
      });
      setShowInfoModal(true);
    }
  };

  const handleViewSchema = async (schemaId: string, version: number) => {
    try {
      // Fetch the full schema details from API
      const response = await authenticatedGet(
        buildApiUrl(API_ENDPOINTS.SCHEMAS.BY_VERSION(schemaId, version))
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
          image_link: schemaData.image_link, // Include image link from API
        };
        setSelectedSchema(schemaWithDetails);
        setShowViewSchemaModal(true);
      }
    } catch (error) {
      console.error('Error fetching schema details:', error);
      setInfoModalConfig({
        title: 'Error',
        message: 'Failed to load schema details. Please try again.',
        buttonColor: 'red',
      });
      setShowInfoModal(true);
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

      // API expects the schema object (type, properties, required, expired_in) and optional image field
      const payload = {
        schema: {
          type: 'object',
          properties,
          required,
          expired_in: data.expiredIn,
        },
      };

      let response: Response;

      // Use FormData if image is provided, otherwise use JSON
      if (data.image) {
        const formData = new FormData();
        // Append schema fields separately, not as stringified JSON
        formData.append('schema[type]', payload.schema.type);
        formData.append('schema[expired_in]', String(payload.schema.expired_in));
        formData.append('schema[required]', JSON.stringify(payload.schema.required));
        formData.append('schema[properties]', JSON.stringify(payload.schema.properties));
        formData.append('image', data.image, data.image.name);

        const token = localStorage.getItem('institutionToken');
        if (!token) {
          throw new Error('No authentication token found. Please log in.');
        }

        response = await fetch(buildApiUrl(API_ENDPOINTS.SCHEMAS.BY_ID(data.schemaId)), {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            // Don't set Content-Type - browser will set it with boundary for multipart/form-data
          },
          body: formData,
        });
      } else {
        response = await authenticatedFetch(
          buildApiUrl(API_ENDPOINTS.SCHEMAS.BY_ID(data.schemaId)),
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          }
        );
      }

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Schema update failed:', errorData);

        // Handle validation errors
        if (response.status === 422) {
          const validationErrors = errorData.errors || errorData.message || 'Validation failed';
          throw new Error(`Validation error: ${JSON.stringify(validationErrors)}`);
        }

        throw new Error(errorData.message || `Failed to update schema: ${response.statusText}`);
      }

      const result = await response.json();

      // Show success message with transaction hash if available
      if (result.transaction_hash) {
        setInfoModalConfig({
          title: 'Success',
          message: `Schema updated successfully!\nNew version: ${result.data.version}\nTransaction: ${result.transaction_hash.substring(0, 10)}...`,
          buttonColor: 'green',
        });
        setShowInfoModal(true);
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
      setInfoModalConfig({
        title: 'Error',
        message: errorMessage,
        buttonColor: 'red',
      });
      setShowInfoModal(true);
      throw error; // Re-throw to prevent the form from clearing
    }
  };

  const handleToggleStatus = async (schemaId: string, schemaVersion: number) => {
    const schemaKey = `${schemaId}-${schemaVersion}`;

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

      // Add schema to toggling set
      setTogglingSchemas((prev) => new Set(prev).add(schemaKey));

      // Call the appropriate API endpoint
      const endpoint = isCurrentlyActive
        ? API_ENDPOINTS.SCHEMAS.DEACTIVATE(schemaId, schemaVersion)
        : API_ENDPOINTS.SCHEMAS.REACTIVATE(schemaId, schemaVersion);

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
        setInfoModalConfig({
          title: 'Success',
          message: `Schema ${action}d successfully!\nTransaction: ${result.transaction_hash.substring(0, 10)}...`,
          buttonColor: 'green',
        });
        setShowInfoModal(true);
      }
    } catch (error) {
      console.error('Error toggling schema status:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to update schema status. Please try again.';
      setInfoModalConfig({
        title: 'Error',
        message: errorMessage,
        buttonColor: 'red',
      });
      setShowInfoModal(true);

      // Try to refresh the schema list to ensure correct state
      try {
        await refreshSchemas();
      } catch (refreshError) {
        console.error('Error refreshing schemas:', refreshError);
      }
    } finally {
      // Remove schema from toggling set
      setTogglingSchemas((prev) => {
        const newSet = new Set(prev);
        newSet.delete(schemaKey);
        return newSet;
      });
    }
  };

  const handleSelectionChange = (
    selectedIndices: number[],
    selectedIdValues?: (string | number)[]
  ) => {
    if (selectedIdValues && selectedIdValues.length > 0) {
      setSelectedSchemaKeys(new Set(selectedIdValues as string[]));
    } else {
      const selectedKeys = new Set(
        selectedIndices.map((index) => filteredSchemas[index]?.uniqueKey).filter(Boolean)
      );
      setSelectedSchemaKeys(selectedKeys);
    }
  };

  const handleUnselectAll = () => {
    setSelectedSchemaKeys(new Set());
  };

  const handleBulkToggle = async (action: 'reactivate' | 'deactivate') => {
    if (selectedSchemaKeys.size === 0) {
      setInfoModalConfig({
        title: 'Validation Error',
        message: 'Please select at least one schema',
        buttonColor: 'red',
      });
      setShowInfoModal(true);
      return;
    }

    // Get selected schemas from uniqueKeys
    const selectedSchemas = schemas.filter((schema) => selectedSchemaKeys.has(schema.uniqueKey));

    const actionText = action === 'reactivate' ? 'reactivate' : 'deactivate';
    const confirmed = window.confirm(
      `Are you sure you want to ${actionText} ${selectedSchemas.length} schema(s)?`
    );

    if (!confirmed) {
      return;
    }

    // Clear selection first before processing
    setSelectedSchemaKeys(new Set());

    setIsBulkToggling(true);
    setBulkTogglingAction(action);

    // Add all schemas to the toggling set immediately to show they're queued
    const allSchemaKeys = selectedSchemas.map((s) => `${s.id}-${s.version}`);
    setTogglingSchemas(new Set(allSchemaKeys));

    const results: {
      success: boolean;
      skipped: boolean;
      schema: Schema;
      error?: string;
      reason?: string;
    }[] = [];

    let remainingCount = selectedSchemas.length;

    // Process each schema one by one
    for (const schema of selectedSchemas) {
      const schemaKey = `${schema.id}-${schema.version}`;
      const targetIsActive = action === 'reactivate';

      // Update remaining count
      setBulkRemainingCount(remainingCount);

      // Check if schema is already in the desired state
      if (schema.isActive === targetIsActive) {
        results.push({
          success: false,
          skipped: true,
          schema,
          reason: `Already ${targetIsActive ? 'active' : 'inactive'}`,
        });
        remainingCount--;
        // Remove from toggling set
        setTogglingSchemas((prev) => {
          const newSet = new Set(prev);
          newSet.delete(schemaKey);
          return newSet;
        });
        continue;
      }

      try {
        // Call the appropriate API endpoint
        const endpoint =
          action === 'deactivate'
            ? API_ENDPOINTS.SCHEMAS.DEACTIVATE(schema.id, schema.version)
            : API_ENDPOINTS.SCHEMAS.REACTIVATE(schema.id, schema.version);

        const response = await authenticatedFetch(buildApiUrl(endpoint), {
          method: 'PATCH',
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Failed to ${action} schema`);
        }

        results.push({ success: true, skipped: false, schema });

        // Refresh schemas after each successful toggle to update status immediately
        await refreshSchemas();
      } catch (error) {
        results.push({
          success: false,
          skipped: false,
          schema,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        remainingCount--;
        // Remove from toggling set
        setTogglingSchemas((prev) => {
          const newSet = new Set(prev);
          newSet.delete(schemaKey);
          return newSet;
        });
      }
    }

    // Show results
    const successCount = results.filter((r) => r.success).length;
    const skippedCount = results.filter((r) => r.skipped).length;
    const failCount = results.filter((r) => !r.success && !r.skipped).length;

    let resultMessage = `Bulk ${action} completed:\n✓ Success: ${successCount}`;

    if (skippedCount > 0) {
      const skippedSchemas = results
        .filter((r) => r.skipped)
        .map((r) => `${r.schema.schemaName}: ${r.reason}`)
        .join('\n');
      resultMessage += `\n⊘ Skipped: ${skippedCount}\n\nSkipped schemas:\n${skippedSchemas}`;
    }

    if (failCount > 0) {
      const failedSchemas = results
        .filter((r) => !r.success && !r.skipped)
        .map((r) => `${r.schema.schemaName}: ${r.error}`)
        .join('\n');
      resultMessage += `\n✗ Failed: ${failCount}\n\nFailed schemas:\n${failedSchemas}`;
    }

    setInfoModalConfig({
      title: 'Bulk Action Results',
      message: resultMessage,
      buttonColor: failCount > 0 ? 'yellow' : 'green',
    });
    setShowInfoModal(true);

    setIsBulkToggling(false);
    setBulkTogglingAction(null);
    setBulkRemainingCount(0);
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
      // Only name, schema structure, expired_in, issuer_did, and optional image are sent
      const payload = {
        name: data.schemaName,
        schema: {
          type: 'object',
          properties,
          required,
          expired_in: data.expiredIn,
        },
        issuer_did: issuerDid,
      };

      let response: Response;

      // Use FormData if image is provided, otherwise use JSON
      if (data.image) {
        const formData = new FormData();
        formData.append('name', data.schemaName);
        // Append schema fields separately, not as stringified JSON
        formData.append('schema[type]', payload.schema.type);
        formData.append('schema[expired_in]', String(payload.schema.expired_in));
        formData.append('schema[required]', JSON.stringify(payload.schema.required));
        formData.append('schema[properties]', JSON.stringify(payload.schema.properties));
        formData.append('issuer_did', issuerDid);
        formData.append('image', data.image, data.image.name);

        const token = localStorage.getItem('institutionToken');
        if (!token) {
          throw new Error('No authentication token found. Please log in.');
        }

        response = await fetch(buildApiUrl(API_ENDPOINTS.SCHEMAS.BASE), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            // Don't set Content-Type - browser will set it with boundary for multipart/form-data
          },
          body: formData,
        });
      } else {
        response = await authenticatedPost(buildApiUrl(API_ENDPOINTS.SCHEMAS.BASE), payload);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Schema creation failed:', errorData);

        // Handle validation errors
        if (response.status === 422) {
          const validationErrors = errorData.errors || errorData.message || 'Validation failed';
          throw new Error(`Validation error: ${JSON.stringify(validationErrors)}`);
        }

        throw new Error(errorData.message || 'Failed to create schema');
      }

      // Refresh the schemas list
      await refreshSchemas();

      // Only close modal on success
      setShowCreateSchemaModal(false);
    } catch (error) {
      console.error('Error creating schema:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to create schema. Please try again.';
      setInfoModalConfig({
        title: 'Error',
        message: errorMessage,
        buttonColor: 'red',
      });
      setShowInfoModal(true);
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
      id: 'expiredIn',
      label: 'Expired In (Years)',
      sortKey: 'expiredIn',
      render: (row) => (
        <ThemedText className="text-sm text-gray-900">
          {row.expiredIn === 0 ? 'Lifetime' : row.expiredIn}
        </ThemedText>
      ),
    },
    {
      id: 'status',
      label: 'STATUS',
      sortKey: 'isActive',
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
      id: 'createdAt',
      label: 'CREATED AT',
      sortKey: 'createdAt',
      render: (row) => (
        <ThemedText className="text-sm text-gray-900">
          {new Date(row.createdAt).toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          })}
        </ThemedText>
      ),
    },
    {
      id: 'updatedAt',
      label: 'UPDATED AT',
      sortKey: 'updatedAt',
      render: (row) => (
        <ThemedText className="text-sm text-gray-900">
          {new Date(row.updatedAt).toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          })}
        </ThemedText>
      ),
    },
    {
      id: 'action',
      label: 'Action',
      render: (row) => {
        const schemaKey = `${row.id}-${row.version}`;
        const isToggling = togglingSchemas.has(schemaKey);
        return (
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => handleUpdateSchema(row.id, row.version)}
              disabled={isToggling}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              UPDATE
            </button>
            {row.isActive ? (
              <button
                onClick={() => handleToggleStatus(row.id, row.version)}
                disabled={isToggling}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isToggling ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>DEACTIVATING...</span>
                  </>
                ) : (
                  'DEACTIVATE'
                )}
              </button>
            ) : (
              <button
                onClick={() => handleToggleStatus(row.id, row.version)}
                disabled={isToggling}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isToggling ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>REACTIVATING...</span>
                  </>
                ) : (
                  'REACTIVATE'
                )}
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

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <ThemedText className="text-red-800">Error: {error}</ThemedText>
          </div>
        )}

        {/* Data Table */}
        {!isLoading && !error && (
          <DataTable
            data={filteredSchemas}
            columns={columns}
            onFilter={handleFilter}
            filterButtonRef={filterButtonRef}
            searchPlaceholder="Search..."
            onSearch={handleSearch}
            defaultSortColumn="createdAt"
            defaultSortDirection="desc"
            topRightButtons={
              <div className="flex flex-wrap items-center justify-end gap-3">
                {/* Show bulk operation status indicator only when no schemas are selected */}
                {isBulkToggling && selectedSchemaKeys.size === 0 && (
                  <>
                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                      <span className="text-gray-700">
                        {bulkTogglingAction === 'reactivate' ? 'Reactivating' : 'Deactivating'}{' '}
                        {bulkRemainingCount} schema(s)...
                      </span>
                    </div>
                    <div className="h-8 w-px bg-gray-300"></div>
                  </>
                )}

                {selectedSchemaKeys.size > 0 && (
                  <ThemedText className="text-sm text-gray-700">
                    {selectedSchemaKeys.size} schema(s) selected
                  </ThemedText>
                )}

                {selectedSchemaKeys.size > 0 && (
                  <>
                    <button
                      onClick={() => handleBulkToggle('reactivate')}
                      disabled={isBulkToggling}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isBulkToggling && bulkTogglingAction === 'reactivate' ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          <span>Reactivating {bulkRemainingCount} schema(s)...</span>
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
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          <span>Reactivate All</span>
                        </>
                      )}
                    </button>

                    {/* Separator */}
                    <div className="h-8 w-px bg-gray-300"></div>

                    <button
                      onClick={() => handleBulkToggle('deactivate')}
                      disabled={isBulkToggling}
                      className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isBulkToggling && bulkTogglingAction === 'deactivate' ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          <span>Deactivating {bulkRemainingCount} schema(s)...</span>
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
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                          <span>Deactivate All</span>
                        </>
                      )}
                    </button>

                    <div className="h-8 w-px bg-gray-300"></div>

                    <button
                      onClick={handleUnselectAll}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm font-medium cursor-pointer"
                    >
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
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                      <span>Unselect All</span>
                    </button>

                    <div className="h-8 w-px bg-gray-300"></div>
                  </>
                )}

                <button
                  onClick={handleNewSchema}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  New Schema
                </button>
              </div>
            }
            enableSelection={true}
            onSelectionChange={handleSelectionChange}
            selectedIds={selectedSchemaKeys}
            onRowClick={(row) => handleViewSchema(row.id, row.version)}
            totalCount={filteredSchemas.length}
            rowsPerPageOptions={[5, 10, 25, 50, 100]}
            idKey="uniqueKey"
          />
        )}
      </div>

      {/* Filter Popup */}
      {showFilterModal && (
        <div
          ref={filterModalRef}
          className="fixed bg-white rounded-lg shadow-xl border border-gray-200 p-6 w-80 z-30"
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
              onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Attribute Count Filter */}
          <div className="mb-4">
            <ThemedText className="block text-sm font-medium text-gray-900 mb-2">
              Number of Attributes
            </ThemedText>
            <div className="flex gap-2">
              <input
                type="number"
                value={filterMinAttributes}
                onChange={(e) => setFilterMinAttributes(e.target.value)}
                placeholder="Min"
                min="0"
                className="w-1/2 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 placeholder:text-gray-500"
              />
              <input
                type="number"
                value={filterMaxAttributes}
                onChange={(e) => setFilterMaxAttributes(e.target.value)}
                placeholder="Max"
                min="0"
                className="w-1/2 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 placeholder:text-gray-500"
              />
            </div>
          </div>

          {/* Expired In Filter */}
          <div className="mb-4">
            <ThemedText className="block text-sm font-medium text-gray-900 mb-2">
              Expired In (Years)
            </ThemedText>
            <div className="flex gap-2">
              <input
                type="number"
                value={filterMinExpiredIn}
                onChange={(e) => setFilterMinExpiredIn(e.target.value)}
                placeholder="Min"
                min="0"
                className="w-1/2 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 placeholder:text-gray-500"
              />
              <input
                type="number"
                value={filterMaxExpiredIn}
                onChange={(e) => setFilterMaxExpiredIn(e.target.value)}
                placeholder="Max"
                min="0"
                className="w-1/2 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 placeholder:text-gray-500"
              />
            </div>
          </div>

          {/* Clear Filters Button */}
          <button
            onClick={clearFilters}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium cursor-pointer"
          >
            Clear All Filters
          </button>
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
          imageUrl={selectedSchema?.image_link}
        />
      </Modal>

      {/* View Schema Modal */}
      <Modal
        isOpen={showViewSchemaModal}
        onClose={() => {
          setShowViewSchemaModal(false);
          setSelectedSchema(null);
        }}
        title="View Schema"
      >
        {selectedSchema && selectedSchema.schemaDetails && (
          <ViewSchemaForm
            onClose={() => {
              setShowViewSchemaModal(false);
              setSelectedSchema(null);
            }}
            schemaData={{
              id: selectedSchema.id,
              schemaName: selectedSchema.schemaName.split(' v')[0],
              version: selectedSchema.version.toString(),
              expiredIn: selectedSchema.expiredIn,
              isActive: selectedSchema.isActive ? 'Active' : 'Inactive',
              updatedAt: selectedSchema.updatedAt,
              attributes: Object.entries(selectedSchema.schemaDetails.properties).map(
                ([name, config], index) => ({
                  id: index + 1,
                  name,
                  type: (config as { type: string }).type,
                  description: '',
                  required: selectedSchema.schemaDetails!.required.includes(name),
                })
              ),
              imageUrl: selectedSchema.image_link,
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
    </InstitutionLayout>
  );
}
