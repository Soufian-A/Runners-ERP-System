import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react';

interface RevenueReportProps {
  dateFrom: string;
  dateTo: string;
}

export const RevenueReport = ({ dateFrom, dateTo }: RevenueReportProps) => {
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['revenue-orders', dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('created_at, status, delivery_fee_usd, delivery_fee_lbp')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo + 'T23:59:59');
      
      if (error) throw error;
      return data;
    },
  });

  const { data: expensesData, isLoading: expensesLoading } = useQuery({
    queryKey: ['revenue-expenses', dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_expenses')
        .select(`
          date,
          amount_usd,
          amount_lbp,
          category_id,
          expense_categories (
            name,
            category_group
          )
        `)
        .gte('date', dateFrom)
        .lte('date', dateTo);
      
      if (error) throw error;
      return data;
    },
  });

  // Daily revenue/expense trend
  const dailyData = (() => {
    if (!ordersData) return [];
    
    const days = eachDayOfInterval({
      start: parseISO(dateFrom),
      end: parseISO(dateTo),
    });
    
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      
      const dayOrders = ordersData.filter(o => 
        o.status === 'Delivered' && 
        format(new Date(o.created_at!), 'yyyy-MM-dd') === dayStr
      );
      const revenue = dayOrders.reduce((sum, o) => sum + Number(o.delivery_fee_usd || 0), 0);
      
      const dayExpenses = expensesData?.filter(e => e.date === dayStr) || [];
      const expenses = dayExpenses.reduce((sum, e) => sum + Number(e.amount_usd || 0), 0);
      
      return {
        date: format(day, 'MMM dd'),
        revenue,
        expenses,
        profit: revenue - expenses,
      };
    });
  })();

  // Expense by category
  const expenseByCategory = (() => {
    if (!expensesData) return [];
    
    const categoryTotals: Record<string, { amount: number; group: string }> = {};
    expensesData.forEach((e: any) => {
      const categoryName = e.expense_categories?.name || 'Unknown';
      const categoryGroup = e.expense_categories?.category_group || 'Other';
      if (!categoryTotals[categoryName]) {
        categoryTotals[categoryName] = { amount: 0, group: categoryGroup };
      }
      categoryTotals[categoryName].amount += Number(e.amount_usd || 0);
    });
    
    return Object.entries(categoryTotals)
      .map(([name, data]) => ({
        name,
        value: data.amount,
        group: data.group,
      }))
      .filter(c => c.value > 0)
      .sort((a, b) => b.value - a.value);
  })();

  // Expense by group
  const expenseByGroup = (() => {
    const groupTotals: Record<string, number> = {};
    expenseByCategory.forEach(c => {
      groupTotals[c.group] = (groupTotals[c.group] || 0) + c.value;
    });
    
    const colors = ['#ef4444', '#f59e0b', '#8b5cf6', '#3b82f6', '#22c55e', '#06b6d4', '#ec4899'];
    
    return Object.entries(groupTotals)
      .map(([name, value], index) => ({
        name,
        value,
        color: colors[index % colors.length],
      }))
      .sort((a, b) => b.value - a.value);
  })();

  // Summary calculations
  const totalRevenue = ordersData
    ?.filter(o => o.status === 'Delivered')
    .reduce((sum, o) => sum + Number(o.delivery_fee_usd || 0), 0) || 0;
  
  const totalExpenses = expensesData?.reduce((sum, e) => sum + Number(e.amount_usd || 0), 0) || 0;
  const netProfit = totalRevenue - totalExpenses;

  const isLoading = ordersLoading || expensesLoading;

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
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${totalRevenue.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              Total Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">${totalExpenses.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className={`h-4 w-4 ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`} />
              Net Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${netProfit.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue vs Expenses Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Revenue vs Expenses Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
                />
                <Legend />
                <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#22c55e" strokeWidth={2} />
                <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" strokeWidth={2} />
                <Line type="monotone" dataKey="profit" name="Profit" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense by Group */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Expenses by Category Group</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {expenseByGroup.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseByGroup}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {expenseByGroup.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No expenses recorded in this period
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Expense Details Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Expense Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[280px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenseByCategory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No expenses recorded
                      </TableCell>
                    </TableRow>
                  ) : (
                    expenseByCategory.map(cat => (
                      <TableRow key={cat.name}>
                        <TableCell>{cat.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{cat.group}</TableCell>
                        <TableCell className="text-right text-red-600">${cat.value.toFixed(2)}</TableCell>
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
