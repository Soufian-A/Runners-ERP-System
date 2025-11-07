import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { updateCashboxDaily } from '@/lib/cashbox'; // Import the new utility

interface AddExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
}

const AddExpenseDialog = ({ open, onOpenChange, date }: AddExpenseDialogProps) => {
  const queryClient = useQueryClient();
  const [categoryId, setCategoryId] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'LBP'>('USD');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const { data: categories } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .order('category_group', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error('Please enter a valid amount');
      }
      if (!categoryId) {
        throw new Error('Please select an expense category');
      }

      // Insert into daily_expenses
      const expenseData = {
        date,
        category_id: categoryId,
        amount_usd: currency === 'USD' ? amountNum : 0,
        amount_lbp: currency === 'LBP' ? amountNum : 0,
        notes: notes || null,
      };

      const { error: expenseError } = await supabase
        .from('daily_expenses')
        .insert(expenseData);

      if (expenseError) throw expenseError;

      // Update cashbox_daily using the new utility
      const expenseCategory = categories?.find(cat => cat.id === categoryId)?.name || 'Unknown Expense';
      await updateCashboxDaily({
        date,
        cashOutUsdChange: currency === 'USD' ? amountNum : 0,
        cashOutLbpChange: currency === 'LBP' ? amountNum : 0,
        note: `Expense (${expenseCategory}) - ${amountNum} ${currency}${notes ? ` - ${notes}` : ''}`,
      });
    },
    onSuccess: () => {
      toast.success('Expense added successfully');
      queryClient.invalidateQueries({ queryKey: ['daily-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['cashbox'] }); // Invalidate cashbox to reflect changes
      setCategoryId('');
      setAmount('');
      setNotes('');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to add expense: ${error.message}`);
    },
  });

  const handleSubmit = () => {
    mutation.mutate();
  };

  const groupedCategories = categories?.reduce((acc, cat) => {
    if (!acc[cat.category_group]) {
      acc[cat.category_group] = [];
    }
    acc[cat.category_group].push(cat);
    return acc;
  }, {} as Record<string, typeof categories>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Expense Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select expense category" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {groupedCategories && Object.entries(groupedCategories).map(([group, cats]) => (
                  <div key={group}>
                    <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                      {group}
                    </div>
                    {cats.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Currency</Label>
            <Select value={currency} onValueChange={(v) => setCurrency(v as 'USD' | 'LBP')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="LBP">LBP</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Amount</Label>
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              step="0.01"
            />
          </div>

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Add any notes about this expense..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            Add Expense
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddExpenseDialog;