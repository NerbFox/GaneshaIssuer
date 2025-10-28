'use client';

import React, { useMemo, useState } from 'react';
import Select, { StylesConfig } from 'react-select';
import countriesData from '@/data/countries.json';
import { ThemedText } from './ThemedText';

interface PhoneInputProps {
  id: string;
  name: string;
  label: string;
  value: string;
  prefix: string;
  onValueChange: (value: string) => void;
  onPrefixChange: (prefix: string) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

interface PrefixOption {
  value: string;
  label: string;
  flag: string;
}

interface Country {
  code: string;
  name: string;
  flag: string;
  phoneCode: string;
}

const customStyles: StylesConfig<PrefixOption, false> = {
  control: (provided) => ({
    ...provided,
    backgroundColor: '#E9F2F5',
    border: 'none',
    borderRadius: '0.5rem 0 0 0.5rem',
    boxShadow: 'none',
    minHeight: '60px',
    height: '60px',
    paddingLeft: '1rem',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: '#E9F2F5',
    },
  }),
  valueContainer: (provided) => ({
    ...provided,
    height: '60px',
    padding: '0',
    paddingTop: '1.25rem',
  }),
  input: (provided) => ({
    ...provided,
    margin: 0,
    padding: 0,
    color: '#000',
  }),
  placeholder: (provided) => ({
    ...provided,
    color: '#6b7280',
    fontSize: '14px',
  }),
  singleValue: (provided) => ({
    ...provided,
    color: '#000',
    fontSize: '14px',
    margin: 0,
  }),
  menu: (provided) => ({
    ...provided,
    backgroundColor: '#fff',
    borderRadius: '0.5rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    zIndex: 9999,
  }),
  menuList: (provided) => ({
    ...provided,
    maxHeight: '200px',
    '::-webkit-scrollbar': {
      width: '8px',
    },
    '::-webkit-scrollbar-track': {
      background: '#f1f1f1',
      borderRadius: '0.5rem',
    },
    '::-webkit-scrollbar-thumb': {
      background: '#888',
      borderRadius: '0.5rem',
    },
    '::-webkit-scrollbar-thumb:hover': {
      background: '#555',
    },
  }),
  option: (provided, state) => ({
    ...provided,
    backgroundColor: state.isSelected ? '#0D2B45' : state.isFocused ? '#E9F2F5' : '#fff',
    color: state.isSelected ? '#fff' : '#000',
    fontSize: '14px',
    padding: '0.5rem 1rem',
    cursor: 'pointer',
    '&:active': {
      backgroundColor: '#0D2B45',
    },
  }),
  indicatorSeparator: () => ({
    display: 'none',
  }),
  dropdownIndicator: (provided) => ({
    ...provided,
    padding: '8px',
    color: '#6b7280',
    '&:hover': {
      color: '#374151',
    },
  }),
  indicatorsContainer: (provided) => ({
    ...provided,
    height: '60px',
    paddingTop: '1.25rem',
  }),
};

const formatOptionLabel = (option: PrefixOption) => (
  <div className="flex items-center gap-2">
    <span className="text-lg">{option.flag}</span>
    <span>{option.label}</span>
  </div>
);

export default function PhoneInput({
  id,
  name,
  label,
  value,
  prefix,
  onValueChange,
  onPrefixChange,
  onBlur,
  required = false,
  disabled = false,
  placeholder = '123 4567 8900',
  className = '',
}: PhoneInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  // Generate phone prefix options from countries data
  const options = useMemo(() => {
    const uniquePrefixes = new Map<string, PrefixOption>();

    (countriesData as Country[]).forEach((country) => {
      if (!uniquePrefixes.has(country.phoneCode)) {
        uniquePrefixes.set(country.phoneCode, {
          value: country.phoneCode,
          label: country.phoneCode,
          flag: country.flag,
        });
      }
    });

    // Sort by phone code
    return Array.from(uniquePrefixes.values()).sort((a, b) => {
      const aNum = parseInt(a.value.replace('+', ''));
      const bNum = parseInt(b.value.replace('+', ''));
      return aNum - bNum;
    });
  }, []);

  const selectedOption = useMemo(
    () => options.find((option: PrefixOption) => option.value === prefix) || null,
    [prefix, options]
  );

  const handlePrefixChange = (option: PrefixOption | null) => {
    if (option) {
      onPrefixChange(option.value);
    }
  };

  const formatPhoneNumber = (input: string): string => {
    // Remove all non-digit characters
    const cleaned = input.replace(/\D/g, '');

    // Add spaces every 3-4 digits for better readability
    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 7) {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    } else if (cleaned.length <= 11) {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7)}`;
    } else {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7, 11)} ${cleaned.slice(11, 15)}`;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove all non-digit characters and format
    const formatted = formatPhoneNumber(e.target.value);
    onValueChange(formatted);
  };

  return (
    <div className={`relative ${className}`}>
      <div
        className={`flex rounded-lg transition-all ${
          isFocused && !disabled ? 'ring-2 ring-[#0D2B45]' : ''
        }`}
      >
        {/* Prefix Dropdown */}
        <div style={{ width: '120px', flexShrink: 0 }}>
          <Select<PrefixOption>
            instanceId={`${id}-prefix`}
            value={selectedOption}
            onChange={handlePrefixChange}
            options={options}
            styles={customStyles}
            isSearchable
            isDisabled={disabled}
            placeholder="+62"
            formatOptionLabel={formatOptionLabel}
            classNamePrefix="react-select"
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
        </div>

        {/* Phone Number Input */}
        <div className="relative flex-1">
          <input
            id={id}
            name={name}
            type="tel"
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
