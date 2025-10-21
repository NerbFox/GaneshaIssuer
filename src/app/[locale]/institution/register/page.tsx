'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { ThemedText } from '@/components/ThemedText';
import Button from '@/components/Button';
import Input from '@/components/Input';
import CountrySelect from '@/components/CountrySelect';
import PageHeader from '@/components/PageHeader';
import { Link } from '@/i18n/routing';
import { buildApiUrl, API_ENDPOINTS } from '@/utils/api';

export default function InstitutionRegisterPage() {
  const router = useRouter();
  const t = useTranslations('auth.register');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    country: '',
    website: '',
    address: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Validate institution name (at least 3 characters)
    if (formData.name.trim().length < 3) {
      errors.name = 'Institution name must be at least 3 characters';
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    // Validate phone (must start with + and contain only digits after)
    const phoneRegex = /^\+\d{10,15}$/;
    if (!phoneRegex.test(formData.phone)) {
      errors.phone = 'Phone must start with + and contain 10-15 digits (e.g., +628123456789)';
    }

    // Validate country
    if (!formData.country) {
      errors.country = 'Please select a country';
    }

    // Validate website URL
    const urlRegex = /^https?:\/\/.+\..+/;
    if (!urlRegex.test(formData.website)) {
      errors.website = 'Please enter a valid website URL (e.g., https://example.com)';
    }

    // Validate address (at least 10 characters)
    if (formData.address.trim().length < 10) {
      errors.address = 'Address must be at least 10 characters';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
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
      const response = await fetch(buildApiUrl(API_ENDPOINTS.AUTH.REGISTER), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || t('registrationFailed'));
      }

      // Redirect to success page or show success message
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

    // Clear validation error for this field when user starts typing
    if (validationErrors[name]) {
      setValidationErrors({
        ...validationErrors,
        [name]: '',
      });
    }
  };

  const handleCountryChange = (value: string) => {
    setFormData({
      ...formData,
      country: value,
    });

    // Clear validation error for country when user selects
    if (validationErrors.country) {
      setValidationErrors({
        ...validationErrors,
        country: '',
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#0D2B45] flex items-center justify-center relative py-28 px-4">
      <PageHeader backHref="/institution/setup" />

      <div className="bg-white rounded-4xl w-full max-w-5xl shadow-xl p-8 md:p-12 relative z-10">
        {/* Logo top-right */}
        <div className="flex justify-end mb-6">
          <div className="flex items-center">
            <Image src="/GWallet.svg" width={50} height={50} alt="GaneshaWallet Logo" />
            <ThemedText fontSize={20} fontWeight={700} className="pl-2 text-[#0C2D48]">
              GaneshaWallet
            </ThemedText>
          </div>
        </div>

        {/* Title at the top */}
        <div className="text-center mb-8">
          <ThemedText fontSize={40} fontWeight={700} className="text-black mb-2 block">
            {t('title')}
          </ThemedText>
          <ThemedText fontSize={16} className="text-gray-600 block">
            {t('subtitle')}
          </ThemedText>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <ThemedText fontSize={14}>{error}</ThemedText>
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Form Fields in 2 columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Input
                id="name"
                name="name"
                type="text"
                label={t('name')}
                placeholder={t('namePlaceholder')}
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
                label={t('email')}
                placeholder={t('emailPlaceholder')}
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

            <div>
              <Input
                id="phone"
                name="phone"
                type="tel"
                label={t('phone')}
                placeholder={t('phonePlaceholder')}
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
                label={t('country')}
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

            <div>
              <Input
                id="website"
                name="website"
                type="url"
                label={t('website')}
                placeholder={t('websitePlaceholder')}
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

            {/* Address Field - Full Width */}
            <div className="md:col-span-2">
              <div className="relative">
                <textarea
                  name="address"
                  required
                  rows={3}
                  value={formData.address}
                  onChange={handleChange}
                  className="w-full px-4 pt-8 pb-2 bg-[#E9F2F5] border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D2B45] text-black resize-none"
                  style={{ fontSize: '14px' }}
                  placeholder={t('addressPlaceholder')}
                  disabled={loading}
                />
                <label className="absolute left-4 top-2">
                  <ThemedText fontSize={12} fontWeight={500} className="text-gray-700">
                    {t('address')}
                    <span className="text-red-500">*</span>
                  </ThemedText>
                </label>
              </div>
              {validationErrors.address && (
                <ThemedText fontSize={12} className="text-red-500 mt-1 block">
                  {validationErrors.address}
                </ThemedText>
              )}
            </div>
          </div>

          {/* Privacy Policy Notice */}
          <div className="text-center pt-2">
            <ThemedText fontSize={12} className="text-gray-600">
              {t.rich('privacyPolicy', {
                terms: (chunks) => (
                  <Link href="/terms" className="text-[#0D2B45] hover:underline font-medium">
                    {chunks}
                  </Link>
                ),
                privacy: (chunks) => (
                  <Link href="/privacy" className="text-[#0D2B45] hover:underline font-medium">
                    {chunks}
                  </Link>
                ),
              })}
            </ThemedText>
          </div>

          {/* Login Link */}
          <div className="text-center">
            <ThemedText fontSize={12} className="text-gray-600">
              {t('alreadyHaveAccount')}{' '}
              <Link
                href="/institution/login"
                className="text-[#0D2B45] hover:underline font-medium"
              >
                {t('loginHere')}
              </Link>
            </ThemedText>
          </div>

          {/* Submit Button */}
          <Button type="submit" variant="primary" fullWidth disabled={loading}>
            {loading ? t('processing') : t('registerButton')}
          </Button>
        </form>
      </div>
    </div>
  );
}
