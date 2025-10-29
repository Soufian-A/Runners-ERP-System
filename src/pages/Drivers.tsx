import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Truck, Plus, DollarSign } from 'lucide-react';
import CreateDriverDialog from '@/components/drivers/CreateDriverDialog';
import DriverRemittanceDialog from '@/components/drivers/DriverRemittanceDialog';
import { toast } from '@/hooks/use-toast';

const Drivers = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
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

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Drivers</h1>
            <p className="text-muted-foreground mt-1">Manage delivery drivers and wallets</p>
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
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedDriver(driver)}
                        >
                          <DollarSign className="mr-1 h-3 w-3" />
                          Remit
                        </Button>
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