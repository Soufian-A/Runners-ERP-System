import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface OrderActionsDialogProps {
  order: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const OrderActionsDialog = ({ order, open, onOpenChange }: OrderActionsDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [statusData, setStatusData] = useState({
    status: order?.status || 'New',
  });
  
  const [prepayData, setPrepayData] = useState({
    amount_usd: 0,
    amount_lbp: 0,
  });

  const [driverPaidData, setDriverPaidData] = useState({
    amount_usd: 0,
    amount_lbp: 0,
    reason: '',
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (data: any) => {
      const updateData: any = {
        status: data.status,
      };

      if (data.status === 'Delivered') {
        updateData.delivered_at = new Date().toISOString();
        
        // Create accounting entry for delivery income
        await supabase.from('accounting_entries').insert({
          category: 'DeliveryIncome',
          amount_usd: order.delivery_fee_usd,
          amount_lbp: order.delivery_fee_lbp,
          order_ref: order.order_id,
          memo: `Delivery income for order ${order.order_id}`,
        });

        // Credit driver wallet if InHouse
        if (order.fulfillment === 'InHouse' && order.driver_id) {
          await supabase.from('driver_transactions').insert({
            driver_id: order.driver_id,
            type: 'Credit',
            amount_usd: order.delivery_fee_usd,
            amount_lbp: order.delivery_fee_lbp,
            order_ref: order.order_id,
            note: `Delivery fee for order ${order.order_id}`,
          });

          // Update driver wallet
          const { data: driver } = await supabase
            .from('drivers')
            .select('wallet_usd, wallet_lbp')
            .eq('id', order.driver_id)
            .single();

          if (driver) {
            await supabase
              .from('drivers')
              .update({
                wallet_usd: Number(driver.wallet_usd) + Number(order.delivery_fee_usd),
                wallet_lbp: Number(driver.wallet_lbp) + Number(order.delivery_fee_lbp),
              })
              .eq('id', order.driver_id);
          }

          // Set remittance pending if driver collected cash
          if (order.order_amount_usd > 0 || order.order_amount_lbp > 0) {
            updateData.driver_remit_status = 'Pending';
          }
        }

        // Credit client based on fee rule
        let clientCreditUSD = 0;
        let clientCreditLBP = 0;
        
        if (order.client_fee_rule === 'ADD_ON') {
          clientCreditUSD = order.order_amount_usd;
          clientCreditLBP = order.order_amount_lbp;
        } else if (order.client_fee_rule === 'DEDUCT') {
          clientCreditUSD = Number(order.order_amount_usd) - Number(order.delivery_fee_usd);
          clientCreditLBP = Number(order.order_amount_lbp) - Number(order.delivery_fee_lbp);
        } else if (order.client_fee_rule === 'INCLUDED') {
          clientCreditUSD = order.order_amount_usd;
          clientCreditLBP = order.order_amount_lbp;
        }

        await supabase.from('client_transactions').insert({
          client_id: order.client_id,
          type: 'Credit',
          amount_usd: clientCreditUSD,
          amount_lbp: clientCreditLBP,
          order_ref: order.order_id,
          note: `Payment for order ${order.order_id}`,
        });
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', order.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast({
        title: "Status Updated",
        description: "Order status has been updated successfully.",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const prepayMutation = useMutation({
    mutationFn: async (data: any) => {
      // Record cashbox out
      const today = new Date().toISOString().split('T')[0];
      const { data: cashbox } = await supabase
        .from('cashbox_daily')
        .select('*')
        .eq('date', today)
        .maybeSingle();

      if (cashbox) {
        await supabase
          .from('cashbox_daily')
          .update({
            cash_out_usd: Number(cashbox.cash_out_usd) + Number(data.amount_usd),
            cash_out_lbp: Number(cashbox.cash_out_lbp) + Number(data.amount_lbp),
          })
          .eq('id', cashbox.id);
      }

      // Accounting entry
      await supabase.from('accounting_entries').insert({
        category: 'PrepaidFloat',
        amount_usd: data.amount_usd,
        amount_lbp: data.amount_lbp,
        order_ref: order.order_id,
        memo: `Prepaid to client for order ${order.order_id}`,
      });

      // Client transaction debit
      await supabase.from('client_transactions').insert({
        client_id: order.client_id,
        type: 'Debit',
        amount_usd: data.amount_usd,
        amount_lbp: data.amount_lbp,
        order_ref: order.order_id,
        note: `Prepayment for order ${order.order_id}`,
      });

      // Update order
      const { error } = await supabase
        .from('orders')
        .update({
          prepaid_by_runners: true,
          prepay_amount_usd: data.amount_usd,
          prepay_amount_lbp: data.amount_lbp,
        })
        .eq('id', order.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast({
        title: "Prepayment Recorded",
        description: "Prepayment has been recorded successfully.",
      });
      setPrepayData({ amount_usd: 0, amount_lbp: 0 });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const driverPaidMutation = useMutation({
    mutationFn: async (data: any) => {
      // Debit driver wallet
      await supabase.from('driver_transactions').insert({
        driver_id: order.driver_id,
        type: 'Debit',
        amount_usd: data.amount_usd,
        amount_lbp: data.amount_lbp,
        order_ref: order.order_id,
        note: data.reason,
      });

      const { data: driver } = await supabase
        .from('drivers')
        .select('wallet_usd, wallet_lbp')
        .eq('id', order.driver_id)
        .single();

      if (driver) {
        await supabase
          .from('drivers')
          .update({
            wallet_usd: Number(driver.wallet_usd) - Number(data.amount_usd),
            wallet_lbp: Number(driver.wallet_lbp) - Number(data.amount_lbp),
          })
          .eq('id', order.driver_id);
      }

      // Debit client
      await supabase.from('client_transactions').insert({
        client_id: order.client_id,
        type: 'Debit',
        amount_usd: data.amount_usd,
        amount_lbp: data.amount_lbp,
        order_ref: order.order_id,
        note: `Driver paid for client: ${data.reason}`,
      });

      // Update order
      const { error } = await supabase
        .from('orders')
        .update({
          driver_paid_for_client: true,
          driver_paid_amount_usd: data.amount_usd,
          driver_paid_amount_lbp: data.amount_lbp,
          driver_paid_reason: data.reason,
        })
        .eq('id', order.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast({
        title: "Driver Payment Recorded",
        description: "Driver payment has been recorded successfully.",
      });
      setDriverPaidData({ amount_usd: 0, amount_lbp: 0, reason: '' });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Order Actions - {order?.order_id}</DialogTitle>
          <DialogDescription>
            Manage order status and financial transactions
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="status" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="status">Status</TabsTrigger>
            <TabsTrigger value="prepay">Prepay</TabsTrigger>
            <TabsTrigger value="driver-paid">Driver Paid</TabsTrigger>
          </TabsList>

          <TabsContent value="status" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="status">Update Status</Label>
              <Select
                value={statusData.status}
                onValueChange={(value) => setStatusData({ status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="New">New</SelectItem>
                  <SelectItem value="Assigned">Assigned</SelectItem>
                  <SelectItem value="PickedUp">Picked Up</SelectItem>
                  <SelectItem value="Delivered">Delivered</SelectItem>
                  <SelectItem value="Returned">Returned</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => updateStatusMutation.mutate(statusData)}
              disabled={updateStatusMutation.isPending}
              className="w-full"
            >
              {updateStatusMutation.isPending ? 'Updating...' : 'Update Status'}
            </Button>
          </TabsContent>

          <TabsContent value="prepay" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prepay_usd">Amount (USD)</Label>
                <Input
                  id="prepay_usd"
                  type="number"
                  step="0.01"
                  min="0"
                  value={prepayData.amount_usd}
                  onChange={(e) =>
                    setPrepayData({ ...prepayData, amount_usd: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prepay_lbp">Amount (LBP)</Label>
                <Input
                  id="prepay_lbp"
                  type="number"
                  step="1"
                  min="0"
                  value={prepayData.amount_lbp}
                  onChange={(e) =>
                    setPrepayData({ ...prepayData, amount_lbp: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
            </div>
            <Button
              onClick={() => prepayMutation.mutate(prepayData)}
              disabled={prepayMutation.isPending}
              className="w-full"
            >
              {prepayMutation.isPending ? 'Recording...' : 'Record Prepayment'}
            </Button>
          </TabsContent>

          <TabsContent value="driver-paid" className="space-y-4">
            {!order?.driver_id ? (
              <p className="text-sm text-muted-foreground">
                This order doesn't have an assigned driver.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="driver_paid_usd">Amount (USD)</Label>
                    <Input
                      id="driver_paid_usd"
                      type="number"
                      step="0.01"
                      min="0"
                      value={driverPaidData.amount_usd}
                      onChange={(e) =>
                        setDriverPaidData({
                          ...driverPaidData,
                          amount_usd: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="driver_paid_lbp">Amount (LBP)</Label>
                    <Input
                      id="driver_paid_lbp"
                      type="number"
                      step="1"
                      min="0"
                      value={driverPaidData.amount_lbp}
                      onChange={(e) =>
                        setDriverPaidData({
                          ...driverPaidData,
                          amount_lbp: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason</Label>
                  <Textarea
                    id="reason"
                    value={driverPaidData.reason}
                    onChange={(e) =>
                      setDriverPaidData({ ...driverPaidData, reason: e.target.value })
                    }
                    placeholder="e.g., Groceries, COD payment, etc."
                  />
                </div>
                <Button
                  onClick={() => driverPaidMutation.mutate(driverPaidData)}
                  disabled={driverPaidMutation.isPending}
                  className="w-full"
                >
                  {driverPaidMutation.isPending ? 'Recording...' : 'Record Driver Payment'}
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default OrderActionsDialog;
