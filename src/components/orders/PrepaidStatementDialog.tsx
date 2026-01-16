import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Copy, FileText, Wallet } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface Order {
  id: string;
  order_id: string;
  voucher_no?: string;
  order_amount_usd: number;
  order_amount_lbp: number;
  delivery_fee_usd: number;
  delivery_fee_lbp: number;
  address: string;
  customers?: { phone: string; name?: string };
}

interface PrepaidStatementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  selectedOrderIds: string[];
}

export function PrepaidStatementDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  selectedOrderIds,
}: PrepaidStatementDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch selected orders
  const { data: orders, isLoading } = useQuery({
    queryKey: ["prepaid-statement-orders", selectedOrderIds],
    queryFn: async () => {
      if (selectedOrderIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          order_id,
          voucher_no,
          order_amount_usd,
          order_amount_lbp,
          delivery_fee_usd,
          delivery_fee_lbp,
          address,
          customers(phone, name)
        `)
        .in("id", selectedOrderIds);

      if (error) throw error;
      return data as Order[];
    },
    enabled: open && selectedOrderIds.length > 0,
  });

  // Fetch company settings
  const { data: companySettings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("company_settings")
        .select("*")
        .maybeSingle();
      return data;
    },
    enabled: open,
  });

  // Calculate totals
  const totals = useMemo(() => {
    if (!orders) return { orderAmountUsd: 0, orderAmountLbp: 0, feeUsd: 0, feeLbp: 0, netUsd: 0, netLbp: 0 };
    
    const orderAmountUsd = orders.reduce((sum, o) => sum + Number(o.order_amount_usd), 0);
    const orderAmountLbp = orders.reduce((sum, o) => sum + Number(o.order_amount_lbp), 0);
    const feeUsd = orders.reduce((sum, o) => sum + Number(o.delivery_fee_usd), 0);
    const feeLbp = orders.reduce((sum, o) => sum + Number(o.delivery_fee_lbp), 0);
    
    // Net to pay = Order Amount - Delivery Fee
    const netUsd = orderAmountUsd - feeUsd;
    const netLbp = orderAmountLbp - feeLbp;
    
    return { orderAmountUsd, orderAmountLbp, feeUsd, feeLbp, netUsd, netLbp };
  }, [orders]);

  // Process prepayment mutation
  const prepayMutation = useMutation({
    mutationFn: async () => {
      if (!orders || orders.length === 0) throw new Error("No orders to process");

      const today = new Date().toISOString().split('T')[0];
      
      // 1. Update cashbox atomically - cash out (net amount = order - fee)
      const { error: cashboxError } = await (supabase.rpc as any)('update_cashbox_atomic', {
        p_date: today,
        p_cash_in_usd: 0,
        p_cash_in_lbp: 0,
        p_cash_out_usd: totals.netUsd,
        p_cash_out_lbp: totals.netLbp,
      });

      if (cashboxError) throw cashboxError;

      // 2. Create accounting entry for each order
      for (const order of orders) {
        const netUsd = Number(order.order_amount_usd) - Number(order.delivery_fee_usd);
        const netLbp = Number(order.order_amount_lbp) - Number(order.delivery_fee_lbp);
        
        await supabase.from('accounting_entries').insert({
          category: 'PrepaidFloat',
          amount_usd: netUsd,
          amount_lbp: netLbp,
          order_ref: order.voucher_no || order.order_id,
          memo: `Prepaid to ${clientName} for order ${order.voucher_no || order.order_id}`,
        });

        // 3. Create client transaction - Debit (client owes us the order amount they'll collect)
        await supabase.from('client_transactions').insert({
          client_id: clientId,
          type: 'Debit',
          amount_usd: Number(order.order_amount_usd),
          amount_lbp: Number(order.order_amount_lbp),
          order_ref: order.voucher_no || order.order_id,
          note: `Prepaid for order ${order.voucher_no || order.order_id}`,
        });
      }

      // 4. Mark orders as prepaid
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          prepaid_by_company: true,
          prepaid_by_runners: true,
        })
        .in('id', selectedOrderIds);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ecom-orders'] });
      queryClient.invalidateQueries({ queryKey: ['cashbox'] });
      toast({
        title: "Prepayment Processed",
        description: `Paid ${formatCurrency(totals.netUsd, totals.netLbp)} to ${clientName} for ${orders?.length} orders.`,
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

  const formatCurrency = (usd: number, lbp: number) => {
    const parts = [];
    if (usd > 0) parts.push(`$${usd.toFixed(2)}`);
    if (lbp > 0) parts.push(`${lbp.toLocaleString()} LL`);
    return parts.join(" / ") || "$0.00";
  };

  const generateWhatsAppText = () => {
    if (!orders) return "";
    
    const companyName = companySettings?.company_name || "Our Company";
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    
    let text = `📋 *Prepaid Order Statement*\n`;
    text += `From: ${companyName}\n`;
    text += `To: ${clientName}\n`;
    text += `Date: ${today}\n`;
    text += `━━━━━━━━━━━━━━━\n\n`;
    
    text += `*Orders to be picked up:*\n\n`;
    
    orders.forEach((order, index) => {
      text += `${index + 1}. *${order.voucher_no || order.order_id}*\n`;
      text += `   Customer: ${order.customers?.name || order.customers?.phone || 'N/A'}\n`;
      text += `   Address: ${order.address}\n`;
      text += `   Amount: ${formatCurrency(order.order_amount_usd, order.order_amount_lbp)}\n`;
      text += `   Fee: ${formatCurrency(order.delivery_fee_usd, order.delivery_fee_lbp)}\n\n`;
    });
    
    text += `━━━━━━━━━━━━━━━\n`;
    text += `*Summary:*\n`;
    text += `Total Orders: ${orders.length}\n`;
    text += `Total Order Amount: ${formatCurrency(totals.orderAmountUsd, totals.orderAmountLbp)}\n`;
    text += `Delivery Fee: ${formatCurrency(totals.feeUsd, totals.feeLbp)}\n`;
    text += `━━━━━━━━━━━━━━━\n`;
    text += `*Net Amount to Pay: ${formatCurrency(totals.netUsd, totals.netLbp)}*\n`;
    text += `(Order Amount - Delivery Fee)\n`;
    
    return text;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateWhatsAppText());
    toast({
      title: "Copied!",
      description: "Statement copied to clipboard. Paste into WhatsApp.",
    });
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center p-8">Loading...</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Prepaid Statement for {clientName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Review the orders below. When you click "Process Prepayment", the net amount (Order Amount - Delivery Fee) 
            will be deducted from cashbox and paid to the client.
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Voucher</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Address</TableHead>
                <TableHead className="text-right">Order Amount</TableHead>
                <TableHead className="text-right">Delivery Fee</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders?.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.voucher_no || order.order_id}</TableCell>
                  <TableCell>{order.customers?.name || order.customers?.phone || '-'}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{order.address}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(order.order_amount_usd, order.order_amount_lbp)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(order.delivery_fee_usd, order.delivery_fee_lbp)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Separator />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-muted rounded-lg text-center">
              <p className="text-xs text-muted-foreground">Total Orders</p>
              <p className="text-xl font-bold">{orders?.length || 0}</p>
            </div>
            <div className="p-3 bg-muted rounded-lg text-center">
              <p className="text-xs text-muted-foreground">Order Amount</p>
              <p className="text-lg font-bold">
                {formatCurrency(totals.orderAmountUsd, totals.orderAmountLbp)}
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg text-center">
              <p className="text-xs text-muted-foreground">Delivery Fee</p>
              <p className="text-lg font-bold text-muted-foreground">
                -{formatCurrency(totals.feeUsd, totals.feeLbp)}
              </p>
            </div>
            <div className="p-3 bg-primary/10 rounded-lg border-2 border-primary text-center">
              <p className="text-xs text-muted-foreground">Net to Pay</p>
              <p className="text-xl font-bold text-primary">
                {formatCurrency(totals.netUsd, totals.netLbp)}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={copyToClipboard}>
            <Copy className="h-4 w-4 mr-2" />
            Copy for WhatsApp
          </Button>
          <Button 
            onClick={() => prepayMutation.mutate()} 
            disabled={prepayMutation.isPending || !orders?.length}
          >
            <Wallet className="h-4 w-4 mr-2" />
            {prepayMutation.isPending ? "Processing..." : `Pay ${formatCurrency(totals.netUsd, totals.netLbp)} to Client`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}