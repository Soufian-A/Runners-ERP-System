import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

interface OrdersChartProps {
  dateFrom: string;
  dateTo: string;
}

const STATUS_COLORS: Record<string, string> = {
  Delivered: '#22c55e',
  New: '#3b82f6',
  Assigned: '#8b5cf6',
  PickedUp: '#f59e0b',
  Returned: '#ef4444',
  Cancelled: '#6b7280',
};

export const OrdersChart = ({ dateFrom, dateTo }: OrdersChartProps) => {
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['orders-chart', dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, created_at, status, order_type, fulfillment')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo + 'T23:59:59')
        .order('created_at');
      
      if (error) throw error;
      return data;
    },
  });

  // Prepare daily data
  const dailyData = (() => {
    if (!ordersData) return [];
    
    const days = eachDayOfInterval({
      start: parseISO(dateFrom),
      end: parseISO(dateTo),
    });
    
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayOrders = ordersData.filter(o => 
        format(new Date(o.created_at!), 'yyyy-MM-dd') === dayStr
      );
      
      return {
        date: format(day, 'MMM dd'),
        total: dayOrders.length,
        instant: dayOrders.filter(o => o.order_type === 'instant').length,
        ecom: dayOrders.filter(o => o.order_type === 'ecom').length,
        errand: dayOrders.filter(o => o.order_type === 'errand').length,
      };
    });
  })();

  // Prepare status breakdown
  const statusData = (() => {
    if (!ordersData) return [];
    
    const statusCounts: Record<string, number> = {};
    ordersData.forEach(o => {
      const status = o.status || 'Unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    return Object.entries(statusCounts).map(([name, value]) => ({
      name,
      value,
      color: STATUS_COLORS[name] || '#6b7280',
    }));
  })();

  // Fulfillment breakdown
  const fulfillmentData = (() => {
    if (!ordersData) return [];
    
    const inHouse = ordersData.filter(o => o.fulfillment === 'InHouse').length;
    const thirdParty = ordersData.filter(o => o.fulfillment === 'ThirdParty').length;
    
    return [
      { name: 'In-House', value: inHouse, color: '#3b82f6' },
      { name: 'Third Party', value: thirdParty, color: '#f59e0b' },
    ].filter(d => d.value > 0);
  })();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Daily Orders Trend */}
      <Card className="col-span-1 lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">Daily Orders Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar dataKey="instant" name="Instant" fill="#3b82f6" stackId="a" />
                <Bar dataKey="ecom" name="E-commerce" fill="#8b5cf6" stackId="a" />
                <Bar dataKey="errand" name="Errand" fill="#f59e0b" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Order Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Fulfillment Type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fulfillment Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={fulfillmentData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {fulfillmentData.map((entry, index) => (
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
  );
};
