# StockPanel Component

A reusable stock management panel component that displays stock levels from multiple sources (Gilmours, Bidfood, Other Products, Components) with real-time updates and customizable behavior.

## Features

- **Real-time Data**: Fetches stock data from the `/api/stock` endpoint
- **Auto-refresh**: Configurable automatic refresh intervals
- **Manual Refresh**: Built-in refresh button with loading states
- **Error Handling**: Graceful error states with retry functionality
- **Responsive Design**: Adapts to different container sizes
- **Stock Status Indicators**: Color-coded quantities and low stock badges
- **Scrollable Content**: Handles large lists of stock items
- **Customizable**: Multiple configuration options for different use cases

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | `""` | Additional CSS classes for styling |
| `showRefreshButton` | `boolean` | `true` | Whether to show the refresh button |
| `autoRefresh` | `boolean` | `false` | Enable automatic refresh |
| `refreshInterval` | `number` | `30000` | Auto-refresh interval in milliseconds |

## Usage Examples

### Basic Usage
```tsx
import { StockPanel } from '@/components/StockPanel'

<StockPanel />
```

### Realtime Orders Page (Auto-refresh)
```tsx
<StockPanel 
  autoRefresh={true}
  refreshInterval={60000} // Refresh every minute
  showRefreshButton={true}
/>
```

### Calendar Page (Manual refresh only)
```tsx
<StockPanel 
  autoRefresh={false}
  showRefreshButton={true}
/>
```

### Dashboard Widget (No refresh button)
```tsx
<StockPanel 
  showRefreshButton={false}
  className="h-64"
/>
```

### Custom Styling
```tsx
<StockPanel 
  className="border-2 border-blue-200 shadow-lg"
  autoRefresh={true}
  refreshInterval={45000}
/>
```

## Data Structure

The component expects stock items with the following structure:

```typescript
interface StockItem {
  id: string
  name: string
  quantity: number
  unit: string
  lowStock: boolean
}
```

## API Integration

The component fetches data from `/api/stock` which aggregates data from:
- Gilmours products
- Bidfood products  
- Other products
- Components

## Styling

The component uses Tailwind CSS classes and includes:
- Loading states with spinners
- Error states with retry buttons
- Hover effects on stock items
- Color-coded quantity indicators
- Responsive design patterns

## Dependencies

- React hooks (useState, useEffect)
- Lucide React icons (Loader2, RefreshCw)
- UI components from @/components/ui
- Tailwind CSS for styling

## Implementation Notes

- Uses `useRef` for safe state access during initialization
- Implements proper cleanup for intervals
- Handles network errors gracefully
- Provides loading and error states
- Supports both manual and automatic refresh modes 