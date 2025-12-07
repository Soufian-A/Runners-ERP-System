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
import { FileText, Download, CheckCircle, Search, DollarSign, History, ArrowUpRight, ArrowDownLeft, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { ClientStatementPreview } from './ClientStatementPreview';

export function ClientStatementsTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedClient, setSelectedClient] = useState('');
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedStatement, setSelectedStatement] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentAmountUsd, setPaymentAmountUsd] = useState('');
  const [paymentAmountLbp, setPaymentAmountLbp] = useState('');
  const [recordPaymentMode, setRecordPaymentMode] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);

  const { data: clients } = useQuery({
    queryKey: ['clients-for-statement'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: clientBalances } = useQuery({
    queryKey: ['client-balances-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('client_transactions').select('client_id, type, amount_usd, amount_lbp');
      if (error) throw error;
      
      const balances = new Map<string, { usd: number; lbp: number }>();
      data?.forEach((tx: any) => {
        const current = balances.get(tx.client_id) || { usd: 0, lbp: 0 };
        const multiplier = tx.type === 'Credit' ? 1 : -1;
        balances.set(tx.client_id, {
          usd: current.usd + Number(tx.amount_usd || 0) * multiplier,
          lbp: current.lbp + Number(tx.amount_lbp || 0) * multiplier,
        });
      });
      return balances;
    },
  });

  // Get pending orders for the selected client (excluding those already in ANY statement - paid OR unpaid)
  const { data: orders, isLoading } = useQuery({
    queryKey: ['client-pending-orders', selectedClient, dateFrom, dateTo],
    queryFn: async () => {
      if (!selectedClient) return [];

      // Get ALL statements for this client (both paid and unpaid) to exclude their orders
      const { data: statementsData } = await supabase
        .from('client_statements')
        .select('order_refs')
        .eq('client_id', selectedClient);

      // Collect ALL order refs that are already in any statement
      const usedOrderRefs = new Set<string>();
      statementsData?.forEach(stmt => {
        if (stmt.order_refs) {
          stmt.order_refs.forEach((ref: string) => usedOrderRefs.add(ref));
        }
      });

      const { data, error } = await supabase
        .from('orders')
        .select(`*, customers(phone, name, address), drivers(name)`)
        .eq('client_id', selectedClient)
        .eq('status', 'Delivered')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo + 'T23:59:59')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter out orders already in ANY statement (prevents duplicate statements)
      return data?.filter(order => {
        const orderRef = order.order_type === 'ecom' ? (order.voucher_no || order.order_id) : order.order_id;
        return !usedOrderRefs.has(orderRef);
      }) || [];
    },
    enabled: !!selectedClient,
  });

  // Get statement history for the selected client
  const { data: statementHistory, isLoading: loadingHistory } = useQuery({
    queryKey: ['client-statements-history', selectedClient],
    queryFn: async () => {
      const query = supabase
        .from('client_statements')
        .select(`*, clients(name)`)
        .order('issued_date', { ascending: false });
      
      if (selectedClient) {
        query.eq('client_id', selectedClient);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const filteredOrders = orders?.filter(order => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      order.order_id?.toLowerCase().includes(search) ||
      order.voucher_no?.toLowerCase().includes(search) ||
      order.customers?.name?.toLowerCase().includes(search) ||
      order.customers?.phone?.toLowerCase().includes(search) ||
      order.address?.toLowerCase().includes(search)
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
    
    return selectedOrdersData.reduce((acc, order) => {
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
        dueToClientLbp = 0;
      }

      return {
        totalOrders: acc.totalOrders + 1,
        totalOrderAmountUsd: acc.totalOrderAmountUsd + Number(order.order_amount_usd || 0),
        totalOrderAmountLbp: acc.totalOrderAmountLbp + Number(order.order_amount_lbp || 0),
        totalDeliveryFeesUsd: acc.totalDeliveryFeesUsd + Number(order.delivery_fee_usd || 0),
        totalDeliveryFeesLbp: acc.totalDeliveryFeesLbp + Number(order.delivery_fee_lbp || 0),
        totalDueToClientUsd: acc.totalDueToClientUsd + dueToClientUsd,
        totalDueToClientLbp: acc.totalDueToClientLbp + dueToClientLbp,
      };
    }, {
      totalOrders: 0,
      totalOrderAmountUsd: 0,
      totalOrderAmountLbp: 0,
      totalDeliveryFeesUsd: 0,
      totalDeliveryFeesLbp: 0,
      totalDueToClientUsd: 0,
      totalDueToClientLbp: 0,
    });
  };

  const totals = calculateTotals();
  const selectedClientData = clients?.find(c => c.id === selectedClient);
  const clientBalance = clientBalances?.get(selectedClient) || { usd: 0, lbp: 0 };
  
  // Positive balance = we owe client, Negative balance = client owes us
  const weOweClient = clientBalance.usd > 0 || clientBalance.lbp > 0;

  const issueStatementMutation = useMutation({
    mutationFn: async () => {
      if (selectedOrders.length === 0) throw new Error('No orders selected');
      
      const selectedOrdersData = orders?.filter(o => selectedOrders.includes(o.id)) || [];
      const orderRefs = selectedOrdersData.map(o => o.order_type === 'ecom' ? (o.voucher_no || o.order_id) : o.order_id);

      const { data: statementIdData, error: idError } = await supabase.rpc('generate_client_statement_id');
      if (idError) throw idError;

      const { error: insertError } = await supabase.from('client_statements').insert({
        client_id: selectedClient,
        statement_id: statementIdData,
        period_from: dateFrom,
        period_to: dateTo,
        total_orders: totals.totalOrders,
        total_delivered: totals.totalOrders,
        total_order_amount_usd: totals.totalOrderAmountUsd,
        total_order_amount_lbp: totals.totalOrderAmountLbp,
        total_delivery_fees_usd: totals.totalDeliveryFeesUsd,
        total_delivery_fees_lbp: totals.totalDeliveryFeesLbp,
        net_due_usd: totals.totalDueToClientUsd,
        net_due_lbp: totals.totalDueToClientLbp,
        order_refs: orderRefs,
        status: 'unpaid',
        created_by: user?.id,
      });

      if (insertError) throw insertError;
      return statementIdData;
    },
    onSuccess: (statementId) => {
      toast.success(`Statement ${statementId} issued`);
      queryClient.invalidateQueries({ queryKey: ['client-pending-orders'] });
      queryClient.invalidateQueries({ queryKey: ['client-statements-history'] });
      setSelectedOrders([]);
    },
    onError: (error) => {
      toast.error(`Failed: ${error.message}`);
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      const amountUsd = parseFloat(paymentAmountUsd) || 0;
      const amountLbp = parseFloat(paymentAmountLbp) || 0;
      
      if (amountUsd === 0 && amountLbp === 0) throw new Error('Enter a payment amount');

      // Determine payment direction based on current balance
      // If we owe client (positive balance), we pay them (cash out)
      // If client owes us (negative balance), they pay us (cash in)
      const isPayingClient = weOweClient;

      // Update cashbox
      const today = new Date().toISOString().split('T')[0];
      const { data: existingCashbox } = await supabase
        .from('cashbox_daily')
        .select('*')
        .eq('date', today)
        .maybeSingle();

      if (existingCashbox) {
        if (isPayingClient) {
          await supabase.from('cashbox_daily').update({
            cash_out_usd: Number(existingCashbox.cash_out_usd || 0) + amountUsd,
            cash_out_lbp: Number(existingCashbox.cash_out_lbp || 0) + amountLbp,
          }).eq('id', existingCashbox.id);
        } else {
          await supabase.from('cashbox_daily').update({
            cash_in_usd: Number(existingCashbox.cash_in_usd || 0) + amountUsd,
            cash_in_lbp: Number(existingCashbox.cash_in_lbp || 0) + amountLbp,
          }).eq('id', existingCashbox.id);
        }
      } else {
        await supabase.from('cashbox_daily').insert({
          date: today,
          cash_in_usd: isPayingClient ? 0 : amountUsd,
          cash_in_lbp: isPayingClient ? 0 : amountLbp,
          cash_out_usd: isPayingClient ? amountUsd : 0,
          cash_out_lbp: isPayingClient ? amountLbp : 0,
        });
      }

      // Record client transaction
      await supabase.from('client_transactions').insert({
        client_id: selectedClient,
        type: isPayingClient ? 'Debit' : 'Credit',
        amount_usd: amountUsd,
        amount_lbp: amountLbp,
        note: `Payment ${isPayingClient ? 'to' : 'from'} client - ${paymentMethod}`,
      });

      // If there's a selected statement, mark it as paid
      if (selectedStatement) {
        await supabase.from('client_statements').update({
          status: 'paid',
          paid_date: new Date().toISOString(),
          payment_method: paymentMethod,
          notes: paymentNotes || null,
        }).eq('id', selectedStatement.id);
      }
    },
    onSuccess: () => {
      toast.success('Payment recorded');
      queryClient.invalidateQueries({ queryKey: ['client-statements-history'] });
      queryClient.invalidateQueries({ queryKey: ['client-balances-all'] });
      queryClient.invalidateQueries({ queryKey: ['client-pending-orders'] });
      queryClient.invalidateQueries({ queryKey: ['cashbox'] });
      setPaymentDialogOpen(false);
      setSelectedStatement(null);
      setPaymentAmountUsd('');
      setPaymentAmountLbp('');
      setPaymentMethod('cash');
      setPaymentNotes('');
      setRecordPaymentMode(false);
    },
    onError: (error) => {
      toast.error(`Failed: ${error.message}`);
    },
  });

  const openPaymentDialog = (statement?: any) => {
    setSelectedStatement(statement || null);
    setRecordPaymentMode(!statement);
    if (statement) {
      setPaymentAmountUsd(Math.abs(statement.net_due_usd || 0).toString());
      setPaymentAmountLbp(Math.abs(statement.net_due_lbp || 0).toString());
    } else {
      setPaymentAmountUsd('');
      setPaymentAmountLbp('');
    }
    setPaymentDialogOpen(true);
  };

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
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label>Client</Label>
                  <Select value={selectedClient} onValueChange={setSelectedClient}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select client..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clients?.map((client) => {
                        const bal = clientBalances?.get(client.id) || { usd: 0, lbp: 0 };
                        return (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name} (${bal.usd.toFixed(2)})
                          </SelectItem>
                        );
                      })}
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
                <div className="space-y-2">
                  <Label>Actions</Label>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => openPaymentDialog()}
                    disabled={!selectedClient}
                  >
                    <DollarSign className="mr-2 h-4 w-4" />
                    {weOweClient ? 'Pay Client' : 'Receive Payment'}
                  </Button>
                </div>
              </div>

              {/* Client Balance Summary */}
              {selectedClient && (
                <div className="mt-4 p-3 bg-muted rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">{selectedClientData?.name} Balance:</span>
                    <span className={`font-bold ${clientBalance.usd < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ${Math.abs(clientBalance.usd).toFixed(2)} USD / {Math.abs(clientBalance.lbp).toLocaleString()} LL
                    </span>
                    <Badge variant={weOweClient ? 'default' : 'destructive'}>
                      {weOweClient ? (
                        <><ArrowUpRight className="mr-1 h-3 w-3" />We Owe Client</>
                      ) : (
                        <><ArrowDownLeft className="mr-1 h-3 w-3" />Client Owes Us</>
                      )}
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Orders Table */}
          {selectedClient && (
            <Card>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    Unpaid Orders - {selectedClientData?.name}
                  </CardTitle>
                  <div className="flex items-center gap-4">
                    <Button variant="outline" size="sm" onClick={handleSelectAll}>
                      {selectedOrders.length === filteredOrders.length ? 'Deselect All' : 'Select All'}
                    </Button>
                    <span className="text-sm text-muted-foreground">{selectedOrders.length} selected</span>
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
                          <TableHead>Type</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Order USD</TableHead>
                          <TableHead>Fee USD</TableHead>
                          <TableHead>Driver Paid</TableHead>
                          <TableHead>Due USD</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrders.map((order) => {
                          let dueToClientUsd = 0;
                          if (order.order_type === 'instant') {
                            dueToClientUsd = order.driver_paid_for_client 
                              ? Number(order.order_amount_usd || 0) + Number(order.delivery_fee_usd || 0)
                              : Number(order.order_amount_usd || 0);
                          } else {
                            dueToClientUsd = Number(order.amount_due_to_client_usd || 0);
                          }

                          return (
                            <TableRow key={order.id} className="h-10">
                              <TableCell className="py-1">
                                <Checkbox
                                  checked={selectedOrders.includes(order.id)}
                                  onCheckedChange={() => handleToggleOrder(order.id)}
                                />
                              </TableCell>
                              <TableCell className="py-1 text-xs">
                                {format(new Date(order.created_at), 'MMM dd')}
                              </TableCell>
                              <TableCell className="py-1 text-xs font-mono">
                                {order.order_type === 'ecom' ? (order.voucher_no || order.order_id) : order.order_id}
                              </TableCell>
                              <TableCell className="py-1">
                                <Badge variant="outline" className="text-xs">{order.order_type}</Badge>
                              </TableCell>
                              <TableCell className="py-1 text-xs">{order.customers?.name || order.customers?.phone}</TableCell>
                              <TableCell className="py-1 text-xs">${Number(order.order_amount_usd || 0).toFixed(2)}</TableCell>
                              <TableCell className="py-1 text-xs">${Number(order.delivery_fee_usd || 0).toFixed(2)}</TableCell>
                              <TableCell className="py-1 text-xs">
                                {order.driver_paid_for_client ? (
                                  <Badge variant="outline" className="text-xs text-blue-600">Yes</Badge>
                                ) : '-'}
                              </TableCell>
                              <TableCell className="py-1 text-xs font-semibold">${dueToClientUsd.toFixed(2)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-center py-8 text-muted-foreground">No unpaid orders found.</p>
                )}

                {/* Summary & Actions */}
                {selectedOrders.length > 0 && (
                  <div className="border-t p-4 bg-muted/50">
                    <div className="flex items-center justify-between">
                      <div className="grid grid-cols-4 gap-6 text-sm">
                        <div>
                          <span className="text-muted-foreground">Orders:</span>
                          <p className="font-semibold">{totals.totalOrders}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Order Amount:</span>
                          <p className="font-semibold">${totals.totalOrderAmountUsd.toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Delivery Fees:</span>
                          <p className="font-semibold">${totals.totalDeliveryFeesUsd.toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Net Due to Client:</span>
                          <p className="font-bold text-lg">${totals.totalDueToClientUsd.toFixed(2)}</p>
                        </div>
                      </div>
                      <Button variant="outline" onClick={() => setPreviewDialogOpen(true)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Preview / Export
                      </Button>
                      <Button onClick={() => issueStatementMutation.mutate()} disabled={issueStatementMutation.isPending}>
                        <FileText className="mr-2 h-4 w-4" />
                        {issueStatementMutation.isPending ? 'Processing...' : 'Issue Statement'}
                      </Button>
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
              ) : statementHistory && statementHistory.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Statement ID</TableHead>
                      <TableHead>Client</TableHead>
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
                    {statementHistory.map((statement) => (
                      <TableRow key={statement.id}>
                        <TableCell className="font-mono text-sm">{statement.statement_id}</TableCell>
                        <TableCell>{statement.clients?.name}</TableCell>
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
                                onClick={() => openPaymentDialog(statement)}
                              >
                                <DollarSign className="mr-1 h-3 w-3" />
                                Pay
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
            <DialogTitle>
              {weOweClient ? 'Pay Client' : 'Receive Payment from Client'}
            </DialogTitle>
            <DialogDescription>
              {selectedStatement ? (
                <>
                  Statement: <span className="font-mono">{selectedStatement.statement_id}</span>
                  <br />
                  Amount Due: ${Math.abs(selectedStatement.net_due_usd || 0).toFixed(2)}
                </>
              ) : (
                <>Client: {selectedClientData?.name}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount USD</Label>
                <Input
                  type="number"
                  value={paymentAmountUsd}
                  onChange={(e) => setPaymentAmountUsd(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Amount LBP</Label>
                <Input
                  type="number"
                  value={paymentAmountLbp}
                  onChange={(e) => setPaymentAmountLbp(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
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
            <Button onClick={() => recordPaymentMutation.mutate()} disabled={recordPaymentMutation.isPending}>
              <CheckCircle className="mr-2 h-4 w-4" />
              {recordPaymentMutation.isPending ? 'Processing...' : 'Confirm Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Statement Preview Dialog */}
      <ClientStatementPreview
        open={previewDialogOpen}
        onOpenChange={setPreviewDialogOpen}
        orders={orders?.filter(o => selectedOrders.includes(o.id)) || []}
        clientName={selectedClientData?.name || ''}
        dateFrom={dateFrom}
        dateTo={dateTo}
        totals={totals}
      />
    </div>
  );
}
