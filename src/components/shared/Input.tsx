import React from 'react';

interface InputProps {
  id: string;
  name: string;
  type?: 'text' | 'email' | 'password' | 'tel' | 'url';
  label: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export default function Input({
  id,
  name,
  type = 'text',
  label,
  placeholder,
  value,
  onChange,
  required = false,
  disabled = false,
  className = '',
}: InputProps) {
  return (
    <div className={`relative ${className}`}>
      <input
        type={type}
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full px-4 pt-8 pb-2 bg-[#E9F2F5] border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D2B45] text-black disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ fontSize: '14px' }}
      />
      <label
        htmlFor={id}
        className="absolute left-4 top-2 text-xs font-medium text-xs font-medium text-gray-700"
      >
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
    </div>
  );
}
