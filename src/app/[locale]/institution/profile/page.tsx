import InstitutionLayout from '@/components/InstitutionLayout';
import { ThemedText } from '@/components/ThemedText';

export default function InstitutionProfilePage() {
  return (
    <InstitutionLayout activeTab="profile">
      {/* Profile Content */}
      <div className="p-12 max-w-4xl">
        <ThemedText fontSize={40} fontWeight={700}  className="text-black mb-12">Profile</ThemedText>
        
        {/* Institution Name Field */}
        <div className="mt-5 mb-5">
          <ThemedText className="block text-sm font-medium text-gray-900 mb-3">
            Institution Name
          </ThemedText>
          <input
            type="text"
            value="Dinas Kependudukan dan Pencatatan Sipil"
            readOnly
            className="w-full px-4 py-3 bg-[#F4F7FC] border border-gray-200 rounded-lg text-gray-500 text-sm"
          />
        </div>

        {/* Email Field */}
        <div className="mb-5">
          <ThemedText className="block text-sm font-medium text-gray-900 mb-3">
            Email
          </ThemedText>
          <input
            type="email"
            value="info@disdukcapil.go.id"
            readOnly
            className="w-full px-4 py-3 bg-[#F4F7FC] border border-gray-200 rounded-lg text-gray-500 text-sm"
          />
        </div>

        {/* Phone Number Field */}
        <div className="mb-5">
          <ThemedText className="block text-sm font-medium text-gray-900 mb-3">
            Phone Number
          </ThemedText>
          <input
            type="tel"
            value="+6221-234567"
            readOnly
            className="w-full px-4 py-3 bg-[#F4F7FC] border border-gray-200 rounded-lg text-gray-500 text-sm"
          />
        </div>

        {/* Country Field */}
        <div className="mb-5">
          <ThemedText className="block text-sm font-medium text-gray-900 mb-3">
            Country
          </ThemedText>
          <input
            type="text"
            value="Indonesia"
            readOnly
            className="w-full px-4 py-3 bg-[#F4F7FC] border border-gray-200 rounded-lg text-gray-500 text-sm"
          />
        </div>

        {/* Address Field */}
        <div className="mb-5">
          <ThemedText className="block text-sm font-medium text-gray-900 mb-3">
            Address
          </ThemedText>
          <input
            type="text"
            value="Jl. Raya Jakarta"
            readOnly
            className="w-full px-4 py-3 bg-[#F4F7FC] border border-gray-200 rounded-lg text-gray-500 text-sm"
          />
        </div>

        {/* Website Field */}
        <div className="mb-5">
          <ThemedText className="block text-sm font-medium text-gray-900 mb-3">
            Website
          </ThemedText>
          <input
            type="text"
            value="disdukcapil.go.id"
            readOnly
            className="w-full px-4 py-3 bg-[#F4F7FC] border border-gray-200 rounded-lg text-gray-500 text-sm"
          />
        </div>

        {/* DID Field */}
        <div className="mb-5">
          <ThemedText className="block text-sm font-medium text-gray-900 mb-3">
            DID
          </ThemedText>
          <input
            type="text"
            value="did:git:iabcdefghijklmnopqrstuvwxyz1234567890"
            readOnly
            className="w-full px-4 py-3 bg-[#F4F7FC] border border-gray-200 rounded-lg text-gray-500 text-sm"
          />
        </div>
      </div>
    </InstitutionLayout>
  );
}
