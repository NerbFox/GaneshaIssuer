'use client';

import React, { useEffect, useRef, useState } from 'react';

interface DateTimePickerProps {
  value: string; // ISO format: YYYY-MM-DDTHH:MM
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value,
  onChange,
  className = '',
  disabled = false,
}) => {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [displayTime, setDisplayTime] = useState('');
  const [isDateFocused, setIsDateFocused] = useState(false);

  // Parse the value
  const getDatePart = () => {
    if (!value) return '';
    return value.split('T')[0]; // YYYY-MM-DD
  };

  const getTimePart = () => {
    if (!value) return '';
    const timePart = value.split('T')[1];
    return timePart || '';
  };

  useEffect(() => {
    if (!value) {
      setDisplayTime('');
      return;
    }
    const timePart = value.split('T')[1] || '';
    setDisplayTime(timePart);
  }, [value]);

  // Format date as MM/DD/YYYY for display
  const formatDateForDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${month}/${day}/${year}`;
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    if (newDate) {
      const time = getTimePart() || '00:00';
      onChange(`${newDate}T${time}`);
    } else {
      onChange('');
    }
  };

  const handleClearDateTime = () => {
    onChange('');
    setDisplayTime('');
  };

  const handleTimeClick = () => {
    // Get current time and fill it automatically
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const currentTime = `${hours}:${minutes}`;

    setDisplayTime(currentTime);

    const date = getDatePart();
    if (date) {
      onChange(`${date}T${currentTime}`);
    }
  };

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
    const date = getDatePart();

    if (!sanitized) {
      setDisplayTime('');
      if (date) {
        onChange(`${date}T00:00`);
      } else {
        onChange('');
      }
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
    if (timeRegex.test(timeToValidate) && date) {
      // Ensure two-digit format for hours and minutes
      const [hours, minutes] = timeToValidate.split(':');
      const formattedTime = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
      setDisplayTime(formattedTime);
      onChange(`${date}T${formattedTime}`);
    } else {
      // Revert to last valid time if input is invalid or date missing
      setDisplayTime(getTimePart());
    }
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      {/* Native Date Input with custom overlay */}
      <div className="relative w-32">
        <input
          ref={dateInputRef}
          type="date"
          value={getDatePart()}
          onChange={handleDateChange}
          onFocus={() => setIsDateFocused(true)}
          onBlur={() => setIsDateFocused(false)}
          disabled={disabled}
          className={`w-full px-3 py-2 pr-8 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            disabled
              ? 'bg-gray-50 cursor-not-allowed'
              : 'cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 hover:[&::-webkit-calendar-picker-indicator]:opacity-100'
          } [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-8 [&::-webkit-calendar-picker-indicator]:h-full`}
          style={{
            colorScheme: 'light',
            color: isDateFocused ? '#111827' : 'transparent',
          }}
        />
        {/* Custom display overlay when not focused and has value */}
        {!isDateFocused && getDatePart() && (
          <div className="absolute inset-0 flex items-center px-3 pr-8 pointer-events-none">
            <span className="text-sm text-gray-900">{formatDateForDisplay(getDatePart())}</span>
          </div>
        )}
        {/* Placeholder when no value */}
        {!isDateFocused && !getDatePart() && (
          <div className="absolute inset-0 flex items-center px-3 pr-8 pointer-events-none">
            <span className="text-sm text-gray-400">MM/DD/YYYY</span>
          </div>
        )}
        {/* Clear button overlay */}
        {value && !disabled && (
          <button
            type="button"
            onClick={handleClearDateTime}
            className="absolute inset-y-0 right-1 flex items-center text-gray-400 hover:text-red-500 focus:outline-none z-10"
            aria-label="Clear date and time"
            title="Clear"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      {/* Time Display Input - Now editable */}
      <div className="relative flex-1">
        <input
          type="text"
          value={displayTime}
          onChange={handleTimeInputChange}
          onBlur={commitTimeValue}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitTimeValue();
            }
          }}
          placeholder="00:00"
          disabled={disabled}
          className={`w-full px-4 py-2 pr-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 ${
            disabled ? 'bg-gray-50 cursor-not-allowed' : ''
          }`}
        />
        {!disabled && (
          <button
            type="button"
            onClick={handleTimeClick}
            className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-blue-500 focus:outline-none"
            aria-label="Set current time"
            title="Set current time"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l2.5 2.5M12 22a10 10 0 100-20 10 10 0 000 20z"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};
