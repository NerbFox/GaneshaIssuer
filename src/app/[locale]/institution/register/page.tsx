'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ThemedText } from '@/components/ThemedText';
import Button from '@/components/Button';
import Input from '@/components/Input';
import CountrySelect from '@/components/CountrySelect';
import PhoneInput from '@/components/PhoneInput';
import WebsiteInput from '@/components/WebsiteInput';
import AuthContainer from '@/components/AuthContainer';
import { Link } from '@/i18n/routing';
import { buildApiUrl, API_ENDPOINTS } from '@/utils/api';

export default function InstitutionRegisterPage() {
  const router = useRouter();
  const t = useTranslations('auth.register');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    phonePrefix: '+62',
    country: '',
    address: '',
    website: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validateField = (name: string, value: string): string => {
    switch (name) {
      case 'name':
        if (!value.trim()) return 'Institution name is required';
        if (value.trim().length < 3) return 'Institution name must be at least 3 characters';
        return '';

      case 'email':
        if (!value.trim()) return 'Email is required';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) return 'Please enter a valid email address';
        return '';

      case 'phone':
        if (!value.trim()) return 'Phone number is required';
        // Only validate the numeric part (without prefix)
        const phoneRegex = /^\d{8,15}$/;
        const cleanPhone = value.replace(/\s/g, '');
        if (!phoneRegex.test(cleanPhone)) return 'Phone must contain 8-15 digits (spaces allowed)';
        return '';

      case 'country':
        if (!value) return 'Please select a country';
        return '';

      case 'address':
        if (!value.trim()) return 'Address is required';
        if (value.trim().length < 10) return 'Address must be at least 10 characters';
        return '';

      case 'website':
        if (!value.trim()) return 'Website is required';
        try {
          // Add https:// prefix for validation
          new URL(`https://${value}`);
          // Check if it's a valid domain format
          const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-_.]*\.[a-zA-Z]{2,}$/;
          if (!domainRegex.test(value.trim())) {
            return 'Please enter a valid domain (e.g., example.com)';
          }
          return '';
        } catch {
          return 'Please enter a valid domain (e.g., example.com)';
        }

      default:
        return '';
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    Object.keys(formData).forEach((key) => {
      const error = validateField(key, formData[key as keyof typeof formData]);
      if (error) errors[key] = error;
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const isFormValid = (): boolean => {
    return Object.keys(formData).every((key) => {
      const value = formData[key as keyof typeof formData];
      return validateField(key, value) === '';
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    // Validate form before submission
    if (!validateForm()) {
      setError('Please fix the validation errors below');
      return;
    }

    setLoading(true);

    try {
      // Send registration data to backend
      const response = await fetch(buildApiUrl(API_ENDPOINTS.AUTH.REGISTER), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          // Combine prefix and phone number for backend
          phone: `${formData.phonePrefix}${formData.phone.replace(/\s/g, '')}`,
          // Add https:// prefix to website
          website: `https://${formData.website}`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || t('registrationFailed'));
      }

      // Redirect to success page
      router.push('/institution/register/success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('registrationFailed');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });

    // Validate field in real-time
    const error = validateField(name, value);
    setValidationErrors({
      ...validationErrors,
      [name]: error,
    });
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    // Validate field on blur
    const error = validateField(name, value);
    setValidationErrors({
      ...validationErrors,
      [name]: error,
    });
  };

  const handleCountryChange = (value: string) => {
    setFormData({
      ...formData,
      country: value,
    });

    // Validate country in real-time
    const error = validateField('country', value);
    setValidationErrors({
      ...validationErrors,
      country: error,
    });
  };

  const handlePhonePrefixChange = (prefix: string) => {
    setFormData({
      ...formData,
      phonePrefix: prefix,
    });
  };

  return (
    <AuthContainer backHref="/institution">
      {/* Title */}
      <div className="mb-8">
        <ThemedText fontSize={32} fontWeight={700} className="text-black mb-1 block">
          Create an Account
        </ThemedText>
        <ThemedText fontSize={16} className="text-gray-600 block">
          Get an account to get started
        </ThemedText>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <ThemedText fontSize={14}>{error}</ThemedText>
        </div>
      )}

      {/* Registration Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Row 1: Institution Name + Email */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Input
              id="name"
              name="name"
              type="text"
              label="Institution Name"
              placeholder="John Doe"
              value={formData.name}
              onChange={handleChange}
              required
              disabled={loading}
            />
            {validationErrors.name && (
              <ThemedText fontSize={12} className="text-red-500 mt-1 block">
                {validationErrors.name}
              </ThemedText>
            )}
          </div>

          <div>
            <Input
              id="email"
              name="email"
              type="email"
              label="Email"
              placeholder="jdoe@gmail.com"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={loading}
            />
            {validationErrors.email && (
              <ThemedText fontSize={12} className="text-red-500 mt-1 block">
                {validationErrors.email}
              </ThemedText>
            )}
          </div>
        </div>

        {/* Row 2: Phone Number + Country */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <PhoneInput
              id="phone"
              name="phone"
              label="Phone Number"
              placeholder="123 4567 8900"
              value={formData.phone}
              prefix={formData.phonePrefix}
              onValueChange={(value) => {
                setFormData({ ...formData, phone: value });
                const error = validateField('phone', value);
                setValidationErrors({ ...validationErrors, phone: error });
              }}
              onPrefixChange={handlePhonePrefixChange}
              onBlur={handleBlur}
              required
              disabled={loading}
            />
            {validationErrors.phone && (
              <ThemedText fontSize={12} className="text-red-500 mt-1 block">
                {validationErrors.phone}
              </ThemedText>
            )}
          </div>

          <div>
            <CountrySelect
              id="country"
              name="country"
              label="Country"
              value={formData.country}
              onChange={handleCountryChange}
              required
              disabled={loading}
            />
            {validationErrors.country && (
              <ThemedText fontSize={12} className="text-red-500 mt-1 block">
                {validationErrors.country}
              </ThemedText>
            )}
          </div>
        </div>

        {/* Row 3: Address (Full Width) */}
        <div className="relative">
          <textarea
            id="address"
            name="address"
            placeholder="Kampus UI Depok, Jawa Barat 16424"
            value={formData.address}
            onChange={handleChange}
            onBlur={handleBlur}
            required
            disabled={loading}
            rows={4}
            className="text-black w-full px-4 pt-8 pb-2 bg-[#E9F2F5] rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-[#0D2B45] disabled:opacity-50 disabled:cursor-not-allowed resize-none"
            style={{ fontSize: '14px' }}
          />
          <label htmlFor="address" className="absolute top-2 left-4">
            <ThemedText fontSize={12} fontWeight={500} className="text-gray-700">
              Address<span className="text-red-500">*</span>
            </ThemedText>
          </label>
          {validationErrors.address && (
            <ThemedText fontSize={12} className="text-red-500 mt-1 block">
              {validationErrors.address}
            </ThemedText>
          )}
        </div>

        {/* Row 4: Website (Full Width) */}
        <div>
          <WebsiteInput
            id="website"
            name="website"
            label="Website"
            placeholder="example.com"
            value={formData.website}
            onChange={(value) => {
              setFormData({ ...formData, website: value });
              const error = validateField('website', value);
              setValidationErrors({ ...validationErrors, website: error });
            }}
            onBlur={(e) => {
              const error = validateField('website', e.target.value);
              setValidationErrors({ ...validationErrors, website: error });
            }}
            required
            disabled={loading}
          />
          {validationErrors.website && (
            <ThemedText fontSize={12} className="text-red-500 mt-1 block">
              {validationErrors.website}
            </ThemedText>
          )}
        </div>

        {/* Privacy Policy Text */}
        <div className="text-center pt-2">
          <ThemedText fontSize={12} className="text-gray-600">
            By continuing, you agree to the{' '}
            <Link href="/privacy" className="text-[#0D73BA] hover:underline">
              Privacy Policy
            </Link>
          </ThemedText>
        </div>

        {/* Submit Button */}
        <Button type="submit" variant="primary" fullWidth disabled={loading || !isFormValid()}>
          {loading ? 'Processing...' : 'Continue'}
        </Button>
      </form>
    </AuthContainer>
  );
}
