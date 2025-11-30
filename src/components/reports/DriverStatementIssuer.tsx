import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export function DriverStatementIssuer() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDriver, setSelectedDriver] = useState('');
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  const { data: drivers } = useQuery({
    queryKey: ['drivers-for-statement'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Get unpaid orders for the selected driver and period
  const { data: orders, isLoading } = useQuery({
    queryKey: ['driver-statement-orders', selectedDriver, dateFrom, dateTo],
    queryFn: async () => {
      if (!selectedDriver) return null;

      // First, get all statement IDs that include orders in this period
      const { data: statementsData } = await supabase
        .from('driver_statements')
        .select('order_refs, status')
        .eq('driver_id', selectedDriver);

      // Get all order refs that are in paid statements
      const paidOrderRefs = new Set<string>();
      statementsData?.forEach(stmt => {
        if (stmt.status === 'paid' && stmt.order_refs) {
          stmt.order_refs.forEach((ref: string) => paidOrderRefs.add(ref));
        }
      });

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          customers(phone, name),
          clients(name)
        `)
        .eq('driver_id', selectedDriver)
        .eq('driver_remit_status', 'Pending')
        .gte('delivered_at', dateFrom)
        .lte('delivered_at', dateTo + 'T23:59:59')
        .order('delivered_at', { ascending: false });

      if (error) throw error;

      // Filter out orders already in paid statements
      return data?.filter(order => !paidOrderRefs.has(order.order_id)) || [];
    },
    enabled: !!selectedDriver,
  });

  const calculateTotals = () => {
    if (!orders || orders.length === 0) {
      return {
        totalCollectedUsd: 0,
        totalCollectedLbp: 0,
        totalDeliveryFeesUsd: 0,
        totalDeliveryFeesLbp: 0,
        totalDriverPaidRefundUsd: 0,
        totalDriverPaidRefundLbp: 0,
        netDueUsd: 0,
        netDueLbp: 0,
      };
    }

    const totals = orders.reduce((acc, order) => {
      const collectedUsd = Number(order.collected_amount_usd || 0);
      const collectedLbp = Number(order.collected_amount_lbp || 0);
      const feeUsd = Number(order.delivery_fee_usd || 0);
      const feeLbp = Number(order.delivery_fee_lbp || 0);
      const driverPaidUsd = order.driver_paid_for_client ? Number(order.driver_paid_amount_usd || 0) : 0;
      const driverPaidLbp = order.driver_paid_for_client ? Number(order.driver_paid_amount_lbp || 0) : 0;

      return {
        totalCollectedUsd: acc.totalCollectedUsd + collectedUsd,
        totalCollectedLbp: acc.totalCollectedLbp + collectedLbp,
        totalDeliveryFeesUsd: acc.totalDeliveryFeesUsd + feeUsd,
        totalDeliveryFeesLbp: acc.totalDeliveryFeesLbp + feeLbp,
        totalDriverPaidRefundUsd: acc.totalDriverPaidRefundUsd + driverPaidUsd,
        totalDriverPaidRefundLbp: acc.totalDriverPaidRefundLbp + driverPaidLbp,
      };
    }, {
      totalCollectedUsd: 0,
      totalCollectedLbp: 0,
      totalDeliveryFeesUsd: 0,
      totalDeliveryFeesLbp: 0,
      totalDriverPaidRefundUsd: 0,
      totalDriverPaidRefundLbp: 0,
    });

    return {
      ...totals,
      netDueUsd: totals.totalCollectedUsd - totals.totalDriverPaidRefundUsd,
      netDueLbp: totals.totalCollectedLbp - totals.totalDriverPaidRefundLbp,
    };
  };

  const issueStatementMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDriver || !orders || orders.length === 0) {
        throw new Error('No orders to include in statement');
      }

      const totals = calculateTotals();
      const orderRefs = orders.map(o => o.order_id);

      // Generate statement ID
      const { data: statementIdData, error: idError } = await supabase
        .rpc('generate_driver_statement_id');

      if (idError) throw idError;

      // Insert statement
      const { error: insertError } = await supabase
        .from('driver_statements')
        .insert({
          driver_id: selectedDriver,
          statement_id: statementIdData,
          period_from: dateFrom,
          period_to: dateTo,
          total_collected_usd: totals.totalCollectedUsd,
          total_collected_lbp: totals.totalCollectedLbp,
          total_delivery_fees_usd: totals.totalDeliveryFeesUsd,
          total_delivery_fees_lbp: totals.totalDeliveryFeesLbp,
          total_driver_paid_refund_usd: totals.totalDriverPaidRefundUsd,
          total_driver_paid_refund_lbp: totals.totalDriverPaidRefundLbp,
          net_due_usd: totals.netDueUsd,
          net_due_lbp: totals.netDueLbp,
          order_refs: orderRefs,
          status: 'unpaid',
          created_by: user?.id,
        });

      if (insertError) throw insertError;

      return statementIdData;
    },
    onSuccess: (statementId) => {
      toast.success(`Statement ${statementId} issued successfully`);
      queryClient.invalidateQueries({ queryKey: ['driver-statement-orders'] });
      queryClient.invalidateQueries({ queryKey: ['driver-statements'] });
    },
    onError: (error) => {
      toast.error(`Failed to issue statement: ${error.message}`);
    },
  });

  const totals = calculateTotals();
  const selectedDriverData = drivers?.find(d => d.id === selectedDriver);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Driver Statement Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="driver">Driver</Label>
              <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                <SelectTrigger id="driver">
                  <SelectValue placeholder="Select driver..." />
                </SelectTrigger>
                <SelectContent>
                  {drivers?.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.name}
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

      {selectedDriver && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Statement for {selectedDriverData?.name}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Period: {format(new Date(dateFrom), 'MMM dd, yyyy')} - {format(new Date(dateTo), 'MMM dd, yyyy')}
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={() => issueStatementMutation.mutate()}
                  disabled={!orders || orders.length === 0 || issueStatementMutation.isPending}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {issueStatementMutation.isPending ? 'Issuing...' : 'Issue Statement'}
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Orders</p>
                    <p className="text-2xl font-bold">{orders.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Collected</p>
                    <p className="text-lg font-semibold">
                      ${totals.totalCollectedUsd.toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {totals.totalCollectedLbp.toLocaleString()} LBP
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Delivery Fees</p>
                    <p className="text-lg font-semibold text-green-600">
                      ${totals.totalDeliveryFeesUsd.toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {totals.totalDeliveryFeesLbp.toLocaleString()} LBP
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Driver Paid (Refund)</p>
                    <p className="text-lg font-semibold text-blue-600">
                      ${totals.totalDriverPaidRefundUsd.toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {totals.totalDriverPaidRefundLbp.toLocaleString()} LBP
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Collected USD</TableHead>
                        <TableHead>Collected LBP</TableHead>
                        <TableHead>Fee USD</TableHead>
                        <TableHead>Fee LBP</TableHead>
                        <TableHead>Driver Paid</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell>
                            {order.delivered_at ? format(new Date(order.delivered_at), 'MMM dd, yyyy') : '-'}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{order.order_id}</TableCell>
                          <TableCell>{order.clients?.name}</TableCell>
                          <TableCell>
                            {order.customers?.name || order.customers?.phone || '-'}
                          </TableCell>
                          <TableCell>${Number(order.collected_amount_usd || 0).toFixed(2)}</TableCell>
                          <TableCell>{Number(order.collected_amount_lbp || 0).toLocaleString()} LL</TableCell>
                          <TableCell className="text-green-600">
                            ${Number(order.delivery_fee_usd || 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-green-600">
                            {Number(order.delivery_fee_lbp || 0).toLocaleString()} LL
                          </TableCell>
                          <TableCell>
                            {order.driver_paid_for_client ? (
                              <Badge variant="outline" className="text-blue-600">
                                ${Number(order.driver_paid_amount_usd || 0).toFixed(2)}
                              </Badge>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-6 flex justify-end">
                  <div className="rounded-md bg-muted p-6 space-y-2 min-w-[300px]">
                    <div className="flex justify-between text-sm">
                      <span>Total Collected:</span>
                      <span className="font-semibold">
                        ${totals.totalCollectedUsd.toFixed(2)} / {totals.totalCollectedLbp.toLocaleString()} LL
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Driver Paid (Refund):</span>
                      <span className="font-semibold text-blue-600">
                        -${totals.totalDriverPaidRefundUsd.toFixed(2)} / -{totals.totalDriverPaidRefundLbp.toLocaleString()} LL
                      </span>
                    </div>
                    <div className="border-t pt-2">
                      <div className="flex justify-between text-lg font-bold">
                        <span>Net Due from Driver:</span>
                        <span>
                          ${totals.netDueUsd.toFixed(2)} / {totals.netDueLbp.toLocaleString()} LL
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-center text-muted-foreground">
                No unpaid orders found for the selected period.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
