import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

interface DriverStatementInlineDetailProps {
  statement: {
    id: string;
    statement_id: string;
    driver_id: string;
    period_from: string;
    period_to: string;
    order_refs: string[] | null;
    total_collected_usd: number | null;
    total_collected_lbp: number | null;
    total_delivery_fees_usd: number | null;
    total_delivery_fees_lbp: number | null;
    total_driver_paid_refund_usd: number | null;
    total_driver_paid_refund_lbp: number | null;
    net_due_usd: number | null;
    net_due_lbp: number | null;
    drivers?: { name: string };
  };
}

export function DriverStatementInlineDetail({ statement }: DriverStatementInlineDetailProps) {
  const { data: orders, isLoading } = useQuery({
    queryKey: ['statement-orders-inline', statement.id],
    queryFn: async () => {
      if (!statement.order_refs?.length) return [];
      
      const { data, error } = await supabase
        .from('orders')
        .select(`*, clients(name)`)
        .or(statement.order_refs.map((ref: string) => `order_id.eq.${ref},voucher_no.eq.${ref}`).join(','));

      if (error) throw error;
      return data || [];
    },
    enabled: !!statement.order_refs?.length,
  });

  const formatAmount = (usd: number, lbp: number) => {
    const parts = [];
    if (usd !== 0) parts.push(`$${usd.toFixed(2)}`);
    if (lbp !== 0) parts.push(`${lbp.toLocaleString()} LL`);
    return parts.length > 0 ? parts.join(' / ') : '-';
  };

  const totals = {
    totalCollectedUsd: Number(statement.total_collected_usd || 0),
    totalCollectedLbp: Number(statement.total_collected_lbp || 0),
    totalDeliveryFeesUsd: Number(statement.total_delivery_fees_usd || 0),
    totalDeliveryFeesLbp: Number(statement.total_delivery_fees_lbp || 0),
    totalDriverPaidUsd: Number(statement.total_driver_paid_refund_usd || 0),
    totalDriverPaidLbp: Number(statement.total_driver_paid_refund_lbp || 0),
  };
  const netDueUsd = Number(statement.net_due_usd || 0);
  const netDueLbp = Number(statement.net_due_lbp || 0);

  const generateWhatsAppText = () => {
    const driverName = statement.drivers?.name || 'Driver';
    let text = `📋 *DRIVER STATEMENT - ${driverName}*\n`;
    text += `📅 Period: ${format(new Date(statement.period_from), 'MMM dd, yyyy')} - ${format(new Date(statement.period_to), 'MMM dd, yyyy')}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    text += `*ORDERS (${orders?.length || 0})*\n`;
    text += `─────────────────────\n`;
    
    orders?.forEach((order: any, idx: number) => {
      const collectedUsd = Number(order.collected_amount_usd || 0);
      const collectedLbp = Number(order.collected_amount_lbp || 0);
      const feeUsd = Number(order.delivery_fee_usd || 0);
      const feeLbp = Number(order.delivery_fee_lbp || 0);
      const driverPaidUsd = Number(order.driver_paid_amount_usd || 0);
      const driverPaidLbp = Number(order.driver_paid_amount_lbp || 0);
      
      const orderRef = order.order_type === 'ecom' ? (order.voucher_no || order.order_id) : order.order_id;
      
      text += `\n${idx + 1}. *${orderRef}*\n`;
      text += `   📅 ${order.delivered_at ? format(new Date(order.delivered_at), 'MMM dd, yyyy') : 'N/A'}\n`;
      text += `   🏪 ${order.clients?.name || 'N/A'}\n`;
      text += `   💰 Collected: ${formatAmount(collectedUsd, collectedLbp)}\n`;
      text += `   🚚 Fee: ${formatAmount(feeUsd, feeLbp)}\n`;
      if (order.driver_paid_for_client) {
        text += `   💳 Driver Paid: ${formatAmount(driverPaidUsd, driverPaidLbp)}\n`;
      }
    });

    text += `\n━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `*SUMMARY*\n`;
    text += `Total Collected: ${formatAmount(totals.totalCollectedUsd, totals.totalCollectedLbp)}\n`;
    text += `Delivery Fees: ${formatAmount(totals.totalDeliveryFeesUsd, totals.totalDeliveryFeesLbp)}\n`;
    text += `Driver Paid Refund: ${formatAmount(totals.totalDriverPaidUsd, totals.totalDriverPaidLbp)}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `*NET DUE: ${formatAmount(netDueUsd, netDueLbp)}*`;

    return text;
  };

  const copyToClipboard = async () => {
    const text = generateWhatsAppText();
    await navigator.clipboard.writeText(text);
    toast.success('Statement copied to clipboard!');
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 bg-muted/30 space-y-4">
      {/* Orders Table */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium text-sm">Orders ({orders?.length || 0})</h4>
          <Button variant="outline" size="sm" onClick={copyToClipboard} className="h-7 text-xs">
            <Copy className="mr-1.5 h-3 w-3" />
            Copy for WhatsApp
          </Button>
        </div>
        <div className="border rounded-lg bg-background">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="py-1.5">Date</TableHead>
                <TableHead className="py-1.5">Order</TableHead>
                <TableHead className="py-1.5">Client</TableHead>
                <TableHead className="py-1.5 text-right">Collected</TableHead>
                <TableHead className="py-1.5 text-right">Fee</TableHead>
                <TableHead className="py-1.5 text-right">Driver Paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders?.map((order: any) => {
                const collectedUsd = Number(order.collected_amount_usd || 0);
                const collectedLbp = Number(order.collected_amount_lbp || 0);
                const feeUsd = Number(order.delivery_fee_usd || 0);
                const feeLbp = Number(order.delivery_fee_lbp || 0);
                const driverPaidUsd = Number(order.driver_paid_amount_usd || 0);
                const driverPaidLbp = Number(order.driver_paid_amount_lbp || 0);
                const orderRef = order.order_type === 'ecom' ? (order.voucher_no || order.order_id) : order.order_id;
                
                return (
                  <TableRow key={order.id} className="text-xs">
                    <TableCell className="py-1.5">{order.delivered_at ? format(new Date(order.delivered_at), 'MMM dd') : '-'}</TableCell>
                    <TableCell className="py-1.5 font-mono">{orderRef}</TableCell>
                    <TableCell className="py-1.5">{order.clients?.name || '-'}</TableCell>
                    <TableCell className="py-1.5 text-right">
                      {formatAmount(collectedUsd, collectedLbp)}
                    </TableCell>
                    <TableCell className="py-1.5 text-right text-status-success">
                      {formatAmount(feeUsd, feeLbp)}
                    </TableCell>
                    <TableCell className="py-1.5 text-right">
                      {order.driver_paid_for_client ? (
                        <span className="text-status-info">{formatAmount(driverPaidUsd, driverPaidLbp)}</span>
                      ) : '-'}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!orders || orders.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-4 text-muted-foreground text-xs">
                    No orders found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        <div className="p-2 bg-background rounded-lg border text-center">
          <p className="text-[10px] text-muted-foreground">Total Collected</p>
          <p className="text-sm font-bold font-mono">
            {formatAmount(totals.totalCollectedUsd, totals.totalCollectedLbp)}
          </p>
        </div>
        <div className="p-2 bg-background rounded-lg border text-center">
          <p className="text-[10px] text-muted-foreground">Delivery Fees</p>
          <p className="text-sm font-bold font-mono text-status-success">
            {formatAmount(totals.totalDeliveryFeesUsd, totals.totalDeliveryFeesLbp)}
          </p>
        </div>
        <div className="p-2 bg-background rounded-lg border text-center">
          <p className="text-[10px] text-muted-foreground">Driver Paid Refund</p>
          <p className="text-sm font-bold font-mono text-status-info">
            {formatAmount(totals.totalDriverPaidUsd, totals.totalDriverPaidLbp)}
          </p>
        </div>
        <div className="p-2 bg-primary/10 rounded-lg border-2 border-primary text-center">
          <p className="text-[10px] text-muted-foreground">Net Due</p>
          <p className="text-base font-bold font-mono text-primary">
            {formatAmount(netDueUsd, netDueLbp)}
          </p>
        </div>
      </div>
    </div>
  );
}
