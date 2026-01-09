import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface GiveDriverCashDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  preselectedDriver?: any;
}

export default function GiveDriverCashDialog({ open, onOpenChange, date, preselectedDriver }: GiveDriverCashDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [driverId, setDriverId] = useState(preselectedDriver?.id || '');
  const [currency, setCurrency] = useState<'USD' | 'LBP'>('USD');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  // Update driverId when preselectedDriver changes
  useEffect(() => {
    if (preselectedDriver?.id) {
      setDriverId(preselectedDriver.id);
    }
  }, [preselectedDriver]);

  const { data: drivers } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const giveCashMutation = useMutation({
    mutationFn: async () => {
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error('Please enter a valid amount');
      }
      if (!driverId) {
        throw new Error('Please select a driver');
      }

      // Get driver info for the notes
      const { data: driver } = await supabase
        .from('drivers')
        .select('name')
        .eq('id', driverId)
        .single();

      if (!driver) throw new Error('Driver not found');

      const amountUsd = currency === 'USD' ? amountNum : 0;
      const amountLbp = currency === 'LBP' ? amountNum : 0;

      // Add to driver wallet (Credit transaction) and update wallet atomically
      const { error: transactionError } = await supabase
        .from('driver_transactions')
        .insert({
          driver_id: driverId,
          type: 'Credit',
          amount_usd: amountUsd,
          amount_lbp: amountLbp,
          note: notes || 'Cash given from cashbox',
        });

      if (transactionError) throw transactionError;

      // Use atomic wallet update to prevent race conditions
      const { error: walletError } = await (supabase.rpc as any)('update_driver_wallet_atomic', {
        p_driver_id: driverId,
        p_amount_usd: amountUsd,
        p_amount_lbp: amountLbp,
      });

      if (walletError) throw walletError;

      // Use atomic cashbox update
      const { error: cashboxError } = await (supabase.rpc as any)('update_cashbox_atomic', {
        p_date: date,
        p_cash_in_usd: 0,
        p_cash_in_lbp: 0,
        p_cash_out_usd: amountUsd,
        p_cash_out_lbp: amountLbp,
      });

      if (cashboxError) throw cashboxError;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Cash given to driver successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['cashbox'] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['driver-transactions'] });
      setDriverId('');
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
          <DialogTitle>Give Cash to Driver</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="driver">Driver</Label>
            <Select value={driverId} onValueChange={setDriverId}>
              <SelectTrigger>
                <SelectValue placeholder="Select driver..." />
              </SelectTrigger>
              <SelectContent>
                {drivers?.map((driver) => (
                  <SelectItem key={driver.id} value={driver.id}>
                    {driver.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Button onClick={() => giveCashMutation.mutate()} disabled={giveCashMutation.isPending}>
              {giveCashMutation.isPending ? 'Processing...' : 'Give Cash'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
