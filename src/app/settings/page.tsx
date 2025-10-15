'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MultiSelect, MultiSelectOption } from '@/components/ui/multi-select'
import { Loader2, Send, Settings as SettingsIcon, Mail, Edit3, Save, RefreshCw, Plus, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface EmailSetting {
  id: string
  name: string
  title: string
  description?: string
  recipientEmail: string
  isActive: boolean
}

interface Component {
  id: string
  name: string
  description?: string
  unit?: string
  cost?: number
  prepCategory?: string
  allergens?: string[]
  dietary?: string[]
  images?: any[]
  ingredients?: any[]
  instructions?: string
  hasGluten: boolean
  hasDairy: boolean
  hasSoy: boolean
  hasOnionGarlic: boolean
  hasSesame: boolean
  hasNuts: boolean
  hasEgg: boolean
  isVegetarian: boolean
  isVegan: boolean
  isHalal: boolean
}

interface OtherItem {
  id: string
  name: string
  description?: string
  supplier?: string
  cost?: number
  prepCategory?: string
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<EmailSetting[]>([])
  const [components, setComponents] = useState<Component[]>([])
  const [otherItems, setOtherItems] = useState<OtherItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [testingEmail, setTestingEmail] = useState(false)
  const [bulkSaving, setBulkSaving] = useState<'components' | 'other' | null>(null)
  const { toast } = useToast()

  // Load all data
  useEffect(() => {
    loadAllData()
  }, [])

  const loadAllData = async () => {
    try {
      await Promise.all([
        loadSettings(),
        loadComponents(),
        loadOtherItems()
      ])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/email-settings')
      if (res.ok) {
        const data = await res.json()
        setSettings(data.settings || [])
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    }
  }

  const loadComponents = async () => {
    try {
      const res = await fetch('/api/components')
      if (res.ok) {
        const data = await res.json()
        setComponents(data || [])
      }
    } catch (error) {
      console.error('Error loading components:', error)
    }
  }

  const loadOtherItems = async () => {
    try {
      const res = await fetch('/api/other')
      if (res.ok) {
        const data = await res.json()
        setOtherItems(data?.products || [])
      }
    } catch (error) {
      console.error('Error loading other items:', error)
    }
  }

  const updateSetting = async (id: string, recipientEmail: string, isActive: boolean) => {
    setSaving(id)
    try {
      const res = await fetch(`/api/email-settings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientEmail, isActive }),
      })

      if (res.ok) {
        toast({
          title: 'Success',
          description: 'Email setting updated',
        })
        loadSettings()
      } else {
        throw new Error('Failed to update')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update email setting',
        variant: 'destructive',
      })
    } finally {
      setSaving(null)
    }
  }

  const createDefaultSetting = async () => {
    setSaving('new')
    try {
      const res = await fetch('/api/email-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'WLG_3DAY_OUTLOOK',
          title: 'Email WLG 3 Day Orders',
          description: 'Daily email with today, tomorrow, and day after tomorrow WLG orders',
          recipientEmail: 'placeholder@example.com',
          isActive: false,
        }),
      })

      if (res.ok) {
        toast({
          title: 'Success',
          description: 'Email setting created',
        })
        loadSettings()
      } else {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create email setting',
        variant: 'destructive',
      })
    } finally {
      setSaving(null)
    }
  }

  const sendTestEmail = async () => {
    setTestingEmail(true)
    try {
      const recipientEmail = wlgSetting?.recipientEmail
      if (!recipientEmail || recipientEmail === 'placeholder@example.com') {
        toast({
          title: 'Error',
          description: 'Please configure a recipient email address first',
          variant: 'destructive',
        })
        return
      }

      const res = await fetch('/api/test-wlg-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientEmail }),
      })

      if (res.ok) {
        const data = await res.json()
        toast({
          title: 'Test Email Sent! 📧',
          description: `Email sent to ${recipientEmail} with ${data.today?.orderCount || 0} today, ${data.tomorrow?.orderCount || 0} tomorrow, ${data.dayAfter?.orderCount || 0} day after orders.`,
        })
      } else {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send test email')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send test email',
        variant: 'destructive',
      })
    } finally {
      setTestingEmail(false)
    }
  }

  const addNewComponent = () => {
    const newComponent: Component = {
      id: 'new',
      name: '',
      description: '',
      unit: '',
      cost: 0,
      prepCategory: '',
      allergens: [],
      dietary: [],
      images: [],
      ingredients: [],
      instructions: '',
      hasGluten: false,
      hasDairy: false,
      hasSoy: false,
      hasOnionGarlic: false,
      hasSesame: false,
      hasNuts: false,
      hasEgg: false,
      isVegetarian: false,
      isVegan: false,
      isHalal: false,
    }
    setComponents([...components, newComponent])
  }

  const addNewOtherItem = () => {
    const newItem: OtherItem = {
      id: 'new',
      name: '',
      description: '',
      supplier: '',
      cost: 0,
      prepCategory: '',
    }
    setOtherItems([...otherItems, newItem])
  }

  const updateComponent = (index: number, field: keyof Component, value: any) => {
    const updated = [...components]
    updated[index] = { ...updated[index], [field]: value }
    setComponents(updated)
  }

  const updateOtherItem = (index: number, field: keyof OtherItem, value: any) => {
    const updated = [...otherItems]
    updated[index] = { ...updated[index], [field]: value }
    setOtherItems(updated)
  }

  const removeComponent = (index: number) => {
    const updated = components.filter((_, i) => i !== index)
    setComponents(updated)
  }

  const removeOtherItem = (index: number) => {
    const updated = otherItems.filter((_, i) => i !== index)
    setOtherItems(updated)
  }

  const saveComponents = async () => {
    setBulkSaving('components')
    try {
      const res = await fetch('/api/bulk-update-components', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ components }),
      })

      if (res.ok) {
        const data = await res.json()
        toast({
          title: 'Success',
          description: data.message,
        })
        loadComponents()
      } else {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save components')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save components',
        variant: 'destructive',
      })
    } finally {
      setBulkSaving(null)
    }
  }

  const saveOtherItems = async () => {
    setBulkSaving('other')
    try {
      const res = await fetch('/api/bulk-update-other', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otherItems }),
      })

      if (res.ok) {
        const data = await res.json()
        toast({
          title: 'Success',
          description: data.message,
        })
        loadOtherItems()
      } else {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save other items')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save other items',
        variant: 'destructive',
      })
    } finally {
      setBulkSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  const wlgSetting = settings.find(s => s.name === 'WLG_3DAY_OUTLOOK')

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center gap-3 mb-6">
        <SettingsIcon className="h-8 w-8" />
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>

      <Tabs defaultValue="email" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email Automation
          </TabsTrigger>
          <TabsTrigger value="bulk-edit" className="flex items-center gap-2">
            <Edit3 className="h-4 w-4" />
            Bulk Edit
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="mt-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Email Automation
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure automated email notifications
                </p>
              </div>
              <Button
                onClick={sendTestEmail}
                disabled={testingEmail || !wlgSetting?.isActive || !wlgSetting?.recipientEmail || wlgSetting?.recipientEmail === 'placeholder@example.com'}
                className="flex items-center gap-2"
              >
                {testingEmail ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send Test Email
              </Button>
            </div>

            {!wlgSetting ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  No email settings configured yet
                </p>
                <Button
                  onClick={createDefaultSetting}
                  disabled={saving === 'new'}
                >
                  {saving === 'new' ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Create WLG 3-Day Outlook Setting
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="border rounded-lg p-4 bg-muted/50">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{wlgSetting.title}</h3>
                      {wlgSetting.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {wlgSetting.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="active-toggle" className="text-sm">
                        {wlgSetting.isActive ? 'Active' : 'Inactive'}
                      </Label>
                      <input
                        id="active-toggle"
                        type="checkbox"
                        checked={wlgSetting.isActive}
                        onChange={(e) =>
                          updateSetting(
                            wlgSetting.id,
                            wlgSetting.recipientEmail,
                            e.target.checked
                          )
                        }
                        className="h-4 w-4 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="recipient-email" className="text-sm font-medium">
                        Recipient Email Address
                      </Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          id="recipient-email"
                          type="email"
                          placeholder="Enter email address for daily WLG outlook"
                          value={wlgSetting.recipientEmail === 'placeholder@example.com' ? '' : wlgSetting.recipientEmail}
                          onChange={(e) => {
                            setSettings(
                              settings.map(s =>
                                s.id === wlgSetting.id
                                  ? { ...s, recipientEmail: e.target.value || 'placeholder@example.com' }
                                  : s
                              )
                            )
                          }}
                          className="flex-1"
                        />
                        <Button
                          onClick={() =>
                            updateSetting(
                              wlgSetting.id,
                              wlgSetting.recipientEmail,
                              wlgSetting.isActive
                            )
                          }
                          disabled={saving === wlgSetting.id}
                        >
                          {saving === wlgSetting.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Save'
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        This email will receive the daily WLG 3-day outlook at 9:00 AM
                      </p>
                    </div>

                    <div className="pt-4 border-t">
                      <h4 className="font-medium text-sm mb-2">Schedule</h4>
                      <p className="text-sm text-muted-foreground">
                        ⏰ Sends daily at <strong>9:00 AM</strong>
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        📧 Includes: Today's orders, Tomorrow's orders, and Day After Tomorrow's orders
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        🏙️ Filters: Wellington (WLG) orders only
                      </p>
                    </div>
                  </div>
                </div>

                {!wlgSetting.isActive && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm text-amber-800">
                      ⚠️ Email automation is currently <strong>inactive</strong>. Toggle it on above to start receiving daily emails.
                    </p>
                  </div>
                )}

                {wlgSetting.isActive && (wlgSetting.recipientEmail === 'placeholder@example.com' || !wlgSetting.recipientEmail) && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-800">
                      ❌ Please configure a recipient email address before activating.
                    </p>
                  </div>
                )}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="bulk-edit" className="mt-6 space-y-6">
          {/* Components Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Edit3 className="h-5 w-5" />
                    Components
                  </CardTitle>
                  <CardDescription>
                    Bulk edit all component properties
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button onClick={addNewComponent} variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Component
                  </Button>
                  <Button 
                    onClick={saveComponents} 
                    disabled={bulkSaving === 'components'}
                    className="flex items-center gap-2"
                  >
                    {bulkSaving === 'components' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save All Components
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 p-2 text-left text-sm font-medium">Name</th>
                      <th className="border border-gray-300 p-2 text-left text-sm font-medium">Description</th>
                      <th className="border border-gray-300 p-2 text-left text-sm font-medium">Unit</th>
                      <th className="border border-gray-300 p-2 text-left text-sm font-medium">Cost</th>
                      <th className="border border-gray-300 p-2 text-left text-sm font-medium">Prep Category</th>
                      <th className="border border-gray-300 p-2 text-left text-sm font-medium">Allergens</th>
                      <th className="border border-gray-300 p-2 text-left text-sm font-medium">Dietary</th>
                      <th className="border border-gray-300 p-2 text-left text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {components.map((component, index) => (
                      <tr key={component.id || index} className="hover:bg-gray-50">
                        <td className="border border-gray-300 p-2">
                          <Input
                            value={component.name}
                            onChange={(e) => updateComponent(index, 'name', e.target.value)}
                            className="min-w-[150px]"
                          />
                        </td>
                        <td className="border border-gray-300 p-2">
                          <Input
                            value={component.description || ''}
                            onChange={(e) => updateComponent(index, 'description', e.target.value)}
                            className="min-w-[150px]"
                          />
                        </td>
                        <td className="border border-gray-300 p-2">
                          <Input
                            value={component.unit || ''}
                            onChange={(e) => updateComponent(index, 'unit', e.target.value)}
                            className="min-w-[80px]"
                          />
                        </td>
                        <td className="border border-gray-300 p-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={component.cost || ''}
                            onChange={(e) => updateComponent(index, 'cost', parseFloat(e.target.value) || 0)}
                            className="min-w-[80px]"
                          />
                        </td>
                        <td className="border border-gray-300 p-2">
                          <Input
                            value={component.prepCategory || ''}
                            onChange={(e) => updateComponent(index, 'prepCategory', e.target.value)}
                            className="min-w-[120px]"
                          />
                        </td>
                        <td className="border border-gray-300 p-2">
                          <Input
                            value={Array.isArray(component.allergens) ? component.allergens.join(', ') : ''}
                            onChange={(e) => updateComponent(index, 'allergens', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                            placeholder="Gluten, Dairy, Soy"
                            className="min-w-[120px]"
                          />
                        </td>
                        <td className="border border-gray-300 p-2">
                          <Input
                            value={Array.isArray(component.dietary) ? component.dietary.join(', ') : ''}
                            onChange={(e) => updateComponent(index, 'dietary', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                            placeholder="Vegetarian, Vegan"
                            className="min-w-[120px]"
                          />
                        </td>
                        <td className="border border-gray-300 p-2">
                          <Button
                            onClick={() => removeComponent(index)}
                            variant="destructive"
                            size="sm"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Other Items Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Edit3 className="h-5 w-5" />
                    Other Items
                  </CardTitle>
                  <CardDescription>
                    Bulk edit all other item properties
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button onClick={addNewOtherItem} variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                  <Button 
                    onClick={saveOtherItems} 
                    disabled={bulkSaving === 'other'}
                    className="flex items-center gap-2"
                  >
                    {bulkSaving === 'other' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save All Items
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 p-2 text-left text-sm font-medium">Name</th>
                      <th className="border border-gray-300 p-2 text-left text-sm font-medium">Description</th>
                      <th className="border border-gray-300 p-2 text-left text-sm font-medium">Supplier</th>
                      <th className="border border-gray-300 p-2 text-left text-sm font-medium">Cost</th>
                      <th className="border border-gray-300 p-2 text-left text-sm font-medium">Prep Category</th>
                      <th className="border border-gray-300 p-2 text-left text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {otherItems.map((item, index) => (
                      <tr key={item.id || index} className="hover:bg-gray-50">
                        <td className="border border-gray-300 p-2">
                          <Input
                            value={item.name}
                            onChange={(e) => updateOtherItem(index, 'name', e.target.value)}
                            className="min-w-[150px]"
                          />
                        </td>
                        <td className="border border-gray-300 p-2">
                          <Input
                            value={item.description || ''}
                            onChange={(e) => updateOtherItem(index, 'description', e.target.value)}
                            className="min-w-[150px]"
                          />
                        </td>
                        <td className="border border-gray-300 p-2">
                          <Input
                            value={item.supplier || ''}
                            onChange={(e) => updateOtherItem(index, 'supplier', e.target.value)}
                            className="min-w-[120px]"
                          />
                        </td>
                        <td className="border border-gray-300 p-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={item.cost || ''}
                            onChange={(e) => updateOtherItem(index, 'cost', parseFloat(e.target.value) || 0)}
                            className="min-w-[80px]"
                          />
                        </td>
                        <td className="border border-gray-300 p-2">
                          <Input
                            value={item.prepCategory || ''}
                            onChange={(e) => updateOtherItem(index, 'prepCategory', e.target.value)}
                            className="min-w-[120px]"
                          />
                        </td>
                        <td className="border border-gray-300 p-2">
                          <Button
                            onClick={() => removeOtherItem(index)}
                            variant="destructive"
                            size="sm"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}