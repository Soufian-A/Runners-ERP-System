import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Wallet, Users, Truck, DollarSign, AlertTriangle } from 'lucide-react';

export const BalancesReport = () => {
  const { data: drivers, isLoading: driversLoading } = useQuery({
    queryKey: ['balances-drivers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('id, name, wallet_usd, wallet_lbp, active')
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  const { data: clientBalances, isLoading: clientsLoading } = useQuery({
    queryKey: ['balances-clients'],
    queryFn: async () => {
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, type')
        .order('name');
      
      if (clientsError) throw clientsError;

      const { data: transactions, error: txError } = await supabase
        .from('client_transactions')
        .select('client_id, type, amount_usd, amount_lbp');
      
      if (txError) throw txError;

      return clients.map(client => {
        const clientTxs = transactions.filter(t => t.client_id === client.id);
        const balanceUsd = clientTxs.reduce((sum, t) => {
          const multiplier = t.type === 'Credit' ? 1 : -1;
          return sum + Number(t.amount_usd || 0) * multiplier;
        }, 0);
        const balanceLbp = clientTxs.reduce((sum, t) => {
          const multiplier = t.type === 'Credit' ? 1 : -1;
          return sum + Number(t.amount_lbp || 0) * multiplier;
        }, 0);
        
        return {
          ...client,
          balanceUsd,
          balanceLbp,
        };
      });
    },
  });

  const { data: cashboxData, isLoading: cashboxLoading } = useQuery({
    queryKey: ['balances-cashbox'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cashbox_daily')
        .select('*')
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  const totalDriverWalletUsd = drivers?.reduce((sum, d) => sum + Number(d.wallet_usd || 0), 0) || 0;
  const totalDriverWalletLbp = drivers?.reduce((sum, d) => sum + Number(d.wallet_lbp || 0), 0) || 0;
  
  const driversOwingUs = drivers?.filter(d => Number(d.wallet_usd || 0) < 0 || Number(d.wallet_lbp || 0) < 0) || [];
  const driversWeOwe = drivers?.filter(d => Number(d.wallet_usd || 0) > 0 || Number(d.wallet_lbp || 0) > 0) || [];
  
  const totalClientBalanceUsd = clientBalances?.reduce((sum, c) => sum + c.balanceUsd, 0) || 0;
  const totalClientBalanceLbp = clientBalances?.reduce((sum, c) => sum + c.balanceLbp, 0) || 0;
  
  const clientsOwingUs = clientBalances?.filter(c => c.balanceUsd < 0 || c.balanceLbp < 0) || [];
  const clientsWeOwe = clientBalances?.filter(c => c.balanceUsd > 0 || c.balanceLbp > 0) || [];

  const isLoading = driversLoading || clientsLoading || cashboxLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              Cashbox Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${Number(cashboxData?.closing_usd || 0).toFixed(2)}
            </div>
            <p className="text-sm text-muted-foreground">
              {Number(cashboxData?.closing_lbp || 0).toLocaleString()} LL
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Truck className="h-4 w-4 text-blue-600" />
              Total Driver Wallets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalDriverWalletUsd >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${totalDriverWalletUsd.toFixed(2)}
            </div>
            <p className="text-sm text-muted-foreground">
              {totalDriverWalletLbp.toLocaleString()} LL
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-600" />
              Total Client Balances
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalClientBalanceUsd >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${totalClientBalanceUsd.toFixed(2)}
            </div>
            <p className="text-sm text-muted-foreground">
              {totalClientBalanceLbp.toLocaleString()} LL
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Outstanding Balances */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Drivers Owing Money */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Drivers Owing Company ({driversOwingUs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[250px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Driver</TableHead>
                    <TableHead className="text-right">Amount Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {driversOwingUs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground">
                        No outstanding balances
                      </TableCell>
                    </TableRow>
                  ) : (
                    driversOwingUs.map(driver => (
                      <TableRow key={driver.id}>
                        <TableCell className="font-medium">{driver.name}</TableCell>
                        <TableCell className="text-right text-red-600">
                          ${Math.abs(Number(driver.wallet_usd)).toFixed(2)}
                          {Number(driver.wallet_lbp) !== 0 && (
                            <span className="block text-xs">
                              {Math.abs(Number(driver.wallet_lbp)).toLocaleString()} LL
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Clients Owing Money */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Clients Owing Company ({clientsOwingUs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[250px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientsOwingUs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No outstanding balances
                      </TableCell>
                    </TableRow>
                  ) : (
                    clientsOwingUs.map(client => (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{client.type}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          ${Math.abs(client.balanceUsd).toFixed(2)}
                          {client.balanceLbp !== 0 && (
                            <span className="block text-xs">
                              {Math.abs(client.balanceLbp).toLocaleString()} LL
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Company Owes Drivers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Wallet className="h-5 w-5 text-green-600" />
              Company Owes Drivers ({driversWeOwe.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[250px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Driver</TableHead>
                    <TableHead className="text-right">Amount Owed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {driversWeOwe.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground">
                        No amounts owed
                      </TableCell>
                    </TableRow>
                  ) : (
                    driversWeOwe.map(driver => (
                      <TableRow key={driver.id}>
                        <TableCell className="font-medium">{driver.name}</TableCell>
                        <TableCell className="text-right text-green-600">
                          ${Number(driver.wallet_usd).toFixed(2)}
                          {Number(driver.wallet_lbp) !== 0 && (
                            <span className="block text-xs">
                              {Number(driver.wallet_lbp).toLocaleString()} LL
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Company Owes Clients */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Wallet className="h-5 w-5 text-green-600" />
              Company Owes Clients ({clientsWeOwe.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[250px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount Owed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientsWeOwe.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No amounts owed
                      </TableCell>
                    </TableRow>
                  ) : (
                    clientsWeOwe.map(client => (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{client.type}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          ${client.balanceUsd.toFixed(2)}
                          {client.balanceLbp !== 0 && (
                            <span className="block text-xs">
                              {client.balanceLbp.toLocaleString()} LL
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
