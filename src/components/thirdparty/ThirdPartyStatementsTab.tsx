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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Textarea } from '@/components/ui/textarea';
import { 
  FileText, CheckCircle, Search, DollarSign, ChevronDown, ChevronUp, 
  Wallet, Clock, TrendingUp, ChevronsUpDown, Check, Truck, 
  ArrowDownLeft, ArrowUpRight, Trash2, AlertCircle, Receipt
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

export function ThirdPartyStatementsTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedThirdParty, setSelectedThirdParty] = useState('');
  const [thirdPartySearchOpen, setThirdPartySearchOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [receiveAmountUsd, setReceiveAmountUsd] = useState('');
  const [receiveNotes, setReceiveNotes] = useState('');
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payAmountUsd, setPayAmountUsd] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [pendingExpanded, setPendingExpanded] = useState(true);
  const [receivedExpanded, setReceivedExpanded] = useState(false);
  const [transactionsExpanded, setTransactionsExpanded] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<any>(null);

  // Fetch third parties
  const { data: thirdParties } = useQuery({
    queryKey: ['third-parties-for-statement'],
    queryFn: async () => {
      const { data, error } = await supabase.from('third_parties').select('*').eq('active', true).order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch delivered orders for selected third party
  const { data: orders, isLoading } = useQuery({
    queryKey: ['third-party-pending-orders', selectedThirdParty, dateFrom, dateTo],
    queryFn: async () => {
      if (!selectedThirdParty) return [];

      const { data, error } = await supabase
        .from('orders')
        .select(`*, clients(name), drivers(name), customers(phone, name, address)`)
        .eq('third_party_id', selectedThirdParty)
        .eq('fulfillment', 'ThirdParty')
        .eq('status', 'Delivered')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo + 'T23:59:59')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedThirdParty,
  });

  // Fetch ALL order transactions for this third party (not filtered by date)
  const { data: orderTransactions } = useQuery({
    queryKey: ['order-transactions-third-party', selectedThirdParty],
    queryFn: async () => {
      if (!selectedThirdParty) return [];
      
      const { data, error } = await supabase
        .from('order_transactions')
        .select('*, orders(order_id, voucher_no, order_type)')
        .eq('party_type', 'THIRD_PARTY')
        .eq('party_id', selectedThirdParty)
        .order('tx_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedThirdParty,
  });

  // Get received order IDs from transactions
  const receivedOrderIds = new Set(
    orderTransactions?.filter(tx => tx.tx_type === 'THIRD_PARTY_REMITTANCE' && tx.direction === 'IN' && tx.order_id).map(tx => tx.order_id)
  );

  // Filter orders by search
  const filterOrders = (orderList: any[]) => {
    if (!searchTerm) return orderList;
    const search = searchTerm.toLowerCase();
    return orderList.filter(order => 
      order.order_id?.toLowerCase().includes(search) ||
      order.voucher_no?.toLowerCase().includes(search) ||
      order.clients?.name?.toLowerCase().includes(search) ||
      order.address?.toLowerCase().includes(search)
    );
  };

  // Split orders into pending and received
  const pendingOrders = filterOrders(orders?.filter(o => !receivedOrderIds.has(o.id)) || []);
  const receivedOrders = filterOrders(orders?.filter(o => receivedOrderIds.has(o.id)) || []);

  const handleSelectAll = () => {
    if (selectedOrders.length === pendingOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(pendingOrders.map(o => o.id));
    }
  };

  const handleToggleOrder = (orderId: string) => {
    setSelectedOrders(prev =>
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  // Calculate totals for selected orders
  const calculateSelectedTotals = () => {
    const selectedOrdersData = orders?.filter(o => selectedOrders.includes(o.id)) || [];
    
    return selectedOrdersData.reduce((acc, order) => {
      const orderValue = Number(order.order_amount_usd || 0);
      const thirdPartyFee = Number(order.third_party_fee_usd || 0);
      const expectedRemit = orderValue - thirdPartyFee;

      return {
        totalOrders: acc.totalOrders + 1,
        totalOrderValue: acc.totalOrderValue + orderValue,
        totalThirdPartyFees: acc.totalThirdPartyFees + thirdPartyFee,
        expectedRemittance: acc.expectedRemittance + expectedRemit,
      };
    }, {
      totalOrders: 0,
      totalOrderValue: 0,
      totalThirdPartyFees: 0,
      expectedRemittance: 0,
    });
  };

  const selectedTotals = calculateSelectedTotals();
  const selectedThirdPartyData = thirdParties?.find(tp => tp.id === selectedThirdParty);

  // Calculate overall stats for all pending orders (what they owe us)
  const allPendingOrdersTotal = (orders?.filter(o => !receivedOrderIds.has(o.id)) || [])
    .reduce((sum, o) => sum + Number(o.order_amount_usd || 0) - Number(o.third_party_fee_usd || 0), 0);
  
  // Get all remittance transactions (IN = received from 3P, OUT = paid to 3P)
  const remittanceIn = orderTransactions?.filter(tx => tx.direction === 'IN') || [];
  const paymentsOut = orderTransactions?.filter(tx => tx.direction === 'OUT') || [];
  
  const totalReceived = remittanceIn.reduce((sum, tx) => sum + Number(tx.amount_usd || 0), 0);
  const totalPaidOut = paymentsOut.reduce((sum, tx) => sum + Number(tx.amount_usd || 0), 0);
  
  // Net balance: positive = they owe us, negative = we owe them
  const netBalance = allPendingOrdersTotal - totalPaidOut;

  // Record remittance mutation
  const recordRemittanceMutation = useMutation({
    mutationFn: async () => {
      const amountUsd = parseFloat(receiveAmountUsd) || 0;
      if (amountUsd === 0) throw new Error('Enter a remittance amount');
      if (selectedOrders.length === 0) throw new Error('No orders selected');

      const selectedOrdersData = orders?.filter(o => selectedOrders.includes(o.id)) || [];

      // Create transaction for each order
      const transactions = selectedOrdersData.map(order => ({
        order_id: order.id,
        party_type: 'THIRD_PARTY' as const,
        party_id: selectedThirdParty,
        direction: 'IN' as const,
        amount_usd: Number(order.order_amount_usd || 0) - Number(order.third_party_fee_usd || 0),
        tx_type: 'THIRD_PARTY_REMITTANCE' as const,
        tx_date: new Date().toISOString(),
        recorded_by: user?.id,
        note: receiveNotes || `Remittance from ${selectedThirdPartyData?.name}`,
      }));

      const { error: txError } = await supabase.from('order_transactions').insert(transactions);
      if (txError) throw txError;

      // Update orders settlement status
      const { error: orderError } = await supabase
        .from('orders')
        .update({ third_party_settlement_status: 'Received' })
        .in('id', selectedOrders);
      if (orderError) throw orderError;

      // Update cashbox
      const today = new Date().toISOString().split('T')[0];
      const { data: existingCashbox } = await supabase
        .from('cashbox_daily')
        .select('*')
        .eq('date', today)
        .maybeSingle();

      if (existingCashbox) {
        await supabase.from('cashbox_daily').update({
          cash_in_usd: Number(existingCashbox.cash_in_usd || 0) + amountUsd,
        }).eq('id', existingCashbox.id);
      } else {
        await supabase.from('cashbox_daily').insert({
          date: today,
          cash_in_usd: amountUsd,
        });
      }
    },
    onSuccess: () => {
      toast.success('Remittance recorded successfully');
      queryClient.invalidateQueries({ queryKey: ['third-party-pending-orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-transactions-third-party'] });
      queryClient.invalidateQueries({ queryKey: ['cashbox'] });
      setReceiveDialogOpen(false);
      setSelectedOrders([]);
      setReceiveAmountUsd('');
      setReceiveNotes('');
    },
    onError: (error) => {
      toast.error(`Failed: ${error.message}`);
    },
  });

  // Pay third party mutation (for items they purchase for us)
  const payThirdPartyMutation = useMutation({
    mutationFn: async () => {
      const amountUsd = parseFloat(payAmountUsd) || 0;
      if (amountUsd === 0) throw new Error('Enter a payment amount');

      // Create transaction for payment OUT
      const { error: txError } = await supabase.from('order_transactions').insert({
        order_id: null,
        party_type: 'THIRD_PARTY' as const,
        party_id: selectedThirdParty,
        direction: 'OUT' as const,
        amount_usd: amountUsd,
        tx_type: 'THIRD_PARTY_REMITTANCE' as const,
        tx_date: new Date().toISOString(),
        recorded_by: user?.id,
        note: payNotes || `Payment to ${selectedThirdPartyData?.name}`,
      });
      if (txError) throw txError;

      // Update cashbox - cash out
      const today = new Date().toISOString().split('T')[0];
      const { data: existingCashbox } = await supabase
        .from('cashbox_daily')
        .select('*')
        .eq('date', today)
        .maybeSingle();

      if (existingCashbox) {
        await supabase.from('cashbox_daily').update({
          cash_out_usd: Number(existingCashbox.cash_out_usd || 0) + amountUsd,
        }).eq('id', existingCashbox.id);
      } else {
        await supabase.from('cashbox_daily').insert({
          date: today,
          cash_out_usd: amountUsd,
        });
      }
    },
    onSuccess: () => {
      toast.success('Payment to third party recorded');
      queryClient.invalidateQueries({ queryKey: ['order-transactions-third-party'] });
      queryClient.invalidateQueries({ queryKey: ['cashbox'] });
      setPayDialogOpen(false);
      setPayAmountUsd('');
      setPayNotes('');
    },
    onError: (error) => {
      toast.error(`Failed: ${error.message}`);
    },
  });

  // Delete transaction mutation
  const deleteTransactionMutation = useMutation({
    mutationFn: async (transaction: any) => {
      // If it was a remittance IN with an order, reset the order status
      if (transaction.direction === 'IN' && transaction.order_id) {
        await supabase
          .from('orders')
          .update({ third_party_settlement_status: 'Pending' })
          .eq('id', transaction.order_id);
      }

      // Delete the transaction
      const { error } = await supabase.from('order_transactions').delete().eq('id', transaction.id);
      if (error) throw error;

      // Reverse cashbox entry
      const txDate = new Date(transaction.tx_date).toISOString().split('T')[0];
      const { data: cashbox } = await supabase
        .from('cashbox_daily')
        .select('*')
        .eq('date', txDate)
        .maybeSingle();

      if (cashbox) {
        if (transaction.direction === 'IN') {
          await supabase.from('cashbox_daily').update({
            cash_in_usd: Math.max(0, Number(cashbox.cash_in_usd || 0) - Number(transaction.amount_usd || 0)),
          }).eq('id', cashbox.id);
        } else {
          await supabase.from('cashbox_daily').update({
            cash_out_usd: Math.max(0, Number(cashbox.cash_out_usd || 0) - Number(transaction.amount_usd || 0)),
          }).eq('id', cashbox.id);
        }
      }
    },
    onSuccess: () => {
      toast.success('Transaction deleted and reversed');
      queryClient.invalidateQueries({ queryKey: ['third-party-pending-orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-transactions-third-party'] });
      queryClient.invalidateQueries({ queryKey: ['cashbox'] });
      setDeleteDialogOpen(false);
      setTransactionToDelete(null);
    },
    onError: (error) => {
      toast.error(`Failed: ${error.message}`);
    },
  });

  const openReceiveDialog = () => {
    setReceiveAmountUsd(selectedTotals.expectedRemittance.toFixed(2));
    setReceiveDialogOpen(true);
  };

  const getOrderRef = (tx: any) => {
    if (!tx.orders) return '-';
    return tx.orders.order_type === 'ecom' 
      ? (tx.orders.voucher_no || tx.orders.order_id) 
      : tx.orders.order_id;
  };

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <Card className="border-sidebar-border bg-sidebar/50">
        <CardContent className="pt-4 pb-3">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground mb-1 block">Third Party</Label>
              <Popover open={thirdPartySearchOpen} onOpenChange={setThirdPartySearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={thirdPartySearchOpen}
                    className="w-full justify-between h-9 font-normal"
                  >
                    {selectedThirdParty
                      ? thirdParties?.find((tp) => tp.id === selectedThirdParty)?.name
                      : "Select third party..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0 bg-popover" align="start">
                  <Command>
                    <CommandInput placeholder="Search third parties..." />
                    <CommandList>
                      <CommandEmpty>No third party found.</CommandEmpty>
                      <CommandGroup>
                        {thirdParties?.map((tp) => (
                          <CommandItem
                            key={tp.id}
                            value={tp.name}
                            onSelect={() => {
                              setSelectedThirdParty(tp.id);
                              setThirdPartySearchOpen(false);
                              setSelectedOrders([]);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedThirdParty === tp.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {tp.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">From</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">To</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search orders..."
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
      {selectedThirdParty && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">
              Settlement Summary for {selectedThirdPartyData?.name}
            </h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPayDialogOpen(true)}>
                <ArrowUpRight className="h-4 w-4 mr-1" />
                Pay Third Party
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 text-blue-600">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs font-medium">Pending Orders</span>
                </div>
                <div className="mt-1">
                  <span className="text-2xl font-bold">{pendingOrders.length}</span>
                  <span className="text-sm text-muted-foreground ml-2">of {orders?.length || 0}</span>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 text-yellow-600">
                  <Receipt className="h-4 w-4" />
                  <span className="text-xs font-medium">They Owe Us</span>
                </div>
                <div className="mt-1">
                  <span className="text-2xl font-bold">${allPendingOrdersTotal.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 text-green-600">
                  <ArrowDownLeft className="h-4 w-4" />
                  <span className="text-xs font-medium">Total Received</span>
                </div>
                <div className="mt-1">
                  <span className="text-2xl font-bold">${totalReceived.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 text-orange-600">
                  <ArrowUpRight className="h-4 w-4" />
                  <span className="text-xs font-medium">We Paid Them</span>
                </div>
                <div className="mt-1">
                  <span className="text-2xl font-bold">${totalPaidOut.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
            
            <Card className={cn(
              "bg-gradient-to-br border",
              netBalance > 0 
                ? "from-green-500/10 to-green-600/5 border-green-500/20" 
                : netBalance < 0
                  ? "from-red-500/10 to-red-600/5 border-red-500/20"
                  : "from-gray-500/10 to-gray-600/5 border-gray-500/20"
            )}>
              <CardContent className="pt-4 pb-3">
                <div className={cn(
                  "flex items-center gap-2",
                  netBalance > 0 ? "text-green-600" : netBalance < 0 ? "text-red-600" : "text-gray-600"
                )}>
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs font-medium">Net Balance</span>
                </div>
                <div className="mt-1">
                  <span className={cn(
                    "text-2xl font-bold",
                    netBalance > 0 ? "text-green-600" : netBalance < 0 ? "text-red-600" : ""
                  )}>
                    {netBalance >= 0 ? '+' : ''}{netBalance.toFixed(2)}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {netBalance > 0 ? '(they owe us)' : netBalance < 0 ? '(we owe them)' : '(settled)'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Pending Orders Section */}
      {selectedThirdParty && (
        <Card>
          <Collapsible open={pendingExpanded} onOpenChange={setPendingExpanded}>
            <CardHeader className="pb-2">
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between cursor-pointer">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4 text-yellow-600" />
                    Pending Remittance
                    <Badge variant="outline" className="border-yellow-500 text-yellow-600">{pendingOrders.length}</Badge>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {selectedOrders.length > 0 && (
                      <Button size="sm" onClick={openReceiveDialog} className="bg-green-600 hover:bg-green-700">
                        <ArrowDownLeft className="h-4 w-4 mr-1" />
                        Receive ${selectedTotals.expectedRemittance.toFixed(2)}
                      </Button>
                    )}
                    {pendingExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pt-0">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : pendingOrders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    No pending remittances - all settled!
                  </div>
                ) : (
                  <>
                    {selectedOrders.length > 0 && (
                      <div className="mb-3 p-3 bg-muted/50 rounded-lg flex items-center justify-between">
                        <span className="text-sm">
                          <strong>{selectedOrders.length}</strong> orders selected • 
                          Expected: <strong className="text-green-600">${selectedTotals.expectedRemittance.toFixed(2)}</strong>
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedOrders([])}>
                          Clear selection
                        </Button>
                      </div>
                    )}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={selectedOrders.length === pendingOrders.length && pendingOrders.length > 0}
                              onCheckedChange={handleSelectAll}
                            />
                          </TableHead>
                          <TableHead>Order Ref</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Order Value</TableHead>
                          <TableHead className="text-right">3P Fee</TableHead>
                          <TableHead className="text-right">Expected Remit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingOrders.map((order) => {
                          const orderRef = order.order_type === 'ecom' ? (order.voucher_no || order.order_id) : order.order_id;
                          const orderValue = Number(order.order_amount_usd || 0);
                          const thirdPartyFee = Number(order.third_party_fee_usd || 0);
                          const expectedRemit = orderValue - thirdPartyFee;

                          return (
                            <TableRow key={order.id} className={selectedOrders.includes(order.id) ? 'bg-muted/30' : ''}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedOrders.includes(order.id)}
                                  onCheckedChange={() => handleToggleOrder(order.id)}
                                />
                              </TableCell>
                              <TableCell className="font-mono text-sm">{orderRef}</TableCell>
                              <TableCell>{order.clients?.name}</TableCell>
                              <TableCell>{format(new Date(order.created_at), 'MMM d')}</TableCell>
                              <TableCell className="text-right font-mono">${orderValue.toFixed(2)}</TableCell>
                              <TableCell className="text-right font-mono text-muted-foreground">-${thirdPartyFee.toFixed(2)}</TableCell>
                              <TableCell className="text-right font-mono font-medium text-green-600">${expectedRemit.toFixed(2)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Received Orders Section */}
      {selectedThirdParty && receivedOrders.length > 0 && (
        <Card>
          <Collapsible open={receivedExpanded} onOpenChange={setReceivedExpanded}>
            <CardHeader className="pb-2">
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between cursor-pointer">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Received Orders
                    <Badge variant="default" className="bg-green-600">{receivedOrders.length}</Badge>
                  </CardTitle>
                  {receivedExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order Ref</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Order Value</TableHead>
                      <TableHead className="text-right">3P Fee</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receivedOrders.map((order) => {
                      const orderRef = order.order_type === 'ecom' ? (order.voucher_no || order.order_id) : order.order_id;
                      const orderValue = Number(order.order_amount_usd || 0);
                      const thirdPartyFee = Number(order.third_party_fee_usd || 0);
                      const expectedRemit = orderValue - thirdPartyFee;

                      return (
                        <TableRow key={order.id} className="opacity-70">
                          <TableCell className="font-mono text-sm">{orderRef}</TableCell>
                          <TableCell>{order.clients?.name}</TableCell>
                          <TableCell>{format(new Date(order.created_at), 'MMM d')}</TableCell>
                          <TableCell className="text-right font-mono">${orderValue.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">-${thirdPartyFee.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono font-medium text-green-600">${expectedRemit.toFixed(2)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Transaction History Section */}
      {selectedThirdParty && (
        <Card>
          <Collapsible open={transactionsExpanded} onOpenChange={setTransactionsExpanded}>
            <CardHeader className="pb-2">
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between cursor-pointer">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Transaction History
                    <Badge variant="secondary">{orderTransactions?.length || 0}</Badge>
                  </CardTitle>
                  {transactionsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pt-0">
                {!orderTransactions || orderTransactions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No transactions recorded yet
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Order Ref</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Note</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderTransactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell>{format(new Date(tx.tx_date), 'MMM d, yyyy')}</TableCell>
                          <TableCell>
                            {tx.direction === 'IN' ? (
                              <Badge variant="default" className="bg-green-600">
                                <ArrowDownLeft className="h-3 w-3 mr-1" />
                                Received
                              </Badge>
                            ) : (
                              <Badge variant="default" className="bg-orange-600">
                                <ArrowUpRight className="h-3 w-3 mr-1" />
                                Paid Out
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{getOrderRef(tx)}</TableCell>
                          <TableCell className={cn(
                            "text-right font-mono font-medium",
                            tx.direction === 'IN' ? 'text-green-600' : 'text-orange-600'
                          )}>
                            {tx.direction === 'IN' ? '+' : '-'}${Number(tx.amount_usd).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                            {tx.note || '-'}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              onClick={() => {
                                setTransactionToDelete(tx);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {!selectedThirdParty && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Select a third party to view their orders and settlement status</p>
          </CardContent>
        </Card>
      )}

      {/* Receive Remittance Dialog */}
      <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownLeft className="h-5 w-5 text-green-600" />
              Receive Third Party Remittance
            </DialogTitle>
            <DialogDescription>
              Record cash received from {selectedThirdPartyData?.name} for {selectedOrders.length} orders
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted/50 p-3 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Selected Orders:</span>
                <span className="font-medium">{selectedTotals.totalOrders}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Order Value:</span>
                <span className="font-medium">${selectedTotals.totalOrderValue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Third Party Fees:</span>
                <span className="font-medium text-red-600">-${selectedTotals.totalThirdPartyFees.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-medium">Expected Remittance:</span>
                <span className="font-bold text-green-600">${selectedTotals.expectedRemittance.toFixed(2)}</span>
              </div>
            </div>
            <div>
              <Label>Amount Received (USD)</Label>
              <Input
                type="number"
                step="0.01"
                value={receiveAmountUsd}
                onChange={(e) => setReceiveAmountUsd(e.target.value)}
                placeholder="0.00"
              />
              {parseFloat(receiveAmountUsd) !== selectedTotals.expectedRemittance && receiveAmountUsd && (
                <p className="text-xs text-yellow-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Amount differs from expected (${selectedTotals.expectedRemittance.toFixed(2)})
                </p>
              )}
            </div>
            <div>
              <Label>Notes (Optional)</Label>
              <Textarea
                value={receiveNotes}
                onChange={(e) => setReceiveNotes(e.target.value)}
                placeholder="Add notes about this remittance..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => recordRemittanceMutation.mutate()} 
              disabled={recordRemittanceMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {recordRemittanceMutation.isPending ? 'Processing...' : 'Record Remittance'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay Third Party Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpRight className="h-5 w-5 text-orange-600" />
              Pay Third Party
            </DialogTitle>
            <DialogDescription>
              Record payment to {selectedThirdPartyData?.name} (e.g., for items purchased on your behalf)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Amount (USD)</Label>
              <Input
                type="number"
                step="0.01"
                value={payAmountUsd}
                onChange={(e) => setPayAmountUsd(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder="e.g., Item purchase from their coverage area, reimbursement, etc."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => payThirdPartyMutation.mutate()} 
              disabled={payThirdPartyMutation.isPending}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {payThirdPartyMutation.isPending ? 'Processing...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Transaction Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Transaction
            </DialogTitle>
            <DialogDescription>
              This will reverse the transaction and update the cashbox accordingly.
              {transactionToDelete?.order_id && ' The related order will be marked as pending again.'}
            </DialogDescription>
          </DialogHeader>
          {transactionToDelete && (
            <div className="bg-muted/50 p-3 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type:</span>
                <span className="font-medium">{transactionToDelete.direction === 'IN' ? 'Received' : 'Paid Out'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-medium">${Number(transactionToDelete.amount_usd).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date:</span>
                <span className="font-medium">{format(new Date(transactionToDelete.tx_date), 'MMM d, yyyy')}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button 
              variant="destructive"
              onClick={() => deleteTransactionMutation.mutate(transactionToDelete)} 
              disabled={deleteTransactionMutation.isPending}
            >
              {deleteTransactionMutation.isPending ? 'Deleting...' : 'Delete & Reverse'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
