import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { History, Pencil, Trash2, Search } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';

type TransactionType = 'driver' | 'client' | 'cashbox' | 'payment' | 'expense';

interface UnifiedTransaction {
  id: string;
  type: TransactionType;
  timestamp: string;
  entityName: string;
  entityType: string;
  transactionType: 'Credit' | 'Debit' | 'Capital In' | 'Capital Out' | 'Expense' | 'Payment' | 'Daily Expense';
  amountUsd: number;
  amountLbp: number;
  orderRef?: string;
  note?: string;
  rawData: any;
}

const TransactionHistory = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<TransactionType | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [editTransaction, setEditTransaction] = useState<UnifiedTransaction | null>(null);
  const [deleteTransaction, setDeleteTransaction] = useState<UnifiedTransaction | null>(null);

  // Edit form state
  const [editAmountUsd, setEditAmountUsd] = useState('');
  const [editAmountLbp, setEditAmountLbp] = useState('');
  const [editNote, setEditNote] = useState('');

  // Fetch all transactions
  const { data: transactions, isLoading } = useQuery({
    queryKey: ['all-transactions', dateFrom, dateTo],
    queryFn: async () => {
      const unified: UnifiedTransaction[] = [];

      // Fetch driver transactions
      let driverQuery = supabase
        .from('driver_transactions')
        .select('*, drivers(name)')
        .order('ts', { ascending: false });
      
      if (dateFrom) driverQuery = driverQuery.gte('ts', dateFrom);
      if (dateTo) driverQuery = driverQuery.lte('ts', dateTo + 'T23:59:59');

      const { data: driverTxs } = await driverQuery;
      
      driverTxs?.forEach(tx => {
        unified.push({
          id: tx.id,
          type: 'driver',
          timestamp: tx.ts || '',
          entityName: tx.drivers?.name || 'Unknown Driver',
          entityType: 'Driver',
          transactionType: tx.type,
          amountUsd: Number(tx.amount_usd || 0),
          amountLbp: Number(tx.amount_lbp || 0),
          orderRef: tx.order_ref || undefined,
          note: tx.note || undefined,
          rawData: tx,
        });
      });

      // Fetch client transactions
      let clientQuery = supabase
        .from('client_transactions')
        .select('*, clients(name)')
        .order('ts', { ascending: false });
      
      if (dateFrom) clientQuery = clientQuery.gte('ts', dateFrom);
      if (dateTo) clientQuery = clientQuery.lte('ts', dateTo + 'T23:59:59');

      const { data: clientTxs } = await clientQuery;
      
      clientTxs?.forEach(tx => {
        unified.push({
          id: tx.id,
          type: 'client',
          timestamp: tx.ts || '',
          entityName: tx.clients?.name || 'Unknown Client',
          entityType: 'Client',
          transactionType: tx.type,
          amountUsd: Number(tx.amount_usd || 0),
          amountLbp: Number(tx.amount_lbp || 0),
          orderRef: tx.order_ref || undefined,
          note: tx.note || undefined,
          rawData: tx,
        });
      });

      // Fetch client payments
      let paymentQuery = supabase
        .from('client_payments')
        .select('*')
        .order('payment_date', { ascending: false });
      
      if (dateFrom) paymentQuery = paymentQuery.gte('payment_date', dateFrom);
      if (dateTo) paymentQuery = paymentQuery.lte('payment_date', dateTo);

      const { data: payments } = await paymentQuery;
      
      // Get client names separately
      if (payments && payments.length > 0) {
        const clientIds = [...new Set(payments.map(p => p.client_id))];
        const { data: clients } = await supabase
          .from('clients')
          .select('id, name')
          .in('id', clientIds);
        
        const clientMap = new Map(clients?.map(c => [c.id, c.name]));
        
        payments.forEach(payment => {
          unified.push({
            id: payment.id,
            type: 'payment',
            timestamp: payment.payment_date,
            entityName: clientMap.get(payment.client_id) || 'Unknown Client',
            entityType: 'Client Payment',
            transactionType: 'Payment',
            amountUsd: Number(payment.amount_usd || 0),
            amountLbp: Number(payment.amount_lbp || 0),
            note: payment.notes || undefined,
            rawData: payment,
          });
        });
      }

      // Fetch daily expenses
      let expenseQuery = supabase
        .from('daily_expenses')
        .select('*, expense_categories(name, category_group)')
        .order('date', { ascending: false });
      
      if (dateFrom) expenseQuery = expenseQuery.gte('date', dateFrom);
      if (dateTo) expenseQuery = expenseQuery.lte('date', dateTo);

      const { data: expenses } = await expenseQuery;
      
      expenses?.forEach(expense => {
        unified.push({
          id: expense.id,
          type: 'expense',
          timestamp: expense.date,
          entityName: expense.expense_categories?.name || 'Unknown Category',
          entityType: expense.expense_categories?.category_group || 'Expense',
          transactionType: 'Daily Expense',
          amountUsd: Number(expense.amount_usd || 0),
          amountLbp: Number(expense.amount_lbp || 0),
          note: expense.notes || undefined,
          rawData: expense,
        });
      });

      // Fetch cashbox transactions
      let cashboxQuery = supabase
        .from('cashbox_daily')
        .select('*')
        .order('date', { ascending: false });
      
      if (dateFrom) cashboxQuery = cashboxQuery.gte('date', dateFrom);
      if (dateTo) cashboxQuery = cashboxQuery.lte('date', dateTo);

      const { data: cashboxTxs } = await cashboxQuery;
      
      cashboxTxs?.forEach(tx => {
        if (tx.cash_in_usd > 0 || tx.cash_in_lbp > 0) {
          unified.push({
            id: `${tx.id}-in`,
            type: 'cashbox',
            timestamp: tx.date,
            entityName: 'Cashbox',
            entityType: 'Cashbox',
            transactionType: 'Capital In',
            amountUsd: Number(tx.cash_in_usd || 0),
            amountLbp: Number(tx.cash_in_lbp || 0),
            note: tx.notes || undefined,
            rawData: tx,
          });
        }
        if (tx.cash_out_usd > 0 || tx.cash_out_lbp > 0) {
          unified.push({
            id: `${tx.id}-out`,
            type: 'cashbox',
            timestamp: tx.date,
            entityName: 'Cashbox',
            entityType: 'Cashbox',
            transactionType: 'Capital Out',
            amountUsd: Number(tx.cash_out_usd || 0),
            amountLbp: Number(tx.cash_out_lbp || 0),
            note: tx.notes || undefined,
            rawData: tx,
          });
        }
      });

      // Sort by timestamp descending
      unified.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return unified;
    },
  });

  // Filter transactions
  const filteredTransactions = transactions?.filter(tx => {
    const matchesSearch = 
      tx.entityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.orderRef?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.note?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'all' || tx.type === filterType;

    return matchesSearch && matchesType;
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (transaction: UnifiedTransaction) => {
      if (transaction.type === 'driver') {
        // Reverse driver wallet
        const { data: driver } = await supabase
          .from('drivers')
          .select('wallet_usd, wallet_lbp')
          .eq('id', transaction.rawData.driver_id)
          .single();

        if (driver) {
          const newUsd = transaction.transactionType === 'Credit'
            ? driver.wallet_usd - transaction.amountUsd
            : driver.wallet_usd + transaction.amountUsd;
          const newLbp = transaction.transactionType === 'Credit'
            ? driver.wallet_lbp - transaction.amountLbp
            : driver.wallet_lbp + transaction.amountLbp;

          await supabase
            .from('drivers')
            .update({ wallet_usd: newUsd, wallet_lbp: newLbp })
            .eq('id', transaction.rawData.driver_id);
        }

        await supabase.from('driver_transactions').delete().eq('id', transaction.id);
      } else if (transaction.type === 'client') {
        await supabase.from('client_transactions').delete().eq('id', transaction.id);
      } else if (transaction.type === 'payment') {
        await supabase.from('client_payments').delete().eq('id', transaction.id);
      } else if (transaction.type === 'expense') {
        await supabase.from('daily_expenses').delete().eq('id', transaction.id);
      }
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Transaction deleted successfully' });
      queryClient.invalidateQueries({ queryKey: ['all-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setDeleteTransaction(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Edit mutation
  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editTransaction) return;

      const newAmountUsd = parseFloat(editAmountUsd);
      const newAmountLbp = parseFloat(editAmountLbp);

      if (editTransaction.type === 'driver') {
        // Reverse old amounts
        const { data: driver } = await supabase
          .from('drivers')
          .select('wallet_usd, wallet_lbp')
          .eq('id', editTransaction.rawData.driver_id)
          .single();

        if (driver) {
          let newUsd = driver.wallet_usd;
          let newLbp = driver.wallet_lbp;

          // Reverse old transaction
          if (editTransaction.transactionType === 'Credit') {
            newUsd -= editTransaction.amountUsd;
            newLbp -= editTransaction.amountLbp;
          } else {
            newUsd += editTransaction.amountUsd;
            newLbp += editTransaction.amountLbp;
          }

          // Apply new transaction
          if (editTransaction.transactionType === 'Credit') {
            newUsd += newAmountUsd;
            newLbp += newAmountLbp;
          } else {
            newUsd -= newAmountUsd;
            newLbp -= newAmountLbp;
          }

          await supabase
            .from('drivers')
            .update({ wallet_usd: newUsd, wallet_lbp: newLbp })
            .eq('id', editTransaction.rawData.driver_id);
        }

        await supabase
          .from('driver_transactions')
          .update({
            amount_usd: newAmountUsd,
            amount_lbp: newAmountLbp,
            note: editNote,
          })
          .eq('id', editTransaction.id);
      } else if (editTransaction.type === 'client') {
        await supabase
          .from('client_transactions')
          .update({
            amount_usd: newAmountUsd,
            amount_lbp: newAmountLbp,
            note: editNote,
          })
          .eq('id', editTransaction.id);
      } else if (editTransaction.type === 'payment') {
        await supabase
          .from('client_payments')
          .update({
            amount_usd: newAmountUsd,
            amount_lbp: newAmountLbp,
            notes: editNote,
          })
          .eq('id', editTransaction.id);
      } else if (editTransaction.type === 'expense') {
        await supabase
          .from('daily_expenses')
          .update({
            amount_usd: newAmountUsd,
            amount_lbp: newAmountLbp,
            notes: editNote,
          })
          .eq('id', editTransaction.id);
      }
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Transaction updated successfully' });
      queryClient.invalidateQueries({ queryKey: ['all-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setEditTransaction(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleEdit = (transaction: UnifiedTransaction) => {
    setEditTransaction(transaction);
    setEditAmountUsd(transaction.amountUsd.toString());
    setEditAmountLbp(transaction.amountLbp.toString());
    setEditNote(transaction.note || '');
  };

  const getTransactionColor = (txType: string) => {
    switch (txType) {
      case 'Credit':
      case 'Capital In':
      case 'Payment':
        return 'text-green-600';
      case 'Debit':
      case 'Capital Out':
      case 'Expense':
        return 'text-red-600';
      default:
        return '';
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <History className="h-8 w-8" />
              Transaction History
            </h1>
            <p className="text-muted-foreground mt-1">
              View and manage all transactions across the system
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search entity, order, note..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="driver">Driver</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="payment">Payment</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="cashbox">Cashbox</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>From Date</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>To Date</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Transactions ({filteredTransactions?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center text-muted-foreground">Loading...</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Transaction</TableHead>
                      <TableHead>USD</TableHead>
                      <TableHead>LBP</TableHead>
                      <TableHead>Order Ref</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions?.map((tx) => (
                      <TableRow key={`${tx.type}-${tx.id}`}>
                        <TableCell className="text-xs">
                          {format(new Date(tx.timestamp), 'MMM dd, yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{tx.entityName}</span>
                            <span className="text-xs text-muted-foreground">{tx.entityType}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{tx.type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getTransactionColor(tx.transactionType)}>
                            {tx.transactionType}
                          </Badge>
                        </TableCell>
                        <TableCell className={getTransactionColor(tx.transactionType)}>
                          ${tx.amountUsd.toFixed(2)}
                        </TableCell>
                        <TableCell className={getTransactionColor(tx.transactionType)}>
                          LL {tx.amountLbp.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs">{tx.orderRef || '-'}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">
                          {tx.note || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {tx.type !== 'cashbox' ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEdit(tx)}
                                  title="Edit"
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setDeleteTransaction(tx)}
                                  title="Delete"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground">N/A</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editTransaction} onOpenChange={(open) => !open && setEditTransaction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount USD</Label>
              <Input
                type="number"
                step="0.01"
                value={editAmountUsd}
                onChange={(e) => setEditAmountUsd(e.target.value)}
              />
            </div>
            <div>
              <Label>Amount LBP</Label>
              <Input
                type="number"
                step="1"
                value={editAmountLbp}
                onChange={(e) => setEditAmountLbp(e.target.value)}
              />
            </div>
            <div>
              <Label>Note</Label>
              <Textarea
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="Optional note..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditTransaction(null)}>
                Cancel
              </Button>
              <Button onClick={() => editMutation.mutate()} disabled={editMutation.isPending}>
                {editMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteTransaction} onOpenChange={(open) => !open && setDeleteTransaction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this transaction? This will reverse any wallet/balance changes and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTransaction && deleteMutation.mutate(deleteTransaction)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default TransactionHistory;
