import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Truck, Plus, DollarSign, FileText } from 'lucide-react';
import CreateDriverDialog from '@/components/drivers/CreateDriverDialog';
import DriverCashSettlementDialog from '@/components/drivers/DriverCashSettlementDialog';
import { DriverStatementsTab } from '@/components/drivers/DriverStatementsTab';

const Drivers = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [settleCashDriver, setSettleCashDriver] = useState<any>(null);

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

        <Tabs defaultValue="list" className="w-full">
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
                              onClick={() => setSettleCashDriver(driver)}
                              title="Give or take working capital cash"
                            >
                              <DollarSign className="mr-1 h-3 w-3" />
                              Give/Take Cash
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
    </Layout>
  );
};

export default Drivers;
