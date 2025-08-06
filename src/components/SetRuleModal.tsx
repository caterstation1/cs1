'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, AlertCircle, Plus, X } from 'lucide-react';
import { IngredientSelector } from './IngredientSelector';

interface SetRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRuleApplied?: (result: { updated: number; errors: number }) => void;
}

interface RuleField {
  id: string;
  field: string;
  value: string;
  ingredients?: any[]; // For ingredient rules
}

const CUSTOM_DATA_FIELDS = [
  { value: 'displayName', label: 'Display Name', description: 'Override product name' },
  { value: 'meat1', label: 'Meat 1', description: 'Primary meat type' },
  { value: 'meat2', label: 'Meat 2', description: 'Secondary meat type' },
  { value: 'timer1', label: 'Timer 1', description: 'First cooking timer (minutes)' },
  { value: 'timer2', label: 'Timer 2', description: 'Second cooking timer (minutes)' },
  { value: 'option1', label: 'Option 1', description: 'First option field' },
  { value: 'option2', label: 'Option 2', description: 'Second option field' },
  { value: 'serveware', label: 'Serveware', description: 'Include serveware (Yes/No)' },
  { value: 'ingredients', label: 'Ingredients', description: 'Add ingredients/components' },
  { value: 'totalCost', label: 'Total Cost', description: 'Set total cost' },
];

export function SetRuleModal({ isOpen, onClose, onRuleApplied }: SetRuleModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [ruleFields, setRuleFields] = useState<RuleField[]>([
    { id: '1', field: '', value: '' }
  ]);
  const [isApplying, setIsApplying] = useState(false);
  const [result, setResult] = useState<{ updated: number; errors: number } | null>(null);

  const addRuleField = () => {
    const newId = (ruleFields.length + 1).toString();
    setRuleFields([...ruleFields, { id: newId, field: '', value: '', ingredients: [] }]);
  };

  const removeRuleField = (id: string) => {
    if (ruleFields.length > 1) {
      setRuleFields(ruleFields.filter(field => field.id !== id));
    }
  };

  const updateRuleField = (id: string, field: string, value: string | any[]) => {
    setRuleFields(ruleFields.map(f => 
      f.id === id ? { ...f, [field]: value } : f
    ));
  };

  const handleApplyRule = async () => {
    if (!searchTerm.trim() || !ruleFields.some(f => f.field && (f.value || f.ingredients))) {
      return;
    }

    setIsApplying(true);
    setResult(null);

    try {
      // Create the rule with multiple fields
      const ruleData: any = {
        name: `Auto: ${searchTerm} → Multiple Fields`,
        description: `Automatically set multiple fields when "${searchTerm}" appears in product title`,
        matchPattern: searchTerm,
        matchType: 'contains',
        priority: 5,
        isActive: true,
      };

      // Add each field to the rule
      ruleFields.forEach(({ field, value, ingredients }) => {
        if (field && (value || ingredients)) {
          const fieldKey = field === 'serveware' ? 'setServeware' : 
                          field === 'displayName' ? 'setDisplayName' :
                          field === 'ingredients' ? 'setIngredients' :
                          field === 'totalCost' ? 'setTotalCost' :
                          `set${field.charAt(0).toUpperCase() + field.slice(1)}`;
          
          if (field === 'ingredients' && ingredients) {
            ruleData[fieldKey] = ingredients;
          } else if (field === 'totalCost') {
            ruleData[fieldKey] = parseFloat(value) || 0;
          } else if (field === 'serveware') {
            ruleData[fieldKey] = (value.toLowerCase() === 'yes' || value.toLowerCase() === 'true');
          } else if (field.includes('timer')) {
            ruleData[fieldKey] = parseInt(value) || 0;
          } else {
            ruleData[fieldKey] = value;
          }
        }
      });

      // Create the rule
      const createResponse = await fetch('/api/product-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ruleData)
      });

      if (!createResponse.ok) {
        throw new Error('Failed to create rule');
      }

      // Apply the rule to all products
      const applyResponse = await fetch('/api/product-rules/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply-all' })
      });

      if (!applyResponse.ok) {
        throw new Error('Failed to apply rule');
      }

      const applyResult = await applyResponse.json();
      setResult(applyResult.result);
      
      if (onRuleApplied) {
        onRuleApplied(applyResult.result);
      }

      // Close the modal after successful application
      setTimeout(() => {
        handleClose();
      }, 1500); // Give user 1.5 seconds to see the success message

    } catch (error) {
      console.error('Error applying rule:', error);
      setResult({ updated: 0, errors: 1 });
    } finally {
      setIsApplying(false);
    }
  };

  const handleClose = () => {
    setSearchTerm('');
    setRuleFields([{ id: '1', field: '', value: '', ingredients: [] }]);
    setResult(null);
    onClose();
  };

  const getFieldDescription = (fieldValue: string) => {
    const field = CUSTOM_DATA_FIELDS.find(f => f.value === fieldValue);
    return field?.description || '';
  };

  const getFieldPlaceholder = (fieldValue: string) => {
    if (fieldValue === 'ingredients') {
      return 'Select ingredients to add';
    }
    if (fieldValue.includes('timer')) {
      return 'Enter minutes (e.g., 45)';
    }
    if (fieldValue === 'serveware') {
      return 'Enter Yes or No';
    }
    if (fieldValue === 'totalCost') {
      return 'Enter total cost (e.g., 25.50)';
    }
    return `Enter ${fieldValue} value`;
  };

  const isValidInput = () => {
    if (!searchTerm.trim()) return false;
    
    return ruleFields.some(({ field, value, ingredients }) => {
      if (!field) return false;
      
      if (field === 'ingredients') {
        return ingredients && ingredients.length > 0;
      }
      
      if (!value.trim()) return false;
      
      if (field.includes('timer')) {
        return !isNaN(parseInt(value)) && parseInt(value) >= 0;
      }
      
      if (field === 'serveware') {
        const lowerValue = value.toLowerCase();
        return lowerValue === 'yes' || lowerValue === 'no' || lowerValue === 'true' || lowerValue === 'false';
      }
      
      if (field === 'totalCost') {
        return !isNaN(parseFloat(value)) && parseFloat(value) >= 0;
      }
      
      return true;
    });
  };

  const getAvailableFields = (currentFieldId: string) => {
    const usedFields = ruleFields
      .filter(f => f.id !== currentFieldId && f.field)
      .map(f => f.field);
    
    return CUSTOM_DATA_FIELDS.filter(field => !usedFields.includes(field.value));
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Set Product Rule</DialogTitle>
          <DialogDescription>
            Create a rule to automatically populate product data based on Shopify product information.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Term */}
          <div className="space-y-2">
            <Label htmlFor="searchTerm">Search for in Shopify data</Label>
            <Input
              id="searchTerm"
              placeholder="e.g., Beef Brisket, Yes Serveware, Chicken"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <p className="text-xs text-gray-500">
              This text will be searched for in product titles and variant names
            </p>
          </div>

          {/* Rule Fields */}
          <div className="space-y-3">
            <Label>Set Custom Data Fields</Label>
            {ruleFields.map((ruleField, index) => (
              <div key={ruleField.id} className="space-y-3 p-4 border rounded-lg">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                  <div className="space-y-2">
                    <Label>Field Type</Label>
                    <Select 
                      value={ruleField.field} 
                      onValueChange={(value) => updateRuleField(ruleField.id, 'field', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a field to populate" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableFields(ruleField.id).map((field) => (
                          <SelectItem key={field.value} value={field.value}>
                            <div>
                              <div className="font-medium">{field.label}</div>
                              <div className="text-xs text-gray-500">{field.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {ruleField.field && (
                      <p className="text-xs text-blue-600">
                        {getFieldDescription(ruleField.field)}
                      </p>
                    )}
                  </div>
                  
                  <div className="lg:col-span-2 space-y-2">
                    <Label>Value</Label>
                    {ruleField.field === 'ingredients' ? (
                      <IngredientSelector
                        onIngredientsChange={(ingredients) => {
                          updateRuleField(ruleField.id, 'ingredients', ingredients);
                        }}
                        initialIngredients={ruleField.ingredients || []}
                      />
                    ) : (
                      <Input
                        placeholder={getFieldPlaceholder(ruleField.field)}
                        value={ruleField.value}
                        onChange={(e) => updateRuleField(ruleField.id, 'value', e.target.value)}
                      />
                    )}
                    {ruleField.field === 'serveware' && (
                      <p className="text-xs text-gray-500">
                        Enter &quot;Yes&quot; or &quot;No&quot; (case insensitive)
                      </p>
                    )}
                    {ruleField.field.includes('timer') && (
                      <p className="text-xs text-gray-500">
                        Enter number of minutes
                      </p>
                    )}
                    {ruleField.field === 'totalCost' && (
                      <p className="text-xs text-gray-500">
                        Enter total cost (e.g., 25.50)
                      </p>
                    )}
                  </div>
                </div>
                
                {ruleFields.length > 1 && (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRuleField(ruleField.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Remove Field
                    </Button>
                  </div>
                )}
              </div>
            ))}
            
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRuleField}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Another Field
            </Button>
          </div>

          {/* Rule Preview */}
          {isValidInput() && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <div className="text-sm font-medium text-blue-800 mb-1">Rule Preview:</div>
              <div className="text-sm text-blue-700">
                If <Badge variant="outline" className="text-blue-700">{searchTerm}</Badge> appears in product data, set:
                <div className="mt-1 space-y-1">
                  {ruleFields
                    .filter(f => f.field && (f.value || f.ingredients))
                    .map(({ field, value, ingredients }) => (
                      <div key={field} className="flex items-center gap-2">
                        <Badge variant="outline" className="text-blue-700">{field}</Badge>
                        <span>to</span>
                        {field === 'ingredients' && ingredients ? (
                          <Badge variant="outline" className="text-blue-700">
                            {ingredients.length} ingredients
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-blue-700">{value}</Badge>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`p-3 rounded border ${
              result.errors > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
            }`}>
              <div className="flex items-center gap-2">
                {result.errors > 0 ? (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                )}
                <div className="text-sm font-medium">
                  {result.errors > 0 ? 'Rule applied with errors' : 'Rule applied successfully'}
                </div>
              </div>
              <div className="text-sm mt-1">
                Updated {result.updated} products
                {result.errors > 0 && `, ${result.errors} errors`}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isApplying}>
            Cancel
          </Button>
          <Button 
            onClick={handleApplyRule} 
            disabled={!isValidInput() || isApplying}
          >
            {isApplying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Applying Rule...
              </>
            ) : (
              'Apply Rule'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 