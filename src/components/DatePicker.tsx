'use client';

import { useRef, useState } from 'react';

interface DatePickerProps {
  value: string; // ISO date string (YYYY-MM-DD)
  onChange: (value: string) => void;
}

export default function DatePicker({ value, onChange }: DatePickerProps) {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value; // YYYY-MM-DD
    onChange(dateValue);
  };

  const handleClearDate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  // Format date for display (MM/DD/YYYY)
  const formatDateForDisplay = (isoDate: string): string => {
    if (!isoDate) return '';
    try {
      const date = new Date(isoDate + 'T00:00:00'); // Add time to prevent timezone issues
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    } catch {
      return '';
    }
  };

  return (
    <div className="relative w-full">
      <div className="flex gap-2">
        {/* Native Date Input styled to look custom */}
        <div className="relative flex-1">
          <input
            ref={dateInputRef}
            type="date"
            value={value}
            onChange={handleDateChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full"
            style={{
              colorScheme: 'light',
              color: isFocused ? '#111827' : 'transparent',
            }}
          />
          {/* Custom display overlay when not focused and has value */}
          {!isFocused && value && (
            <div className="absolute inset-0 flex items-center px-3 pointer-events-none">
              <span className="text-sm text-gray-900">{formatDateForDisplay(value)}</span>
            </div>
          )}
          {/* Placeholder when no value */}
          {!isFocused && !value && (
            <div className="absolute inset-0 flex items-center px-3 pointer-events-none">
              <span className="text-sm text-gray-400">MM/DD/YYYY</span>
            </div>
          )}
        </div>

        {/* Clear Button */}
        {value && (
          <button
            type="button"
            onClick={handleClearDate}
            className="px-3 py-2 text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center"
            title="Clear date"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
