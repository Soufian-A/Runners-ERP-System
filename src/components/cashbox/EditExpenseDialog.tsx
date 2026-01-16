import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import ExpenseCategoryCombobox from './ExpenseCategoryCombobox';

interface Expense {
  id: string;
  date: string;
  category_id: string;
  amount_usd: number;
  amount_lbp: number;
  notes: string | null;
  expense_categories?: {
    id: string;
    name: string;
    category_group: string;
  };
}

interface EditExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: Expense | null;
}

export default function EditExpenseDialog({ open, onOpenChange, expense }: EditExpenseDialogProps) {
  const queryClient = useQueryClient();
  const [categoryId, setCategoryId] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'LBP'>('USD');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState('');

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

  useEffect(() => {
    if (expense) {
      setCategoryId(expense.category_id);
      setDate(expense.date);
      setNotes(expense.notes || '');
      if (expense.amount_usd > 0) {
        setCurrency('USD');
        setAmount(expense.amount_usd.toString());
      } else {
        setCurrency('LBP');
        setAmount(expense.amount_lbp.toString());
      }
    }
  }, [expense]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!expense) return;
      
      const newAmountUsd = currency === 'USD' ? Number(amount) : 0;
      const newAmountLbp = currency === 'LBP' ? Number(amount) : 0;
      const oldAmountUsd = Number(expense.amount_usd || 0);
      const oldAmountLbp = Number(expense.amount_lbp || 0);
      
      // Calculate the difference (new - old)
      // If new > old, we need more cash out (positive diff)
      // If new < old, we need less cash out (negative diff)
      const diffUsd = newAmountUsd - oldAmountUsd;
      const diffLbp = newAmountLbp - oldAmountLbp;
      
      const expenseData = {
        date,
        category_id: categoryId,
        amount_usd: newAmountUsd,
        amount_lbp: newAmountLbp,
        notes: notes || null,
      };

      const { error } = await supabase
        .from('daily_expenses')
        .update(expenseData)
        .eq('id', expense.id);

      if (error) throw error;

      // Update cashbox with the difference (if any change in amount)
      if (diffUsd !== 0 || diffLbp !== 0) {
        // If date changed, we need to reverse old date and add to new date
        if (date !== expense.date) {
          // Reverse old expense from old date
          const { error: oldCashboxError } = await (supabase.rpc as any)('update_cashbox_atomic', {
            p_date: expense.date,
            p_cash_in_usd: 0,
            p_cash_in_lbp: 0,
            p_cash_out_usd: -oldAmountUsd,
            p_cash_out_lbp: -oldAmountLbp,
          });
          if (oldCashboxError) throw oldCashboxError;

          // Add new expense to new date
          const { error: newCashboxError } = await (supabase.rpc as any)('update_cashbox_atomic', {
            p_date: date,
            p_cash_in_usd: 0,
            p_cash_in_lbp: 0,
            p_cash_out_usd: newAmountUsd,
            p_cash_out_lbp: newAmountLbp,
          });
          if (newCashboxError) throw newCashboxError;
        } else {
          // Same date, just apply the difference
          const { error: cashboxError } = await (supabase.rpc as any)('update_cashbox_atomic', {
            p_date: date,
            p_cash_in_usd: 0,
            p_cash_in_lbp: 0,
            p_cash_out_usd: diffUsd,
            p_cash_out_lbp: diffLbp,
          });
          if (cashboxError) throw cashboxError;
        }
      } else if (date !== expense.date) {
        // Amount same but date changed
        const { error: oldCashboxError } = await (supabase.rpc as any)('update_cashbox_atomic', {
          p_date: expense.date,
          p_cash_in_usd: 0,
          p_cash_in_lbp: 0,
          p_cash_out_usd: -oldAmountUsd,
          p_cash_out_lbp: -oldAmountLbp,
        });
        if (oldCashboxError) throw oldCashboxError;

        const { error: newCashboxError } = await (supabase.rpc as any)('update_cashbox_atomic', {
          p_date: date,
          p_cash_in_usd: 0,
          p_cash_in_lbp: 0,
          p_cash_out_usd: newAmountUsd,
          p_cash_out_lbp: newAmountLbp,
        });
        if (newCashboxError) throw newCashboxError;
      }
    },
    onSuccess: () => {
      toast.success('Expense updated successfully');
      queryClient.invalidateQueries({ queryKey: ['daily-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['all-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['cashbox'] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update expense: ${error.message}`);
    },
  });

  const handleSubmit = () => {
    if (!categoryId || !amount || Number(amount) <= 0) {
      toast.error('Please select a category and enter a valid amount');
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Expense</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Expense Category</Label>
            <ExpenseCategoryCombobox
              categories={categories}
              value={categoryId}
              onValueChange={setCategoryId}
            />
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
            {mutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
