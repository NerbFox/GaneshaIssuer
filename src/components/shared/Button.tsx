import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  className?: string;
  fullWidth?: boolean;
}

export default function Button({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  disabled = false,
  className = '',
  fullWidth = false,
}: ButtonProps) {
  const baseStyles =
    'rounded-xl py-3 px-6 font-medium transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

  const variantStyles = {
    primary: 'bg-[#0D2B45] text-white hover:opacity-90',
    secondary: 'bg-[#E9F2F5] text-gray-800 hover:bg-[#DDE8EB]',
    outline: 'border-2 border-[#0D2B45] text-[#0D2B45] hover:bg-[#0D2B45] hover:text-white',
  };

  const widthStyles = fullWidth ? 'w-full' : '';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variantStyles[variant]} ${widthStyles} ${className}`}
    >
      {children}
    </button>
  );
}
