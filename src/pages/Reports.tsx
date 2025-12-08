import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Truck, Users, DollarSign, Wallet, Settings, FileText } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { KPICards } from '@/components/reports/KPICards';
import { OrdersChart } from '@/components/reports/OrdersChart';
import { DriverPerformanceReport } from '@/components/reports/DriverPerformanceReport';
import { ClientPerformanceReport } from '@/components/reports/ClientPerformanceReport';
import { RevenueReport } from '@/components/reports/RevenueReport';
import { BalancesReport } from '@/components/reports/BalancesReport';
import { DateRangeFilter } from '@/components/reports/DateRangeFilter';
import { PaymentHistoryTab } from '@/components/reports/PaymentHistoryTab';
import { CompanyLogoSettings } from '@/components/reports/CompanyLogoSettings';

const Reports = () => {
  const queryClient = useQueryClient();
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['kpi'] });
    queryClient.invalidateQueries({ queryKey: ['orders-chart'] });
    queryClient.invalidateQueries({ queryKey: ['driver-orders-performance'] });
    queryClient.invalidateQueries({ queryKey: ['client-orders-performance'] });
    queryClient.invalidateQueries({ queryKey: ['revenue'] });
    queryClient.invalidateQueries({ queryKey: ['balances'] });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive performance metrics and business intelligence
          </p>
        </div>

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-7">
            <TabsTrigger value="dashboard" className="flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="drivers" className="flex items-center gap-1.5">
              <Truck className="h-4 w-4" />
              <span className="hidden sm:inline">Drivers</span>
            </TabsTrigger>
            <TabsTrigger value="clients" className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Clients</span>
            </TabsTrigger>
            <TabsTrigger value="revenue" className="flex items-center gap-1.5">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Revenue</span>
            </TabsTrigger>
            <TabsTrigger value="balances" className="flex items-center gap-1.5">
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">Balances</span>
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Payments</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-1.5">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6 mt-6">
            <DateRangeFilter
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateFromChange={setDateFrom}
              onDateToChange={setDateTo}
              onRefresh={handleRefresh}
            />
            <KPICards dateFrom={dateFrom} dateTo={dateTo} />
            <OrdersChart dateFrom={dateFrom} dateTo={dateTo} />
          </TabsContent>

          {/* Drivers Tab */}
          <TabsContent value="drivers" className="space-y-6 mt-6">
            <DateRangeFilter
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateFromChange={setDateFrom}
              onDateToChange={setDateTo}
              onRefresh={handleRefresh}
            />
            <DriverPerformanceReport dateFrom={dateFrom} dateTo={dateTo} />
          </TabsContent>

          {/* Clients Tab */}
          <TabsContent value="clients" className="space-y-6 mt-6">
            <DateRangeFilter
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateFromChange={setDateFrom}
              onDateToChange={setDateTo}
              onRefresh={handleRefresh}
            />
            <ClientPerformanceReport dateFrom={dateFrom} dateTo={dateTo} />
          </TabsContent>

          {/* Revenue Tab */}
          <TabsContent value="revenue" className="space-y-6 mt-6">
            <DateRangeFilter
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateFromChange={setDateFrom}
              onDateToChange={setDateTo}
              onRefresh={handleRefresh}
            />
            <RevenueReport dateFrom={dateFrom} dateTo={dateTo} />
          </TabsContent>

          {/* Balances Tab */}
          <TabsContent value="balances" className="space-y-6 mt-6">
            <BalancesReport />
          </TabsContent>

          {/* Payment History Tab */}
          <TabsContent value="payments" className="mt-6">
            <PaymentHistoryTab />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-6">
            <CompanyLogoSettings />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Reports;
