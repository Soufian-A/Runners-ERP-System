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
import { Truck, Plus, DollarSign, FileText } from 'lucide-react';
import CreateDriverDialog from '@/components/drivers/CreateDriverDialog';
import DriverRemittanceDialog from '@/components/drivers/DriverRemittanceDialog';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const Drivers = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [viewStatementDriver, setViewStatementDriver] = useState<any>(null);
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

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
      
      // First get driver transactions
      const { data: transactions, error: txError } = await supabase
        .from('driver_transactions')
        .select('*')
        .eq('driver_id', viewStatementDriver.id)
        .gte('ts', dateFrom)
        .lte('ts', dateTo + 'T23:59:59')
        .order('ts', { ascending: false });
      
      if (txError) throw txError;
      if (!transactions) return [];

      // Get all unique order_refs
      const orderRefs = transactions
        .map(tx => tx.order_ref)
        .filter(ref => ref !== null);

      // Fetch orders data separately
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('order_id, voucher_no, order_amount_usd, order_amount_lbp, delivery_fee_usd, delivery_fee_lbp, notes, clients(name)')
        .in('order_id', orderRefs);
      
      if (ordersError) throw ordersError;

      // Create a map for quick lookup
      const ordersMap = new Map(orders?.map(o => [o.order_id, o]) || []);

      // Combine the data
      return transactions.map(tx => ({
        ...tx,
        order: ordersMap.get(tx.order_ref)
      }));
    },
    enabled: !!viewStatementDriver?.id,
  });

  const processDeliveredOrders = async () => {
    const { data: deliveredOrders } = await supabase
      .from('orders')
      .select('id')
      .eq('status', 'Delivered');
    
    if (deliveredOrders) {
      for (const order of deliveredOrders) {
        try {
          await supabase.functions.invoke('process-order-delivery', {
            body: { orderId: order.id }
          });
        } catch (error) {
          console.error('Error processing order:', order.id, error);
        }
      }
      toast({ title: "Reprocessed all delivered orders" });
      refetch();
    }
  };

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

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Drivers</h1>
            <p className="text-muted-foreground mt-1">Manage delivery drivers, wallets, and statements</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={processDeliveredOrders}>
              Reprocess Delivered Orders
            </Button>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Driver
            </Button>
          </div>
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
                          <TableHead className="py-2">Voucher #</TableHead>
                          <TableHead className="py-2">Client Name</TableHead>
                          <TableHead className="py-2">Order Amount USD</TableHead>
                          <TableHead className="py-2">Order Amount LBP</TableHead>
                          <TableHead className="py-2">Delivery Fee USD</TableHead>
                          <TableHead className="py-2">Delivery Fee LBP</TableHead>
                          <TableHead className="py-2">Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statementData.map((row: any) => (
                          <TableRow key={row.id}>
                            <TableCell className="py-1.5">{format(new Date(row.ts), 'MMM dd, yyyy HH:mm')}</TableCell>
                            <TableCell className="py-1.5">{row.order?.voucher_no || '-'}</TableCell>
                            <TableCell className="py-1.5">{row.order?.clients?.name || '-'}</TableCell>
                            <TableCell className="py-1.5">${Number(row.order?.order_amount_usd || 0).toFixed(2)}</TableCell>
                            <TableCell className="py-1.5">{Number(row.order?.order_amount_lbp || 0).toLocaleString()} LBP</TableCell>
                            <TableCell className="py-1.5">${Number(row.order?.delivery_fee_usd || 0).toFixed(2)}</TableCell>
                            <TableCell className="py-1.5">{Number(row.order?.delivery_fee_lbp || 0).toLocaleString()} LBP</TableCell>
                            <TableCell className="py-1.5 max-w-xs truncate">{row.order?.notes || '-'}</TableCell>
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
    </Layout>
  );
};

export default Drivers;