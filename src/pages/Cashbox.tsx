import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Minus, HandCoins, Receipt } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import CashboxTransactionDialog from '@/components/cashbox/CashboxTransactionDialog';
import GiveDriverCashDialog from '@/components/cashbox/GiveDriverCashDialog';
import AddExpenseDialog from '@/components/cashbox/AddExpenseDialog';

const Cashbox = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [addCapitalOpen, setAddCapitalOpen] = useState(false);
  const [withdrawCapitalOpen, setWithdrawCapitalOpen] = useState(false);
  const [giveDriverCashOpen, setGiveDriverCashOpen] = useState(false);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);

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

  const totalExpensesUSD = expenses?.reduce((sum, exp) => sum + Number(exp.amount_usd || 0), 0) || 0;
  const totalExpensesLBP = expenses?.reduce((sum, exp) => sum + Number(exp.amount_lbp || 0), 0) || 0;
  const revenueUSD = Number(cashbox?.cash_in_usd || 0);
  const revenueLBP = Number(cashbox?.cash_in_lbp || 0);
  const profitUSD = revenueUSD - totalExpensesUSD;
  const profitLBP = revenueLBP - totalExpensesLBP;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Cashbox</h1>
          <p className="text-muted-foreground mt-1">Daily cash flow management</p>
        </div>

        <div className="flex justify-between items-end">
          <div className="w-64">
            <Label htmlFor="date">Select Date</Label>
            <Input
              id="date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setAddCapitalOpen(true)} variant="default">
              <Plus className="mr-2 h-4 w-4" />
              Add Capital
            </Button>
            <Button onClick={() => setWithdrawCapitalOpen(true)} variant="outline">
              <Minus className="mr-2 h-4 w-4" />
              Withdraw Capital
            </Button>
            <Button onClick={() => setGiveDriverCashOpen(true)} variant="secondary">
              <HandCoins className="mr-2 h-4 w-4" />
              Give Driver Cash
            </Button>
            <Button onClick={() => setAddExpenseOpen(true)} variant="secondary">
              <Receipt className="mr-2 h-4 w-4" />
              Add Expense
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Revenue USD</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                ${revenueUSD.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Revenue LBP</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {revenueLBP.toLocaleString()} LBP
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses USD</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                ${totalExpensesUSD.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses LBP</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {totalExpensesLBP.toLocaleString()} LBP
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Profit USD</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${profitUSD >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${profitUSD.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Profit LBP</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${profitLBP >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {profitLBP.toLocaleString()} LBP
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Opening Balance USD</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${Number(cashbox?.opening_usd || 0).toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Opening Balance LBP</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Number(cashbox?.opening_lbp || 0).toLocaleString()} LBP
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Closing Balance USD</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${Number(cashbox?.closing_usd || 0).toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Closing Balance LBP</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Number(cashbox?.closing_lbp || 0).toLocaleString()} LBP
              </div>
            </CardContent>
          </Card>
        </div>

        {expenses && expenses.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Daily Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Amount USD</TableHead>
                    <TableHead>Amount LBP</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense: any) => (
                    <TableRow key={expense.id}>
                      <TableCell>
                        <div className="font-medium">{expense.expense_categories?.name}</div>
                        <div className="text-xs text-muted-foreground">{expense.expense_categories?.category_group}</div>
                      </TableCell>
                      <TableCell>${Number(expense.amount_usd || 0).toFixed(2)}</TableCell>
                      <TableCell>{Number(expense.amount_lbp || 0).toLocaleString()} LBP</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{expense.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {!cashbox && !isLoading && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                No cashbox data for this date
              </p>
            </CardContent>
          </Card>
        )}
      </div>

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
