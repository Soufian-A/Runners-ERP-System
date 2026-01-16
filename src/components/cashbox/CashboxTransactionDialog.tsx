import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface CashboxTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  type: 'in' | 'out';
}

export default function CashboxTransactionDialog({ open, onOpenChange, date, type }: CashboxTransactionDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currency, setCurrency] = useState<'USD' | 'LBP'>('USD');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const transactionMutation = useMutation({
    mutationFn: async () => {
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error('Please enter a valid amount');
      }

      const amountUsd = currency === 'USD' ? amountNum : 0;
      const amountLbp = currency === 'LBP' ? amountNum : 0;

      // Use atomic cashbox update
      const { error: cashboxError } = await (supabase.rpc as any)('update_cashbox_atomic', {
        p_date: date,
        p_cash_in_usd: type === 'in' ? amountUsd : 0,
        p_cash_in_lbp: type === 'in' ? amountLbp : 0,
        p_cash_out_usd: type === 'out' ? amountUsd : 0,
        p_cash_out_lbp: type === 'out' ? amountLbp : 0,
      });

      if (cashboxError) throw cashboxError;

      // Add notes if provided
      if (notes) {
        const { data: existing } = await supabase
          .from('cashbox_daily')
          .select('notes')
          .eq('date', date)
          .maybeSingle();
        
        const noteText = `${new Date().toLocaleString()}: ${type === 'in' ? 'Added' : 'Withdrew'} ${amountNum} ${currency} - ${notes}`;
        const updatedNotes = existing?.notes 
          ? `${existing.notes}\n${noteText}`
          : noteText;
        
        await supabase
          .from('cashbox_daily')
          .update({ notes: updatedNotes })
          .eq('date', date);
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Capital ${type === 'in' ? 'added' : 'withdrawn'} successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['cashbox'] });
      setAmount('');
      setNotes('');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{type === 'in' ? 'Add Capital' : 'Withdraw Capital'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="currency">Currency</Label>
            <Select value={currency} onValueChange={(value: 'USD' | 'LBP') => setCurrency(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="LBP">LBP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => transactionMutation.mutate()} disabled={transactionMutation.isPending}>
              {transactionMutation.isPending ? 'Processing...' : type === 'in' ? 'Add Capital' : 'Withdraw Capital'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
