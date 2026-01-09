import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react';

interface DriverCashSettlementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver: any;
}

export default function DriverCashSettlementDialog({ open, onOpenChange, driver }: DriverCashSettlementDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [transactionType, setTransactionType] = useState<'give' | 'take'>('give');
  const [amountUsd, setAmountUsd] = useState('');
  const [amountLbp, setAmountLbp] = useState('');
  const [notes, setNotes] = useState('');

  // Auto-fill amounts and determine transaction type based on driver balance
  // Positive wallet = driver has collected cash = driver owes us
  // Negative wallet = we owe the driver
  useEffect(() => {
    if (driver && open) {
      const walletUsd = Number(driver.wallet_usd || 0);
      const walletLbp = Number(driver.wallet_lbp || 0);

      // Determine transaction type based on largest absolute balance
      if (Math.abs(walletUsd) > Math.abs(walletLbp) / 89500) {
        // USD is the dominant currency
        if (walletUsd > 0) {
          setTransactionType('take'); // Driver owes us (positive = driver has cash)
          setAmountUsd(walletUsd.toFixed(2));
          setAmountLbp('0');
        } else if (walletUsd < 0) {
          setTransactionType('give'); // We owe driver (negative = we owe)
          setAmountUsd(Math.abs(walletUsd).toFixed(2));
          setAmountLbp('0');
        }
      } else {
        // LBP is the dominant currency
        if (walletLbp > 0) {
          setTransactionType('take'); // Driver owes us (positive = driver has cash)
          setAmountLbp(walletLbp.toString());
          setAmountUsd('0');
        } else if (walletLbp < 0) {
          setTransactionType('give'); // We owe driver (negative = we owe)
          setAmountLbp(Math.abs(walletLbp).toString());
          setAmountUsd('0');
        }
      }
    }
  }, [driver, open]);

  const settleCashMutation = useMutation({
    mutationFn: async () => {
      const amountUsdNum = parseFloat(amountUsd) || 0;
      const amountLbpNum = parseFloat(amountLbp) || 0;

      if (amountUsdNum <= 0 && amountLbpNum <= 0) {
        throw new Error('Please enter a valid amount');
      }

      const today = new Date().toISOString().split('T')[0];

      if (transactionType === 'give') {
        // Give cash to driver (Credit to driver, Cash out from cashbox)
        const { error: transactionError } = await supabase
          .from('driver_transactions')
          .insert({
            driver_id: driver.id,
            type: 'Credit',
            amount_usd: amountUsdNum,
            amount_lbp: amountLbpNum,
            note: notes || 'Cash settlement - payment to driver',
          });

        if (transactionError) throw transactionError;

        // Use atomic wallet update
        const { error: walletError } = await (supabase.rpc as any)('update_driver_wallet_atomic', {
          p_driver_id: driver.id,
          p_amount_usd: amountUsdNum,
          p_amount_lbp: amountLbpNum,
        });

        if (walletError) throw walletError;

        // Use atomic cashbox update (cash out)
        const { error: cashboxError } = await (supabase.rpc as any)('update_cashbox_atomic', {
          p_date: today,
          p_cash_in_usd: 0,
          p_cash_in_lbp: 0,
          p_cash_out_usd: amountUsdNum,
          p_cash_out_lbp: amountLbpNum,
        });

        if (cashboxError) throw cashboxError;
      } else {
        // Take cash from driver (Debit from driver, Cash in to cashbox)
        // Check if driver has enough balance
        const currentWalletUsd = Number(driver.wallet_usd || 0);
        const currentWalletLbp = Number(driver.wallet_lbp || 0);
        
        if (amountUsdNum > currentWalletUsd || amountLbpNum > currentWalletLbp) {
          throw new Error('Insufficient driver balance');
        }

        const { error: transactionError } = await supabase
          .from('driver_transactions')
          .insert({
            driver_id: driver.id,
            type: 'Debit',
            amount_usd: amountUsdNum,
            amount_lbp: amountLbpNum,
            note: notes || 'Cash settlement - collection from driver',
          });

        if (transactionError) throw transactionError;

        // Use atomic wallet update (negative = debit)
        const { error: walletError } = await (supabase.rpc as any)('update_driver_wallet_atomic', {
          p_driver_id: driver.id,
          p_amount_usd: -amountUsdNum,
          p_amount_lbp: -amountLbpNum,
        });

        if (walletError) throw walletError;

        // Use atomic cashbox update (cash in)
        const { error: cashboxError } = await (supabase.rpc as any)('update_cashbox_atomic', {
          p_date: today,
          p_cash_in_usd: amountUsdNum,
          p_cash_in_lbp: amountLbpNum,
          p_cash_out_usd: 0,
          p_cash_out_lbp: 0,
        });

        if (cashboxError) throw cashboxError;
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Cash ${transactionType === 'give' ? 'given to' : 'taken from'} driver successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['cashbox'] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['driver-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['driver-statement'] });
      setAmountUsd('');
      setAmountLbp('');
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

  const walletUsd = Number(driver?.wallet_usd || 0);
  const walletLbp = Number(driver?.wallet_lbp || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Settle Cash with {driver?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md bg-muted p-4 space-y-2">
            <p className="text-sm font-medium">Current Driver Balance:</p>
            <div className="flex items-center gap-4">
              <div>
              <p className={`text-lg font-bold ${walletUsd > 0 ? 'text-green-600' : walletUsd < 0 ? 'text-red-600' : ''}`}>
                  ${Math.abs(walletUsd).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {walletUsd > 0 ? 'Driver owes us' : walletUsd < 0 ? 'We owe driver' : 'Settled'}
                </p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <p className={`text-lg font-bold ${walletLbp > 0 ? 'text-green-600' : walletLbp < 0 ? 'text-red-600' : ''}`}>
                  LL {Math.abs(walletLbp).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {walletLbp > 0 ? 'Driver owes us' : walletLbp < 0 ? 'We owe driver' : 'Settled'}
                </p>
              </div>
            </div>
          </div>

          <div>
            <Label>Transaction Type</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <Button
                type="button"
                variant={transactionType === 'give' ? 'default' : 'outline'}
                onClick={() => setTransactionType('give')}
                className="w-full"
              >
                <ArrowUpRight className="mr-2 h-4 w-4" />
                Give Cash
              </Button>
              <Button
                type="button"
                variant={transactionType === 'take' ? 'default' : 'outline'}
                onClick={() => setTransactionType('take')}
                className="w-full"
              >
                <ArrowDownLeft className="mr-2 h-4 w-4" />
                Take Cash
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="amountUsd">Amount (USD)</Label>
            <Input
              id="amountUsd"
              type="number"
              step="0.01"
              value={amountUsd}
              onChange={(e) => setAmountUsd(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div>
            <Label htmlFor="amountLbp">Amount (LBP)</Label>
            <Input
              id="amountLbp"
              type="number"
              step="1"
              value={amountLbp}
              onChange={(e) => setAmountLbp(e.target.value)}
              placeholder="0"
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

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => settleCashMutation.mutate()} disabled={settleCashMutation.isPending}>
              {settleCashMutation.isPending ? 'Processing...' : `${transactionType === 'give' ? 'Give' : 'Take'} Cash`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
