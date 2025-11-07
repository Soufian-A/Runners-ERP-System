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
import { updateCashboxDaily } from '@/lib/cashbox'; // Import the new utility

interface TakeBackCashDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver: any;
}

export default function TakeBackCashDialog({ open, onOpenChange, driver }: TakeBackCashDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currency, setCurrency] = useState<'USD' | 'LBP'>('USD');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const takeBackCashMutation = useMutation({
    mutationFn: async () => {
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error('Please enter a valid amount');
      }

      // Check if driver has enough balance
      const currentBalance = currency === 'USD' ? driver.wallet_usd : driver.wallet_lbp;
      if (currentBalance < amountNum) {
        throw new Error(`Insufficient balance. Driver has ${currency === 'USD' ? '$' : ''}${Number(currentBalance).toLocaleString()}${currency === 'LBP' ? ' LBP' : ''}`);
      }

      // Debit from driver wallet
      const { error: transactionError } = await supabase
        .from('driver_transactions')
        .insert({
          driver_id: driver.id,
          type: 'Debit',
          amount_usd: currency === 'USD' ? amountNum : 0,
          amount_lbp: currency === 'LBP' ? amountNum : 0,
          note: notes || 'Cash taken back to cashbox',
        });

      if (transactionError) throw transactionError;

      // Update driver wallet
      const { error: driverError } = await supabase
        .from('drivers')
        .update({
          wallet_usd: currency === 'USD' ? driver.wallet_usd - amountNum : driver.wallet_usd,
          wallet_lbp: currency === 'LBP' ? driver.wallet_lbp - amountNum : driver.wallet_lbp,
        })
        .eq('id', driver.id);

      if (driverError) throw driverError;

      // Update cashbox for today (cash in) using the new utility
      const today = new Date().toISOString().split('T')[0];
      await updateCashboxDaily({
        date: today,
        cashInUsdChange: currency === 'USD' ? amountNum : 0,
        cashInLbpChange: currency === 'LBP' ? amountNum : 0,
        note: `Took back ${amountNum} ${currency} from driver ${driver.name} - ${notes}`,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Cash taken back successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['cashbox'] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['driver-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['driver-statement'] });
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
          <DialogTitle>Take Back Cash from {driver?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md bg-muted p-3">
            <p className="text-sm font-medium">Current Wallet Balance:</p>
            <p className="text-lg">
              ${Number(driver?.wallet_usd || 0).toFixed(2)} / {Number(driver?.wallet_lbp || 0).toLocaleString()} LBP
            </p>
          </div>
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
            <Button onClick={() => takeBackCashMutation.mutate()} disabled={takeBackCashMutation.isPending}>
              {takeBackCashMutation.isPending ? 'Processing...' : 'Take Back Cash'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}