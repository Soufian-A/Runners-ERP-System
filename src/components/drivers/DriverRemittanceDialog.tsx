import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DriverRemittanceDialogProps {
  driver: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DriverRemittanceDialog = ({ driver, open, onOpenChange }: DriverRemittanceDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  const { data: pendingOrders, isLoading } = useQuery({
    queryKey: ['driver-pending-orders', driver?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          clients(name),
          customers(phone, name, address)
        `)
        .eq('driver_id', driver.id)
        .eq('driver_remit_status', 'Pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!driver?.id && open,
  });

  const remittanceMutation = useMutation({
    mutationFn: async () => {
      const ordersToRemit = pendingOrders?.filter((o: any) =>
        selectedOrders.includes(o.id)
      );

      if (!ordersToRemit || ordersToRemit.length === 0) {
        throw new Error('No orders selected');
      }

      let totalCollectedUSD = 0;
      let totalCollectedLBP = 0;
      let totalOrderAmountUSD = 0;
      let totalOrderAmountLBP = 0;
      let totalDeliveryFeeUSD = 0;
      let totalDeliveryFeeLBP = 0;
      let totalDriverPaidRefundUSD = 0;
      let totalDriverPaidRefundLBP = 0;

      for (const order of ordersToRemit) {
        // Total collected from customer by driver = order amount + delivery fee
        const collectedUSD = Number(order.order_amount_usd) + Number(order.delivery_fee_usd);
        const collectedLBP = Number(order.order_amount_lbp) + Number(order.delivery_fee_lbp);
        
        totalCollectedUSD += collectedUSD;
        totalCollectedLBP += collectedLBP;
        
        // Order amount only (for client credit)
        totalOrderAmountUSD += Number(order.order_amount_usd);
        totalOrderAmountLBP += Number(order.order_amount_lbp);
        
        // Delivery fees (for income)
        totalDeliveryFeeUSD += Number(order.delivery_fee_usd);
        totalDeliveryFeeLBP += Number(order.delivery_fee_lbp);
        
        // Driver paid amount (to refund back to driver)
        if (order.driver_paid_for_client) {
          totalDriverPaidRefundUSD += Number(order.driver_paid_amount_usd || 0);
          totalDriverPaidRefundLBP += Number(order.driver_paid_amount_lbp || 0);
        }
      }

      // Record cashbox in (total collected from driver)
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
            cash_in_usd: Number(cashbox.cash_in_usd) + totalCollectedUSD,
            cash_in_lbp: Number(cashbox.cash_in_lbp) + totalCollectedLBP,
          })
          .eq('id', cashbox.id);
      } else {
        await supabase.from('cashbox_daily').insert({
          date: today,
          opening_usd: 0,
          opening_lbp: 0,
          cash_in_usd: totalCollectedUSD,
          cash_in_lbp: totalCollectedLBP,
          cash_out_usd: 0,
          cash_out_lbp: 0,
          closing_usd: totalCollectedUSD,
          closing_lbp: totalCollectedLBP,
        });
      }

      // Debit driver wallet for total collected
      await supabase.from('driver_transactions').insert({
        driver_id: driver.id,
        type: 'Debit',
        amount_usd: totalCollectedUSD,
        amount_lbp: totalCollectedLBP,
        note: `Collected from driver for ${ordersToRemit.length} orders`,
      });

      // Credit driver wallet back for amounts they paid out of pocket
      if (totalDriverPaidRefundUSD > 0 || totalDriverPaidRefundLBP > 0) {
        await supabase.from('driver_transactions').insert({
          driver_id: driver.id,
          type: 'Credit',
          amount_usd: totalDriverPaidRefundUSD,
          amount_lbp: totalDriverPaidRefundLBP,
          note: `Refund for amounts paid on behalf of clients`,
        });
      }

      const { data: currentDriver } = await supabase
        .from('drivers')
        .select('wallet_usd, wallet_lbp')
        .eq('id', driver.id)
        .single();

      if (currentDriver) {
        const netDebitUSD = totalCollectedUSD - totalDriverPaidRefundUSD;
        const netDebitLBP = totalCollectedLBP - totalDriverPaidRefundLBP;
        
        await supabase
          .from('drivers')
          .update({
            wallet_usd: Number(currentDriver.wallet_usd) - netDebitUSD,
            wallet_lbp: Number(currentDriver.wallet_lbp) - netDebitLBP,
          })
          .eq('id', driver.id);
      }

      // Credit client accounts for order amounts (they've been paid)
      // Group orders by client
      const ordersByClient = ordersToRemit.reduce((acc: any, order: any) => {
        if (!acc[order.client_id]) {
          acc[order.client_id] = [];
        }
        acc[order.client_id].push(order);
        return acc;
      }, {});

      // Create credit transactions for each client
      for (const [clientId, clientOrders] of Object.entries(ordersByClient)) {
        const clientTotalUSD = (clientOrders as any[]).reduce((sum, o) => sum + Number(o.order_amount_usd), 0);
        const clientTotalLBP = (clientOrders as any[]).reduce((sum, o) => sum + Number(o.order_amount_lbp), 0);
        
        if (clientTotalUSD > 0 || clientTotalLBP > 0) {
          const orderIds = (clientOrders as any[]).map(o => o.order_type === 'ecom' ? (o.voucher_no || o.order_id) : o.order_id).join(', ');
          await supabase.from('client_transactions').insert({
            client_id: clientId,
            type: 'Credit',
            amount_usd: clientTotalUSD,
            amount_lbp: clientTotalLBP,
            note: `Payment for orders: ${orderIds}`,
          });
        }
      }

      // Record delivery fees as income
      if (totalDeliveryFeeUSD > 0 || totalDeliveryFeeLBP > 0) {
        await supabase.from('accounting_entries').insert({
          category: 'DeliveryIncome',
          amount_usd: totalDeliveryFeeUSD,
          amount_lbp: totalDeliveryFeeLBP,
          memo: `Delivery fees from driver remittance - ${ordersToRemit.length} orders`,
        });
      }

      // Update orders
      const now = new Date().toISOString();
      for (const order of ordersToRemit) {
        await supabase
          .from('orders')
          .update({
            driver_remit_status: 'Collected',
            driver_remit_date: now,
            collected_amount_usd: Number(order.order_amount_usd) + Number(order.delivery_fee_usd),
            collected_amount_lbp: Number(order.order_amount_lbp) + Number(order.delivery_fee_lbp),
          })
          .eq('id', order.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['driver-pending-orders'] });
      toast({
        title: "Remittance Recorded",
        description: "Driver remittance has been recorded successfully.",
      });
      setSelectedOrders([]);
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

  const handleToggleOrder = (orderId: string) => {
    setSelectedOrders((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    );
  };

  const calculateTotals = () => {
    const selected = pendingOrders?.filter((o: any) => selectedOrders.includes(o.id)) || [];
    
    return selected.reduce(
      (acc: any, o: any) => ({
        totalCollectionUsd: acc.totalCollectionUsd + Number(o.order_amount_usd) + Number(o.driver_paid_amount_usd),
        totalCollectionLbp: acc.totalCollectionLbp + Number(o.order_amount_lbp) + Number(o.driver_paid_amount_lbp),
        orderAmountsUsd: acc.orderAmountsUsd + Number(o.order_amount_usd),
        orderAmountsLbp: acc.orderAmountsLbp + Number(o.order_amount_lbp),
        deliveryFeesUsd: acc.deliveryFeesUsd + Number(o.delivery_fee_usd),
        deliveryFeesLbp: acc.deliveryFeesLbp + Number(o.delivery_fee_lbp),
        driverPaidUsd: acc.driverPaidUsd + Number(o.driver_paid_amount_usd || 0),
        driverPaidLbp: acc.driverPaidLbp + Number(o.driver_paid_amount_lbp || 0),
      }),
      { 
        totalCollectionUsd: 0, 
        totalCollectionLbp: 0,
        orderAmountsUsd: 0,
        orderAmountsLbp: 0,
        deliveryFeesUsd: 0,
        deliveryFeesLbp: 0,
        driverPaidUsd: 0,
        driverPaidLbp: 0,
      }
    );
  };

  const totals = calculateTotals();

  const handleSelectAll = () => {
    if (selectedOrders.length === pendingOrders?.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(pendingOrders?.map((o: any) => o.id) || []);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Driver Remittance - {driver?.name}</DialogTitle>
          <DialogDescription>
            Select orders to collect remittance for
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading orders...</p>
        ) : pendingOrders && pendingOrders.length > 0 ? (
          <>
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm text-muted-foreground">{pendingOrders.length} pending order(s)</p>
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                {selectedOrders.length === pendingOrders.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            <ScrollArea className="h-[400px] w-full rounded-md border p-4">
              <div className="space-y-3">
                {pendingOrders.map((order: any) => (
                  <div
                    key={order.id}
                    className="flex items-start space-x-3 space-y-0 rounded-md border p-3"
                  >
                    <Checkbox
                      id={order.id}
                      checked={selectedOrders.includes(order.id)}
                      onCheckedChange={() => handleToggleOrder(order.id)}
                      className="mt-1"
                    />
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center justify-between">
                        <Label
                          htmlFor={order.id}
                          className="text-sm font-semibold cursor-pointer"
                        >
                          {order.order_type === 'ecom' ? (order.voucher_no || order.order_id) : order.order_id}
                        </Label>
                        {order.driver_paid_for_client && (
                          <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded">Driver Paid</span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <div>
                          <span className="text-muted-foreground">Client:</span>{' '}
                          <span className="font-medium">{order.clients?.name || '-'}</span>
                        </div>
                        {order.customers && (
                          <div>
                            <span className="text-muted-foreground">Customer:</span>{' '}
                            <span className="font-medium">{order.customers.phone}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground">Order Amount:</span>{' '}
                          <span className="font-medium">
                            ${Number(order.order_amount_usd).toFixed(2)} / LL {Number(order.order_amount_lbp).toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Delivery Fee:</span>{' '}
                          <span className="font-medium">
                            ${Number(order.delivery_fee_usd).toFixed(2)} / LL {Number(order.delivery_fee_lbp).toLocaleString()}
                          </span>
                        </div>
                        {order.driver_paid_for_client && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Driver Paid Amount:</span>{' '}
                            <span className="font-medium text-orange-600">
                              ${Number(order.driver_paid_amount_usd).toFixed(2)} / LL {Number(order.driver_paid_amount_lbp).toLocaleString()}
                            </span>
                          </div>
                        )}
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Address:</span>{' '}
                          <span className="font-medium">{order.address}</span>
                        </div>
                        {order.notes && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Notes:</span>{' '}
                            <span className="font-medium">{order.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {selectedOrders.length > 0 && (
              <div className="rounded-md bg-muted p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-lg">Total to Collect from Driver:</p>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">
                      ${totals.totalCollectionUsd.toFixed(2)}
                    </p>
                    <p className="text-lg font-bold text-primary">
                      LL {totals.totalCollectionLbp.toLocaleString()}
                    </p>
                  </div>
                </div>
                
                <div className="text-xs space-y-1 border-t pt-2">
                  <p className="font-medium mb-1">Breakdown of what will happen:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-muted-foreground">→ To Clients (order amounts):</span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium">${totals.orderAmountsUsd.toFixed(2)} / LL {totals.orderAmountsLbp.toLocaleString()}</span>
                    </div>
                    
                    <div>
                      <span className="text-muted-foreground">→ To Income (delivery fees):</span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium">${totals.deliveryFeesUsd.toFixed(2)} / LL {totals.deliveryFeesLbp.toLocaleString()}</span>
                    </div>
                    
                    {(totals.driverPaidUsd > 0 || totals.driverPaidLbp > 0) && (
                      <>
                        <div>
                          <span className="text-muted-foreground">→ Refund to Driver (paid on behalf):</span>
                        </div>
                        <div className="text-right">
                          <span className="font-medium text-orange-600">${totals.driverPaidUsd.toFixed(2)} / LL {totals.driverPaidLbp.toLocaleString()}</span>
                        </div>
                      </>
                    )}
                  </div>
                  <p className="text-muted-foreground pt-1 italic">
                    {selectedOrders.length} order(s) will be marked as collected
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => remittanceMutation.mutate()}
                disabled={selectedOrders.length === 0 || remittanceMutation.isPending}
              >
                {remittanceMutation.isPending ? 'Processing...' : 'Record Remittance'}
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No pending orders to remit.</p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DriverRemittanceDialog;
