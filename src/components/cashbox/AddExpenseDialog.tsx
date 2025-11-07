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

      // Update cashbox_daily
      const { data: existingCashbox, error: cashboxFetchError } = await supabase
        .from('cashbox_daily')
        .select('*')
        .eq('date', date)
        .maybeSingle();

      if (cashboxFetchError) throw cashboxFetchError;

      const updateData: any = {};
      if (currency === 'USD') {
        updateData.cash_out_usd = (existingCashbox?.cash_out_usd || 0) + amountNum;
        updateData.closing_usd = (existingCashbox?.opening_usd || 0) + (existingCashbox?.cash_in_usd || 0) - updateData.cash_out_usd;
      } else {
        updateData.cash_out_lbp = (existingCashbox?.cash_out_lbp || 0) + amountNum;
        updateData.closing_lbp = (existingCashbox?.opening_lbp || 0) + (existingCashbox?.cash_in_lbp || 0) - updateData.cash_out_lbp;
      }

      const expenseCategory = categories?.find(cat => cat.id === categoryId)?.name || 'Unknown Expense';
      const cashboxNote = `${new Date().toLocaleString()}: Expense (${expenseCategory}) - ${amountNum} ${currency}${notes ? ` - ${notes}` : ''}`;
      updateData.notes = existingCashbox?.notes
        ? `${existingCashbox.notes}\n${cashboxNote}`
        : cashboxNote;

      if (existingCashbox) {
        const { error: cashboxUpdateError } = await supabase
          .from('cashbox_daily')
          .update(updateData)
          .eq('id', existingCashbox.id);
        if (cashboxUpdateError) throw cashboxUpdateError;
      } else {
        const { error: cashboxInsertError } = await supabase
          .from('cashbox_daily')
          .insert({
            date,
            opening_usd: 0,
            opening_lbp: 0,
            cash_in_usd: 0,
            cash_in_lbp: 0,
            ...updateData,
          });
        if (cashboxInsertError) throw cashboxInsertError;
      }
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