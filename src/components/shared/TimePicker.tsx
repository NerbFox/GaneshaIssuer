'use client';

import { useState, useEffect } from 'react';

interface TimePickerProps {
  value: string; // HH:MM format
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function TimePicker({ value, onChange, disabled = false }: TimePickerProps) {
  const [displayTime, setDisplayTime] = useState('');

  useEffect(() => {
    setDisplayTime(value || '');
  }, [value]);

  const handleTimeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    // Remove any non-digit characters except colon
    const digitsOnly = newValue.replace(/[^0-9:]/g, '');

    // Remove any colons (we'll add it back automatically)
    const numbersOnly = digitsOnly.replace(/:/g, '');

    // Limit to 4 digits maximum
    if (numbersOnly.length > 4) {
      return;
    }

    // Auto-format: add colon after 2 digits
    let formattedValue = numbersOnly;
    if (numbersOnly.length > 2) {
      formattedValue = numbersOnly.slice(0, 2) + ':' + numbersOnly.slice(2);
    }

    setDisplayTime(formattedValue);
  };

  const formatTimeInput = (input: string): string => {
    // Remove all non-digit characters
    const digitsOnly = input.replace(/\D/g, '');

    // Limit to 4 digits
    const limitedDigits = digitsOnly.slice(0, 4);

    if (limitedDigits.length === 0) {
      return '';
    }

    if (limitedDigits.length <= 2) {
      // Just hours: "21" stays as "21"
      return limitedDigits;
    }

    // 3 or 4 digits: format as HH:MM
    const hours = limitedDigits.slice(0, 2);
    const minutes = limitedDigits.slice(2);
    return `${hours}:${minutes}`;
  };

  const commitTimeValue = () => {
    const sanitized = displayTime.trim();

    if (!sanitized) {
      setDisplayTime('');
      onChange('');
      return;
    }

    // Auto-format if input is just digits (e.g., "2100" -> "21:00")
    let timeToValidate = sanitized;
    if (/^\d{3,4}$/.test(sanitized)) {
      timeToValidate = formatTimeInput(sanitized);
      setDisplayTime(timeToValidate);
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([0-1]?\d|2[0-3]):([0-5]\d)$/;
    if (timeRegex.test(timeToValidate)) {
      // Ensure two-digit format for hours and minutes
      const [hours, minutes] = timeToValidate.split(':');
      const formattedTime = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
      setDisplayTime(formattedTime);
      onChange(formattedTime);
    } else {
      // Revert to last valid time if input is invalid
      setDisplayTime(value || '');
    }
  };

  const handleClearTime = () => {
    setDisplayTime('');
    onChange('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitTimeValue();
    }
  };

  return (
    <div className="relative w-full">
      <div className="flex gap-2">
        {/* Time Input */}
        <input
          type="text"
          value={displayTime}
          onChange={handleTimeInputChange}
          onBlur={commitTimeValue}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? '' : '00:00'}
          maxLength={5}
          disabled={disabled}
          className={`w-full px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            disabled ? 'bg-gray-50 cursor-not-allowed' : ''
          }`}
        />

        {/* Clear Button */}
        {value && !disabled && (
          <button
            type="button"
            onClick={handleClearTime}
            className="px-3 py-2 text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center"
            title="Clear time"
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
