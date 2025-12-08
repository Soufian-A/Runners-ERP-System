import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, DollarSign, Users, Truck, TrendingUp, TrendingDown, CheckCircle, XCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface KPICardsProps {
  dateFrom: string;
  dateTo: string;
}

export const KPICards = ({ dateFrom, dateTo }: KPICardsProps) => {
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['kpi-orders', dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, status, delivery_fee_usd, delivery_fee_lbp, order_amount_usd, order_amount_lbp, fulfillment')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo + 'T23:59:59');
      
      if (error) throw error;
      return data;
    },
  });

  const { data: driversCount } = useQuery({
    queryKey: ['kpi-drivers-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('drivers')
        .select('*', { count: 'exact', head: true })
        .eq('active', true);
      
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: clientsCount } = useQuery({
    queryKey: ['kpi-clients-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true });
      
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: expensesData } = useQuery({
    queryKey: ['kpi-expenses', dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_expenses')
        .select('amount_usd, amount_lbp')
        .gte('date', dateFrom)
        .lte('date', dateTo);
      
      if (error) throw error;
      return data;
    },
  });

  const totalOrders = ordersData?.length || 0;
  const deliveredOrders = ordersData?.filter(o => o.status === 'Delivered').length || 0;
  const cancelledOrders = ordersData?.filter(o => o.status === 'Cancelled' || o.status === 'Returned').length || 0;
  const inHouseOrders = ordersData?.filter(o => o.fulfillment === 'InHouse').length || 0;
  
  const totalRevenue = ordersData?.reduce((sum, o) => sum + Number(o.delivery_fee_usd || 0), 0) || 0;
  const totalCollected = ordersData
    ?.filter(o => o.status === 'Delivered')
    .reduce((sum, o) => sum + Number(o.order_amount_usd || 0) + Number(o.delivery_fee_usd || 0), 0) || 0;
  
  const totalExpenses = expensesData?.reduce((sum, e) => sum + Number(e.amount_usd || 0), 0) || 0;
  const netProfit = totalRevenue - totalExpenses;
  
  const deliveryRate = totalOrders > 0 ? ((deliveredOrders / totalOrders) * 100).toFixed(1) : '0';

  const kpis = [
    {
      title: 'Total Orders',
      value: totalOrders.toLocaleString(),
      icon: Package,
      description: `${inHouseOrders} in-house`,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Delivered',
      value: deliveredOrders.toLocaleString(),
      icon: CheckCircle,
      description: `${deliveryRate}% success rate`,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Cancelled/Returned',
      value: cancelledOrders.toLocaleString(),
      icon: XCircle,
      description: 'Failed deliveries',
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    {
      title: 'Delivery Revenue',
      value: `$${totalRevenue.toFixed(2)}`,
      icon: DollarSign,
      description: 'From delivery fees',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      title: 'Total Collected',
      value: `$${totalCollected.toFixed(2)}`,
      icon: TrendingUp,
      description: 'Orders + Fees',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Total Expenses',
      value: `$${totalExpenses.toFixed(2)}`,
      icon: TrendingDown,
      description: 'Daily expenses',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      title: 'Net Profit',
      value: `$${netProfit.toFixed(2)}`,
      icon: netProfit >= 0 ? TrendingUp : TrendingDown,
      description: 'Revenue - Expenses',
      color: netProfit >= 0 ? 'text-green-600' : 'text-red-600',
      bgColor: netProfit >= 0 ? 'bg-green-50' : 'bg-red-50',
    },
    {
      title: 'Active Resources',
      value: `${driversCount || 0} / ${clientsCount || 0}`,
      icon: Users,
      description: 'Drivers / Clients',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    },
  ];

  if (ordersLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-16 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <Card key={kpi.title} className="relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <div className={`p-1.5 rounded-md ${kpi.bgColor}`}>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
              {kpi.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
            <p className="text-xs text-muted-foreground mt-1">{kpi.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
