'use client';

import React, { useMemo } from 'react';
import Select, { StylesConfig } from 'react-select';
import countriesData from '@/data/countries.json';
import { ThemedText } from '@/components/shared/ThemedText';
import { useTranslations } from 'next-intl';

interface CountrySelectProps {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

interface CountryOption {
  value: string;
  label: string;
}

interface Country {
  code: string;
  name: string;
  flag: string;
}

const customStyles: StylesConfig<CountryOption, false> = {
  control: (provided) => ({
    ...provided,
    backgroundColor: '#E9F2F5',
    border: 'none',
    borderRadius: '0.5rem',
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

export default function CountrySelect({
  id,
  name,
  label,
  value,
  onChange,
  required = false,
  disabled = false,
  className = '',
}: CountrySelectProps) {
  const t = useTranslations('auth.register');

  const countries = useMemo(() => {
    return (countriesData as Country[]).map((country: Country) => ({
      value: country.name,
      label: `${country.flag} ${country.name}`,
    }));
  }, []);

  const selectedOption =
    countries.find((country: CountryOption) => country.value === value) || null;

  const handleChange = (option: CountryOption | null) => {
    onChange(option ? option.value : '');
  };

  return (
    <div className={`relative ${className}`}>
      <Select
        instanceId={id}
        id={id}
        name={name}
        options={countries}
        value={selectedOption}
        onChange={handleChange}
        isDisabled={disabled}
        styles={customStyles}
        placeholder={t('countryPlaceholder')}
        isSearchable
        className="react-select-container"
        classNamePrefix="react-select"
      />
      <label htmlFor={id} className="absolute left-4 top-2 z-10 pointer-events-none">
        <ThemedText fontSize={12} fontWeight={500} className="text-gray-700">
          {label}
          {required && <span className="text-red-500">*</span>}
        </ThemedText>
      </label>
    </div>
  );
}
