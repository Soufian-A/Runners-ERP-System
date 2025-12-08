import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Minus, HandCoins, Receipt, History, Wallet, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CashboxTransactionDialog from '@/components/cashbox/CashboxTransactionDialog';
import GiveDriverCashDialog from '@/components/cashbox/GiveDriverCashDialog';
import AddExpenseDialog from '@/components/cashbox/AddExpenseDialog';
import CashboxSummaryCards from '@/components/cashbox/CashboxSummaryCards';
import ExpensesTable from '@/components/cashbox/ExpensesTable';
import TransactionHistoryTable from '@/components/cashbox/TransactionHistoryTable';
import AllExpensesTab from '@/components/cashbox/AllExpensesTab';
import { format, addDays, subDays } from 'date-fns';

const Cashbox = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [addCapitalOpen, setAddCapitalOpen] = useState(false);
  const [withdrawCapitalOpen, setWithdrawCapitalOpen] = useState(false);
  const [giveDriverCashOpen, setGiveDriverCashOpen] = useState(false);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('daily');

  const goToPrevDay = () => {
    const newDate = subDays(new Date(selectedDate), 1);
    setSelectedDate(format(newDate, 'yyyy-MM-dd'));
  };

  const goToNextDay = () => {
    const newDate = addDays(new Date(selectedDate), 1);
    setSelectedDate(format(newDate, 'yyyy-MM-dd'));
  };

  const goToToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const { data: cashbox, isLoading } = useQuery({
    queryKey: ['cashbox', selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cashbox_daily')
        .select('*')
        .eq('date', selectedDate)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: expenses } = useQuery({
    queryKey: ['daily-expenses', selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_expenses')
        .select('*, expense_categories(*)')
        .eq('date', selectedDate)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: incomeEntries } = useQuery({
    queryKey: ['daily-income', selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounting_entries')
        .select('amount_usd, amount_lbp, category, ts')
        .eq('category', 'DeliveryIncome')
        .gte('ts', selectedDate)
        .lte('ts', selectedDate + 'T23:59:59');
      if (error) throw error;
      return data;
    },
  });

  const totalExpensesUSD = expenses?.reduce((sum, exp) => sum + Number(exp.amount_usd || 0), 0) || 0;
  const totalExpensesLBP = expenses?.reduce((sum, exp) => sum + Number(exp.amount_lbp || 0), 0) || 0;

  const revenueUSD = incomeEntries?.reduce((sum: number, entry: any) => sum + Number(entry.amount_usd || 0), 0) || 0;
  const revenueLBP = incomeEntries?.reduce((sum: number, entry: any) => sum + Number(entry.amount_lbp || 0), 0) || 0;

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Wallet className="h-8 w-8" />
              Cashbox
            </h1>
            <p className="text-muted-foreground mt-1">Daily cash flow management and expense tracking</p>
          </div>
          
          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setAddCapitalOpen(true)} variant="default" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Capital
            </Button>
            <Button onClick={() => setWithdrawCapitalOpen(true)} variant="outline" size="sm">
              <Minus className="mr-2 h-4 w-4" />
              Withdraw
            </Button>
            <Button onClick={() => setGiveDriverCashOpen(true)} variant="secondary" size="sm">
              <HandCoins className="mr-2 h-4 w-4" />
              Driver Cash
            </Button>
            <Button onClick={() => setAddExpenseOpen(true)} variant="secondary" size="sm">
              <Receipt className="mr-2 h-4 w-4" />
              Add Expense
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="daily" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Daily View
            </TabsTrigger>
            <TabsTrigger value="transactions" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Transactions
            </TabsTrigger>
            <TabsTrigger value="expenses" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              All Expenses
            </TabsTrigger>
          </TabsList>

          {/* Date Navigation - Only show for daily and transactions tabs */}
          {(activeTab === 'daily' || activeTab === 'transactions') && (
            <div className="flex items-center gap-2 mt-4">
              <Button variant="outline" size="icon" onClick={goToPrevDay}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-auto"
                />
                {!isToday && (
                  <Button variant="outline" size="sm" onClick={goToToday}>
                    Today
                  </Button>
                )}
              </div>
              <Button variant="outline" size="icon" onClick={goToNextDay}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground ml-2">
                {format(new Date(selectedDate), 'EEEE, MMMM d, yyyy')}
              </span>
            </div>
          )}

          {/* Daily View Tab */}
          <TabsContent value="daily" className="space-y-6 mt-6">
            <CashboxSummaryCards
              cashbox={cashbox}
              revenueUSD={revenueUSD}
              revenueLBP={revenueLBP}
              expensesUSD={totalExpensesUSD}
              expensesLBP={totalExpensesLBP}
            />

            {/* Daily Expenses */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Daily Expenses
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => setAddExpenseOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </CardHeader>
              <CardContent>
                {expenses && expenses.length > 0 ? (
                  <ExpensesTable expenses={expenses} />
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No expenses recorded for this date
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cashbox Notes */}
            {cashbox?.notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Cashbox Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-sm whitespace-pre-wrap text-muted-foreground bg-muted p-4 rounded-lg">
                    {cashbox.notes}
                  </pre>
                </CardContent>
              </Card>
            )}

            {!cashbox && !isLoading && (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    No cashbox data for {format(new Date(selectedDate), 'MMMM d, yyyy')}. 
                    Add a transaction to initialize.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Transaction History - {format(new Date(selectedDate), 'MMMM d, yyyy')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TransactionHistoryTable date={selectedDate} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* All Expenses Tab */}
          <TabsContent value="expenses" className="mt-6">
            <AllExpensesTab />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <CashboxTransactionDialog
        open={addCapitalOpen}
        onOpenChange={setAddCapitalOpen}
        date={selectedDate}
        type="in"
      />
      <CashboxTransactionDialog
        open={withdrawCapitalOpen}
        onOpenChange={setWithdrawCapitalOpen}
        date={selectedDate}
        type="out"
      />
      <GiveDriverCashDialog
        open={giveDriverCashOpen}
        onOpenChange={setGiveDriverCashOpen}
        date={selectedDate}
      />
      <AddExpenseDialog
        open={addExpenseOpen}
        onOpenChange={setAddExpenseOpen}
        date={selectedDate}
      />
    </Layout>
  );
};

export default Cashbox;
