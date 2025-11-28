'use client';

import React from 'react';
import Modal from '@/components/shared/Modal';
import { DataTable, Column } from '@/components/shared/DataTable';

interface Schema {
  id: string;
  version: number;
  name: string;
  schema: {
    type: string;
    required: string[];
    expired_in: number;
    properties: {
      [key: string]: {
        type: string;
        description: string;
      };
    };
  };
  issuer_did: string;
  issuer_name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SchemaWithCompositeId extends Schema {
  compositeId: string;
}

interface VCInfoItem {
  id: string;
  name: string;
  value: string;
}

interface AttributeItem {
  id: string;
  name: string;
  type: string;
}

interface RequestCredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  isSchemasLoading: boolean;
  filteredSchemas: SchemaWithCompositeId[];
  expandedSchemaId: string | null;
  schemaColumns: Column<SchemaWithCompositeId>[];
  vcInfoColumns: Column<VCInfoItem>[];
  attributesColumns: Column<AttributeItem>[];
  onSchemaSearch: (value: string) => void;
  getVCInfoData: (schema: Schema) => VCInfoItem[];
  getAttributesData: (schema: Schema) => AttributeItem[];
}

export const RequestCredentialModal: React.FC<RequestCredentialModalProps> = ({
  isOpen,
  onClose,
  isSchemasLoading,
  filteredSchemas,
  expandedSchemaId,
  schemaColumns,
  vcInfoColumns,
  attributesColumns,
  onSchemaSearch,
  getVCInfoData,
  getAttributesData,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Request New Credential" minHeight="700px">
      <div className="px-8 py-6">
        {isSchemasLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
            </div>
          </div>
        ) : (
          <>
            {/* Schema List with Expandable Rows */}
            <DataTable<SchemaWithCompositeId>
              data={filteredSchemas.filter((s) => s.compositeId)}
              columns={schemaColumns}
              searchPlaceholder="Search schemas..."
              onSearch={onSchemaSearch}
              enableSelection={false}
              totalCount={filteredSchemas.filter((s) => s.compositeId).length}
              rowsPerPageOptions={[5, 10, 25]}
              idKey="compositeId"
              expandableRows={{
                expandedRowId: expandedSchemaId,
                renderExpandedContent: (schema: SchemaWithCompositeId) => (
                  <div className="space-y-6 bg-white p-4 rounded-lg">
                    {/* VC Info */}
                    <div>
                      <p className="text-base font-semibold text-gray-900 mb-3">VC Info</p>
                      <DataTable
                        data={getVCInfoData(schema)}
                        columns={vcInfoColumns}
                        enableSelection={false}
                        totalCount={getVCInfoData(schema).length}
                        idKey="id"
                        hideTopControls={true}
                        hideBottomControls={true}
                        rowsPerPageOptions={[1000]}
                      />
                    </div>

                    {/* Attributes */}
                    <div>
                      <p className="text-base font-semibold text-gray-900 mb-3">Attributes</p>
                      <DataTable
                        data={getAttributesData(schema)}
                        columns={attributesColumns}
                        enableSelection={false}
                        totalCount={getAttributesData(schema).length}
                        idKey="id"
                        hideTopControls={true}
                        hideBottomControls={true}
                        rowsPerPageOptions={[1000]}
                      />
                    </div>
                  </div>
                ),
              }}
              hideBottomControls={true}
            />

            {filteredSchemas.length === 0 && (
              <div className="text-center py-12">
                <span className="text-gray-500">No schemas available</span>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};
