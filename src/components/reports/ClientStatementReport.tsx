import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { ClientPaymentDialog } from './ClientPaymentDialog';

export function ClientStatementReport() {
  const [selectedClient, setSelectedClient] = useState('');
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  const { data: companySettings } = useQuery({
    queryKey: ['company-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  const { data: clients } = useQuery({
    queryKey: ['clients-for-statement'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: orders, isLoading } = useQuery({
    queryKey: ['client-statement', selectedClient, dateFrom, dateTo],
    queryFn: async () => {
      if (!selectedClient) return null;

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          customers(phone, name, address),
          drivers(name),
          third_parties(name)
        `)
        .eq('client_id', selectedClient)
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo + 'T23:59:59')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!selectedClient,
  });

  const { data: payments } = useQuery({
    queryKey: ['client-statement-payments', selectedClient, dateFrom, dateTo],
    queryFn: async () => {
      if (!selectedClient) return [];

      const { data, error } = await supabase
        .from('client_payments')
        .select('amount_usd, amount_lbp, period_from, period_to')
        .eq('client_id', selectedClient)
        .eq('period_from', dateFrom)
        .eq('period_to', dateTo);

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedClient,
  });

  const calculateTotals = () => {
    if (!orders) return { 
      totalOrders: 0,
      totalOrderAmountUsd: 0,
      totalOrderAmountLbp: 0, 
      totalDeliveryFeesUsd: 0,
      totalDeliveryFeesLbp: 0, 
      totalDueToClientUsd: 0,
      totalDueToClientLbp: 0,
      deliveredOrders: 0 
    };

    const deliveredOrders = orders.filter(o => o.status === 'Delivered');

    // For instant orders:
    // - If driver paid for client: client owes order_amount + delivery_fee (driver didn't collect either)
    // - If driver collected: client owes order_amount only (we keep delivery fee)
    // For ecom orders: use amount_due_to_client_usd/lbp (based on fee rule)
    const totalDueToClientUsd = deliveredOrders.reduce((sum, o) => {
      if (o.order_type === 'instant') {
        if (o.driver_paid_for_client) {
          return sum + Number(o.order_amount_usd || 0) + Number(o.delivery_fee_usd || 0);
        } else {
          return sum + Number(o.order_amount_usd || 0);
        }
      }
      return sum + Number(o.amount_due_to_client_usd || 0);
    }, 0);

    const totalDueToClientLbp = deliveredOrders.reduce((sum, o) => {
      if (o.order_type === 'instant') {
        if (o.driver_paid_for_client) {
          return sum + Number(o.order_amount_lbp || 0) + Number(o.delivery_fee_lbp || 0);
        } else {
          return sum + Number(o.order_amount_lbp || 0);
        }
      }
      return sum + Number(o.amount_due_to_client_usd || 0); // Note: ecom doesn't have _lbp field
    }, 0);

    return {
      totalOrders: orders.length,
      deliveredOrders: deliveredOrders.length,
      totalOrderAmountUsd: deliveredOrders.reduce((sum, o) => sum + Number(o.order_amount_usd || 0), 0),
      totalOrderAmountLbp: deliveredOrders.reduce((sum, o) => sum + Number(o.order_amount_lbp || 0), 0),
      totalDeliveryFeesUsd: deliveredOrders.reduce((sum, o) => sum + Number(o.delivery_fee_usd || 0), 0),
      totalDeliveryFeesLbp: deliveredOrders.reduce((sum, o) => sum + Number(o.delivery_fee_lbp || 0), 0),
      totalDueToClientUsd,
      totalDueToClientLbp,
    };
  };

  const totals = calculateTotals();

  const totalPaymentsUsd = payments?.reduce((sum: number, p: any) => sum + Number(p.amount_usd || 0), 0) ?? 0;
  const totalPaymentsLbp = payments?.reduce((sum: number, p: any) => sum + Number(p.amount_lbp || 0), 0) ?? 0;

  const netDueUsd = totals.totalDueToClientUsd - totalPaymentsUsd;
  const netDueLbp = totals.totalDueToClientLbp - totalPaymentsLbp;

  const safeNetDueUsd = netDueUsd < 0 ? 0 : netDueUsd;
  const safeNetDueLbp = netDueLbp < 0 ? 0 : netDueLbp;

  const isClientOwesUs = netDueUsd < 0 || netDueLbp < 0;
  const displayNetUsd = Math.abs(netDueUsd);
  const displayNetLbp = Math.abs(netDueLbp);

  const selectedClientData = clients?.find(c => c.id === selectedClient);
  const orderIds = orders?.map(o => o.order_type === 'ecom' ? (o.voucher_no || o.order_id) : o.order_id) || [];
  const totalDueAmount = safeNetDueUsd + (safeNetDueLbp / 89500); // Rough conversion for payment dialog

  return (
    <div className="space-y-6">
      {paymentDialogOpen && selectedClientData && (
        <ClientPaymentDialog
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          clientId={selectedClient}
          clientName={selectedClientData.name}
          amountDue={totalDueAmount}
          dateFrom={dateFrom}
          dateTo={dateTo}
          orderIds={orderIds}
        />
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Client Statement Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client">Client</Label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger id="client">
                  <SelectValue placeholder="Select client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date-from">From Date</Label>
              <Input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date-to">To Date</Label>
              <Input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedClient && (
        <Card>
          <CardHeader>
            {companySettings?.logo_url && (
              <div className="mb-4 flex justify-center">
                <img 
                  src={companySettings.logo_url} 
                  alt="Company Logo" 
                  className="max-h-16 object-contain"
                />
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Statement for {selectedClientData?.name}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Period: {format(new Date(dateFrom), 'MMM dd, yyyy')} - {format(new Date(dateTo), 'MMM dd, yyyy')}
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={() => setPaymentDialogOpen(true)}
                  disabled={!orders || orders.length === 0 || (safeNetDueUsd === 0 && safeNetDueLbp === 0)}
                >
                  <DollarSign className="mr-2 h-4 w-4" />
                  Record Payment
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Export PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center text-muted-foreground">Loading...</p>
            ) : orders && orders.length > 0 ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Orders</p>
                    <p className="text-2xl font-bold">{totals.totalOrders}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Delivered</p>
                    <p className="text-2xl font-bold text-green-600">{totals.deliveredOrders}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Delivery Fees</p>
                    <p className="text-lg font-bold">${totals.totalDeliveryFeesUsd.toFixed(2)}</p>
                    <p className="text-sm font-semibold">LL {totals.totalDeliveryFeesLbp.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Amount Due (USD)</p>
                    <p className="text-2xl font-bold text-primary">${safeNetDueUsd.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Amount Due (LBP)</p>
                    <p className="text-2xl font-bold text-primary">LL {safeNetDueLbp.toLocaleString()}</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Order USD</TableHead>
                        <TableHead>Order LBP</TableHead>
                        <TableHead>Fee USD</TableHead>
                        <TableHead>Fee LBP</TableHead>
                        <TableHead>Driver Paid</TableHead>
                        <TableHead>Due USD</TableHead>
                        <TableHead>Due LBP</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order: any) => {
                        let dueToClientUsd = 0;
                        let dueToClientLbp = 0;
                        
                        if (order.order_type === 'instant') {
                          if (order.driver_paid_for_client) {
                            dueToClientUsd = Number(order.order_amount_usd || 0) + Number(order.delivery_fee_usd || 0);
                            dueToClientLbp = Number(order.order_amount_lbp || 0) + Number(order.delivery_fee_lbp || 0);
                          } else {
                            dueToClientUsd = Number(order.order_amount_usd || 0);
                            dueToClientLbp = Number(order.order_amount_lbp || 0);
                          }
                        } else {
                          dueToClientUsd = Number(order.amount_due_to_client_usd || 0);
                          dueToClientLbp = 0; // Ecom doesn't have LBP field
                        }
                        
                        return (
                          <TableRow key={order.id}>
                            <TableCell className="text-xs">
                              {format(new Date(order.created_at), 'MMM dd, HH:mm')}
                            </TableCell>
                            <TableCell className="text-xs">{order.order_type === 'ecom' ? (order.voucher_no || order.order_id) : order.order_id}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {order.order_type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col text-xs">
                                <span>{order.customers?.phone}</span>
                                {order.customers?.name && (
                                  <span className="text-muted-foreground">{order.customers.name}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-xs">
                              {order.address}
                            </TableCell>
                            <TableCell className="text-xs">${order.order_amount_usd.toFixed(2)}</TableCell>
                            <TableCell className="text-xs">LL {Number(order.order_amount_lbp || 0).toLocaleString()}</TableCell>
                            <TableCell className="text-xs">${order.delivery_fee_usd.toFixed(2)}</TableCell>
                            <TableCell className="text-xs">LL {Number(order.delivery_fee_lbp || 0).toLocaleString()}</TableCell>
                            <TableCell>
                              {order.driver_paid_for_client ? (
                                <Badge variant="destructive" className="text-xs">Yes</Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">No</span>
                              )}
                            </TableCell>
                            <TableCell className="font-medium text-xs">
                              ${dueToClientUsd.toFixed(2)}
                            </TableCell>
                            <TableCell className="font-medium text-xs">
                              LL {dueToClientLbp.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Badge variant={order.status === 'Delivered' ? 'default' : 'secondary'}>
                                {order.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-6 flex justify-end">
                  <div className="rounded-md bg-primary/10 p-6 border-2 border-primary">
                    <p className="text-sm text-muted-foreground mb-2">
                      {isClientOwesUs ? 'Net Amount Client Owes Us' : 'Net Amount Due to Client'}
                    </p>
                    <p className="font-bold text-2xl text-primary">
                      ${displayNetUsd.toFixed(2)}
                    </p>
                    <p className="font-bold text-2xl text-primary mt-1">
                      LL {displayNetLbp.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Based on {totals.deliveredOrders} delivered orders and recorded payments
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-center text-muted-foreground">
                No orders found for the selected period.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
