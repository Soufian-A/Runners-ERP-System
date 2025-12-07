import { useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Copy, X } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Order {
  id: string;
  order_id: string;
  order_type: 'ecom' | 'instant' | 'errand';
  voucher_no?: string;
  address: string;
  notes?: string;
  order_amount_usd: number;
  order_amount_lbp: number;
  delivery_fee_usd: number;
  delivery_fee_lbp: number;
  amount_due_to_client_usd?: number;
  driver_paid_for_client?: boolean;
  created_at: string;
  customers?: { phone: string; name?: string; address?: string };
}

interface ClientStatementPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: Order[];
  clientName: string;
  dateFrom: string;
  dateTo: string;
  totals: {
    totalOrders: number;
    totalOrderAmountUsd: number;
    totalOrderAmountLbp: number;
    totalDeliveryFeesUsd: number;
    totalDeliveryFeesLbp: number;
    totalDueToClientUsd: number;
    totalDueToClientLbp: number;
  };
}

export function ClientStatementPreview({
  open,
  onOpenChange,
  orders,
  clientName,
  dateFrom,
  dateTo,
  totals,
}: ClientStatementPreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);

  const instantOrders = orders.filter(o => o.order_type === 'instant' || o.order_type === 'errand');
  const ecomOrders = orders.filter(o => o.order_type === 'ecom');

  const calculateDue = (order: Order) => {
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

  const formatAmount = (usd: number, lbp: number) => {
    const parts = [];
    if (usd > 0) parts.push(`$${usd.toFixed(2)}`);
    if (lbp > 0) parts.push(`${lbp.toLocaleString()} LL`);
    return parts.length > 0 ? parts.join(' / ') : '-';
  };

  const generateWhatsAppText = () => {
    let text = `📋 *STATEMENT - ${clientName}*\n`;
    text += `📅 Period: ${format(new Date(dateFrom), 'MMM dd, yyyy')} - ${format(new Date(dateTo), 'MMM dd, yyyy')}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (instantOrders.length > 0) {
      text += `*INSTANT ORDERS (${instantOrders.length})*\n`;
      text += `─────────────────────\n`;
      instantOrders.forEach((order, idx) => {
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
      ecomOrders.forEach((order, idx) => {
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
    toast.success('Statement copied to clipboard - ready to paste in WhatsApp!');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Statement Preview - {clientName}</span>
          </DialogTitle>
          <DialogDescription>
            Period: {format(new Date(dateFrom), 'MMM dd, yyyy')} - {format(new Date(dateTo), 'MMM dd, yyyy')}
          </DialogDescription>
        </DialogHeader>

        <div ref={previewRef} className="flex-1 overflow-auto space-y-6 p-4 bg-background border rounded-lg">
          {/* Instant Orders */}
          {instantOrders.length > 0 && (
            <div>
              <h3 className="font-semibold text-lg mb-3 border-b pb-2">Instant Orders ({instantOrders.length})</h3>
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead>Date</TableHead>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Driver Paid</TableHead>
                    <TableHead className="text-right">Order Amount</TableHead>
                    <TableHead className="text-right">Fee</TableHead>
                    <TableHead className="text-right">Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {instantOrders.map((order) => {
                    const due = calculateDue(order);
                    const orderUsd = Number(order.order_amount_usd || 0);
                    const orderLbp = Number(order.order_amount_lbp || 0);
                    const feeUsd = Number(order.delivery_fee_usd || 0);
                    const feeLbp = Number(order.delivery_fee_lbp || 0);
                    
                    return (
                      <TableRow key={order.id} className="text-sm">
                        <TableCell>{format(new Date(order.created_at), 'MMM dd')}</TableCell>
                        <TableCell className="font-mono">{order.order_id}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{order.address}</TableCell>
                        <TableCell className="max-w-[120px] truncate text-muted-foreground">{order.notes || '-'}</TableCell>
                        <TableCell>
                          {order.driver_paid_for_client ? (
                            <Badge variant="outline" className="text-xs text-blue-600">Yes</Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatAmount(orderUsd, orderLbp)}
                        </TableCell>
                        <TableCell className="text-right">
                          {order.driver_paid_for_client ? formatAmount(feeUsd, feeLbp) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatAmount(due.usd, due.lbp)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Ecom Orders */}
          {ecomOrders.length > 0 && (
            <div>
              <h3 className="font-semibold text-lg mb-3 border-b pb-2">E-Commerce Orders ({ecomOrders.length})</h3>
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead>Voucher #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead className="text-right">Order</TableHead>
                    <TableHead className="text-right">Fee</TableHead>
                    <TableHead className="text-right">Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ecomOrders.map((order) => {
                    const due = calculateDue(order);
                    return (
                      <TableRow key={order.id} className="text-sm">
                        <TableCell className="font-mono">{order.voucher_no || order.order_id}</TableCell>
                        <TableCell>{order.customers?.name || '-'}</TableCell>
                        <TableCell>{order.customers?.phone || '-'}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{order.address}</TableCell>
                        <TableCell className="text-right">${Number(order.order_amount_usd).toFixed(2)}</TableCell>
                        <TableCell className="text-right">${Number(order.delivery_fee_usd).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-semibold">${due.usd.toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Summary */}
          <div className="border-t pt-4 mt-4">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Total Orders</p>
                <p className="text-xl font-bold">{totals.totalOrders}</p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Order Amount</p>
                <p className="text-lg font-bold">
                  {formatAmount(totals.totalOrderAmountUsd, totals.totalOrderAmountLbp)}
                </p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Delivery Fee</p>
                <p className="text-lg font-bold">
                  {formatAmount(totals.totalDeliveryFeesUsd, totals.totalDeliveryFeesLbp)}
                </p>
              </div>
              <div className="p-3 bg-primary/10 rounded-lg border-2 border-primary">
                <p className="text-xs text-muted-foreground">Total Due</p>
                <p className="text-xl font-bold text-primary">
                  {formatAmount(totals.totalDueToClientUsd, totals.totalDueToClientLbp)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="mr-2 h-4 w-4" />
            Close
          </Button>
          <Button onClick={copyToClipboard}>
            <Copy className="mr-2 h-4 w-4" />
            Copy for WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
