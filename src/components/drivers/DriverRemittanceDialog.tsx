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
import { updateCashboxDaily } from '@/lib/cashbox'; // Import the new utility

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
        .select('*')
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

      let totalUSD = 0;
      let totalLBP = 0;

      for (const order of ordersToRemit) {
        totalUSD += Number(order.order_amount_usd) + Number(order.driver_paid_amount_usd);
        totalLBP += Number(order.order_amount_lbp) + Number(order.driver_paid_amount_lbp);
      }

      // Record cashbox in using the new utility
      const today = new Date().toISOString().split('T')[0];
      await updateCashboxDaily({
        date: today,
        cashInUsdChange: totalUSD,
        cashInLbpChange: totalLBP,
        note: `Remittance from driver ${driver.name} for ${ordersToRemit.length} orders`,
      });

      // Debit driver wallet
      await supabase.from('driver_transactions').insert({
        driver_id: driver.id,
        type: 'Debit',
        amount_usd: totalUSD,
        amount_lbp: totalLBP,
        note: `Remittance for ${ordersToRemit.length} orders`,
      });

      const { data: currentDriver } = await supabase
        .from('drivers')
        .select('wallet_usd, wallet_lbp')
        .eq('id', driver.id)
        .single();

      if (currentDriver) {
        await supabase
          .from('drivers')
          .update({
            wallet_usd: Number(currentDriver.wallet_usd) - totalUSD,
            wallet_lbp: Number(currentDriver.wallet_lbp) - totalLBP,
          })
          .eq('id', driver.id);
      }

      // Update orders
      const now = new Date().toISOString();
      for (const order of ordersToRemit) {
        await supabase
          .from('orders')
          .update({
            driver_remit_status: 'Collected',
            driver_remit_date: now,
            collected_amount_usd: Number(order.order_amount_usd) + Number(order.driver_paid_amount_usd),
            collected_amount_lbp: Number(order.order_amount_lbp) + Number(order.driver_paid_amount_lbp),
          })
          .eq('id', order.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['driver-pending-orders'] });
      queryClient.invalidateQueries({ queryKey: ['cashbox'] }); // Invalidate cashbox to reflect changes
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

  const totalSelected = pendingOrders
    ?.filter((o: any) => selectedOrders.includes(o.id))
    .reduce(
      (acc: any, o: any) => ({
        usd: acc.usd + Number(o.order_amount_usd) + Number(o.driver_paid_amount_usd),
        lbp: acc.lbp + Number(o.order_amount_lbp) + Number(o.driver_paid_amount_lbp),
      }),
      { usd: 0, lbp: 0 }
    );

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
            <ScrollArea className="h-[300px] w-full rounded-md border p-4">
              <div className="space-y-4">
                {pendingOrders.map((order: any) => (
                  <div
                    key={order.id}
                    className="flex items-start space-x-3 space-y-0 rounded-md border p-4"
                  >
                    <Checkbox
                      id={order.id}
                      checked={selectedOrders.includes(order.id)}
                      onCheckedChange={() => handleToggleOrder(order.id)}
                    />
                    <div className="space-y-1 flex-1">
                      <Label
                        htmlFor={order.id}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {order.order_id}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Amount: ${Number(order.order_amount_usd).toFixed(2)} /{' '}
                        {Number(order.order_amount_lbp).toLocaleString()} LBP
                        {order.driver_paid_for_client && (
                          <span className="text-orange-600">
                            {' '}+ Driver Paid: ${Number(order.driver_paid_amount_usd).toFixed(2)} /{' '}
                            {Number(order.driver_paid_amount_lbp).toLocaleString()} LBP
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {selectedOrders.length > 0 && (
              <div className="rounded-md bg-muted p-4">
                <p className="font-medium">
                  Total Selected: ${totalSelected?.usd.toFixed(2)} /{' '}
                  {totalSelected?.lbp.toLocaleString()} LBP
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedOrders.length} order(s) selected
                </p>
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