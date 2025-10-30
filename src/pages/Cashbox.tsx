import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Minus, HandCoins } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import CashboxTransactionDialog from '@/components/cashbox/CashboxTransactionDialog';
import GiveDriverCashDialog from '@/components/cashbox/GiveDriverCashDialog';

const Cashbox = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [addCapitalOpen, setAddCapitalOpen] = useState(false);
  const [withdrawCapitalOpen, setWithdrawCapitalOpen] = useState(false);
  const [giveDriverCashOpen, setGiveDriverCashOpen] = useState(false);

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
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
              <CardTitle className="text-sm font-medium text-muted-foreground">Cash In USD</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                +${Number(cashbox?.cash_in_usd || 0).toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cash In LBP</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                +{Number(cashbox?.cash_in_lbp || 0).toLocaleString()} LBP
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cash Out USD</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                -${Number(cashbox?.cash_out_usd || 0).toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cash Out LBP</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                -{Number(cashbox?.cash_out_lbp || 0).toLocaleString()} LBP
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
    </Layout>
  );
};

export default Cashbox;