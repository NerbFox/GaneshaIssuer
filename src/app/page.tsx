import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">GaneshaDCERT</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/register" className="text-gray-700 hover:text-gray-900 px-3 py-2">
                Registrasi
              </Link>
              <Link href="/admin" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                Admin
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Selamat Datang di GaneshaDCERT
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Sistem Autentikasi Magic Link untuk Institusi
          </p>
          
          <div className="flex justify-center space-x-4 mb-12">
            <Link href="/register" className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 shadow-lg">
              Daftar Sekarang
            </Link>
            <Link href="/admin" className="bg-white text-blue-600 px-8 py-3 rounded-lg text-lg font-semibold hover:bg-gray-50 shadow-lg border-2 border-blue-600">
              Admin Panel
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="text-blue-600 mb-4">
                <svg className="h-12 w-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">1. Registrasi</h3>
              <p className="text-gray-600">
                Daftarkan institusi Anda dengan mengisi formulir registrasi
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="text-green-600 mb-4">
                <svg className="h-12 w-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">2. Persetujuan Admin</h3>
              <p className="text-gray-600">
                Admin akan meninjau dan menyetujui pendaftaran Anda
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="text-purple-600 mb-4">
                <svg className="h-12 w-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">3. Magic Link</h3>
              <p className="text-gray-600">
                Terima magic link di email dan login tanpa password
              </p>
            </div>
          </div>
        </div>
      </div>

      <footer className="bg-white border-t border-gray-200 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-gray-600">
            © 2025 GaneshaDCERT. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
