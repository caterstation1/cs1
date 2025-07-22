'use client';

import { useState, useEffect } from 'react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';

interface ProductRule {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  priority: number;
  matchPattern: string;
  matchType: string;
  setMeat1?: string;
  setMeat2?: string;
  setTimer1?: number;
  setTimer2?: number;
  setOption1?: string;
  setOption2?: string;
  setServeware?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ManageRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRulesUpdated?: () => void;
}

const CUSTOM_DATA_FIELDS = [
  { value: 'displayName', label: 'Display Name' },
  { value: 'meat1', label: 'Meat 1' },
  { value: 'meat2', label: 'Meat 2' },
  { value: 'timer1', label: 'Timer 1' },
  { value: 'timer2', label: 'Timer 2' },
  { value: 'option1', label: 'Option 1' },
  { value: 'option2', label: 'Option 2' },
  { value: 'serveware', label: 'Serveware' },
];

export function ManageRulesModal({ isOpen, onClose, onRulesUpdated }: ManageRulesModalProps) {
  const [rules, setRules] = useState<ProductRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingRule, setEditingRule] = useState<ProductRule | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Fetch rules on modal open
  useEffect(() => {
    if (isOpen) {
      fetchRules();
    }
  }, [isOpen]);

  const fetchRules = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/product-rules');
      if (response.ok) {
        const data = await response.json();
        setRules(data);
      }
    } catch (error) {
      console.error('Error fetching rules:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) {
      return;
    }

    try {
      const response = await fetch(`/api/product-rules/${ruleId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setRules(rules.filter(rule => rule.id !== ruleId));
        if (onRulesUpdated) {
          onRulesUpdated();
        }
      }
    } catch (error) {
      console.error('Error deleting rule:', error);
    }
  };

  const handleToggleActive = async (rule: ProductRule) => {
    // If we're deactivating the rule, ask for confirmation and explain the reversal
    if (rule.isActive) {
      const confirmed = confirm(
        `Deactivating this rule will reverse all changes it made to products.\n\n` +
        `Rule: "${rule.name}"\n` +
        `Pattern: "${rule.matchPattern}"\n` +
        `Actions: ${getRuleAction(rule)}\n\n` +
        `This will reset the affected fields to their original values. Continue?`
      )
      
      if (!confirmed) {
        return
      }
    }

    try {
      // If deactivating, first reverse the rule changes
      if (rule.isActive) {
        const reverseResponse = await fetch(`/api/product-rules/${rule.id}/reverse`, {
          method: 'POST'
        })

        if (reverseResponse.ok) {
          const reverseResult = await reverseResponse.json()
          console.log('Rule reversal result:', reverseResult)
          
          // Show a toast or alert about the reversal
          alert(`Rule deactivated and changes reversed:\n${reverseResult.message}`)
        } else {
          console.error('Failed to reverse rule changes')
          alert('Failed to reverse rule changes. The rule may still be deactivated.')
        }
      }

      // Update the rule's active status
      const response = await fetch('/api/product-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: rule.id,
          isActive: !rule.isActive
        })
      });

      if (response.ok) {
        setRules(rules.map(r => 
          r.id === rule.id ? { ...r, isActive: !r.isActive } : r
        ));
        if (onRulesUpdated) {
          onRulesUpdated();
        }
      }
    } catch (error) {
      console.error('Error updating rule:', error);
      alert('Error updating rule status. Please try again.');
    }
  };

  const getRuleAction = (rule: ProductRule) => {
    const actions = [];
    if (rule.setMeat1) actions.push(`Meat1: ${rule.setMeat1}`);
    if (rule.setMeat2) actions.push(`Meat2: ${rule.setMeat2}`);
    if (rule.setTimer1) actions.push(`Timer1: ${rule.setTimer1}m`);
    if (rule.setTimer2) actions.push(`Timer2: ${rule.setTimer2}m`);
    if (rule.setOption1) actions.push(`Option1: ${rule.setOption1}`);
    if (rule.setOption2) actions.push(`Option2: ${rule.setOption2}`);
    if (rule.setServeware !== undefined) actions.push(`Serveware: ${rule.setServeware ? 'Yes' : 'No'}`);
    return actions.join(', ');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Product Rules</DialogTitle>
          <DialogDescription>
            View, edit, and manage automatic product rules. Rules are applied when editing products.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                {rules.length} rule{rules.length !== 1 ? 's' : ''} total
              </div>
              <Button onClick={fetchRules} variant="outline" size="sm">
                Refresh
              </Button>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Rule Name</TableHead>
                    <TableHead>Search Pattern</TableHead>
                    <TableHead>Actions</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Operations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {rule.isActive ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                          <Badge variant={rule.isActive ? "default" : "secondary"}>
                            {rule.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{rule.name}</div>
                          {rule.description && (
                            <div className="text-sm text-gray-500">{rule.description}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{rule.matchPattern}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-700">
                          {getRuleAction(rule)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{rule.priority}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(rule)}
                          >
                            {rule.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteRule(rule.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {rules.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No rules found. Create your first rule using the &quot;Set Rule&quot; button.
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 