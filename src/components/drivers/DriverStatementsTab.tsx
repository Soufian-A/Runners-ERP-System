import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FileText, Download, CheckCircle, Search, DollarSign, ChevronDown, ChevronUp, Wallet, Clock, TrendingUp, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { StatusBadge } from '@/components/ui/status-badge';
import { DriverStatementPreview } from './DriverStatementPreview';

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
  const [pendingExpanded, setPendingExpanded] = useState(true);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewStatement, setPreviewStatement] = useState<any>(null);

  const { data: drivers } = useQuery({
    queryKey: ['drivers-for-statement'],
    queryFn: async () => {
      const { data, error } = await supabase.from('drivers').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: orders, isLoading } = useQuery({
    queryKey: ['driver-pending-orders', selectedDriver, dateFrom, dateTo],
    queryFn: async () => {
      if (!selectedDriver) return [];

      const { data: statementsData } = await supabase
        .from('driver_statements')
        .select('order_refs')
        .eq('driver_id', selectedDriver);

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
      return data?.filter(order => !usedOrderRefs.has(order.order_id)) || [];
    },
    enabled: !!selectedDriver,
  });

  const { data: statementHistory, isLoading: loadingHistory } = useQuery({
    queryKey: ['driver-statements-history', selectedDriver],
    queryFn: async () => {
      const query = supabase
        .from('driver_statements')
        .select(`*, drivers(name)`)
        .order('issued_date', { ascending: false });
      
      if (selectedDriver) {
        query.eq('driver_id', selectedDriver);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: statementOrders } = useQuery({
    queryKey: ['statement-orders', previewStatement?.id],
    queryFn: async () => {
      if (!previewStatement?.order_refs?.length) return [];
      
      const { data, error } = await supabase
        .from('orders')
        .select(`*, clients(name)`)
        .or(previewStatement.order_refs.map((ref: string) => `order_id.eq.${ref},voucher_no.eq.${ref}`).join(','));

      if (error) throw error;
      return data || [];
    },
    enabled: !!previewStatement?.order_refs?.length,
  });

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

      if (collectCash) {
        for (const order of selectedOrdersData) {
          await supabase.from('orders').update({
            driver_remit_status: 'Collected',
            driver_remit_date: new Date().toISOString(),
          }).eq('id', order.id);
        }

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

        const driver = drivers?.find(d => d.id === selectedDriver);
        if (driver) {
          await supabase.from('drivers').update({
            wallet_usd: Number(driver.wallet_usd || 0) - netDueUsd,
            wallet_lbp: Number(driver.wallet_lbp || 0) - netDueLbp,
          }).eq('id', selectedDriver);

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
  const unpaidStatements = statementHistory?.filter(s => s.status === 'unpaid')?.length || 0;
  const totalPending = orders?.length || 0;

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <Card className="border-sidebar-border bg-sidebar/50">
        <CardContent className="pt-4 pb-3">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground mb-1 block">Driver</Label>
              <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select driver..." />
                </SelectTrigger>
                <SelectContent>
                  {drivers?.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      <span className="flex items-center gap-2">
                        {driver.name}
                        <span className="text-xs text-muted-foreground font-mono">
                          ${Number(driver.wallet_usd || 0).toFixed(2)}
                          {Number(driver.wallet_lbp || 0) !== 0 && (
                            <span className="ml-1">/ {Number(driver.wallet_lbp || 0).toLocaleString()} LL</span>
                          )}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {selectedDriver && (
        <div className="grid grid-cols-4 gap-3">
          <Card className="border-sidebar-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Wallet Balance</span>
              </div>
              <p className={`text-lg font-bold font-mono mt-1 ${Number(selectedDriverData?.wallet_usd || 0) < 0 ? 'text-status-error' : 'text-status-success'}`}>
                ${Number(selectedDriverData?.wallet_usd || 0).toFixed(2)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-sidebar-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Pending Orders</span>
              </div>
              <p className="text-lg font-bold font-mono mt-1">{totalPending}</p>
            </CardContent>
          </Card>
          <Card className="border-sidebar-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Unpaid Statements</span>
              </div>
              <p className={`text-lg font-bold font-mono mt-1 ${unpaidStatements > 0 ? 'text-status-warning' : ''}`}>
                {unpaidStatements}
              </p>
            </CardContent>
          </Card>
          <Card className="border-sidebar-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Selected Total</span>
              </div>
              <p className="text-lg font-bold font-mono mt-1 text-status-success">
                ${netDueUsd.toFixed(2)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pending Orders Section */}
      {selectedDriver && (
        <Collapsible open={pendingExpanded} onOpenChange={setPendingExpanded}>
          <Card className="border-sidebar-border">
            <CollapsibleTrigger asChild>
              <CardHeader className="py-2 px-4 cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    {pendingExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    Pending Orders ({filteredOrders.length})
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    {selectedOrders.length > 0 && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                        {selectedOrders.length} selected
                      </span>
                    )}
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleSelectAll(); }}>
                      {selectedOrders.length === filteredOrders.length ? 'Clear' : 'Select All'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="p-0">
                {isLoading ? (
                  <p className="text-center py-6 text-muted-foreground text-sm">Loading...</p>
                ) : filteredOrders.length > 0 ? (
                  <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background">
                        <TableRow className="text-xs">
                          <TableHead className="w-8 py-2"></TableHead>
                          <TableHead className="py-2">Date</TableHead>
                          <TableHead className="py-2">Order</TableHead>
                          <TableHead className="py-2">Client</TableHead>
                          <TableHead className="py-2 text-right">Collected</TableHead>
                          <TableHead className="py-2 text-right">Fee</TableHead>
                          <TableHead className="py-2 text-right">Driver Paid</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrders.map((order) => (
                          <TableRow key={order.id} className="h-8 text-xs">
                            <TableCell className="py-1">
                              <Checkbox
                                checked={selectedOrders.includes(order.id)}
                                onCheckedChange={() => handleToggleOrder(order.id)}
                              />
                            </TableCell>
                            <TableCell className="py-1 text-muted-foreground">
                              {order.delivered_at ? format(new Date(order.delivered_at), 'MMM dd') : '-'}
                            </TableCell>
                            <TableCell className="py-1 font-mono">{order.order_id}</TableCell>
                            <TableCell className="py-1">{order.clients?.name}</TableCell>
                            <TableCell className="py-1 text-right font-mono">
                              <div>${Number(order.collected_amount_usd || 0).toFixed(2)}</div>
                              {Number(order.collected_amount_lbp || 0) > 0 && (
                                <div className="text-muted-foreground text-[10px]">{Number(order.collected_amount_lbp || 0).toLocaleString()} LL</div>
                              )}
                            </TableCell>
                            <TableCell className="py-1 text-right font-mono text-status-success">
                              <div>${Number(order.delivery_fee_usd || 0).toFixed(2)}</div>
                              {Number(order.delivery_fee_lbp || 0) > 0 && (
                                <div className="text-muted-foreground text-[10px]">{Number(order.delivery_fee_lbp || 0).toLocaleString()} LL</div>
                              )}
                            </TableCell>
                            <TableCell className="py-1 text-right font-mono">
                              {order.driver_paid_for_client ? (
                                <div>
                                  <div className="text-status-info">${Number(order.driver_paid_amount_usd || 0).toFixed(2)}</div>
                                  {Number(order.driver_paid_amount_lbp || 0) > 0 && (
                                    <div className="text-muted-foreground text-[10px]">{Number(order.driver_paid_amount_lbp || 0).toLocaleString()} LL</div>
                                  )}
                                </div>
                              ) : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-center py-6 text-muted-foreground text-sm">No pending orders in this period.</p>
                )}

                {/* Action Bar */}
                {selectedOrders.length > 0 && (
                  <div className="border-t bg-muted/30 p-3 flex items-center justify-between">
                    <div className="flex items-center gap-6 text-xs">
                      <div>
                        <span className="text-muted-foreground">Collected: </span>
                        <span className="font-mono font-semibold">${totals.totalCollectedUsd.toFixed(2)}</span>
                        {totals.totalCollectedLbp > 0 && (
                          <span className="text-muted-foreground ml-1">/ {totals.totalCollectedLbp.toLocaleString()} LL</span>
                        )}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Fees: </span>
                        <span className="font-mono font-semibold text-status-success">${totals.totalDeliveryFeesUsd.toFixed(2)}</span>
                        {totals.totalDeliveryFeesLbp > 0 && (
                          <span className="text-muted-foreground ml-1">/ {totals.totalDeliveryFeesLbp.toLocaleString()} LL</span>
                        )}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Driver Paid: </span>
                        <span className="font-mono font-semibold text-status-info">-${totals.totalDriverPaidUsd.toFixed(2)}</span>
                        {totals.totalDriverPaidLbp > 0 && (
                          <span className="text-muted-foreground ml-1">/ -{totals.totalDriverPaidLbp.toLocaleString()} LL</span>
                        )}
                      </div>
                      <div className="border-l pl-6">
                        <span className="text-muted-foreground">Net Due: </span>
                        <span className="font-mono font-bold text-base">${netDueUsd.toFixed(2)}</span>
                        {netDueLbp !== 0 && (
                          <span className="text-muted-foreground ml-1">/ {netDueLbp.toLocaleString()} LL</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs">
                        <Checkbox checked={collectCash} onCheckedChange={(v) => setCollectCash(!!v)} />
                        Collect Cash Now
                      </label>
                      <Button size="sm" onClick={() => issueStatementMutation.mutate()} disabled={issueStatementMutation.isPending}>
                        <FileText className="mr-1.5 h-3.5 w-3.5" />
                        {issueStatementMutation.isPending ? 'Processing...' : 'Issue Statement'}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Statement History */}
      <Card className="border-sidebar-border">
        <CardHeader className="py-2 px-4">
          <CardTitle className="text-sm font-medium">Statement History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingHistory ? (
            <p className="text-center py-6 text-muted-foreground text-sm">Loading...</p>
          ) : statementHistory && statementHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="py-2">ID</TableHead>
                    {!selectedDriver && <TableHead className="py-2">Driver</TableHead>}
                    <TableHead className="py-2">Period</TableHead>
                    <TableHead className="py-2 text-right">Net Due</TableHead>
                    <TableHead className="py-2 text-center">Orders</TableHead>
                    <TableHead className="py-2 text-center">Status</TableHead>
                    <TableHead className="py-2">Issued</TableHead>
                    <TableHead className="py-2 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statementHistory.map((statement) => (
                    <TableRow key={statement.id} className="h-9 text-xs">
                      <TableCell className="py-1 font-mono">{statement.statement_id}</TableCell>
                      {!selectedDriver && <TableCell className="py-1">{statement.drivers?.name}</TableCell>}
                      <TableCell className="py-1 text-muted-foreground">
                        {format(new Date(statement.period_from), 'MMM dd')} - {format(new Date(statement.period_to), 'MMM dd')}
                      </TableCell>
                      <TableCell className="py-1 text-right font-mono font-semibold">
                        <div>${Number(statement.net_due_usd).toFixed(2)}</div>
                        {Number(statement.net_due_lbp || 0) !== 0 && (
                          <div className="text-muted-foreground text-[10px]">{Number(statement.net_due_lbp || 0).toLocaleString()} LL</div>
                        )}
                      </TableCell>
                      <TableCell className="py-1 text-center">{statement.order_refs?.length || 0}</TableCell>
                      <TableCell className="py-1 text-center">
                        <StatusBadge status={statement.status} type="statement" />
                      </TableCell>
                      <TableCell className="py-1 text-muted-foreground">
                        {format(new Date(statement.issued_date), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell className="py-1 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => {
                              setPreviewStatement(statement);
                              setPreviewDialogOpen(true);
                            }}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          {statement.status === 'unpaid' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => {
                                setSelectedStatement(statement);
                                setPaymentDialogOpen(true);
                              }}
                            >
                              <DollarSign className="mr-1 h-3 w-3" />
                              Collect
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center py-6 text-muted-foreground text-sm">
              {selectedDriver ? 'No statements found for this driver.' : 'Select a driver to view history, or view all statements.'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Collect Payment</DialogTitle>
            <DialogDescription>
              {selectedStatement && (
                <span className="block mt-1">
                  Statement <span className="font-mono font-medium">{selectedStatement.statement_id}</span>
                  <br />
                  Amount: <span className="font-mono font-semibold">${Number(selectedStatement.net_due_usd).toFixed(2)}</span>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">Payment Method</Label>
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
              <Label className="text-sm">Notes (Optional)</Label>
              <Input value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="Add notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => markAsPaidMutation.mutate()} disabled={markAsPaidMutation.isPending}>
              <CheckCircle className="mr-2 h-4 w-4" />
              {markAsPaidMutation.isPending ? 'Processing...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Statement Preview Dialog */}
      {previewStatement && (
        <DriverStatementPreview
          open={previewDialogOpen}
          onOpenChange={setPreviewDialogOpen}
          orders={statementOrders || []}
          driverName={previewStatement.drivers?.name || 'Driver'}
          dateFrom={previewStatement.period_from}
          dateTo={previewStatement.period_to}
          totals={{
            totalCollectedUsd: Number(previewStatement.total_collected_usd || 0),
            totalCollectedLbp: Number(previewStatement.total_collected_lbp || 0),
            totalDeliveryFeesUsd: Number(previewStatement.total_delivery_fees_usd || 0),
            totalDeliveryFeesLbp: Number(previewStatement.total_delivery_fees_lbp || 0),
            totalDriverPaidUsd: Number(previewStatement.total_driver_paid_refund_usd || 0),
            totalDriverPaidLbp: Number(previewStatement.total_driver_paid_refund_lbp || 0),
          }}
          netDueUsd={Number(previewStatement.net_due_usd || 0)}
          netDueLbp={Number(previewStatement.net_due_lbp || 0)}
        />
      )}
    </div>
  );
}
