import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

export function ClientStatementReport() {
  const [selectedClient, setSelectedClient] = useState('');
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

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

  const calculateTotals = () => {
    if (!orders) return { 
      totalOrders: 0,
      totalOrderAmount: 0, 
      totalDeliveryFees: 0, 
      totalDueToClient: 0,
      deliveredOrders: 0 
    };

    const deliveredOrders = orders.filter(o => o.status === 'Delivered');

    // For instant orders, client owes order_amount + delivery_fee when driver paid for them
    // For ecom orders, use amount_due_to_client_usd
    const totalDueToClient = deliveredOrders.reduce((sum, o) => {
      if (o.order_type === 'instant' && o.driver_paid_for_client) {
        return sum + Number(o.order_amount_usd || 0) + Number(o.delivery_fee_usd || 0);
      }
      return sum + Number(o.amount_due_to_client_usd || 0);
    }, 0);

    return {
      totalOrders: orders.length,
      deliveredOrders: deliveredOrders.length,
      totalOrderAmount: deliveredOrders.reduce((sum, o) => sum + Number(o.order_amount_usd || 0), 0),
      totalDeliveryFees: deliveredOrders.reduce((sum, o) => sum + Number(o.delivery_fee_usd || 0), 0),
      totalDueToClient,
    };
  };

  const totals = calculateTotals();
  const selectedClientData = clients?.find(c => c.id === selectedClient);

  return (
    <div className="space-y-6">
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Statement for {selectedClientData?.name}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Period: {format(new Date(dateFrom), 'MMM dd, yyyy')} - {format(new Date(dateTo), 'MMM dd, yyyy')}
                </p>
              </div>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center text-muted-foreground">Loading...</p>
            ) : orders && orders.length > 0 ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
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
                    <p className="text-2xl font-bold">${totals.totalDeliveryFees.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Amount Due to Client</p>
                    <p className="text-2xl font-bold text-primary">${totals.totalDueToClient.toFixed(2)}</p>
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
                        <TableHead>Order Amount</TableHead>
                        <TableHead>Delivery Fee</TableHead>
                        <TableHead>Driver Paid</TableHead>
                        <TableHead>Due to Client</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order: any) => {
                        const dueToClient = order.order_type === 'instant' && order.driver_paid_for_client
                          ? Number(order.order_amount_usd || 0) + Number(order.delivery_fee_usd || 0)
                          : Number(order.amount_due_to_client_usd || 0);
                        
                        return (
                          <TableRow key={order.id}>
                            <TableCell className="text-xs">
                              {format(new Date(order.created_at), 'MMM dd, HH:mm')}
                            </TableCell>
                            <TableCell className="text-xs">{order.order_id}</TableCell>
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
                            <TableCell>${order.order_amount_usd.toFixed(2)}</TableCell>
                            <TableCell>${order.delivery_fee_usd.toFixed(2)}</TableCell>
                            <TableCell>
                              {order.driver_paid_for_client ? (
                                <Badge variant="destructive" className="text-xs">Yes</Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">No</span>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">
                              ${dueToClient.toFixed(2)}
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
                    <p className="text-sm text-muted-foreground mb-2">Net Amount Due to Client</p>
                    <p className="font-bold text-3xl text-primary">
                      ${totals.totalDueToClient.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Based on {totals.deliveredOrders} delivered orders
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
