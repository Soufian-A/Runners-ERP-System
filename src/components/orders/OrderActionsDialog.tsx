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
    amount: 0,
    currency: 'USD' as 'USD' | 'LBP',
  });

  const [driverPaidData, setDriverPaidData] = useState({
    amount: 0,
    currency: 'USD' as 'USD' | 'LBP',
    reason: '',
  });

  const [thirdPartyData, setThirdPartyData] = useState({
    sell_fee_usd: 0,
    sell_fee_lbp: 0,
    buy_cost_usd: 0,
    buy_cost_lbp: 0,
  });

  const [editData, setEditData] = useState({
    address: order?.address || '',
    order_amount_usd: order?.order_amount_usd || 0,
    order_amount_lbp: order?.order_amount_lbp || 0,
    delivery_fee_usd: order?.delivery_fee_usd || 0,
    delivery_fee_lbp: order?.delivery_fee_lbp || 0,
    notes: order?.notes || '',
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (data: any) => {
      const previousStatus = order.status;
      
      // Validate: Cannot mark as Delivered without a driver
      if (data.status === 'Delivered' && !order.driver_id) {
        throw new Error('Cannot mark order as Delivered without assigning a driver');
      }
      
      const updateData: any = {
        status: data.status,
      };

      // Set delivered_at timestamp when status changes to Delivered
      if (previousStatus !== 'Delivered' && data.status === 'Delivered') {
        updateData.delivered_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', order.id);

      if (error) throw error;

      // If status changed to Delivered, process the accounting via edge function
      if (previousStatus !== 'Delivered' && data.status === 'Delivered') {
        console.log('Order marked as delivered, processing accounting...');
        const { error: functionError } = await supabase.functions.invoke('process-order-delivery', {
          body: { orderId: order.id }
        });
        
        if (functionError) {
          console.error('Error processing delivery:', functionError);
          throw new Error('Order updated but accounting failed: ' + functionError.message);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['instant-orders'] });
      queryClient.invalidateQueries({ queryKey: ['ecom-orders'] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
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
      const amountUSD = data.currency === 'USD' ? data.amount : 0;
      const amountLBP = data.currency === 'LBP' ? data.amount : 0;

      // 1. Cashbox: Cash Out
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
            cash_out_usd: Number(cashbox.cash_out_usd) + amountUSD,
            cash_out_lbp: Number(cashbox.cash_out_lbp) + amountLBP,
            closing_usd: Number(cashbox.opening_usd) + Number(cashbox.cash_in_usd) - (Number(cashbox.cash_out_usd) + amountUSD),
            closing_lbp: Number(cashbox.opening_lbp) + Number(cashbox.cash_in_lbp) - (Number(cashbox.cash_out_lbp) + amountLBP),
          })
          .eq('id', cashbox.id);
      } else {
        await supabase.from('cashbox_daily').insert({
          date: today,
          opening_usd: 0,
          opening_lbp: 0,
          cash_in_usd: 0,
          cash_in_lbp: 0,
          cash_out_usd: amountUSD,
          cash_out_lbp: amountLBP,
          closing_usd: -amountUSD,
          closing_lbp: -amountLBP,
        });
      }

      // 2. Accounting: Expense → PrepaidFloat
      await supabase.from('accounting_entries').insert({
        category: 'PrepaidFloat',
        amount_usd: amountUSD,
        amount_lbp: amountLBP,
        order_ref: order.order_id,
        memo: `Prepaid to client for order ${order.order_id}`,
      });

      // 3. Client transaction: Debit (you're owed)
      await supabase.from('client_transactions').insert({
        client_id: order.client_id,
        type: 'Debit',
        amount_usd: amountUSD,
        amount_lbp: amountLBP,
        order_ref: order.order_id,
        note: `Prepayment for order ${order.order_id}`,
      });

      // 4. Update order
      const { error } = await supabase
        .from('orders')
        .update({
          prepaid_by_runners: true,
          prepay_amount_usd: amountUSD,
          prepay_amount_lbp: amountLBP,
        })
        .eq('id', order.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast({
        title: "Prepayment Recorded",
        description: "Prepayment has been recorded in cashbox, accounting, and client transactions.",
      });
      setPrepayData({ amount: 0, currency: 'USD' });
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
      if (!order.driver_id) {
        throw new Error('No driver assigned to this order');
      }

      const amountUSD = data.currency === 'USD' ? data.amount : 0;
      const amountLBP = data.currency === 'LBP' ? data.amount : 0;

      // 1. Driver transaction: Debit (immediately)
      await supabase.from('driver_transactions').insert({
        driver_id: order.driver_id,
        type: 'Debit',
        amount_usd: amountUSD,
        amount_lbp: amountLBP,
        order_ref: order.order_id,
        note: `Driver paid for client: ${data.reason}`,
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
            wallet_usd: Number(driver.wallet_usd) - amountUSD,
            wallet_lbp: Number(driver.wallet_lbp) - amountLBP,
          })
          .eq('id', order.driver_id);
      }

      // 2. Client transaction: Debit (you're owed)
      await supabase.from('client_transactions').insert({
        client_id: order.client_id,
        type: 'Debit',
        amount_usd: amountUSD,
        amount_lbp: amountLBP,
        order_ref: order.order_id,
        note: `Driver paid for client: ${data.reason}`,
      });

      // 3. Update order
      const { error } = await supabase
        .from('orders')
        .update({
          driver_paid_for_client: true,
          driver_paid_amount_usd: amountUSD,
          driver_paid_amount_lbp: amountLBP,
          driver_paid_reason: data.reason,
        })
        .eq('id', order.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast({
        title: "Driver Payment Recorded",
        description: "Driver wallet debited and client transaction recorded.",
      });
      setDriverPaidData({ amount: 0, currency: 'USD', reason: '' });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const editOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from('orders')
        .update({
          address: data.address,
          order_amount_usd: data.order_amount_usd,
          order_amount_lbp: data.order_amount_lbp,
          delivery_fee_usd: data.delivery_fee_usd,
          delivery_fee_lbp: data.delivery_fee_lbp,
          notes: data.notes,
        })
        .eq('id', order.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast({
        title: "Order Updated",
        description: "Order details have been updated successfully.",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Order Actions - {order?.order_id}</DialogTitle>
          <DialogDescription>
            Manage order status, prepayments, and driver transactions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 text-sm bg-muted p-3 rounded-md">
          <p><strong>Client:</strong> {order?.clients?.name} | <strong>Fee Rule:</strong> {order?.client_fee_rule}</p>
          <p><strong>Order Amount:</strong> ${Number(order?.order_amount_usd).toFixed(2)} / {Number(order?.order_amount_lbp).toLocaleString()} LBP</p>
          <p><strong>Delivery Fee:</strong> ${Number(order?.delivery_fee_usd).toFixed(2)} / {Number(order?.delivery_fee_lbp).toLocaleString()} LBP</p>
        </div>

        <Tabs defaultValue="edit" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="status">Status</TabsTrigger>
            <TabsTrigger value="prepay">Prepay</TabsTrigger>
            <TabsTrigger value="driver-paid">Driver Paid</TabsTrigger>
            {order?.fulfillment === 'ThirdParty' && (
              <TabsTrigger value="third-party">3rd Party</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="edit" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit_address">Delivery Address</Label>
              <Input
                id="edit_address"
                value={editData.address}
                onChange={(e) => setEditData({ ...editData, address: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_amount_usd">Order Amount (USD)</Label>
                <Input
                  id="edit_amount_usd"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editData.order_amount_usd}
                  onChange={(e) =>
                    setEditData({ ...editData, order_amount_usd: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_amount_lbp">Order Amount (LBP)</Label>
                <Input
                  id="edit_amount_lbp"
                  type="number"
                  step="1"
                  min="0"
                  value={editData.order_amount_lbp}
                  onChange={(e) =>
                    setEditData({ ...editData, order_amount_lbp: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_fee_usd">Delivery Fee (USD)</Label>
                <Input
                  id="edit_fee_usd"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editData.delivery_fee_usd}
                  onChange={(e) =>
                    setEditData({ ...editData, delivery_fee_usd: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_fee_lbp">Delivery Fee (LBP)</Label>
                <Input
                  id="edit_fee_lbp"
                  type="number"
                  step="1"
                  min="0"
                  value={editData.delivery_fee_lbp}
                  onChange={(e) =>
                    setEditData({ ...editData, delivery_fee_lbp: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_notes">Notes</Label>
              <Textarea
                id="edit_notes"
                value={editData.notes}
                onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                rows={3}
              />
            </div>

            <Button
              onClick={() => editOrderMutation.mutate(editData)}
              disabled={editOrderMutation.isPending}
              className="w-full"
            >
              {editOrderMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </TabsContent>

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
            {statusData.status === 'Delivered' && (
              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-md text-sm">
                <p className="font-medium">When marking as Delivered:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Driver wallet will be credited with delivery fee</li>
                  <li>Accounting entry will record delivery income</li>
                  <li>Client will be credited based on fee rule ({order?.client_fee_rule})</li>
                  {order?.fulfillment === 'ThirdParty' && (
                    <li className="text-red-600">⚠️ Set third-party fees in the 3rd Party tab first!</li>
                  )}
                </ul>
              </div>
            )}
            <Button
              onClick={() => updateStatusMutation.mutate(statusData)}
              disabled={updateStatusMutation.isPending}
              className="w-full"
            >
              {updateStatusMutation.isPending ? 'Updating...' : 'Update Status'}
            </Button>
          </TabsContent>

          <TabsContent value="prepay" className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-md text-sm">
              <p><strong>Prepay to Client:</strong> You pay the merchant at pickup</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Cashbox: Cash Out</li>
                <li>Accounting: Expense → PrepaidFloat</li>
                <li>Client Transactions: Debit (you're owed)</li>
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prepay_amount">Amount</Label>
                <Input
                  id="prepay_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={prepayData.amount}
                  onChange={(e) =>
                    setPrepayData({ ...prepayData, amount: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prepay_currency">Currency</Label>
                <Select
                  value={prepayData.currency}
                  onValueChange={(value: 'USD' | 'LBP') =>
                    setPrepayData({ ...prepayData, currency: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="LBP">LBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={() => prepayMutation.mutate(prepayData)}
              disabled={prepayMutation.isPending || prepayData.amount <= 0}
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
                <div className="bg-orange-50 border border-orange-200 p-3 rounded-md text-sm">
                  <p><strong>Driver Paid for Client:</strong> Groceries, COD, etc.</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Driver Transactions: Debit (immediately)</li>
                    <li>Client Transactions: Debit (you're owed)</li>
                  </ul>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="driver_paid_amount">Amount</Label>
                    <Input
                      id="driver_paid_amount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={driverPaidData.amount}
                      onChange={(e) =>
                        setDriverPaidData({
                          ...driverPaidData,
                          amount: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="driver_paid_currency">Currency</Label>
                    <Select
                      value={driverPaidData.currency}
                      onValueChange={(value: 'USD' | 'LBP') =>
                        setDriverPaidData({ ...driverPaidData, currency: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="LBP">LBP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason *</Label>
                  <Textarea
                    id="reason"
                    value={driverPaidData.reason}
                    onChange={(e) =>
                      setDriverPaidData({ ...driverPaidData, reason: e.target.value })
                    }
                    placeholder="e.g., Groceries, COD payment, etc."
                    required
                  />
                </div>
                <Button
                  onClick={() => driverPaidMutation.mutate(driverPaidData)}
                  disabled={driverPaidMutation.isPending || driverPaidData.amount <= 0 || !driverPaidData.reason}
                  className="w-full"
                >
                  {driverPaidMutation.isPending ? 'Recording...' : 'Record Driver Payment'}
                </Button>
              </>
            )}
          </TabsContent>

          {order?.fulfillment === 'ThirdParty' && (
            <TabsContent value="third-party" className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 p-3 rounded-md text-sm">
                <p><strong>Set before marking as Delivered</strong></p>
                <p className="mt-1">Sell Fee = what you charge client | Buy Cost = what 3P charges</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sell_fee_usd">Sell Fee (USD)</Label>
                  <Input
                    id="sell_fee_usd"
                    type="number"
                    step="0.01"
                    min="0"
                    value={thirdPartyData.sell_fee_usd}
                    onChange={(e) =>
                      setThirdPartyData({ ...thirdPartyData, sell_fee_usd: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sell_fee_lbp">Sell Fee (LBP)</Label>
                  <Input
                    id="sell_fee_lbp"
                    type="number"
                    step="1"
                    min="0"
                    value={thirdPartyData.sell_fee_lbp}
                    onChange={(e) =>
                      setThirdPartyData({ ...thirdPartyData, sell_fee_lbp: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="buy_cost_usd">Buy Cost (USD)</Label>
                  <Input
                    id="buy_cost_usd"
                    type="number"
                    step="0.01"
                    min="0"
                    value={thirdPartyData.buy_cost_usd}
                    onChange={(e) =>
                      setThirdPartyData({ ...thirdPartyData, buy_cost_usd: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="buy_cost_lbp">Buy Cost (LBP)</Label>
                  <Input
                    id="buy_cost_lbp"
                    type="number"
                    step="1"
                    min="0"
                    value={thirdPartyData.buy_cost_lbp}
                    onChange={(e) =>
                      setThirdPartyData({ ...thirdPartyData, buy_cost_lbp: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>Profit USD: ${(thirdPartyData.sell_fee_usd - thirdPartyData.buy_cost_usd).toFixed(2)}</p>
                <p>Profit LBP: {(thirdPartyData.sell_fee_lbp - thirdPartyData.buy_cost_lbp).toLocaleString()} LBP</p>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default OrderActionsDialog;
