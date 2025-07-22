'use client'

import { StockPanel } from './StockPanel'

export function StockPanelDemo() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold mb-4">Stock Panel Component Examples</h1>
        <p className="text-gray-600 mb-6">
          The StockPanel component is designed to be reusable across different pages with various configurations.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Example 1: Basic usage */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Basic Stock Panel</h2>
          <StockPanel />
        </div>

        {/* Example 2: Auto-refresh enabled */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Auto-refresh (30s)</h2>
          <StockPanel 
            autoRefresh={true}
            refreshInterval={30000}
          />
        </div>

        {/* Example 3: No refresh button */}
        <div>
          <h2 className="text-lg font-semibold mb-3">No Refresh Button</h2>
          <StockPanel 
            showRefreshButton={false}
          />
        </div>

        {/* Example 4: Custom styling */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Custom Styling</h2>
          <StockPanel 
            className="border-2 border-blue-200 shadow-lg"
            autoRefresh={true}
            refreshInterval={45000}
          />
        </div>
      </div>

      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Usage Examples</h3>
        <div className="space-y-2 text-sm">
          <div>
            <strong>Realtime Orders Page:</strong>
            <pre className="bg-white p-2 rounded mt-1 text-xs">
{`<StockPanel 
  autoRefresh={true}
  refreshInterval={60000} // Refresh every minute
  showRefreshButton={true}
/>`}
            </pre>
          </div>
          <div>
            <strong>Calendar Page:</strong>
            <pre className="bg-white p-2 rounded mt-1 text-xs">
{`<StockPanel 
  autoRefresh={false} // No auto-refresh
  showRefreshButton={true}
/>`}
            </pre>
          </div>
          <div>
            <strong>Dashboard Widget:</strong>
            <pre className="bg-white p-2 rounded mt-1 text-xs">
{`<StockPanel 
  showRefreshButton={false}
  className="h-64"
/>`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
} 