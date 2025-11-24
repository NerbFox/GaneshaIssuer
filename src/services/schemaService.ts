/**
 * Schema Service
 * Handles all schema-related API operations
 */

import { API_ENDPOINTS, buildApiUrl, buildApiUrlWithParams } from '@/utils/api';
import { authenticatedGet } from '@/utils/api-client';

// =============================================================================
// TYPES
// =============================================================================

export interface SchemaProperty {
  type: string;
  description: string;
}

export interface SchemaDefinition {
  type: string;
  required: string[];
  properties: Record<string, SchemaProperty>;
  expired_in: number;
  attribute_positions?: unknown;
  qr_code_position?: unknown;
}

export interface SchemaData {
  id: string;
  name: string;
  schema: SchemaDefinition;
  issuer_did: string;
  version: number;
  isActive: boolean;
  image_link: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FetchSchemaByVersionResponse {
  success: boolean;
  data: SchemaData;
}

export interface FetchSchemasParams {
  issuerDid?: string;
  isActive?: boolean;
}

export interface FetchSchemasResponse {
  success: boolean;
  data: {
    count: number;
    data: SchemaData[];
  };
}

// =============================================================================
// SCHEMA FETCHING
// =============================================================================

/**
 * Fetch a schema by ID and version
 */
export async function fetchSchemaByVersion(
  schemaId: string,
  version: number
): Promise<FetchSchemaByVersionResponse> {
  const url = buildApiUrl(API_ENDPOINTS.SCHEMAS.BY_VERSION(schemaId, version));
  const response = await authenticatedGet(url);

  if (!response.ok) {
    throw new Error('Failed to fetch schema details');
  }

  return await response.json();
}

/**
 * Fetch all schemas with optional filters
 */
export async function fetchSchemas(params?: FetchSchemasParams): Promise<FetchSchemasResponse> {
  const url = params
    ? buildApiUrlWithParams(
        API_ENDPOINTS.SCHEMAS.BASE,
        params as Record<string, string | number | boolean>
      )
    : buildApiUrl(API_ENDPOINTS.SCHEMAS.BASE);

  const response = await authenticatedGet(url);

  if (!response.ok) {
    throw new Error('Failed to fetch schemas');
  }

  return await response.json();
}

/**
 * Fetch a schema by ID (latest version)
 */
export async function fetchSchemaById(schemaId: string): Promise<FetchSchemaByVersionResponse> {
  const url = buildApiUrl(API_ENDPOINTS.SCHEMAS.BY_ID(schemaId));
  const response = await authenticatedGet(url);

  if (!response.ok) {
    throw new Error('Failed to fetch schema');
  }

  return await response.json();
}

/**
 * Fetch all versions of a schema
 */
export async function fetchSchemaVersions(schemaId: string): Promise<FetchSchemasResponse> {
  const url = buildApiUrl(API_ENDPOINTS.SCHEMAS.BY_ID_VERSIONS(schemaId));
  const response = await authenticatedGet(url);

  if (!response.ok) {
    throw new Error('Failed to fetch schema versions');
  }

  return await response.json();
}

/**
 * Check if a schema version is active
 */
export async function checkSchemaActive(
  schemaId: string,
  version: number
): Promise<{ success: boolean; isActive: boolean }> {
  const url = buildApiUrl(API_ENDPOINTS.SCHEMAS.ACTIVE_CHECK(schemaId, version));
  const response = await authenticatedGet(url);

  if (!response.ok) {
    throw new Error('Failed to check schema active status');
  }

  return await response.json();
}
