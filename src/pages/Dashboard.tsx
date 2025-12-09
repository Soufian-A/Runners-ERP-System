import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Truck, Users, DollarSign, TrendingUp, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import Layout from '@/components/Layout';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertsWidget } from '@/components/ui/alerts-widget';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const navigate = useNavigate();
  
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const [
        ordersResult,
        driversResult,
        clientsResult,
        todayOrdersResult,
        deliveredTodayResult,
        pendingRemitResult,
        driverBalancesResult,
      ] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('drivers').select('*', { count: 'exact', head: true }).eq('active', true),
        supabase.from('clients').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', today),
        supabase.from('orders').select('delivery_fee_usd, delivery_fee_lbp').eq('status', 'Delivered').gte('delivered_at', today),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'Delivered').eq('driver_remit_status', 'Pending'),
        supabase.from('drivers').select('wallet_usd, wallet_lbp').eq('active', true),
      ]);

      const totalRevenueUSD = deliveredTodayResult.data?.reduce((sum, o) => sum + Number(o.delivery_fee_usd || 0), 0) || 0;
      const totalRevenueLBP = deliveredTodayResult.data?.reduce((sum, o) => sum + Number(o.delivery_fee_lbp || 0), 0) || 0;
      
      // Calculate total driver balances
      const totalDriverWalletUSD = driverBalancesResult.data?.reduce((sum, d) => sum + Number(d.wallet_usd || 0), 0) || 0;
      const totalDriverWalletLBP = driverBalancesResult.data?.reduce((sum, d) => sum + Number(d.wallet_lbp || 0), 0) || 0;

      return {
        totalOrders: ordersResult.count || 0,
        totalDrivers: driversResult.count || 0,
        totalClients: clientsResult.count || 0,
        ordersToday: todayOrdersResult.count || 0,
        revenueUSD: totalRevenueUSD,
        revenueLBP: totalRevenueLBP,
        pendingRemit: pendingRemitResult.count || 0,
        driverWalletUSD: totalDriverWalletUSD,
        driverWalletLBP: totalDriverWalletLBP,
      };
    },
  });

  const StatCard = ({ 
    icon: Icon, 
    title, 
    value, 
    subtitle, 
    loading,
    trend,
    onClick,
  }: { 
    icon: any; 
    title: string; 
    value: any; 
    subtitle?: string; 
    loading?: boolean;
    trend?: "up" | "down" | "neutral";
    onClick?: () => void;
  }) => (
    <Card 
      className={onClick ? "cursor-pointer hover:bg-accent/50 transition-colors" : ""}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono">{value}</span>
            {trend && trend !== "neutral" && (
              <span className={trend === "up" ? "text-status-success" : "text-status-error"}>
                {trend === "up" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              </span>
            )}
          </div>
        )}
        {subtitle && !loading && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Layout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Operations overview</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric' 
            })}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Package}
            title="Orders Today"
            value={stats?.ordersToday || 0}
            subtitle={`${stats?.totalOrders || 0} total orders`}
            loading={isLoading}
            onClick={() => navigate('/orders/instant')}
          />
          <StatCard
            icon={DollarSign}
            title="Today's Revenue"
            value={`$${stats?.revenueUSD?.toFixed(2) || '0.00'}`}
            subtitle={`${stats?.revenueLBP?.toLocaleString() || '0'} LBP`}
            loading={isLoading}
            onClick={() => navigate('/reports')}
          />
          <StatCard
            icon={Truck}
            title="Active Drivers"
            value={stats?.totalDrivers || 0}
            subtitle={stats?.pendingRemit ? `${stats.pendingRemit} pending remit` : undefined}
            loading={isLoading}
            onClick={() => navigate('/drivers')}
          />
          <StatCard
            icon={Users}
            title="Clients"
            value={stats?.totalClients || 0}
            loading={isLoading}
            onClick={() => navigate('/clients')}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Alerts Widget - Takes priority */}
          <div className="lg:col-span-2">
            <AlertsWidget />
          </div>

          {/* Quick Stats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4" />
                Driver Balances
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total USD in Driver Wallets</span>
                  <span className={`font-mono font-medium ${(stats?.driverWalletUSD || 0) >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                    ${stats?.driverWalletUSD?.toFixed(2) || '0.00'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total LBP in Driver Wallets</span>
                  <span className={`font-mono font-medium ${(stats?.driverWalletLBP || 0) >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                    {stats?.driverWalletLBP?.toLocaleString() || '0'} LL
                  </span>
                </div>
              </div>
              
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-2">
                  {(stats?.driverWalletUSD || 0) > 0 
                    ? "Positive balance = Drivers hold company cash"
                    : "Negative balance = Company owes drivers"}
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => navigate('/drivers')}
                >
                  View Driver Details
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/orders/instant')}>
                <Package className="h-4 w-4 mr-2" />
                New Instant Order
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/orders/ecom')}>
                <Package className="h-4 w-4 mr-2" />
                New E-com Order
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/drivers')}>
                <Truck className="h-4 w-4 mr-2" />
                Driver Remittance
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/cashbox')}>
                <DollarSign className="h-4 w-4 mr-2" />
                View Cashbox
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Dashboard;
