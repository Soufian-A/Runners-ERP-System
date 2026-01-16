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
import ExpenseCategoryCombobox from './ExpenseCategoryCombobox';

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
  const [expenseDate, setExpenseDate] = useState(date);

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
      const amountUsd = currency === 'USD' ? Number(amount) : 0;
      const amountLbp = currency === 'LBP' ? Number(amount) : 0;
      
      const expenseData = {
        date: expenseDate,
        category_id: categoryId,
        amount_usd: amountUsd,
        amount_lbp: amountLbp,
        notes: notes || null,
      };

      const { error } = await supabase
        .from('daily_expenses')
        .insert(expenseData);

      if (error) throw error;

      // Update cashbox atomically - expenses are cash out
      const { error: cashboxError } = await (supabase.rpc as any)('update_cashbox_atomic', {
        p_date: expenseDate,
        p_cash_in_usd: 0,
        p_cash_in_lbp: 0,
        p_cash_out_usd: amountUsd,
        p_cash_out_lbp: amountLbp,
      });

      if (cashboxError) throw cashboxError;
    },
    onSuccess: () => {
      toast.success('Expense added successfully');
      queryClient.invalidateQueries({ queryKey: ['daily-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['all-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['cashbox'] });
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
    if (!categoryId || !amount || Number(amount) <= 0) {
      toast.error('Please select a category and enter a valid amount');
      return;
    }
    mutation.mutate();
  };

  // Reset date when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setExpenseDate(date);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Date</Label>
            <Input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Expense Category</Label>
            <ExpenseCategoryCombobox
              categories={categories}
              value={categoryId}
              onValueChange={setCategoryId}
              placeholder="Search or select category..."
            />
          </div>

          <div className="space-y-2">
            <Label>Currency</Label>
            <Select value={currency} onValueChange={(v) => setCurrency(v as 'USD' | 'LBP')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
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
            {mutation.isPending ? 'Adding...' : 'Add Expense'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddExpenseDialog;
