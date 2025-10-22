import InstitutionLayout from '@/components/InstitutionLayout';

export default function InstitutionPage() {
  return (
    <InstitutionLayout activeTab="dashboard">
      {/* Dashboard Content */}
      <div className="p-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Dashboard</h1>
        
        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📄</span>
              </div>
            </div>
            <h3 className="text-gray-500 text-sm font-medium">Total Issued</h3>
            <p className="text-3xl font-bold text-gray-900 mt-1">1,234</p>
          </div>

          <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📋</span>
              </div>
            </div>
            <h3 className="text-gray-500 text-sm font-medium">Pending Requests</h3>
            <p className="text-3xl font-bold text-gray-900 mt-1">45</p>
          </div>

          <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">✅</span>
              </div>
            </div>
            <h3 className="text-gray-500 text-sm font-medium">Verified</h3>
            <p className="text-3xl font-bold text-gray-900 mt-1">892</p>
          </div>

          <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📊</span>
              </div>
            </div>
            <h3 className="text-gray-500 text-sm font-medium">Active Schemas</h3>
            <p className="text-3xl font-bold text-gray-900 mt-1">12</p>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="flex items-center gap-4 pb-4 border-b border-gray-200 last:border-0">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                  <span>📝</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    Credential issued to John Doe
                  </p>
                  <p className="text-xs text-gray-500">2 hours ago</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </InstitutionLayout>
  );
}