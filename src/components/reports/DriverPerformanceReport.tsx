import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Truck } from 'lucide-react';

interface DriverPerformanceReportProps {
  dateFrom: string;
  dateTo: string;
}

export const DriverPerformanceReport = ({ dateFrom, dateTo }: DriverPerformanceReportProps) => {
  const { data: drivers } = useQuery({
    queryKey: ['drivers-performance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['driver-orders-performance', dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('driver_id, status, delivery_fee_usd, delivery_fee_lbp, order_amount_usd, collected_amount_usd')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo + 'T23:59:59')
        .not('driver_id', 'is', null);
      
      if (error) throw error;
      return data;
    },
  });

  const driverStats = (() => {
    if (!drivers || !ordersData) return [];
    
    return drivers.map(driver => {
      const driverOrders = ordersData.filter(o => o.driver_id === driver.id);
      const deliveredOrders = driverOrders.filter(o => o.status === 'Delivered');
      const totalDeliveryFees = deliveredOrders.reduce((sum, o) => sum + Number(o.delivery_fee_usd || 0), 0);
      const totalCollected = deliveredOrders.reduce((sum, o) => sum + Number(o.collected_amount_usd || 0), 0);
      const returnedOrders = driverOrders.filter(o => o.status === 'Returned' || o.status === 'Cancelled');
      
      return {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        active: driver.active,
        walletUsd: Number(driver.wallet_usd || 0),
        walletLbp: Number(driver.wallet_lbp || 0),
        totalOrders: driverOrders.length,
        deliveredOrders: deliveredOrders.length,
        returnedOrders: returnedOrders.length,
        deliveryRate: driverOrders.length > 0 
          ? ((deliveredOrders.length / driverOrders.length) * 100).toFixed(1) 
          : '0',
        totalDeliveryFees,
        totalCollected,
      };
    }).filter(d => d.totalOrders > 0 || d.walletUsd !== 0 || d.walletLbp !== 0)
      .sort((a, b) => b.totalOrders - a.totalOrders);
  })();

  // Chart data - top 10 drivers by orders
  const chartData = driverStats.slice(0, 10).map(d => ({
    name: d.name.length > 10 ? d.name.substring(0, 10) + '...' : d.name,
    orders: d.totalOrders,
    delivered: d.deliveredOrders,
    fees: d.totalDeliveryFees,
  }));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Driver Performance Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Driver Performance (Top 10)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" className="text-xs" />
                <YAxis dataKey="name" type="category" width={80} className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar dataKey="orders" name="Total Orders" fill="#3b82f6" />
                <Bar dataKey="delivered" name="Delivered" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Driver Details Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Driver Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Driver</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Total Orders</TableHead>
                  <TableHead className="text-center">Delivered</TableHead>
                  <TableHead className="text-center">Returned</TableHead>
                  <TableHead className="text-center">Success Rate</TableHead>
                  <TableHead className="text-right">Fees Earned</TableHead>
                  <TableHead className="text-right">Wallet Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {driverStats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No driver activity in this period
                    </TableCell>
                  </TableRow>
                ) : (
                  driverStats.map(driver => (
                    <TableRow key={driver.id}>
                      <TableCell className="font-medium">{driver.name}</TableCell>
                      <TableCell>
                        <Badge variant={driver.active ? 'default' : 'secondary'}>
                          {driver.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">{driver.totalOrders}</TableCell>
                      <TableCell className="text-center text-green-600">{driver.deliveredOrders}</TableCell>
                      <TableCell className="text-center text-red-600">{driver.returnedOrders}</TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant={Number(driver.deliveryRate) >= 90 ? 'default' : 
                                   Number(driver.deliveryRate) >= 70 ? 'secondary' : 'destructive'}
                        >
                          {driver.deliveryRate}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        ${driver.totalDeliveryFees.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={driver.walletUsd >= 0 ? 'text-green-600' : 'text-red-600'}>
                          ${driver.walletUsd.toFixed(2)}
                        </span>
                        {driver.walletLbp !== 0 && (
                          <span className="text-muted-foreground text-xs block">
                            {driver.walletLbp.toLocaleString()} LL
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
  );
};
