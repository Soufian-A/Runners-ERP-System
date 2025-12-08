import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ArrowUpCircle, ArrowDownCircle, Receipt, HandCoins, Truck } from 'lucide-react';

interface TransactionHistoryTableProps {
  date: string;
}

export default function TransactionHistoryTable({ date }: TransactionHistoryTableProps) {
  // Get driver transactions for the date
  const { data: driverTransactions } = useQuery({
    queryKey: ['driver-transactions-daily', date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driver_transactions')
        .select('*, drivers(name)')
        .gte('ts', date)
        .lte('ts', date + 'T23:59:59')
        .order('ts', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Get accounting entries for the date
  const { data: accountingEntries } = useQuery({
    queryKey: ['accounting-entries-daily', date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounting_entries')
        .select('*')
        .gte('ts', date)
        .lte('ts', date + 'T23:59:59')
        .order('ts', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Get daily expenses
  const { data: expenses } = useQuery({
    queryKey: ['daily-expenses', date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_expenses')
        .select('*, expense_categories(name)')
        .eq('date', date)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Combine and sort all transactions
  const allTransactions = [
    ...(driverTransactions?.map(t => ({
      id: t.id,
      time: t.ts,
      type: t.type === 'Credit' ? 'Driver Credit' : 'Driver Debit',
      description: `${t.drivers?.name || 'Driver'}: ${t.note || 'Transaction'}`,
      amountUSD: t.type === 'Credit' ? -Number(t.amount_usd || 0) : Number(t.amount_usd || 0),
      amountLBP: t.type === 'Credit' ? -Number(t.amount_lbp || 0) : Number(t.amount_lbp || 0),
      category: 'driver',
      orderRef: t.order_ref,
    })) || []),
    ...(accountingEntries?.map(t => ({
      id: t.id,
      time: t.ts,
      type: t.category,
      description: t.memo || t.category,
      amountUSD: t.category === 'DeliveryIncome' ? Number(t.amount_usd || 0) : -Number(t.amount_usd || 0),
      amountLBP: t.category === 'DeliveryIncome' ? Number(t.amount_lbp || 0) : -Number(t.amount_lbp || 0),
      category: 'accounting',
      orderRef: t.order_ref,
    })) || []),
    ...(expenses?.map(t => ({
      id: t.id,
      time: t.created_at,
      type: 'Expense',
      description: `${t.expense_categories?.name || 'Expense'}: ${t.notes || ''}`,
      amountUSD: -Number(t.amount_usd || 0),
      amountLBP: -Number(t.amount_lbp || 0),
      category: 'expense',
      orderRef: null,
    })) || []),
  ].sort((a, b) => new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime());

  const getIcon = (category: string, amountUSD: number) => {
    switch (category) {
      case 'driver':
        return <HandCoins className="h-4 w-4" />;
      case 'expense':
        return <Receipt className="h-4 w-4" />;
      case 'accounting':
        return <Truck className="h-4 w-4" />;
      default:
        return amountUSD >= 0 ? <ArrowUpCircle className="h-4 w-4" /> : <ArrowDownCircle className="h-4 w-4" />;
    }
  };

  const getBadgeVariant = (category: string) => {
    switch (category) {
      case 'driver':
        return 'secondary';
      case 'expense':
        return 'destructive';
      case 'accounting':
        return 'default';
      default:
        return 'outline';
    }
  };

  if (allTransactions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No transactions for this date
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Reference</TableHead>
          <TableHead className="text-right">USD</TableHead>
          <TableHead className="text-right">LBP</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {allTransactions.map((tx) => (
          <TableRow key={tx.id}>
            <TableCell className="text-sm text-muted-foreground">
              {tx.time ? format(new Date(tx.time), 'HH:mm:ss') : '-'}
            </TableCell>
            <TableCell>
              <Badge variant={getBadgeVariant(tx.category) as any} className="flex items-center gap-1 w-fit">
                {getIcon(tx.category, tx.amountUSD)}
                {tx.type}
              </Badge>
            </TableCell>
            <TableCell className="max-w-[300px] truncate">
              {tx.description}
            </TableCell>
            <TableCell className="font-mono text-xs">
              {tx.orderRef || '-'}
            </TableCell>
            <TableCell className={`text-right font-mono ${tx.amountUSD >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {tx.amountUSD !== 0 ? (tx.amountUSD >= 0 ? '+' : '') + `$${tx.amountUSD.toFixed(2)}` : '-'}
            </TableCell>
            <TableCell className={`text-right font-mono ${tx.amountLBP >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {tx.amountLBP !== 0 ? (tx.amountLBP >= 0 ? '+' : '') + `${tx.amountLBP.toLocaleString()} LL` : '-'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
