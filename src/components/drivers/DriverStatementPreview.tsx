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
  collected_amount_usd: number;
  collected_amount_lbp: number;
  delivery_fee_usd: number;
  delivery_fee_lbp: number;
  driver_paid_for_client?: boolean;
  driver_paid_amount_usd?: number;
  driver_paid_amount_lbp?: number;
  delivered_at: string;
  clients?: { name: string };
}

interface DriverStatementPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: Order[];
  driverName: string;
  dateFrom: string;
  dateTo: string;
  totals: {
    totalCollectedUsd: number;
    totalCollectedLbp: number;
    totalDeliveryFeesUsd: number;
    totalDeliveryFeesLbp: number;
    totalDriverPaidUsd: number;
    totalDriverPaidLbp: number;
  };
  netDueUsd: number;
  netDueLbp: number;
}

export function DriverStatementPreview({
  open,
  onOpenChange,
  orders,
  driverName,
  dateFrom,
  dateTo,
  totals,
  netDueUsd,
  netDueLbp,
}: DriverStatementPreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);

  const formatAmount = (usd: number, lbp: number) => {
    const parts = [];
    if (usd !== 0) parts.push(`$${usd.toFixed(2)}`);
    if (lbp !== 0) parts.push(`${lbp.toLocaleString()} LL`);
    return parts.length > 0 ? parts.join(' / ') : '-';
  };

  const generateWhatsAppText = () => {
    let text = `📋 *DRIVER STATEMENT - ${driverName}*\n`;
    text += `📅 Period: ${format(new Date(dateFrom), 'MMM dd, yyyy')} - ${format(new Date(dateTo), 'MMM dd, yyyy')}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    text += `*ORDERS (${orders.length})*\n`;
    text += `─────────────────────\n`;
    
    orders.forEach((order, idx) => {
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
    toast.success('Statement copied to clipboard - ready to paste in WhatsApp!');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Statement Preview - {driverName}</span>
          </DialogTitle>
          <DialogDescription>
            Period: {format(new Date(dateFrom), 'MMM dd, yyyy')} - {format(new Date(dateTo), 'MMM dd, yyyy')}
          </DialogDescription>
        </DialogHeader>

        <div ref={previewRef} className="flex-1 overflow-auto space-y-6 p-4 bg-background border rounded-lg">
          {/* Orders Table */}
          <div>
            <h3 className="font-semibold text-lg mb-3 border-b pb-2">Orders ({orders.length})</h3>
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>Date</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Collected</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                  <TableHead className="text-right">Driver Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const collectedUsd = Number(order.collected_amount_usd || 0);
                  const collectedLbp = Number(order.collected_amount_lbp || 0);
                  const feeUsd = Number(order.delivery_fee_usd || 0);
                  const feeLbp = Number(order.delivery_fee_lbp || 0);
                  const driverPaidUsd = Number(order.driver_paid_amount_usd || 0);
                  const driverPaidLbp = Number(order.driver_paid_amount_lbp || 0);
                  const orderRef = order.order_type === 'ecom' ? (order.voucher_no || order.order_id) : order.order_id;
                  
                  return (
                    <TableRow key={order.id} className="text-sm">
                      <TableCell>{order.delivered_at ? format(new Date(order.delivered_at), 'MMM dd') : '-'}</TableCell>
                      <TableCell className="font-mono">{orderRef}</TableCell>
                      <TableCell>{order.clients?.name || '-'}</TableCell>
                      <TableCell className="text-right">
                        {formatAmount(collectedUsd, collectedLbp)}
                      </TableCell>
                      <TableCell className="text-right text-status-success">
                        {formatAmount(feeUsd, feeLbp)}
                      </TableCell>
                      <TableCell className="text-right">
                        {order.driver_paid_for_client ? (
                          <span className="text-status-info">{formatAmount(driverPaidUsd, driverPaidLbp)}</span>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Summary */}
          <div className="border-t pt-4 mt-4">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Total Collected</p>
                <p className="text-lg font-bold">
                  {formatAmount(totals.totalCollectedUsd, totals.totalCollectedLbp)}
                </p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Delivery Fees</p>
                <p className="text-lg font-bold text-status-success">
                  {formatAmount(totals.totalDeliveryFeesUsd, totals.totalDeliveryFeesLbp)}
                </p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Driver Paid Refund</p>
                <p className="text-lg font-bold text-status-info">
                  {formatAmount(totals.totalDriverPaidUsd, totals.totalDriverPaidLbp)}
                </p>
              </div>
              <div className="p-3 bg-primary/10 rounded-lg border-2 border-primary">
                <p className="text-xs text-muted-foreground">Net Due</p>
                <p className="text-xl font-bold text-primary">
                  {formatAmount(netDueUsd, netDueLbp)}
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
