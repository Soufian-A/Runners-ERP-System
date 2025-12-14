import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Truck, Plus, DollarSign, FileText, Trash2 } from 'lucide-react';
import CreateDriverDialog from '@/components/drivers/CreateDriverDialog';
import DriverCashSettlementDialog from '@/components/drivers/DriverCashSettlementDialog';
import { DriverStatementsTab } from '@/components/drivers/DriverStatementsTab';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';

const Drivers = () => {
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabFromUrl === 'statements' ? 'statements' : 'list');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [settleCashDriver, setSettleCashDriver] = useState<any>(null);
  const [deleteDriverId, setDeleteDriverId] = useState<string | null>(null);
  const [deleteDriverName, setDeleteDriverName] = useState<string>('');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (tabFromUrl === 'statements') {
      setActiveTab('statements');
    }
  }, [tabFromUrl]);

  const { data: drivers, isLoading } = useQuery({
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

  const deleteDriverMutation = useMutation({
    mutationFn: async (driverId: string) => {
      const { error } = await supabase
        .from('drivers')
        .delete()
        .eq('id', driverId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast({ title: 'Driver deleted successfully' });
      setDeleteDriverId(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error deleting driver', description: error.message, variant: 'destructive' });
    },
  });

  const handleDeleteClick = (driver: any) => {
    const walletUsd = Number(driver.wallet_usd) || 0;
    const walletLbp = Number(driver.wallet_lbp) || 0;
    
    if (walletUsd !== 0 || walletLbp !== 0) {
      toast({
        title: 'Cannot delete driver',
        description: 'Driver has outstanding wallet balance. Please settle all balances before deleting.',
        variant: 'destructive',
      });
      return;
    }
    
    setDeleteDriverId(driver.id);
    setDeleteDriverName(driver.name);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Drivers</h1>
            <p className="text-muted-foreground mt-1">Manage drivers, wallets, and statements</p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Driver
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="list">
              <Truck className="mr-2 h-4 w-4" />
              Driver List
            </TabsTrigger>
            <TabsTrigger value="statements">
              <FileText className="mr-2 h-4 w-4" />
              Statements
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list">
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
                          <TableCell className={Number(driver.wallet_usd) < 0 ? 'text-destructive' : ''}>
                            ${Number(driver.wallet_usd).toFixed(2)}
                          </TableCell>
                          <TableCell className={Number(driver.wallet_lbp) < 0 ? 'text-destructive' : ''}>
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
                                onClick={() => setSettleCashDriver(driver)}
                                title="Give or take working capital cash"
                              >
                                <DollarSign className="mr-1 h-3 w-3" />
                                Give/Take Cash
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteClick(driver)}
                                title="Delete driver"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
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
          </TabsContent>

          <TabsContent value="statements">
            <DriverStatementsTab />
          </TabsContent>
        </Tabs>
      </div>

      <CreateDriverDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />

      {settleCashDriver && (
        <DriverCashSettlementDialog
          driver={settleCashDriver}
          open={!!settleCashDriver}
          onOpenChange={(open) => !open && setSettleCashDriver(null)}
        />
      )}

      <AlertDialog open={!!deleteDriverId} onOpenChange={(open) => !open && setDeleteDriverId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Driver</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteDriverName}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDriverId && deleteDriverMutation.mutate(deleteDriverId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default Drivers;
