'use client';

import React, { useState } from 'react';
import { ThemedText } from './ThemedText';

interface WebsiteInputProps {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export default function WebsiteInput({
  id,
  name,
  label,
  value,
  onChange,
  onBlur,
  required = false,
  disabled = false,
  placeholder = 'example.com',
  className = '',
}: WebsiteInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove any protocol prefix if user tries to add it
    let cleanValue = e.target.value.replace(/^https?:\/\//i, '').replace(/^\/+/, '');

    onChange(cleanValue);
  };

  return (
    <div className={`relative ${className}`}>
      <div
        className={`flex rounded-lg transition-all ${
          isFocused && !disabled ? 'ring-2 ring-[#0D2B45]' : ''
        }`}
      >
        {/* Fixed HTTPS Prefix */}
        <div className="flex items-center px-3 pt-8 pb-2 bg-[#E9F2F5] rounded-l-lg">
          <ThemedText fontSize={14} className="text-gray-700 select-none whitespace-nowrap">
            https://
          </ThemedText>
        </div>

        {/* Website Input */}
        <div className="relative flex-1">
          <input
            id={id}
            name={name}
            type="text"
            value={value}
            onChange={handleInputChange}
            onFocus={() => setIsFocused(true)}
            onBlur={(e) => {
              setIsFocused(false);
              onBlur?.(e);
            }}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            className="text-black w-full px-4 pt-8 pb-2 bg-[#E9F2F5] rounded-r-lg border-0 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, fontSize: '14px' }}
          />
        </div>
      </div>
      <label htmlFor={id} className="absolute left-3 top-2 z-10 pointer-events-none">
        <ThemedText fontSize={12} fontWeight={500} className="text-gray-700">
          {label}
          {required && <span className="text-red-500">*</span>}
        </ThemedText>
      </label>
    </div>
  );
}
