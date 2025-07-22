import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            CaterStation
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Professional catering management system
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link 
            href="/orders" 
            className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow duration-300 border border-gray-200"
          >
            <div className="text-center">
              <div className="text-3xl mb-4">📋</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Orders</h3>
              <p className="text-gray-600">Manage and track customer orders</p>
            </div>
          </Link>

          <Link 
            href="/realtime-orders" 
            className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow duration-300 border border-gray-200"
          >
            <div className="text-center">
              <div className="text-3xl mb-4">⚡</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Real-time Orders</h3>
              <p className="text-gray-600">Live order tracking and management</p>
            </div>
          </Link>

          <Link 
            href="/products" 
            className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow duration-300 border border-gray-200"
          >
            <div className="text-center">
              <div className="text-3xl mb-4">🍽️</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Products</h3>
              <p className="text-gray-600">Manage product catalog and rules</p>
            </div>
          </Link>

          <Link 
            href="/roster" 
            className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow duration-300 border border-gray-200"
          >
            <div className="text-center">
              <div className="text-3xl mb-4">👥</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Roster</h3>
              <p className="text-gray-600">Staff scheduling and management</p>
            </div>
          </Link>

          <Link 
            href="/staff" 
            className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow duration-300 border border-gray-200"
          >
            <div className="text-center">
              <div className="text-3xl mb-4">👤</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Staff</h3>
              <p className="text-gray-600">Employee management and profiles</p>
            </div>
          </Link>

          <Link 
            href="/timesheet" 
            className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow duration-300 border border-gray-200"
          >
            <div className="text-center">
              <div className="text-3xl mb-4">⏰</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Timesheet</h3>
              <p className="text-gray-600">Time tracking and payroll</p>
            </div>
          </Link>
        </div>

        <div className="text-center mt-12">
          <div className="inline-flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
            System Online - Firestore Connected
          </div>
        </div>
      </div>
    </div>
  );
}
