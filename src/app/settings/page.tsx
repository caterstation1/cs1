'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import DataDriversAdminTab from './_components/DataDriversAdminTab'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
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
  prepCategories?: string[]
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
  prepCategories?: string[]
}

// Available options for dropdowns
const PREP_CATEGORIES = ['Bakery', 'Butchery', 'Hot kitchen', 'Cold kitchen', 'Desserts', 'Pre day prep']

const ALLERGENS = [
  { id: 'hasGluten', label: 'Gluten' },
  { id: 'hasDairy', label: 'Dairy' },
  { id: 'hasSoy', label: 'Soy' },
  { id: 'hasOnionGarlic', label: 'Onion/Garlic' },
  { id: 'hasSesame', label: 'Sesame' },
  { id: 'hasNuts', label: 'Nuts' },
  { id: 'hasEgg', label: 'Egg' }
]

const DIETARY_OPTIONS = [
  { id: 'isVegetarian', label: 'Vegetarian' },
  { id: 'isVegan', label: 'Vegan' },
  { id: 'isHalal', label: 'Halal' }
]

export default function SettingsPage() {
  const [settings, setSettings] = useState<EmailSetting[]>([])
  const [components, setComponents] = useState<Component[]>([])
  const [otherItems, setOtherItems] = useState<OtherItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [testingEmail, setTestingEmail] = useState(false)
  const [bulkSaving, setBulkSaving] = useState<'components' | 'other' | null>(null)
  const { toast } = useToast()
  // Stock items state
  const [stockItems, setStockItems] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [savingStock, setSavingStock] = useState(false)
  // SMS templates
  const [smsDelivery, setSmsDelivery] = useState('')
  const [smsPickup, setSmsPickup] = useState('')
  const [savingSms, setSavingSms] = useState(false)
  // Cars (Fleet)
  const [cars, setCars] = useState<Array<{ id: string; name: string; rego: string; wofExpiry?: string | null; regoExpiry?: string | null }>>([])
  const [carForm, setCarForm] = useState<{ name: string; rego: string; wofExpiry?: string | null; regoExpiry?: string | null }>({ name: '', rego: '', wofExpiry: '', regoExpiry: '' })
  const [savingCar, setSavingCar] = useState(false)

  // Load all data
  useEffect(() => {
    loadAllData()
  }, [])

  const loadAllData = async () => {
    try {
      await Promise.all([
        loadSettings(),
        loadComponents(),
        loadOtherItems(),
        loadStock(),
        loadSuppliers(),
        loadSmsTemplates(),
        loadCars()
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

  const loadCars = async () => {
    try {
      const res = await fetch('/api/cars', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setCars(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error('Error loading cars', e)
    }
  }

  const addCar = async () => {
    try {
      setSavingCar(true)
      const res = await fetch('/api/cars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: carForm.name,
          rego: carForm.rego,
          wofExpiry: carForm.wofExpiry || null,
          regoExpiry: carForm.regoExpiry || null,
        })
      })
      if (!res.ok) throw new Error('Failed to create car')
      setCarForm({ name: '', rego: '', wofExpiry: '', regoExpiry: '' })
      await loadCars()
      toast({ title: 'Saved', description: 'Car added' })
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to add car', variant: 'destructive' })
    } finally {
      setSavingCar(false)
    }
  }

  const updateCar = async (id: string, patch: Partial<{ name: string; rego: string; wofExpiry?: string | null; regoExpiry?: string | null }>) => {
    try {
      const res = await fetch(`/api/cars/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      })
      if (!res.ok) throw new Error('Failed to update car')
      await loadCars()
      toast({ title: 'Updated', description: 'Car updated' })
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to update car', variant: 'destructive' })
    }
  }

  const deleteCar = async (id: string) => {
    try {
      const res = await fetch(`/api/cars/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete car')
      await loadCars()
      toast({ title: 'Deleted', description: 'Car removed' })
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to delete car', variant: 'destructive' })
    }
  }

  const loadSmsTemplates = async () => {
    try {
      const res = await fetch('/api/settings/sms-templates')
      if (res.ok) {
        const data = await res.json()
        setSmsDelivery(data.delivery || '')
        setSmsPickup(data.pickup || '')
      }
    } catch (e) {
      console.error('Error loading SMS templates', e)
    }
  }

  const saveSmsTemplates = async () => {
    setSavingSms(true)
    try {
      const res = await fetch('/api/settings/sms-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delivery: smsDelivery, pickup: smsPickup })
      })
      if (!res.ok) throw new Error('Failed to save SMS templates')
      toast({ title: 'Saved', description: 'SMS templates updated' })
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to save SMS templates', variant: 'destructive' })
    } finally {
      setSavingSms(false)
    }
  }

  const loadSuppliers = async () => {
    try {
      const res = await fetch('/api/suppliers')
      if (res.ok) {
        const data = await res.json()
        setSuppliers(data || [])
      }
    } catch (e) { console.error('Error loading suppliers', e) }
  }

  const loadStock = async () => {
    try {
      const res = await fetch('/api/stock-items')
      if (res.ok) {
        const data = await res.json()
        setStockItems(Array.isArray(data) ? data : [])
      }
    } catch (e) { console.error('Error loading stock items', e) }
  }

  const addStockItem = () => {
    setStockItems(prev => ([...prev, { id: 'new', name: '', description: '', supplierId: '', priceExGst: 0, isActive: true }]))
  }
  const updateStockItem = (index: number, field: string, value: any) => {
    const updated = [...stockItems]
    updated[index] = { ...updated[index], [field]: value }
    setStockItems(updated)
  }
  const removeStockItem = (index: number) => setStockItems(stockItems.filter((_: any, i: number) => i !== index))
  const saveStockItems = async () => {
    setSavingStock(true)
    try {
      for (const item of stockItems) {
        if (item.id === 'new') {
          await fetch('/api/stock-items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) })
        } else {
          await fetch(`/api/stock-items/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) })
        }
      }
      toast({ title: 'Saved', description: 'Stock items updated' })
      await loadStock()
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to save stock items', variant: 'destructive' })
    } finally { setSavingStock(false) }
  }

  const loadComponents = async () => {
    try {
      const res = await fetch('/api/components')
      if (res.ok) {
        const data = await res.json()
        // Ensure prepCategories field is populated from existing data
        const componentsWithCategories = (data || []).map((component: any) => ({
          ...component,
          prepCategories: component.prepCategories || (component.prepCategory ? [component.prepCategory] : [])
        }))
        setComponents(componentsWithCategories)
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
        // Ensure prepCategories field is populated from existing data
        const itemsWithCategories = (data?.products || []).map((item: any) => ({
          ...item,
          prepCategories: item.prepCategories || (item.prepCategory ? [item.prepCategory] : [])
        }))
        setOtherItems(itemsWithCategories)
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
      prepCategories: [],
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
      prepCategories: [],
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
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email Automation
          </TabsTrigger>
          <TabsTrigger value="bulk-edit" className="flex items-center gap-2">
            <Edit3 className="h-4 w-4" />
            Bulk Edit
          </TabsTrigger>
          <TabsTrigger value="stock" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            CS Stock Items
          </TabsTrigger>
          <TabsTrigger value="messaging" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            Messaging (SMS)
          </TabsTrigger>
          <TabsTrigger value="cars" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            Cars
          </TabsTrigger>
          <TabsTrigger value="datadrivers" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            DataDrivers
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
                          <div className="space-y-1 min-w-[140px] max-h-[120px] overflow-y-auto">
                            {PREP_CATEGORIES.map(category => (
                              <div key={category} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`${component.id}-prep-${category}`}
                                  checked={component.prepCategories?.includes(category) || false}
                                  onCheckedChange={(checked) => {
                                    const currentCategories = component.prepCategories || []
                                    const updatedCategories = checked 
                                      ? [...currentCategories, category]
                                      : currentCategories.filter(cat => cat !== category)
                                    
                                    // Update both fields in a single updateComponent call
                                    const updated = [...components]
                                    updated[index] = {
                                      ...updated[index],
                                      prepCategories: updatedCategories,
                                      prepCategory: updatedCategories[0] || ''
                                    }
                                    setComponents(updated)
                                  }}
                                />
                                <Label htmlFor={`${component.id}-prep-${category}`} className="text-xs">
                                  {category}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="border border-gray-300 p-2">
                          <div className="space-y-1 min-w-[140px]">
                            {ALLERGENS.map(allergen => (
                              <div key={allergen.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`${component.id}-${allergen.id}`}
                                  checked={component[allergen.id as keyof Component] as boolean}
                                  onCheckedChange={(checked) => updateComponent(index, allergen.id as keyof Component, checked)}
                                />
                                <Label htmlFor={`${component.id}-${allergen.id}`} className="text-xs">
                                  {allergen.label}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="border border-gray-300 p-2">
                          <div className="space-y-1 min-w-[120px]">
                            {DIETARY_OPTIONS.map(dietary => (
                              <div key={dietary.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`${component.id}-${dietary.id}`}
                                  checked={component[dietary.id as keyof Component] as boolean}
                                  onCheckedChange={(checked) => updateComponent(index, dietary.id as keyof Component, checked)}
                                />
                                <Label htmlFor={`${component.id}-${dietary.id}`} className="text-xs">
                                  {dietary.label}
                                </Label>
                              </div>
                            ))}
                          </div>
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
                          <div className="space-y-1 min-w-[140px] max-h-[120px] overflow-y-auto">
                            {PREP_CATEGORIES.map(category => (
                              <div key={category} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`${item.id}-other-prep-${category}`}
                                  checked={item.prepCategories?.includes(category) || false}
                                  onCheckedChange={(checked) => {
                                    const currentCategories = item.prepCategories || []
                                    const updatedCategories = checked 
                                      ? [...currentCategories, category]
                                      : currentCategories.filter(cat => cat !== category)
                                    
                                    // Update both fields in a single updateOtherItem call
                                    const updated = [...otherItems]
                                    updated[index] = {
                                      ...updated[index],
                                      prepCategories: updatedCategories,
                                      prepCategory: updatedCategories[0] || ''
                                    }
                                    setOtherItems(updated)
                                  }}
                                />
                                <Label htmlFor={`${item.id}-other-prep-${category}`} className="text-xs">
                                  {category}
                                </Label>
                              </div>
                            ))}
                          </div>
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

        <TabsContent value="cars" className="mt-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold">Fleet Cars</h2>
                <p className="text-sm text-muted-foreground">Manage vehicles available for deliveries</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <div>
                <Label>Name</Label>
                <Input value={carForm.name} onChange={e=>setCarForm(f=>({ ...f, name: e.target.value }))} placeholder="e.g. Van 1" />
              </div>
              <div>
                <Label>Rego</Label>
                <Input value={carForm.rego} onChange={e=>setCarForm(f=>({ ...f, rego: e.target.value }))} placeholder="e.g. ABC123" />
              </div>
              <div>
                <Label>WOF Expiry</Label>
                <Input type="date" value={carForm.wofExpiry || ''} onChange={e=>setCarForm(f=>({ ...f, wofExpiry: e.target.value }))} />
              </div>
              <div>
                <Label>Rego Expiry</Label>
                <Input type="date" value={carForm.regoExpiry || ''} onChange={e=>setCarForm(f=>({ ...f, regoExpiry: e.target.value }))} />
              </div>
            </div>
            <div className="mt-3">
              <Button onClick={addCar} disabled={savingCar || !carForm.name || !carForm.rego} className="flex items-center gap-2">
                {savingCar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add Car
              </Button>
            </div>
            <div className="divide-y mt-4">
              {cars.map(car => {
                const toDateVal = (v?: string | null) => {
                  if (!v) return ''
                  const d = new Date(v)
                  if (Number.isNaN(d.getTime())) return ''
                  const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0')
                  return `${y}-${m}-${day}`
                }
                return (
                  <div key={car.id} className="py-3 grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
                    <Input value={car.name} onChange={e=>updateCar(car.id, { name: e.target.value })} />
                    <Input value={car.rego} onChange={e=>updateCar(car.id, { rego: e.target.value })} />
                    <Input type="date" value={toDateVal(car.wofExpiry)} onChange={e=>updateCar(car.id, { wofExpiry: e.target.value })} />
                    <Input type="date" value={toDateVal(car.regoExpiry)} onChange={e=>updateCar(car.id, { regoExpiry: e.target.value })} />
                    <div className="text-right">
                      <Button variant="destructive" size="sm" onClick={()=>deleteCar(car.id)}><X className="h-4 w-4" /></Button>
                    </div>
                  </div>
                )
              })}
              {cars.length === 0 && (
                <div className="py-6 text-sm text-muted-foreground">No cars yet. Add your first car above.</div>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="stock" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <SettingsIcon className="h-5 w-5" />
                    CS Stock Items
                  </CardTitle>
                  <CardDescription>Manage stock items available to WLG licensees</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button onClick={addStockItem} variant="outline" size="sm"><Plus className="h-4 w-4 mr-2"/>Add Item</Button>
                  <Button onClick={saveStockItems} disabled={savingStock} className="flex items-center gap-2">{savingStock ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>}Save All</Button>
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
                      <th className="border border-gray-300 p-2 text-left text-sm font-medium">SKU</th>
                      <th className="border border-gray-300 p-2 text-left text-sm font-medium">Price (ex GST)</th>
                      <th className="border border-gray-300 p-2 text-left text-sm font-medium">Active</th>
                      <th className="border border-gray-300 p-2 text-left text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockItems.map((item, index) => (
                      <tr key={item.id || index} className="hover:bg-gray-50">
                        <td className="border border-gray-300 p-2"><Input value={item.name} onChange={e=>updateStockItem(index,'name',e.target.value)} /></td>
                        <td className="border border-gray-300 p-2"><Input value={item.description||''} onChange={e=>updateStockItem(index,'description',e.target.value)} /></td>
                        <td className="border border-gray-300 p-2">
                          <Select value={item.supplierId||''} onValueChange={(v)=>updateStockItem(index,'supplierId',v)}>
                            <SelectTrigger className="w-[220px]">
                              <div className="truncate text-left w-full">
                                {suppliers.find((s:any)=>s.id===item.supplierId)?.name || 'Select supplier'}
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              {suppliers.map(s=> <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="border border-gray-300 p-2"><Input value={item.sku||''} onChange={e=>updateStockItem(index,'sku',e.target.value)} /></td>
                        <td className="border border-gray-300 p-2"><Input type="number" step="0.01" value={item.priceExGst} onChange={e=>updateStockItem(index,'priceExGst',parseFloat(e.target.value)||0)} /></td>
                        <td className="border border-gray-300 p-2">
                          <input type="checkbox" checked={!!item.isActive} onChange={e=>updateStockItem(index,'isActive',e.target.checked)} />
                        </td>
                        <td className="border border-gray-300 p-2">
                          <Button onClick={()=>removeStockItem(index)} variant="destructive" size="sm"><X className="h-4 w-4"/></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messaging" className="mt-6">
          <Card className="p-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">SMS Templates</h2>
              <p className="text-sm text-muted-foreground">
                Supported tokens: {'{{CustomerFirstName}}'}, {'{{DeliveryTime}}'}, {'{{ShippingAddress.company}}'}, {'{{ShippingAddress.address1}}'}, {'{{ShippingAddress.address2}}'}, {'{{LineItemsList}}'}.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Delivery Template</Label>
                <textarea className="w-full min-h-[240px] border rounded p-2" value={smsDelivery} onChange={(e)=>setSmsDelivery(e.target.value)} />
              </div>
              <div>
                <Label>Pickup Template</Label>
                <textarea className="w-full min-h-[240px] border rounded p-2" value={smsPickup} onChange={(e)=>setSmsPickup(e.target.value)} />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={saveSmsTemplates} disabled={savingSms}>{savingSms ? 'Saving...' : 'Save Templates'}</Button>
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="datadrivers" className="mt-6">
          <DataDriversAdminTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}