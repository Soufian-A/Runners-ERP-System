import { useState } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { DollarSign, Calendar } from 'lucide-react';

interface ClientPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  amountDue: number;
  dateFrom: string;
  dateTo: string;
  orderIds: string[];
}

export function ClientPaymentDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  amountDue,
  dateFrom,
  dateTo,
  orderIds,
}: ClientPaymentDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [amountUsd, setAmountUsd] = useState(amountDue.toFixed(2));
  const [amountLbp, setAmountLbp] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');

  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // 1. Fetch orders to check for driver_paid_for_client scenarios
      const { data: orders } = await supabase
        .from('orders')
        .select('order_id, driver_paid_for_client, order_amount_usd, order_amount_lbp, delivery_fee_usd, delivery_fee_lbp')
        .in('order_id', orderIds);

      // Calculate driver-paid amounts and delivery fees
      let driverPaidOrderAmountUsd = 0;
      let driverPaidOrderAmountLbp = 0;
      let deliveryFeeUsd = 0;
      let deliveryFeeLbp = 0;

      orders?.forEach((order: any) => {
        if (order.driver_paid_for_client) {
          driverPaidOrderAmountUsd += Number(order.order_amount_usd || 0);
          driverPaidOrderAmountLbp += Number(order.order_amount_lbp || 0);
        }
        deliveryFeeUsd += Number(order.delivery_fee_usd || 0);
        deliveryFeeLbp += Number(order.delivery_fee_lbp || 0);
      });

      const hasDriverPaidOrders = driverPaidOrderAmountUsd > 0 || driverPaidOrderAmountLbp > 0;

      // 2. Get client's current balance to determine if this is cash in or cash out
      const { data: transactions } = await supabase
        .from('client_transactions')
        .select('type, amount_usd, amount_lbp')
        .eq('client_id', clientId);

      let balanceUsd = 0;
      let balanceLbp = 0;
      
      transactions?.forEach((tx: any) => {
        if (tx.type === 'Debit') {
          balanceUsd += Number(tx.amount_usd);
          balanceLbp += Number(tx.amount_lbp);
        } else {
          balanceUsd -= Number(tx.amount_usd);
          balanceLbp -= Number(tx.amount_lbp);
        }
      });

      // For driver-paid scenarios, this is always cash in (client pays us back)
      const isCashIn = hasDriverPaidOrders || balanceUsd > 0 || balanceLbp > 0;

      // 3. Generate statement ID
      const { data: statementIdData, error: statementError } = await supabase
        .rpc('generate_statement_id');
      
      if (statementError) throw statementError;
      const statementId = statementIdData as string;

      // 4. Create client payment record
      const { error: paymentError } = await supabase
        .from('client_payments')
        .insert({
          statement_id: statementId,
          client_id: clientId,
          amount_usd: Number(amountUsd),
          amount_lbp: Number(amountLbp),
          period_from: dateFrom,
          period_to: dateTo,
          payment_method: paymentMethod,
          notes: notes,
          order_refs: orderIds,
          created_by: user.id,
        });

      if (paymentError) throw paymentError;

      // 5. Create client transaction (Credit - settling balance)
      const { error: transactionError } = await supabase
        .from('client_transactions')
        .insert({
          client_id: clientId,
          type: 'Credit',
          amount_usd: Number(amountUsd),
          amount_lbp: Number(amountLbp),
          note: hasDriverPaidOrders
            ? `Payment received (Driver-paid reimbursement) - Statement ${statementId}`
            : isCashIn 
              ? `Payment received - Statement ${statementId}` 
              : `Payment made to client - Statement ${statementId}`,
          order_ref: statementId,
        });

      if (transactionError) throw transactionError;

      // 6. Update cashbox based on payment direction
      const today = new Date().toISOString().split('T')[0];
      
      const { data: existingCashbox } = await supabase
        .from('cashbox_daily')
        .select('*')
        .eq('date', today)
        .single();

      if (existingCashbox) {
        const updates = isCashIn 
          ? {
              cash_in_usd: Number(existingCashbox.cash_in_usd) + Number(amountUsd),
              cash_in_lbp: Number(existingCashbox.cash_in_lbp) + Number(amountLbp),
              closing_usd: Number(existingCashbox.opening_usd) + Number(existingCashbox.cash_in_usd) + Number(amountUsd) - Number(existingCashbox.cash_out_usd),
              closing_lbp: Number(existingCashbox.opening_lbp) + Number(existingCashbox.cash_in_lbp) + Number(amountLbp) - Number(existingCashbox.cash_out_lbp),
            }
          : {
              cash_out_usd: Number(existingCashbox.cash_out_usd) + Number(amountUsd),
              cash_out_lbp: Number(existingCashbox.cash_out_lbp) + Number(amountLbp),
              closing_usd: Number(existingCashbox.opening_usd) + Number(existingCashbox.cash_in_usd) - Number(existingCashbox.cash_out_usd) - Number(amountUsd),
              closing_lbp: Number(existingCashbox.opening_lbp) + Number(existingCashbox.cash_in_lbp) - Number(existingCashbox.cash_out_lbp) - Number(amountLbp),
            };

        const { error: cashboxError } = await supabase
          .from('cashbox_daily')
          .update(updates)
          .eq('date', today);

        if (cashboxError) throw cashboxError;
      } else {
        const { error: cashboxError } = await supabase
          .from('cashbox_daily')
          .insert({
            date: today,
            opening_usd: 0,
            opening_lbp: 0,
            cash_in_usd: isCashIn ? Number(amountUsd) : 0,
            cash_in_lbp: isCashIn ? Number(amountLbp) : 0,
            cash_out_usd: isCashIn ? 0 : Number(amountUsd),
            cash_out_lbp: isCashIn ? 0 : Number(amountLbp),
            closing_usd: isCashIn ? Number(amountUsd) : -Number(amountUsd),
            closing_lbp: isCashIn ? Number(amountLbp) : -Number(amountLbp),
            notes: isCashIn 
              ? `Client payment from ${clientName}` 
              : `Payment to client ${clientName}`,
          });

        if (cashboxError) throw cashboxError;
      }

      return statementId;
    },
    onSuccess: (statementId) => {
      queryClient.invalidateQueries({ queryKey: ['client-statement'] });
      queryClient.invalidateQueries({ queryKey: ['client-payments'] });
      queryClient.invalidateQueries({ queryKey: ['cashbox-daily'] });
      toast({
        title: 'Payment Recorded',
        description: `Statement ${statementId} created successfully. Payment added to cashbox.`,
      });
      onOpenChange(false);
      // Reset form
      setAmountUsd(amountDue.toFixed(2));
      setAmountLbp('0');
      setPaymentMethod('cash');
      setNotes('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to record payment',
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Record Client Payment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-sm text-muted-foreground">Client</p>
                <p className="font-medium">{clientName}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Period</p>
                <p className="text-sm flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(dateFrom).toLocaleDateString()} - {new Date(dateTo).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground">Total Amount Due</p>
              <p className="text-2xl font-bold text-primary">${amountDue.toFixed(2)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount-usd">Amount USD</Label>
              <Input
                id="amount-usd"
                type="number"
                step="0.01"
                value={amountUsd}
                onChange={(e) => setAmountUsd(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount-lbp">Amount LBP</Label>
              <Input
                id="amount-lbp"
                type="number"
                step="1"
                value={amountLbp}
                onChange={(e) => setAmountLbp(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-method">Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger id="payment-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="check">Check</SelectItem>
                <SelectItem value="card">Card</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this payment..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={() => recordPaymentMutation.mutate()}
              disabled={recordPaymentMutation.isPending}
            >
              {recordPaymentMutation.isPending ? 'Recording...' : 'Record Payment'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
