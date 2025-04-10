"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface Ingredient {
  source: 'Gilmours' | 'Bidfood' | 'Other' | 'Components' | 'Products'
  id: string
  name: string
  quantity: number
  cost: number
  unit: string
}

interface IngredientSelectorProps {
  onIngredientsChange: (ingredients: Ingredient[]) => void
  initialIngredients?: Ingredient[]
}

export function IngredientSelector({ onIngredientsChange, initialIngredients = [] }: IngredientSelectorProps) {
  const [ingredients, setIngredients] = useState<Ingredient[]>(initialIngredients)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch search results when search term changes
  useEffect(() => {
    const searchIngredients = async () => {
      if (!searchTerm) {
        setSearchResults([])
        return
      }

      setLoading(true)
      setError(null)

      try {
        // Search across all sources
        const sources = ['Gilmours', 'Bidfood', 'Other', 'Components', 'Products']
        const results = await Promise.all(
          sources.map(async (source) => {
            let endpoint = ''
            switch (source) {
              case 'Gilmours':
                endpoint = '/api/gilmours'
                break
              case 'Bidfood':
                endpoint = '/api/bidfood'
                break
              case 'Other':
                endpoint = '/api/other'
                break
              case 'Components':
                endpoint = '/api/components'
                break
              case 'Products':
                endpoint = '/api/products'
                break
            }

            try {
              const response = await fetch(endpoint)
              if (!response.ok) {
                console.warn(`Failed to fetch ${source} items`)
                return []
              }

              const data = await response.json()
              return data
                .filter((item: any) => 
                  item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  item.description?.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map((item: any) => ({
                  ...item,
                  source: source as Ingredient['source']
                }))
            } catch (err) {
              console.warn(`Error fetching ${source} items:`, err)
              return []
            }
          })
        )

        // Flatten and deduplicate results
        const allResults = results.flat()
        const uniqueResults = Array.from(
          new Map(allResults.map(item => [item.id, item])).values()
        )
        setSearchResults(uniqueResults)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to search ingredients')
      } finally {
        setLoading(false)
      }
    }

    const debounceTimer = setTimeout(searchIngredients, 300)
    return () => clearTimeout(debounceTimer)
  }, [searchTerm])

  const addIngredient = (item: any) => {
    const newIngredient: Ingredient = {
      source: item.source,
      id: item.id,
      name: item.name || item.description,
      quantity: 1,
      cost: item.price || item.cost || item.lastPricePaid || 0,
      unit: item.uom || 'unit',
    }

    const updatedIngredients = [...ingredients, newIngredient]
    setIngredients(updatedIngredients)
    onIngredientsChange(updatedIngredients)
    setSearchTerm('')
    setSearchResults([])
  }

  const updateIngredientQuantity = (index: number, value: string) => {
    // Allow empty value to be set
    if (value === '') {
      const updatedIngredients = [...ingredients]
      updatedIngredients[index] = {
        ...updatedIngredients[index],
        quantity: 0,
      }
      setIngredients(updatedIngredients)
      onIngredientsChange(updatedIngredients)
      return
    }

    // Parse as float to support decimal values
    const quantity = parseFloat(value)
    if (isNaN(quantity)) return

    const updatedIngredients = [...ingredients]
    updatedIngredients[index] = {
      ...updatedIngredients[index],
      quantity,
    }
    setIngredients(updatedIngredients)
    onIngredientsChange(updatedIngredients)
  }

  const updateIngredientCost = (index: number, value: string) => {
    const cost = parseFloat(value)
    if (isNaN(cost)) return

    const updatedIngredients = [...ingredients]
    updatedIngredients[index] = {
      ...updatedIngredients[index],
      cost,
    }
    setIngredients(updatedIngredients)
    onIngredientsChange(updatedIngredients)
  }

  const removeIngredient = (index: number) => {
    const updatedIngredients = ingredients.filter((_, i) => i !== index)
    setIngredients(updatedIngredients)
    onIngredientsChange(updatedIngredients)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="flex-1">
          <Label htmlFor="search">Search Ingredients</Label>
          <Input
            id="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, description, or code..."
          />
        </div>
      </div>

      {loading && <div>Loading...</div>}
      {error && <div className="text-red-500">{error}</div>}

      {searchResults.length > 0 && (
        <div className="w-[600px] max-h-[400px] overflow-y-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Code/SKU</TableHead>
                <TableHead className="w-[200px]">Name</TableHead>
                <TableHead className="w-[100px]">Source</TableHead>
                <TableHead className="w-[100px]">Price</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {searchResults.map((result) => (
                <TableRow key={`${result.source}-${result.id}`}>
                  <TableCell className="max-w-[100px]">
                    <div className="truncate" title={result.sku || result.productCode || result.id}>
                      {result.sku || result.productCode || result.id}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <div className="truncate" title={result.name || result.description}>
                      {result.name || result.description}
                    </div>
                  </TableCell>
                  <TableCell>{result.source}</TableCell>
                  <TableCell>
                    ${(result.price || result.cost || result.lastPricePaid || 0).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addIngredient(result)}
                    >
                      Add
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {ingredients.length > 0 && (
        <div className="w-full">
          <Label>Selected Ingredients</Label>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ingredients.map((ingredient, index) => (
                <TableRow key={`${ingredient.source}-${ingredient.id}`}>
                  <TableCell className="max-w-[200px]">
                    <div className="truncate" title={ingredient.name}>
                      {ingredient.name}
                    </div>
                  </TableCell>
                  <TableCell>{ingredient.source}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      value={ingredient.quantity}
                      onChange={(e) => updateIngredientQuantity(index, e.target.value)}
                      className="w-20"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={ingredient.cost}
                      onChange={(e) => updateIngredientCost(index, e.target.value)}
                      className="w-24"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeIngredient(index)}
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
} 