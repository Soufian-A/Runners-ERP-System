import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';

interface ClientPerformanceReportProps {
  dateFrom: string;
  dateTo: string;
}

const CLIENT_TYPE_COLORS: Record<string, string> = {
  Ecom: '#8b5cf6',
  Restaurant: '#f59e0b',
  Individual: '#3b82f6',
};

export const ClientPerformanceReport = ({ dateFrom, dateTo }: ClientPerformanceReportProps) => {
  const { data: clients } = useQuery({
    queryKey: ['clients-performance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['client-orders-performance', dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('client_id, status, delivery_fee_usd, order_amount_usd, client_type')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo + 'T23:59:59');
      
      if (error) throw error;
      return data;
    },
  });

  const { data: transactionsData } = useQuery({
    queryKey: ['client-transactions-performance', dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_transactions')
        .select('client_id, type, amount_usd')
        .gte('ts', dateFrom)
        .lte('ts', dateTo + 'T23:59:59');
      
      if (error) throw error;
      return data;
    },
  });

  const clientStats = (() => {
    if (!clients || !ordersData) return [];
    
    return clients.map(client => {
      const clientOrders = ordersData.filter(o => o.client_id === client.id);
      const deliveredOrders = clientOrders.filter(o => o.status === 'Delivered');
      const totalDeliveryFees = deliveredOrders.reduce((sum, o) => sum + Number(o.delivery_fee_usd || 0), 0);
      const totalOrderAmount = deliveredOrders.reduce((sum, o) => sum + Number(o.order_amount_usd || 0), 0);
      
      const clientTxs = transactionsData?.filter(t => t.client_id === client.id) || [];
      const balance = clientTxs.reduce((sum, t) => {
        const multiplier = t.type === 'Credit' ? 1 : -1;
        return sum + Number(t.amount_usd || 0) * multiplier;
      }, 0);
      
      return {
        id: client.id,
        name: client.name,
        type: client.type,
        totalOrders: clientOrders.length,
        deliveredOrders: deliveredOrders.length,
        totalDeliveryFees,
        totalOrderAmount,
        balance,
      };
    }).filter(c => c.totalOrders > 0 || c.balance !== 0)
      .sort((a, b) => b.totalOrders - a.totalOrders);
  })();

  // Client type breakdown
  const clientTypeData = (() => {
    if (!ordersData) return [];
    
    const typeCounts: Record<string, number> = {};
    ordersData.forEach(o => {
      const type = o.client_type || 'Unknown';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    
    return Object.entries(typeCounts).map(([name, value]) => ({
      name,
      value,
      color: CLIENT_TYPE_COLORS[name] || '#6b7280',
    }));
  })();

  // Chart data - top 10 clients by orders
  const chartData = clientStats.slice(0, 10).map(c => ({
    name: c.name.length > 12 ? c.name.substring(0, 12) + '...' : c.name,
    orders: c.totalOrders,
    revenue: c.totalDeliveryFees,
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Client Orders Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top Clients by Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="name" type="category" width={100} className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="orders" name="Orders" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Client Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Orders by Client Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={clientTypeData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {clientTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client Details Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Client Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-center">Total Orders</TableHead>
                  <TableHead className="text-center">Delivered</TableHead>
                  <TableHead className="text-right">Order Value</TableHead>
                  <TableHead className="text-right">Fees Generated</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientStats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No client activity in this period
                    </TableCell>
                  </TableRow>
                ) : (
                  clientStats.map(client => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline"
                          style={{ borderColor: CLIENT_TYPE_COLORS[client.type] }}
                        >
                          {client.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">{client.totalOrders}</TableCell>
                      <TableCell className="text-center text-green-600">{client.deliveredOrders}</TableCell>
                      <TableCell className="text-right">${client.totalOrderAmount.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-green-600">
                        ${client.totalDeliveryFees.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={client.balance >= 0 ? 'text-green-600' : 'text-red-600'}>
                          ${client.balance.toFixed(2)}
                        </span>
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
