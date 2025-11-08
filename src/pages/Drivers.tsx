import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Truck, Plus, DollarSign, FileText, ArrowDownLeft, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import CreateDriverDialog from '@/components/drivers/CreateDriverDialog';
import DriverRemittanceDialog from '@/components/drivers/DriverRemittanceDialog';
import TakeBackCashDialog from '@/components/drivers/TakeBackCashDialog';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const Drivers = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [viewStatementDriver, setViewStatementDriver] = useState<any>(null);
  const [takeBackCashDriver, setTakeBackCashDriver] = useState<any>(null);
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [deleteTransactionId, setDeleteTransactionId] = useState<string | null>(null);

  const { data: drivers, isLoading, refetch } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: statementData, isLoading: isLoadingStatement } = useQuery({
    queryKey: ['driver-statement', viewStatementDriver?.id, dateFrom, dateTo],
    queryFn: async () => {
      if (!viewStatementDriver?.id) return null;
      
      // Get all driver transactions
      const { data: transactions, error: txError } = await supabase
        .from('driver_transactions')
        .select('*')
        .eq('driver_id', viewStatementDriver.id)
        .gte('ts', dateFrom)
        .lte('ts', dateTo + 'T23:59:59')
        .order('ts', { ascending: false });
      
      if (txError) throw txError;
      if (!transactions) return [];

      // Get all unique order_refs (filter out null)
      const orderRefs = transactions
        .map(tx => tx.order_ref)
        .filter(ref => ref !== null && ref !== undefined);

      // Fetch orders data if there are any order refs
      let ordersMap = new Map();
      if (orderRefs.length > 0) {
        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select('order_id, voucher_no, order_amount_usd, order_amount_lbp, delivery_fee_usd, delivery_fee_lbp, notes, driver_paid_for_client, driver_paid_amount_usd, driver_paid_amount_lbp, driver_paid_reason, clients(name)')
          .in('order_id', orderRefs);
        
        if (ordersError) throw ordersError;
        ordersMap = new Map(orders?.map(o => [o.order_id, o]) || []);
      }

      // Combine the data - include all transactions
      return transactions.map(tx => ({
        ...tx,
        order: tx.order_ref ? ordersMap.get(tx.order_ref) : null
      }));
    },
    enabled: !!viewStatementDriver?.id,
  });

  const calculateStatementTotals = () => {
    if (!statementData) return { usd: 0, lbp: 0 };
    
    return statementData.reduce(
      (acc: any, row: any) => {
        const multiplier = row.type === 'Credit' ? 1 : -1;
        return {
          usd: acc.usd + Number(row.amount_usd || 0) * multiplier,
          lbp: acc.lbp + Number(row.amount_lbp || 0) * multiplier,
        };
      },
      { usd: 0, lbp: 0 }
    );
  };

  const statementTotals = calculateStatementTotals();

  const handleDeleteTransaction = async () => {
    if (!deleteTransactionId) return;

    try {
      // Get transaction details before deleting to reverse wallet balance
      const { data: transaction, error: fetchError } = await supabase
        .from('driver_transactions')
        .select('*, drivers(id, wallet_usd, wallet_lbp)')
        .eq('id', deleteTransactionId)
        .single();

      if (fetchError) throw fetchError;

      // Reverse wallet balance
      const multiplier = transaction.type === 'Credit' ? -1 : 1;
      const newWalletUsd = Number(transaction.drivers.wallet_usd) + (Number(transaction.amount_usd) * multiplier);
      const newWalletLbp = Number(transaction.drivers.wallet_lbp) + (Number(transaction.amount_lbp) * multiplier);

      const { error: walletError } = await supabase
        .from('drivers')
        .update({
          wallet_usd: newWalletUsd,
          wallet_lbp: newWalletLbp,
        })
        .eq('id', transaction.driver_id);

      if (walletError) throw walletError;

      // Delete the transaction
      const { error: deleteError } = await supabase
        .from('driver_transactions')
        .delete()
        .eq('id', deleteTransactionId);

      if (deleteError) throw deleteError;

      toast({
        title: 'Transaction deleted',
        description: 'Transaction has been deleted and wallet balance updated',
      });

      refetch();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDeleteTransactionId(null);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Drivers</h1>
            <p className="text-muted-foreground mt-1">Manage delivery drivers, wallets, and statements</p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Driver
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Driver List
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Wallet USD</TableHead>
                  <TableHead>Wallet LBP</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">Loading...</TableCell>
                  </TableRow>
                ) : drivers && drivers.length > 0 ? (
                  drivers.map((driver) => (
                    <TableRow key={driver.id}>
                      <TableCell className="font-medium">{driver.name}</TableCell>
                      <TableCell>{driver.phone}</TableCell>
                      <TableCell className={Number(driver.wallet_usd) < 0 ? 'text-red-600' : ''}>
                        ${Number(driver.wallet_usd).toFixed(2)}
                      </TableCell>
                      <TableCell className={Number(driver.wallet_lbp) < 0 ? 'text-red-600' : ''}>
                        {Number(driver.wallet_lbp).toLocaleString()} LBP
                      </TableCell>
                      <TableCell>
                        <Badge variant={driver.active ? 'default' : 'secondary'}>
                          {driver.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setViewStatementDriver(driver)}
                          >
                            <FileText className="mr-1 h-3 w-3" />
                            Statement
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedDriver(driver)}
                          >
                            <DollarSign className="mr-1 h-3 w-3" />
                            Remit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setTakeBackCashDriver(driver)}
                          >
                            <ArrowDownLeft className="mr-1 h-3 w-3" />
                            Take Cash
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">No drivers found</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {viewStatementDriver && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Statement for {viewStatementDriver.name}
                </CardTitle>
                <Button variant="ghost" onClick={() => setViewStatementDriver(null)}>
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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

              {isLoadingStatement ? (
                <p className="text-center text-muted-foreground">Loading...</p>
              ) : statementData && statementData.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="py-2">Date</TableHead>
                          <TableHead className="py-2">Type</TableHead>
                          <TableHead className="py-2">Voucher #</TableHead>
                          <TableHead className="py-2">Client</TableHead>
                          <TableHead className="py-2">Order Amount USD</TableHead>
                          <TableHead className="py-2">Order Amount LBP</TableHead>
                          <TableHead className="py-2">Delivery Fee USD</TableHead>
                          <TableHead className="py-2">Delivery Fee LBP</TableHead>
                          <TableHead className="py-2">Transaction USD</TableHead>
                          <TableHead className="py-2">Transaction LBP</TableHead>
                          <TableHead className="py-2">Driver Paid</TableHead>
                          <TableHead className="py-2">Note</TableHead>
                          <TableHead className="py-2">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statementData.map((row: any) => (
                          <TableRow key={row.id}>
                            <TableCell className="py-1.5 whitespace-nowrap">{format(new Date(row.ts), 'MMM dd, yyyy HH:mm')}</TableCell>
                            <TableCell className="py-1.5">
                              <Badge variant={row.type === 'Credit' ? 'default' : 'secondary'}>
                                {row.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-1.5">{row.order?.voucher_no || '-'}</TableCell>
                            <TableCell className="py-1.5">{row.order?.clients?.name || '-'}</TableCell>
                            <TableCell className="py-1.5">
                              {row.order?.order_amount_usd ? `$${Number(row.order.order_amount_usd).toFixed(2)}` : '-'}
                            </TableCell>
                            <TableCell className="py-1.5">
                              {row.order?.order_amount_lbp ? `${Number(row.order.order_amount_lbp).toLocaleString()} LBP` : '-'}
                            </TableCell>
                            <TableCell className="py-1.5">
                              {row.order?.delivery_fee_usd ? `$${Number(row.order.delivery_fee_usd).toFixed(2)}` : '-'}
                            </TableCell>
                            <TableCell className="py-1.5">
                              {row.order?.delivery_fee_lbp ? `${Number(row.order.delivery_fee_lbp).toLocaleString()} LBP` : '-'}
                            </TableCell>
                            <TableCell className={`py-1.5 ${row.type === 'Credit' ? 'text-green-600' : 'text-red-600'}`}>
                              {row.type === 'Credit' ? '+' : '-'}${Number(row.amount_usd || 0).toFixed(2)}
                            </TableCell>
                            <TableCell className={`py-1.5 ${row.type === 'Credit' ? 'text-green-600' : 'text-red-600'}`}>
                              {row.type === 'Credit' ? '+' : '-'}{Number(row.amount_lbp || 0).toLocaleString()} LBP
                            </TableCell>
                            <TableCell className="py-1.5">
                              {row.order?.driver_paid_for_client ? (
                                <Badge variant="outline">Yes</Badge>
                              ) : (
                                <span className="text-muted-foreground">No</span>
                              )}
                            </TableCell>
                            <TableCell className="py-1.5 max-w-xs truncate">{row.note || '-'}</TableCell>
                            <TableCell className="py-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDeleteTransactionId(row.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex justify-end">
                    <div className="rounded-md bg-muted p-4">
                      <p className="font-semibold text-lg">
                        Net Balance: ${statementTotals.usd.toFixed(2)} / {statementTotals.lbp.toLocaleString()} LBP
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-center text-muted-foreground">
                  No transactions found for the selected period.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <CreateDriverDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />

      {selectedDriver && (
        <DriverRemittanceDialog
          driver={selectedDriver}
          open={!!selectedDriver}
          onOpenChange={(open) => !open && setSelectedDriver(null)}
        />
      )}

      {takeBackCashDriver && (
        <TakeBackCashDialog
          driver={takeBackCashDriver}
          open={!!takeBackCashDriver}
          onOpenChange={(open) => !open && setTakeBackCashDriver(null)}
        />
      )}

      <AlertDialog open={!!deleteTransactionId} onOpenChange={(open) => !open && setDeleteTransactionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this transaction? This will reverse the wallet balance and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTransaction}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default Drivers;