'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ThemedText } from '@/components/ThemedText';
import Button from '@/components/Button';
import Input from '@/components/Input';
import CountrySelect from '@/components/CountrySelect';
import AuthContainer from '@/components/AuthContainer';
import { Link } from '@/i18n/routing';

export default function InstitutionRegisterPage() {
  const router = useRouter();
  const t = useTranslations('auth.register');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    country: '',
    description: '',
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
        const phoneRegex = /^\+\d{10,15}$/;
        if (!phoneRegex.test(value))
          return 'Phone must start with + and contain 10-15 digits (e.g., +628123456789)';
        return '';

      case 'country':
        if (!value) return 'Please select a country';
        return '';

      case 'description':
        if (!value.trim()) return 'Description is required';
        if (value.trim().length < 10) return 'Description must be at least 10 characters';
        return '';

      case 'website':
        if (!value.trim()) return 'Website is required';
        try {
          new URL(value);
          return '';
        } catch {
          return 'Please enter a valid URL (e.g., https://example.com)';
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
      // Store form data in sessionStorage to pass to next step
      sessionStorage.setItem('registrationData', JSON.stringify(formData));

      // Redirect to seed phrase generation page
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
            <Input
              id="phone"
              name="phone"
              type="tel"
              label="Phone Number"
              placeholder="+62 123 4567 8900"
              value={formData.phone}
              onChange={handleChange}
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

        {/* Row 3: Description (Full Width) */}
        <div className="relative">
          <textarea
            id="description"
            name="description"
            placeholder="John Doe"
            value={formData.description}
            onChange={handleChange}
            onBlur={handleBlur}
            required
            disabled={loading}
            rows={4}
            className="text-black w-full px-4 pt-7 pb-3 bg-[#E9F2F5] rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-[#0D2B45] disabled:opacity-50 disabled:cursor-not-allowed resize-none text-sm"
          />
          <label htmlFor="description" className="absolute top-2 left-4">
            <ThemedText fontSize={12} fontWeight={500} className="text-gray-700">
              Description<span className="text-red-500">*</span>
            </ThemedText>
          </label>
          {validationErrors.description && (
            <ThemedText fontSize={12} className="text-red-500 mt-1 block">
              {validationErrors.description}
            </ThemedText>
          )}
        </div>

        {/* Row 4: Website (Full Width) */}
        <div>
          <Input
            id="website"
            name="website"
            type="url"
            label="Website"
            placeholder="https://johndoe.com"
            value={formData.website}
            onChange={handleChange}
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
