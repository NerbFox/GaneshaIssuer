'use client';

import { useState, useEffect, ReactNode, Fragment } from 'react';
import { ThemedText } from './ThemedText';

export interface Column<T> {
  id: string;
  label: string;
  render: (row: T, index: number) => ReactNode;
  sortable?: boolean;
  sortKey?: keyof T | ((row: T) => string | number);
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onFilter?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  filterButtonRef?: React.RefObject<HTMLButtonElement | null>;
  activeFilterCount?: number; // Number of active filters
  searchPlaceholder?: string;
  onSearch?: (value: string) => void;
  topRightButton?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
  topRightButtons?: ReactNode; // New prop for custom buttons
  enableSelection?: boolean;
  onSelectionChange?: (selectedIds: number[], selectedIdValues?: (string | number)[]) => void;
  selectedIds?: Set<string | number>; // External control of selected IDs
  onRowClick?: (row: T) => void;
  totalCount?: number;
  rowsPerPageOptions?: number[];
  idKey?: keyof T; // Key to use for the ID column (e.g., 'id')
  enableDragDrop?: boolean; // Enable drag and drop for rows
  onDragStart?: (index: number) => void;
  onDragOver?: (e: React.DragEvent, index: number) => void;
  onDragEnd?: () => void;
  draggedIndex?: number | null;
  expandableRows?: {
    expandedRowId: string | number | null;
    renderExpandedContent: (row: T) => ReactNode;
  };
  hideTopControls?: boolean; // Hide search, filter, and top buttons
  hideBottomControls?: boolean; // Hide pagination and rows per page
  defaultSortColumn?: string; // Default column to sort by
  defaultSortDirection?: 'asc' | 'desc'; // Default sort direction
}

export function DataTable<T>({
  data,
  columns,
  onFilter,
  filterButtonRef,
  activeFilterCount = 0,
  searchPlaceholder = 'Search...',
  onSearch,
  topRightButton,
  topRightButtons,
  enableSelection = true,
  onSelectionChange,
  selectedIds,
  onRowClick,
  totalCount,
  rowsPerPageOptions = [5, 10, 25, 50, 100],
  idKey,
  enableDragDrop = false,
  onDragStart,
  onDragOver,
  onDragEnd,
  draggedIndex,
  expandableRows,
  hideTopControls = false,
  hideBottomControls = false,
  defaultSortColumn,
  defaultSortDirection = 'asc',
}: DataTableProps<T>) {
  const [selectedRows, setSelectedRows] = useState<Set<string | number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(rowsPerPageOptions[0]);
  const [sortColumn, setSortColumn] = useState<string | null>(defaultSortColumn ?? null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(defaultSortDirection);

  useEffect(() => {
    if (selectedIds !== undefined) {
      setSelectedRows(selectedIds);
    }
  }, [selectedIds]);

  useEffect(() => {
    const total = totalCount || data.length;
    const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));

    // If current page exceeds total pages, reset to page 1
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [data.length, totalCount, rowsPerPage, currentPage]);

  // Sort data
  const sortedData = [...data].sort((a, b) => {
    if (!sortColumn) return 0;

    const column = columns.find((col) => col.id === sortColumn);
    if (!column) return 0;

    let aValue: string | number;
    let bValue: string | number;

    if (column.sortKey) {
      if (typeof column.sortKey === 'function') {
        aValue = column.sortKey(a);
        bValue = column.sortKey(b);
      } else {
        aValue = a[column.sortKey] as string | number;
        bValue = b[column.sortKey] as string | number;
      }
    } else {
      return 0;
    }

    // Handle different types
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }

    // Default string comparison
    return sortDirection === 'asc'
      ? String(aValue).localeCompare(String(bValue))
      : String(bValue).localeCompare(String(aValue));
  });

  const total = totalCount || sortedData.length;
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
  const startIndex = total > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0;
  const endIndex = Math.min(currentPage * rowsPerPage, total);

  // Paginate the data
  const paginatedData = sortedData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const handleSelectAll = () => {
    if (selectAll) {
      if (idKey) {
        const currentPageIds = paginatedData.map((row) => row[idKey] as string | number);
        const newSelected = new Set(selectedRows);
        currentPageIds.forEach((id) => newSelected.delete(id));
        setSelectedRows(newSelected);
        setSelectAll(false);

        const selectedIndices: number[] = [];
        const selectedIdValues: (string | number)[] = [];
        data.forEach((row, idx) => {
          const id = row[idKey] as string | number;
          if (newSelected.has(id)) {
            selectedIndices.push(idx);
            selectedIdValues.push(id);
          }
        });
        onSelectionChange?.(selectedIndices, selectedIdValues);
      } else {
        setSelectedRows(new Set());
        setSelectAll(false);
        onSelectionChange?.([], []);
      }
    } else {
      if (idKey) {
        const currentPageIds = paginatedData.map((row) => row[idKey] as string | number);
        const newSelected = new Set(selectedRows);
        currentPageIds.forEach((id) => newSelected.add(id));
        setSelectedRows(newSelected);
        setSelectAll(true);

        const selectedIndices: number[] = [];
        const selectedIdValues: (string | number)[] = [];
        data.forEach((row, idx) => {
          const id = row[idKey] as string | number;
          if (newSelected.has(id)) {
            selectedIndices.push(idx);
            selectedIdValues.push(id);
          }
        });
        onSelectionChange?.(selectedIndices, selectedIdValues);
      } else {
        const allIndices = paginatedData.map((_, index) => (currentPage - 1) * rowsPerPage + index);
        setSelectedRows(new Set(allIndices));
        setSelectAll(true);
        onSelectionChange?.(allIndices, allIndices);
      }
    }
  };

  const handleSelectRow = (index: number) => {
    const row = paginatedData[index];
    const rowId = idKey ? (row[idKey] as string | number) : (currentPage - 1) * rowsPerPage + index;

    const newSelected = new Set(selectedRows);
    if (newSelected.has(rowId)) {
      newSelected.delete(rowId);
    } else {
      newSelected.add(rowId);
    }
    setSelectedRows(newSelected);
    setSelectAll(newSelected.size === paginatedData.length);

    // Convert selected IDs back to indices for backwards compatibility
    if (idKey) {
      const selectedIndices: number[] = [];
      paginatedData.forEach((row, idx) => {
        const id = row[idKey] as string | number;
        if (newSelected.has(id)) {
          selectedIndices.push((currentPage - 1) * rowsPerPage + idx);
        }
      });
      onSelectionChange?.(selectedIndices, Array.from(newSelected));
    } else {
      onSelectionChange?.(Array.from(newSelected) as number[], Array.from(newSelected));
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    onSearch?.(value);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  useEffect(() => {
    if (idKey && paginatedData.length > 0) {
      const currentPageIds = paginatedData.map((row) => row[idKey] as string | number);
      const allCurrentPageSelected = currentPageIds.every((id) => selectedRows.has(id));
      setSelectAll(allCurrentPageSelected && currentPageIds.length > 0);
    }
  }, [currentPage, paginatedData, selectedRows, idKey]);

  const handleRowsPerPageChange = (value: number) => {
    setRowsPerPage(value);
    setCurrentPage(1);
  };

  const handleSort = (columnId: string) => {
    if (sortColumn === columnId) {
      // Toggle direction
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to ascending
      setSortColumn(columnId);
      setSortDirection('asc');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Top Controls */}
      {!hideTopControls && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 pb-4 bg-gray-50">
          <div className="flex items-center gap-3">
            {/* Filter Button */}
            {onFilter && (
              <button
                ref={filterButtonRef}
                onClick={(e) => onFilter(e)}
                className="relative p-2 bg-white rounded-lg border border-gray-200 hover:shadow-sm transition-colors cursor-pointer"
                title="Filter"
              >
                <svg
                  className="w-5 h-5 text-gray-600"
                  fill="white"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                  />
                </svg>
                {/* Filter Count Badge */}
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-blue-500 text-white text-xs font-semibold rounded-full">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            )}

            {/* Search Bar */}
            <div className="relative bg-white">
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
              />
            </div>
          </div>

          {/* Top Right Buttons */}
          <div>
            {topRightButtons
              ? topRightButtons
              : topRightButton && (
                  <button
                    onClick={topRightButton.onClick}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium cursor-pointer"
                  >
                    {topRightButton.icon}
                    {topRightButton.label}
                  </button>
                )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {/* Checkbox Column */}
              {enableSelection && (
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
              )}

              {/* Drag Handle Column */}
              {enableDragDrop && (
                <th className="px-6 py-3 text-left w-16">
                  <ThemedText className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    {/* Empty header for drag handle */}
                  </ThemedText>
                </th>
              )}

              {/* # Column */}
              <th className="px-6 py-3 text-left w-16">
                <ThemedText className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  #
                </ThemedText>
              </th>

              {/* Dynamic Columns */}
              {columns.map((column) => (
                <th key={column.id} className="px-6 py-3 text-left">
                  <button
                    onClick={() => column.sortKey && handleSort(column.id)}
                    className={`flex items-center gap-2 text-xs font-semibold text-gray-600 uppercase tracking-wider ${
                      column.sortKey ? 'cursor-pointer hover:text-gray-900' : ''
                    }`}
                    disabled={!column.sortKey}
                  >
                    <ThemedText
                      fontWeight={700}
                      className="text-xs text-gray-600 uppercase tracking-wider"
                    >
                      {column.label}
                    </ThemedText>
                    {column.sortKey && (
                      <div className="flex flex-col">
                        {sortColumn === column.id ? (
                          sortDirection === 'asc' ? (
                            <svg
                              className="w-4 h-4 text-gray-900"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
                                clipRule="evenodd"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="w-4 h-4 text-gray-900"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )
                        ) : (
                          <svg
                            className="w-4 h-4 text-gray-400"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M5 12a1 1 0 102 0V6.414l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L5 6.414V12zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z" />
                          </svg>
                        )}
                      </div>
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={
                    columns.length + 1 + (enableSelection ? 1 : 0) + (enableDragDrop ? 1 : 0)
                  }
                  className="px-6 py-12 text-center"
                >
                  <div className="flex flex-col items-center justify-center">
                    <svg
                      className="w-16 h-16 text-gray-300 mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                      />
                    </svg>
                    <ThemedText fontSize={16} fontWeight={600} className="text-gray-500 mb-2">
                      No data available
                    </ThemedText>
                    <ThemedText fontSize={14} className="text-gray-400">
                      There are currently no items to display
                    </ThemedText>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((row, paginatedIndex) => {
                const actualIndex = (currentPage - 1) * rowsPerPage + paginatedIndex;
                const isDragging = draggedIndex === actualIndex;
                // Use idKey combined with index for unique key, or just index
                const rowKey = idKey
                  ? `${String(row[idKey])}-${actualIndex}`
                  : `row-${actualIndex}`;
                const rowId = idKey ? (row[idKey] as string | number) : actualIndex;
                const isSelected = selectedRows.has(rowId);
                const isExpanded = expandableRows && expandableRows.expandedRowId === rowId;

                return (
                  <Fragment key={rowKey}>
                    <tr
                      draggable={enableDragDrop}
                      onDragStart={() => enableDragDrop && onDragStart?.(actualIndex)}
                      onDragOver={(e) => enableDragDrop && onDragOver?.(e, actualIndex)}
                      onDragEnd={() => enableDragDrop && onDragEnd?.()}
                      onClick={() => onRowClick?.(row)}
                      className={`hover:bg-gray-50 transition-colors ${
                        isSelected ? 'bg-blue-50' : ''
                      } ${isDragging ? 'opacity-50' : ''} ${enableDragDrop ? 'cursor-move' : onRowClick ? 'cursor-pointer' : ''}`}
                    >
                      {/* Checkbox Cell */}
                      {enableSelection && (
                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectRow(paginatedIndex)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                      )}

                      {/* Drag Handle Cell */}
                      {enableDragDrop && (
                        <td className="px-6 py-4">
                          <svg
                            className="w-5 h-5 text-gray-400 cursor-move"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 8h16M4 16h16"
                            />
                          </svg>
                        </td>
                      )}

                      {/* # Cell */}
                      <td className="px-6 py-4">
                        <ThemedText className="text-sm text-gray-900">{actualIndex + 1}</ThemedText>
                      </td>

                      {/* Dynamic Cells */}
                      {columns.map((column) => (
                        <td key={column.id} className="px-6 py-4">
                          <ThemedText className="text-sm text-gray-900">
                            {column.render(row, paginatedIndex)}
                          </ThemedText>
                        </td>
                      ))}
                    </tr>

                    {/* Expandable Row Content */}
                    {isExpanded && expandableRows && (
                      <tr key={`${rowKey}-expanded`} className="bg-gray-50">
                        <td
                          colSpan={
                            columns.length +
                            1 +
                            (enableSelection ? 1 : 0) +
                            (enableDragDrop ? 1 : 0)
                          }
                          className="px-6 py-0 overflow-hidden"
                        >
                          <div className="animate-slideDown">
                            <div className="py-6">{expandableRows.renderExpandedContent(row)}</div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom Controls */}
      {!hideBottomControls && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50/50 backdrop-blur-sm">
          {/* Items Count */}
          <div className="text-sm text-gray-600">
            {startIndex}-{endIndex} of {total}
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center gap-4">
            {/* Rows Per Page */}
            <div className="flex items-center gap-2">
              <ThemedText className="text-sm text-gray-600">Rows per page:</ThemedText>
              <select
                value={rowsPerPage}
                onChange={(e) => handleRowsPerPageChange(Number(e.target.value))}
                className="px-3 py-1 text-gray-600 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
              >
                {rowsPerPageOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            {/* Pagination */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || total === 0}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg
                  className="w-5 h-5 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>

              <ThemedText className="text-sm text-gray-600">
                {currentPage}/{totalPages}
              </ThemedText>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages || total === 0}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg
                  className="w-5 h-5 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
