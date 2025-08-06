'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface TableInfo {
  table_name: string;
  row_count: number;
}

interface QueryResult {
  columns: string[];
  rows: any[];
  rowCount: number;
  executionTime: number;
}

export default function DatabaseAdminPage() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [customQuery, setCustomQuery] = useState<string>('');
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/database/tables');
      if (!response.ok) throw new Error('Failed to fetch tables');
      const data = await response.json();
      setTables(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tables');
    } finally {
      setLoading(false);
    }
  };

  const executeQuery = async (query: string) => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch('/api/admin/database/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Query failed');
      }
      
      const data = await response.json();
      setQueryResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query failed');
      setQueryResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleTableSelect = (tableName: string) => {
    setSelectedTable(tableName);
    const query = `SELECT * FROM "${tableName}" LIMIT 100`;
    setCustomQuery(query);
    executeQuery(query);
  };

  const handleCustomQuery = () => {
    if (customQuery.trim()) {
      executeQuery(customQuery);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Database Admin</h1>
        <Badge variant="outline">Railway PostgreSQL</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tables List */}
        <Card>
          <CardHeader>
            <CardTitle>Database Tables</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-4">Loading tables...</div>
            ) : (
              <div className="space-y-2">
                {tables.map((table) => (
                  <Button
                    key={table.table_name}
                    variant={selectedTable === table.table_name ? "default" : "outline"}
                    className="w-full justify-between"
                    onClick={() => handleTableSelect(table.table_name)}
                  >
                    <span>{table.table_name}</span>
                    <Badge variant="secondary">{table.row_count}</Badge>
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Query Editor */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>SQL Query Editor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="query">SQL Query</Label>
              <Textarea
                id="query"
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                placeholder="SELECT * FROM users LIMIT 10;"
                className="min-h-[120px] font-mono"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCustomQuery} disabled={loading}>
                {loading ? 'Executing...' : 'Execute Query'}
              </Button>
              <Button variant="outline" onClick={() => setCustomQuery('')}>
                Clear
              </Button>
            </div>
            
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      {queryResult && (
        <Card>
          <CardHeader>
            <CardTitle>
              Query Results
              <Badge variant="outline" className="ml-2">
                {queryResult.rowCount} rows in {queryResult.executionTime}ms
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    {queryResult.columns.map((column) => (
                      <th key={column} className="border border-gray-200 px-3 py-2 text-left text-sm font-medium">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {queryResult.rows.map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      {queryResult.columns.map((column) => (
                        <td key={column} className="border border-gray-200 px-3 py-2 text-sm">
                          {row[column] !== null && row[column] !== undefined 
                            ? String(row[column])
                            : <span className="text-gray-400">null</span>
                          }
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 