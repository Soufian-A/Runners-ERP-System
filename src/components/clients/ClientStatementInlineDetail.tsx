import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

interface ClientStatementInlineDetailProps {
  statement: {
    id: string;
    statement_id: string;
    client_id: string;
    period_from: string;
    period_to: string;
    order_refs: string[] | null;
    total_orders: number | null;
    total_order_amount_usd: number | null;
    total_order_amount_lbp: number | null;
    total_delivery_fees_usd: number | null;
    total_delivery_fees_lbp: number | null;
    net_due_usd: number | null;
    net_due_lbp: number | null;
    clients?: { name: string };
  };
}

export function ClientStatementInlineDetail({ statement }: ClientStatementInlineDetailProps) {
  const { data: orders, isLoading } = useQuery({
    queryKey: ['client-statement-orders-inline', statement.id],
    queryFn: async () => {
      if (!statement.order_refs?.length) return [];
      
      const { data, error } = await supabase
        .from('orders')
        .select(`*, customers(phone, name, address), drivers(name)`)
        .or(statement.order_refs.map((ref: string) => `order_id.eq.${ref},voucher_no.eq.${ref}`).join(','));

      if (error) throw error;
      return data || [];
    },
    enabled: !!statement.order_refs?.length,
  });

  const formatAmount = (usd: number, lbp: number) => {
    const parts = [];
    if (usd > 0) parts.push(`$${usd.toFixed(2)}`);
    if (lbp > 0) parts.push(`${lbp.toLocaleString()} LL`);
    return parts.length > 0 ? parts.join(' / ') : '-';
  };

  const calculateDue = (order: any) => {
    if (order.order_type === 'instant' || order.order_type === 'errand') {
      if (order.driver_paid_for_client) {
        return {
          usd: Number(order.order_amount_usd || 0) + Number(order.delivery_fee_usd || 0),
          lbp: Number(order.order_amount_lbp || 0) + Number(order.delivery_fee_lbp || 0),
        };
      }
      return {
        usd: Number(order.order_amount_usd || 0),
        lbp: Number(order.order_amount_lbp || 0),
      };
    }
    return {
      usd: Number(order.amount_due_to_client_usd || 0),
      lbp: 0,
    };
  };

  const totals = {
    totalOrders: Number(statement.total_orders || 0),
    totalOrderAmountUsd: Number(statement.total_order_amount_usd || 0),
    totalOrderAmountLbp: Number(statement.total_order_amount_lbp || 0),
    totalDeliveryFeesUsd: Number(statement.total_delivery_fees_usd || 0),
    totalDeliveryFeesLbp: Number(statement.total_delivery_fees_lbp || 0),
    totalDueToClientUsd: Number(statement.net_due_usd || 0),
    totalDueToClientLbp: Number(statement.net_due_lbp || 0),
  };

  const instantOrders = orders?.filter((o: any) => o.order_type === 'instant' || o.order_type === 'errand') || [];
  const ecomOrders = orders?.filter((o: any) => o.order_type === 'ecom') || [];

  const generateWhatsAppText = () => {
    const clientName = statement.clients?.name || 'Client';
    let text = `📋 *STATEMENT - ${clientName}*\n`;
    text += `📅 Period: ${format(new Date(statement.period_from), 'MMM dd, yyyy')} - ${format(new Date(statement.period_to), 'MMM dd, yyyy')}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (instantOrders.length > 0) {
      text += `*INSTANT ORDERS (${instantOrders.length})*\n`;
      text += `─────────────────────\n`;
      instantOrders.forEach((order: any, idx: number) => {
        const due = calculateDue(order);
        const orderUsd = Number(order.order_amount_usd || 0);
        const orderLbp = Number(order.order_amount_lbp || 0);
        const feeUsd = Number(order.delivery_fee_usd || 0);
        const feeLbp = Number(order.delivery_fee_lbp || 0);
        
        text += `\n${idx + 1}. *${order.order_id}*\n`;
        text += `   📅 ${format(new Date(order.created_at), 'MMM dd, yyyy')}\n`;
        text += `   📍 ${order.address}\n`;
        if (order.notes) text += `   📝 ${order.notes}\n`;
        text += `   💰 Order: ${formatAmount(orderUsd, orderLbp)}\n`;
        if (order.driver_paid_for_client) {
          text += `   🚚 Delivery Fee: ${formatAmount(feeUsd, feeLbp)}\n`;
        }
        text += `   ✅ Due: *${formatAmount(due.usd, due.lbp)}*\n`;
      });
      text += `\n`;
    }

    if (ecomOrders.length > 0) {
      text += `*E-COMMERCE ORDERS (${ecomOrders.length})*\n`;
      text += `─────────────────────\n`;
      ecomOrders.forEach((order: any, idx: number) => {
        const due = calculateDue(order);
        text += `\n${idx + 1}. *${order.voucher_no || order.order_id}*\n`;
        text += `   👤 ${order.customers?.name || 'N/A'}\n`;
        text += `   📞 ${order.customers?.phone || 'N/A'}\n`;
        text += `   📍 ${order.address}\n`;
        text += `   💵 Order: $${Number(order.order_amount_usd).toFixed(2)}\n`;
        text += `   🚚 Delivery Fee: $${Number(order.delivery_fee_usd).toFixed(2)}\n`;
        text += `   ✅ Due: *$${due.usd.toFixed(2)}*\n`;
      });
      text += `\n`;
    }

    text += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `*SUMMARY*\n`;
    text += `Total Orders: ${totals.totalOrders}\n`;
    text += `Order Amount: ${formatAmount(totals.totalOrderAmountUsd, totals.totalOrderAmountLbp)}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `*NET DUE: ${formatAmount(totals.totalDueToClientUsd, totals.totalDueToClientLbp)}*`;

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
      {/* Copy Button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={copyToClipboard} className="h-7 text-xs">
          <Copy className="mr-1.5 h-3 w-3" />
          Copy for WhatsApp
        </Button>
      </div>

      {/* Instant Orders */}
      {instantOrders.length > 0 && (
        <div>
          <h4 className="font-medium text-sm mb-2">Instant Orders ({instantOrders.length})</h4>
          <div className="border rounded-lg bg-background">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead className="py-1.5">Date</TableHead>
                  <TableHead className="py-1.5">Order ID</TableHead>
                  <TableHead className="py-1.5">Address</TableHead>
                  <TableHead className="py-1.5">Notes</TableHead>
                  <TableHead className="py-1.5">Driver Paid</TableHead>
                  <TableHead className="py-1.5 text-right">Order Amount</TableHead>
                  <TableHead className="py-1.5 text-right">Fee</TableHead>
                  <TableHead className="py-1.5 text-right">Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instantOrders.map((order: any) => {
                  const due = calculateDue(order);
                  const orderUsd = Number(order.order_amount_usd || 0);
                  const orderLbp = Number(order.order_amount_lbp || 0);
                  const feeUsd = Number(order.delivery_fee_usd || 0);
                  const feeLbp = Number(order.delivery_fee_lbp || 0);
                  
                  return (
                    <TableRow key={order.id} className="text-xs">
                      <TableCell className="py-1.5">{format(new Date(order.created_at), 'MMM dd')}</TableCell>
                      <TableCell className="py-1.5 font-mono">{order.order_id}</TableCell>
                      <TableCell className="py-1.5 max-w-[150px] truncate">{order.address}</TableCell>
                      <TableCell className="py-1.5 max-w-[120px] truncate text-muted-foreground">{order.notes || '-'}</TableCell>
                      <TableCell className="py-1.5">
                        {order.driver_paid_for_client ? (
                          <Badge variant="outline" className="text-[10px] text-blue-600">Yes</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="py-1.5 text-right">
                        {formatAmount(orderUsd, orderLbp)}
                      </TableCell>
                      <TableCell className="py-1.5 text-right">
                        {order.driver_paid_for_client ? formatAmount(feeUsd, feeLbp) : '-'}
                      </TableCell>
                      <TableCell className="py-1.5 text-right font-semibold">
                        {formatAmount(due.usd, due.lbp)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* E-Commerce Orders */}
      {ecomOrders.length > 0 && (
        <div>
          <h4 className="font-medium text-sm mb-2">E-Commerce Orders ({ecomOrders.length})</h4>
          <div className="border rounded-lg bg-background">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead className="py-1.5">Voucher #</TableHead>
                  <TableHead className="py-1.5">Customer</TableHead>
                  <TableHead className="py-1.5">Phone</TableHead>
                  <TableHead className="py-1.5">Address</TableHead>
                  <TableHead className="py-1.5 text-right">Order</TableHead>
                  <TableHead className="py-1.5 text-right">Fee</TableHead>
                  <TableHead className="py-1.5 text-right">Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ecomOrders.map((order: any) => {
                  const due = calculateDue(order);
                  return (
                    <TableRow key={order.id} className="text-xs">
                      <TableCell className="py-1.5 font-mono">{order.voucher_no || order.order_id}</TableCell>
                      <TableCell className="py-1.5">{order.customers?.name || '-'}</TableCell>
                      <TableCell className="py-1.5">{order.customers?.phone || '-'}</TableCell>
                      <TableCell className="py-1.5 max-w-[150px] truncate">{order.address}</TableCell>
                      <TableCell className="py-1.5 text-right">${Number(order.order_amount_usd).toFixed(2)}</TableCell>
                      <TableCell className="py-1.5 text-right">${Number(order.delivery_fee_usd).toFixed(2)}</TableCell>
                      <TableCell className="py-1.5 text-right font-semibold">${due.usd.toFixed(2)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        <div className="p-2 bg-background rounded-lg border text-center">
          <p className="text-[10px] text-muted-foreground">Total Orders</p>
          <p className="text-base font-bold">{totals.totalOrders}</p>
        </div>
        <div className="p-2 bg-background rounded-lg border text-center">
          <p className="text-[10px] text-muted-foreground">Order Amount</p>
          <p className="text-sm font-bold font-mono">
            {formatAmount(totals.totalOrderAmountUsd, totals.totalOrderAmountLbp)}
          </p>
        </div>
        <div className="p-2 bg-background rounded-lg border text-center">
          <p className="text-[10px] text-muted-foreground">Delivery Fee</p>
          <p className="text-sm font-bold font-mono">
            {formatAmount(totals.totalDeliveryFeesUsd, totals.totalDeliveryFeesLbp)}
          </p>
        </div>
        <div className="p-2 bg-primary/10 rounded-lg border-2 border-primary text-center">
          <p className="text-[10px] text-muted-foreground">Total Due</p>
          <p className="text-base font-bold font-mono text-primary">
            {formatAmount(totals.totalDueToClientUsd, totals.totalDueToClientLbp)}
          </p>
        </div>
      </div>
    </div>
  );
}
