'use client'

import { useState, useEffect } from 'react'

export default function TestPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('Fetching Shopify data...')
        const response = await fetch('/api/shopify/products')
        console.log('Response status:', response.status)
        const contentType = response.headers.get('content-type');
        if (response.ok && contentType && contentType.includes('application/json')) {
          const result = await response.json()
          console.log('Data received:', result)
          setData(result)
        } else {
          const text = await response.text();
          console.error('Failed to fetch products:', response.status, response.statusText, text);
          setError(text || `HTTP error! status: ${response.status}`)
        }
      } catch (err) {
        console.error('Error:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return <div>Loading...</div>
  }

  if (error) {
    return <div>Error: {error}</div>
  }

  return (
    <div>
      <h1>Shopify API Test</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  )
} 