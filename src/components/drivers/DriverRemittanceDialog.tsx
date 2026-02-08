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
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Search } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface DriverRemittanceDialogProps {
  driver: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DriverRemittanceDialog = ({ driver, open, onOpenChange }: DriverRemittanceDialogProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

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
        if (order.driver_paid_for_client) {
          // For driver_paid_for_client orders:
          // - Driver did NOT collect cash from customer
          // - Driver PAID money on behalf of company to the client
          // - At remittance, we refund the driver what they paid
          totalDriverPaidRefundUSD += Number(order.driver_paid_amount_usd || 0);
          totalDriverPaidRefundLBP += Number(order.driver_paid_amount_lbp || 0);
          
          // Delivery fees are still income (paid by client, not customer)
          totalDeliveryFeeUSD += Number(order.delivery_fee_usd);
          totalDeliveryFeeLBP += Number(order.delivery_fee_lbp);
          
          // No order amount to credit to client (already handled when driver paid)
        } else {
          // Normal orders: driver collected cash from customer
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
        }
      }

      // Calculate net amounts for cashbox
      // If netDebit is positive: driver owes us (cash in)
      // If netDebit is negative: we owe driver (cash out)
      const netDebitUSD = totalCollectedUSD - totalDriverPaidRefundUSD;
      const netDebitLBP = totalCollectedLBP - totalDriverPaidRefundLBP;
      
      const cashInUsd = netDebitUSD > 0 ? netDebitUSD : 0;
      const cashInLbp = netDebitLBP > 0 ? netDebitLBP : 0;
      const cashOutUsd = netDebitUSD < 0 ? Math.abs(netDebitUSD) : 0;
      const cashOutLbp = netDebitLBP < 0 ? Math.abs(netDebitLBP) : 0;

      // Use atomic cashbox update
      const today = new Date().toISOString().split('T')[0];
      const { error: cashboxError } = await (supabase.rpc as any)('update_cashbox_atomic', {
        p_date: today,
        p_cash_in_usd: cashInUsd,
        p_cash_in_lbp: cashInLbp,
        p_cash_out_usd: cashOutUsd,
        p_cash_out_lbp: cashOutLbp,
      });

      if (cashboxError) throw cashboxError;

      // Debit driver wallet for total collected (if any)
      if (totalCollectedUSD > 0 || totalCollectedLBP > 0) {
        await supabase.from('driver_transactions').insert({
          driver_id: driver.id,
          type: 'Debit',
          amount_usd: totalCollectedUSD,
          amount_lbp: totalCollectedLBP,
          note: `Collected from driver for ${ordersToRemit.length} orders`,
        });
      }

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

      // Use atomic wallet update (net debit = collected - refund)
      const { error: walletError } = await (supabase.rpc as any)('update_driver_wallet_atomic', {
        p_driver_id: driver.id,
        p_amount_usd: -netDebitUSD,
        p_amount_lbp: -netDebitLBP,
      });

      if (walletError) throw walletError;

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

      // Auto-generate driver statement
      const { data: statementIdData } = await supabase.rpc('generate_driver_statement_id');
      
      if (statementIdData) {
        const orderRefs = ordersToRemit.map(o => o.order_type === 'ecom' ? (o.voucher_no || o.order_id) : o.order_id);
        
        await supabase.from('driver_statements').insert({
          driver_id: driver.id,
          statement_id: statementIdData,
          period_from: new Date(Math.min(...ordersToRemit.map((o: any) => new Date(o.delivered_at).getTime()))).toISOString().split('T')[0],
          period_to: new Date(Math.max(...ordersToRemit.map((o: any) => new Date(o.delivered_at).getTime()))).toISOString().split('T')[0],
          total_collected_usd: totalCollectedUSD,
          total_collected_lbp: totalCollectedLBP,
          total_delivery_fees_usd: totalDeliveryFeeUSD,
          total_delivery_fees_lbp: totalDeliveryFeeLBP,
          total_driver_paid_refund_usd: totalDriverPaidRefundUSD,
          total_driver_paid_refund_lbp: totalDriverPaidRefundLBP,
          net_due_usd: totalCollectedUSD - totalDriverPaidRefundUSD,
          net_due_lbp: totalCollectedLBP - totalDriverPaidRefundLBP,
          order_refs: orderRefs,
          status: 'paid',
          paid_date: now,
          payment_method: 'Cash',
          created_by: user?.id,
        });
      }
    
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['driver-pending-orders'] });
      queryClient.invalidateQueries({ queryKey: ['driver-statements'] });
      queryClient.invalidateQueries({ queryKey: ['cashbox'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['client-balances-all'] });
      toast({
        title: "Remittance Recorded & Statement Issued",
        description: "Driver remittance and statement have been created successfully.",
      });
      setSelectedOrders([]);
      setSearchTerm('');
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
      (acc: any, o: any) => {
        const isCompanyPaid = o.company_paid_for_order === true;
        const isDriverPaid = o.driver_paid_for_client === true;
        
        if (isCompanyPaid) {
          // Company-paid orders: no collection, no refund - just track delivery fees
          return {
            ...acc,
            deliveryFeesUsd: acc.deliveryFeesUsd + Number(o.delivery_fee_usd),
            deliveryFeesLbp: acc.deliveryFeesLbp + Number(o.delivery_fee_lbp),
          };
        } else if (isDriverPaid) {
          // For driver_paid orders: no collection, only refund to driver
          return {
            ...acc,
            deliveryFeesUsd: acc.deliveryFeesUsd + Number(o.delivery_fee_usd),
            deliveryFeesLbp: acc.deliveryFeesLbp + Number(o.delivery_fee_lbp),
            driverPaidUsd: acc.driverPaidUsd + Number(o.driver_paid_amount_usd || 0),
            driverPaidLbp: acc.driverPaidLbp + Number(o.driver_paid_amount_lbp || 0),
          };
        } else {
          // Normal orders: driver collected cash
          return {
            ...acc,
            totalCollectionUsd: acc.totalCollectionUsd + Number(o.order_amount_usd) + Number(o.delivery_fee_usd),
            totalCollectionLbp: acc.totalCollectionLbp + Number(o.order_amount_lbp) + Number(o.delivery_fee_lbp),
            orderAmountsUsd: acc.orderAmountsUsd + Number(o.order_amount_usd),
            orderAmountsLbp: acc.orderAmountsLbp + Number(o.order_amount_lbp),
            deliveryFeesUsd: acc.deliveryFeesUsd + Number(o.delivery_fee_usd),
            deliveryFeesLbp: acc.deliveryFeesLbp + Number(o.delivery_fee_lbp),
          };
        }
      },
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
    const filtered = filteredOrders || [];
    if (selectedOrders.length === filtered.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filtered.map((o: any) => o.id));
    }
  };

  // Filter orders based on search
  const filteredOrders = pendingOrders?.filter((order: any) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const orderRef = order.order_type === 'ecom' ? (order.voucher_no || order.order_id) : order.order_id;
    return (
      orderRef.toLowerCase().includes(search) ||
      order.clients?.name?.toLowerCase().includes(search) ||
      order.customers?.phone?.toLowerCase().includes(search) ||
      order.address?.toLowerCase().includes(search)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Collect Payment from Driver - {driver?.name}</DialogTitle>
          <DialogDescription>
            Select delivered orders to collect payment for. This will automatically generate a statement.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading orders...</p>
        ) : pendingOrders && pendingOrders.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by order ID, client, customer, or address..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  {selectedOrders.length} of {filteredOrders?.length || 0} selected
                </p>
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  {selectedOrders.length === filteredOrders?.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
            </div>

            <div className="border rounded-md">
              <div className="max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedOrders.length === filteredOrders?.length && filteredOrders.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Order $ / LL</TableHead>
                      <TableHead>Fee $ / LL</TableHead>
                      <TableHead>Total to Collect</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders?.map((order: any) => {
                      const isDriverPaid = order.driver_paid_for_client;
                      // For driver_paid orders: show refund amount (negative collection)
                      // For normal orders: show total to collect
                      const collectUsd = isDriverPaid ? 0 : Number(order.order_amount_usd) + Number(order.delivery_fee_usd);
                      const collectLbp = isDriverPaid ? 0 : Number(order.order_amount_lbp) + Number(order.delivery_fee_lbp);
                      const refundUsd = isDriverPaid ? Number(order.driver_paid_amount_usd || 0) : 0;
                      const refundLbp = isDriverPaid ? Number(order.driver_paid_amount_lbp || 0) : 0;
                      
                      return (
                        <TableRow 
                          key={order.id}
                          className={selectedOrders.includes(order.id) ? 'bg-muted/50' : ''}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedOrders.includes(order.id)}
                              onCheckedChange={() => handleToggleOrder(order.id)}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {order.order_type === 'ecom' ? (order.voucher_no || order.order_id) : order.order_id}
                          </TableCell>
                          <TableCell className="text-sm">
                            {order.delivered_at ? format(new Date(order.delivered_at), 'MMM dd, HH:mm') : '-'}
                          </TableCell>
                          <TableCell className="text-sm">{order.clients?.name || '-'}</TableCell>
                          <TableCell className="text-sm">
                            {order.customers ? (order.customers.name || order.customers.phone) : '-'}
                          </TableCell>
                          <TableCell className="text-sm">
                            ${Number(order.order_amount_usd).toFixed(2)} / {Number(order.order_amount_lbp).toLocaleString()} LL
                          </TableCell>
                          <TableCell className="text-sm text-green-600">
                            ${Number(order.delivery_fee_usd).toFixed(2)} / {Number(order.delivery_fee_lbp).toLocaleString()} LL
                          </TableCell>
                          <TableCell className="font-semibold text-sm">
                            {isDriverPaid ? (
                              <div className="text-orange-600">
                                <div>Refund: ${refundUsd.toFixed(2)}</div>
                                {refundLbp > 0 && <div>{refundLbp.toLocaleString()} LL</div>}
                              </div>
                            ) : (
                              <>
                                <div>${collectUsd.toFixed(2)}</div>
                                <div className="text-muted-foreground">{collectLbp.toLocaleString()} LL</div>
                              </>
                            )}
                          </TableCell>
                          <TableCell>
                            {order.driver_paid_for_client && (
                              <Badge variant="outline" className="text-orange-600 border-orange-600">
                                Driver Paid
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {selectedOrders.length > 0 && (
              <div className="rounded-md bg-muted p-4 space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Orders Selected</p>
                    <p className="text-xl font-bold">{selectedOrders.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cash to Collect</p>
                    <p className="text-lg font-bold text-primary">${totals.totalCollectionUsd.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">{totals.totalCollectionLbp.toLocaleString()} LL</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Delivery Fees (Income)</p>
                    <p className="text-lg font-bold text-green-600">${totals.deliveryFeesUsd.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">{totals.deliveryFeesLbp.toLocaleString()} LL</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">To Clients</p>
                    <p className="text-lg font-bold">${totals.orderAmountsUsd.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">{totals.orderAmountsLbp.toLocaleString()} LL</p>
                  </div>
                  {(totals.driverPaidUsd > 0 || totals.driverPaidLbp > 0) && (
                    <div>
                      <p className="text-xs text-muted-foreground">Refund to Driver</p>
                      <p className="text-lg font-bold text-orange-600">-${totals.driverPaidUsd.toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">-{totals.driverPaidLbp.toLocaleString()} LL</p>
                    </div>
                  )}
                </div>
                {(totals.driverPaidUsd > 0 || totals.driverPaidLbp > 0) && (
                  <div className="border-t pt-2">
                    <p className="text-xs text-muted-foreground">Net to Cashbox (Collection - Refund)</p>
                    <p className="text-base font-semibold">
                      ${(totals.totalCollectionUsd - totals.driverPaidUsd).toFixed(2)} / {(totals.totalCollectionLbp - totals.driverPaidLbp).toLocaleString()} LL
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => {
                onOpenChange(false);
                setSearchTerm('');
              }}>
                Cancel
              </Button>
              <Button
                onClick={() => remittanceMutation.mutate()}
                disabled={selectedOrders.length === 0 || remittanceMutation.isPending}
              >
                {remittanceMutation.isPending ? 'Processing...' : `Collect Payment & Issue Statement`}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No pending orders to remit.</p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DriverRemittanceDialog;
