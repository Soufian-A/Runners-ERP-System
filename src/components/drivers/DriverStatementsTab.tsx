import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Download, CheckCircle, Search, DollarSign, History } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export function DriverStatementsTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDriver, setSelectedDriver] = useState('');
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedStatement, setSelectedStatement] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [collectCash, setCollectCash] = useState(true);

  const { data: drivers } = useQuery({
    queryKey: ['drivers-for-statement'],
    queryFn: async () => {
      const { data, error } = await supabase.from('drivers').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  // Get pending orders for the selected driver (excluding those already in ANY statement)
  const { data: orders, isLoading } = useQuery({
    queryKey: ['driver-pending-orders', selectedDriver, dateFrom, dateTo],
    queryFn: async () => {
      if (!selectedDriver) return [];

      // Get ALL statements for this driver to exclude their orders (prevents duplicate statements)
      const { data: statementsData } = await supabase
        .from('driver_statements')
        .select('order_refs')
        .eq('driver_id', selectedDriver);

      // Collect ALL order refs that are already in any statement
      const usedOrderRefs = new Set<string>();
      statementsData?.forEach(stmt => {
        if (stmt.order_refs) {
          stmt.order_refs.forEach((ref: string) => usedOrderRefs.add(ref));
        }
      });

      const { data, error } = await supabase
        .from('orders')
        .select(`*, customers(phone, name), clients(name)`)
        .eq('driver_id', selectedDriver)
        .eq('driver_remit_status', 'Pending')
        .gte('delivered_at', dateFrom)
        .lte('delivered_at', dateTo + 'T23:59:59')
        .order('delivered_at', { ascending: false });

      if (error) throw error;
      // Filter out orders already in ANY statement (prevents duplicate statements)
      return data?.filter(order => !usedOrderRefs.has(order.order_id)) || [];
    },
    enabled: !!selectedDriver,
  });

  // Get statement history - show all statements, optionally filtered by driver
  const { data: statementHistory, isLoading: loadingHistory } = useQuery({
    queryKey: ['driver-statements-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driver_statements')
        .select(`*, drivers(name)`)
        .order('issued_date', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Filter history by selected driver if one is selected
  const filteredHistory = selectedDriver 
    ? statementHistory?.filter(s => s.driver_id === selectedDriver) 
    : statementHistory;

  const filteredOrders = orders?.filter(order => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      order.order_id?.toLowerCase().includes(search) ||
      order.clients?.name?.toLowerCase().includes(search) ||
      order.customers?.name?.toLowerCase().includes(search) ||
      order.customers?.phone?.toLowerCase().includes(search)
    );
  }) || [];

  const handleSelectAll = () => {
    if (selectedOrders.length === filteredOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders.map(o => o.id));
    }
  };

  const handleToggleOrder = (orderId: string) => {
    setSelectedOrders(prev =>
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  const calculateTotals = () => {
    const selectedOrdersData = orders?.filter(o => selectedOrders.includes(o.id)) || [];
    
    return selectedOrdersData.reduce((acc, order) => ({
      totalCollectedUsd: acc.totalCollectedUsd + Number(order.collected_amount_usd || 0),
      totalCollectedLbp: acc.totalCollectedLbp + Number(order.collected_amount_lbp || 0),
      totalDeliveryFeesUsd: acc.totalDeliveryFeesUsd + Number(order.delivery_fee_usd || 0),
      totalDeliveryFeesLbp: acc.totalDeliveryFeesLbp + Number(order.delivery_fee_lbp || 0),
      totalDriverPaidUsd: acc.totalDriverPaidUsd + (order.driver_paid_for_client ? Number(order.driver_paid_amount_usd || 0) : 0),
      totalDriverPaidLbp: acc.totalDriverPaidLbp + (order.driver_paid_for_client ? Number(order.driver_paid_amount_lbp || 0) : 0),
    }), {
      totalCollectedUsd: 0,
      totalCollectedLbp: 0,
      totalDeliveryFeesUsd: 0,
      totalDeliveryFeesLbp: 0,
      totalDriverPaidUsd: 0,
      totalDriverPaidLbp: 0,
    });
  };

  const totals = calculateTotals();
  const netDueUsd = totals.totalCollectedUsd - totals.totalDriverPaidUsd;
  const netDueLbp = totals.totalCollectedLbp - totals.totalDriverPaidLbp;

  const issueStatementMutation = useMutation({
    mutationFn: async () => {
      if (selectedOrders.length === 0) throw new Error('No orders selected');
      
      const selectedOrdersData = orders?.filter(o => selectedOrders.includes(o.id)) || [];
      const orderRefs = selectedOrdersData.map(o => o.order_id);

      const { data: statementIdData, error: idError } = await supabase.rpc('generate_driver_statement_id');
      if (idError) throw idError;

      // Insert statement
      const { error: insertError } = await supabase.from('driver_statements').insert({
        driver_id: selectedDriver,
        statement_id: statementIdData,
        period_from: dateFrom,
        period_to: dateTo,
        total_collected_usd: totals.totalCollectedUsd,
        total_collected_lbp: totals.totalCollectedLbp,
        total_delivery_fees_usd: totals.totalDeliveryFeesUsd,
        total_delivery_fees_lbp: totals.totalDeliveryFeesLbp,
        total_driver_paid_refund_usd: totals.totalDriverPaidUsd,
        total_driver_paid_refund_lbp: totals.totalDriverPaidLbp,
        net_due_usd: netDueUsd,
        net_due_lbp: netDueLbp,
        order_refs: orderRefs,
        status: collectCash ? 'paid' : 'unpaid',
        paid_date: collectCash ? new Date().toISOString() : null,
        payment_method: collectCash ? 'cash' : null,
        created_by: user?.id,
      });

      if (insertError) throw insertError;

      // If collecting cash, also update order remit status and handle cashbox
      if (collectCash) {
        // Update orders remit status
        for (const order of selectedOrdersData) {
          await supabase.from('orders').update({
            driver_remit_status: 'Collected',
            driver_remit_date: new Date().toISOString(),
          }).eq('id', order.id);
        }

        // Update cashbox
        const today = new Date().toISOString().split('T')[0];
        const { data: existingCashbox } = await supabase
          .from('cashbox_daily')
          .select('*')
          .eq('date', today)
          .maybeSingle();

        if (existingCashbox) {
          await supabase.from('cashbox_daily').update({
            cash_in_usd: Number(existingCashbox.cash_in_usd || 0) + netDueUsd,
            cash_in_lbp: Number(existingCashbox.cash_in_lbp || 0) + netDueLbp,
          }).eq('id', existingCashbox.id);
        } else {
          await supabase.from('cashbox_daily').insert({
            date: today,
            cash_in_usd: netDueUsd,
            cash_in_lbp: netDueLbp,
          });
        }

        // Debit driver wallet
        const driver = drivers?.find(d => d.id === selectedDriver);
        if (driver) {
          await supabase.from('drivers').update({
            wallet_usd: Number(driver.wallet_usd || 0) - netDueUsd,
            wallet_lbp: Number(driver.wallet_lbp || 0) - netDueLbp,
          }).eq('id', selectedDriver);

          // Record driver transaction
          await supabase.from('driver_transactions').insert({
            driver_id: selectedDriver,
            type: 'Debit',
            amount_usd: netDueUsd,
            amount_lbp: netDueLbp,
            note: `Statement ${statementIdData} - Cash Collected`,
          });
        }
      }

      return statementIdData;
    },
    onSuccess: (statementId) => {
      toast.success(`Statement ${statementId} issued${collectCash ? ' and cash collected' : ''}`);
      queryClient.invalidateQueries({ queryKey: ['driver-pending-orders'] });
      queryClient.invalidateQueries({ queryKey: ['driver-statements-history'] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['cashbox'] });
      queryClient.invalidateQueries({ queryKey: ['driver-transactions'] });
      setSelectedOrders([]);
    },
    onError: (error) => {
      toast.error(`Failed: ${error.message}`);
    },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStatement) throw new Error('No statement selected');

      await supabase.from('driver_statements').update({
        status: 'paid',
        paid_date: new Date().toISOString(),
        payment_method: paymentMethod,
        notes: paymentNotes || null,
      }).eq('id', selectedStatement.id);
    },
    onSuccess: () => {
      toast.success('Statement marked as paid');
      queryClient.invalidateQueries({ queryKey: ['driver-statements-history'] });
      setPaymentDialogOpen(false);
      setSelectedStatement(null);
      setPaymentMethod('cash');
      setPaymentNotes('');
    },
    onError: (error) => {
      toast.error(`Failed: ${error.message}`);
    },
  });

  const selectedDriverData = drivers?.find(d => d.id === selectedDriver);

  return (
    <div className="space-y-4">
      <Tabs defaultValue="issue" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="issue">Issue Statement</TabsTrigger>
          <TabsTrigger value="history">
            <History className="mr-2 h-4 w-4" />
            Statement History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="issue" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Driver</Label>
                  <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select driver..." />
                    </SelectTrigger>
                    <SelectContent>
                      {drivers?.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id}>
                          {driver.name} (${Number(driver.wallet_usd || 0).toFixed(2)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>From Date</Label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>To Date</Label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search orders..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Orders Table */}
          {selectedDriver && (
            <Card>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    Pending Orders - {selectedDriverData?.name}
                  </CardTitle>
                  <div className="flex items-center gap-4">
                    <Button variant="outline" size="sm" onClick={handleSelectAll}>
                      {selectedOrders.length === filteredOrders.length ? 'Deselect All' : 'Select All'}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {selectedOrders.length} selected
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <p className="text-center py-8 text-muted-foreground">Loading...</p>
                ) : filteredOrders.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10"></TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Order ID</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Collected USD</TableHead>
                          <TableHead>Collected LBP</TableHead>
                          <TableHead>Fee USD</TableHead>
                          <TableHead>Driver Paid</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrders.map((order) => (
                          <TableRow key={order.id} className="h-10">
                            <TableCell className="py-1">
                              <Checkbox
                                checked={selectedOrders.includes(order.id)}
                                onCheckedChange={() => handleToggleOrder(order.id)}
                              />
                            </TableCell>
                            <TableCell className="py-1 text-xs">
                              {order.delivered_at ? format(new Date(order.delivered_at), 'MMM dd') : '-'}
                            </TableCell>
                            <TableCell className="py-1 text-xs font-mono">{order.order_id}</TableCell>
                            <TableCell className="py-1 text-xs">{order.clients?.name}</TableCell>
                            <TableCell className="py-1 text-xs">{order.customers?.name || order.customers?.phone}</TableCell>
                            <TableCell className="py-1 text-xs">${Number(order.collected_amount_usd || 0).toFixed(2)}</TableCell>
                            <TableCell className="py-1 text-xs">{Number(order.collected_amount_lbp || 0).toLocaleString()} LL</TableCell>
                            <TableCell className="py-1 text-xs text-green-600">${Number(order.delivery_fee_usd || 0).toFixed(2)}</TableCell>
                            <TableCell className="py-1 text-xs">
                              {order.driver_paid_for_client ? (
                                <Badge variant="outline" className="text-xs">${Number(order.driver_paid_amount_usd || 0).toFixed(2)}</Badge>
                              ) : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-center py-8 text-muted-foreground">No pending orders found.</p>
                )}

                {/* Summary & Actions */}
                {selectedOrders.length > 0 && (
                  <div className="border-t p-4 bg-muted/50">
                    <div className="flex items-center justify-between">
                      <div className="grid grid-cols-4 gap-6 text-sm">
                        <div>
                          <span className="text-muted-foreground">Collected:</span>
                          <p className="font-semibold">${totals.totalCollectedUsd.toFixed(2)} / {totals.totalCollectedLbp.toLocaleString()} LL</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Fees:</span>
                          <p className="font-semibold text-green-600">${totals.totalDeliveryFeesUsd.toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Driver Paid:</span>
                          <p className="font-semibold text-blue-600">-${totals.totalDriverPaidUsd.toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Net Due:</span>
                          <p className="font-bold text-lg">${netDueUsd.toFixed(2)} / {netDueLbp.toLocaleString()} LL</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox checked={collectCash} onCheckedChange={(v) => setCollectCash(!!v)} />
                          Collect Cash Now
                        </label>
                        <Button onClick={() => issueStatementMutation.mutate()} disabled={issueStatementMutation.isPending}>
                          <FileText className="mr-2 h-4 w-4" />
                          {issueStatementMutation.isPending ? 'Processing...' : 'Issue Statement'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-lg">Statement History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingHistory ? (
                <p className="text-center py-8 text-muted-foreground">Loading...</p>
              ) : filteredHistory && filteredHistory.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Statement ID</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Net Due USD</TableHead>
                      <TableHead>Net Due LBP</TableHead>
                      <TableHead>Orders</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Issued</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistory.map((statement) => (
                      <TableRow key={statement.id}>
                        <TableCell className="font-mono text-sm">{statement.statement_id}</TableCell>
                        <TableCell>{statement.drivers?.name}</TableCell>
                        <TableCell className="text-xs">
                          {format(new Date(statement.period_from), 'MMM dd')} - {format(new Date(statement.period_to), 'MMM dd')}
                        </TableCell>
                        <TableCell className="font-semibold">${Number(statement.net_due_usd).toFixed(2)}</TableCell>
                        <TableCell className="font-semibold">{Number(statement.net_due_lbp).toLocaleString()} LL</TableCell>
                        <TableCell>{statement.order_refs?.length || 0}</TableCell>
                        <TableCell>
                          <Badge variant={statement.status === 'paid' ? 'default' : 'secondary'}>
                            {statement.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{format(new Date(statement.issued_date), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {statement.status === 'unpaid' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedStatement(statement);
                                  setPaymentDialogOpen(true);
                                }}
                              >
                                <DollarSign className="mr-1 h-3 w-3" />
                                Collect
                              </Button>
                            )}
                            <Button variant="ghost" size="sm">
                              <Download className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center py-8 text-muted-foreground">No statements found.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Collect Payment</DialogTitle>
            <DialogDescription>
              {selectedStatement && (
                <>
                  Statement: <span className="font-mono">{selectedStatement.statement_id}</span>
                  <br />
                  Amount: ${Number(selectedStatement.net_due_usd).toFixed(2)} / {Number(selectedStatement.net_due_lbp).toLocaleString()} LL
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Input value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="Add notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => markAsPaidMutation.mutate()} disabled={markAsPaidMutation.isPending}>
              <CheckCircle className="mr-2 h-4 w-4" />
              {markAsPaidMutation.isPending ? 'Processing...' : 'Confirm Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
