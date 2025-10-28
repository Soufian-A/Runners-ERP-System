import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Truck, Users, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';
import Layout from '@/components/Layout';
import { Skeleton } from '@/components/ui/skeleton';

const Dashboard = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [ordersResult, driversResult, clientsResult] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('drivers').select('*', { count: 'exact', head: true }),
        supabase.from('clients').select('*', { count: 'exact', head: true }),
      ]);

      const todayOrders = await supabase
        .from('orders')
        .select('*')
        .gte('created_at', new Date().toISOString().split('T')[0]);

      const deliveredToday = await supabase
        .from('orders')
        .select('delivery_fee_usd, delivery_fee_lbp')
        .eq('status', 'Delivered')
        .gte('delivered_at', new Date().toISOString().split('T')[0]);

      const totalRevenueUSD = deliveredToday.data?.reduce((sum, o) => sum + Number(o.delivery_fee_usd || 0), 0) || 0;
      const totalRevenueLBP = deliveredToday.data?.reduce((sum, o) => sum + Number(o.delivery_fee_lbp || 0), 0) || 0;

      return {
        totalOrders: ordersResult.count || 0,
        totalDrivers: driversResult.count || 0,
        totalClients: clientsResult.count || 0,
        ordersToday: todayOrders.data?.length || 0,
        revenueUSD: totalRevenueUSD,
        revenueLBP: totalRevenueLBP,
      };
    },
  });

  const StatCard = ({ icon: Icon, title, value, subtitle, loading }: any) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your delivery operations</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Package}
            title="Total Orders"
            value={stats?.totalOrders}
            subtitle={`${stats?.ordersToday} orders today`}
            loading={isLoading}
          />
          <StatCard
            icon={Truck}
            title="Active Drivers"
            value={stats?.totalDrivers}
            loading={isLoading}
          />
          <StatCard
            icon={Users}
            title="Clients"
            value={stats?.totalClients}
            loading={isLoading}
          />
          <StatCard
            icon={DollarSign}
            title="Today's Revenue"
            value={`$${stats?.revenueUSD?.toFixed(2) || '0.00'}`}
            subtitle={`${stats?.revenueLBP?.toLocaleString() || '0'} LBP`}
            loading={isLoading}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">No recent activity to display</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">• Create new order</p>
              <p className="text-sm text-muted-foreground">• View driver statements</p>
              <p className="text-sm text-muted-foreground">• Process remittances</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;