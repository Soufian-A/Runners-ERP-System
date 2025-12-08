import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Wallet, ArrowUpCircle, ArrowDownCircle, DollarSign } from 'lucide-react';

interface CashboxData {
  opening_usd: number;
  opening_lbp: number;
  cash_in_usd: number;
  cash_in_lbp: number;
  cash_out_usd: number;
  cash_out_lbp: number;
  closing_usd: number;
  closing_lbp: number;
}

interface CashboxSummaryCardsProps {
  cashbox: CashboxData | null;
  revenueUSD: number;
  revenueLBP: number;
  expensesUSD: number;
  expensesLBP: number;
}

export default function CashboxSummaryCards({
  cashbox,
  revenueUSD,
  revenueLBP,
  expensesUSD,
  expensesLBP,
}: CashboxSummaryCardsProps) {
  const profitUSD = revenueUSD - expensesUSD;
  const profitLBP = revenueLBP - expensesLBP;

  return (
    <div className="space-y-4">
      {/* Primary Metrics Row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              ${revenueUSD.toFixed(2)}
            </div>
            <div className="text-sm text-muted-foreground">
              {revenueLBP.toLocaleString()} LL
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-rose-500/10 to-rose-500/5 border-rose-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-rose-500" />
              Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">
              ${expensesUSD.toFixed(2)}
            </div>
            <div className="text-sm text-muted-foreground">
              {expensesLBP.toLocaleString()} LL
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${profitUSD >= 0 ? 'from-blue-500/10 to-blue-500/5 border-blue-500/20' : 'from-orange-500/10 to-orange-500/5 border-orange-500/20'}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className={`h-4 w-4 ${profitUSD >= 0 ? 'text-blue-500' : 'text-orange-500'}`} />
              Net Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${profitUSD >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
              ${profitUSD.toFixed(2)}
            </div>
            <div className="text-sm text-muted-foreground">
              {profitLBP.toLocaleString()} LL
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cash Flow Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Wallet className="h-4 w-4" />
              Opening Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              ${Number(cashbox?.opening_usd || 0).toFixed(2)}
            </div>
            <div className="text-sm text-muted-foreground">
              {Number(cashbox?.opening_lbp || 0).toLocaleString()} LL
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <ArrowUpCircle className="h-4 w-4 text-emerald-500" />
              Cash In
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-emerald-600">
              +${Number(cashbox?.cash_in_usd || 0).toFixed(2)}
            </div>
            <div className="text-sm text-muted-foreground">
              +{Number(cashbox?.cash_in_lbp || 0).toLocaleString()} LL
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <ArrowDownCircle className="h-4 w-4 text-rose-500" />
              Cash Out
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-rose-600">
              -${Number(cashbox?.cash_out_usd || 0).toFixed(2)}
            </div>
            <div className="text-sm text-muted-foreground">
              -{Number(cashbox?.cash_out_lbp || 0).toLocaleString()} LL
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              Closing Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-primary">
              ${Number(cashbox?.closing_usd || 0).toFixed(2)}
            </div>
            <div className="text-sm text-muted-foreground">
              {Number(cashbox?.closing_lbp || 0).toLocaleString()} LL
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
