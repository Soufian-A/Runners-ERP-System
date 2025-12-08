import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Receipt } from 'lucide-react';
import ExpenseFilters, { ExpenseFiltersState } from './ExpenseFilters';
import ExpensesTable from './ExpensesTable';
import AddExpenseDialog from './AddExpenseDialog';

const initialFilters: ExpenseFiltersState = {
  search: '',
  categoryId: '',
  categoryGroup: '',
  dateFrom: '',
  dateTo: '',
  currency: '',
  minAmount: '',
  maxAmount: '',
};

export default function AllExpensesTab() {
  const [filters, setFilters] = useState<ExpenseFiltersState>(initialFilters);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);

  const { data: allExpenses, isLoading } = useQuery({
    queryKey: ['all-expenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_expenses')
        .select('*, expense_categories(*)')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredExpenses = useMemo(() => {
    if (!allExpenses) return [];
    
    return allExpenses.filter(expense => {
      // Search in notes
      if (filters.search && !expense.notes?.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }
      
      // Category filter
      if (filters.categoryId && expense.category_id !== filters.categoryId) {
        return false;
      }
      
      // Category group filter
      if (filters.categoryGroup && filters.categoryGroup !== 'all' && 
          expense.expense_categories?.category_group !== filters.categoryGroup) {
        return false;
      }
      
      // Date range filters
      if (filters.dateFrom && expense.date < filters.dateFrom) {
        return false;
      }
      if (filters.dateTo && expense.date > filters.dateTo) {
        return false;
      }
      
      // Currency filter
      if (filters.currency && filters.currency !== 'all') {
        if (filters.currency === 'USD' && Number(expense.amount_usd) === 0) return false;
        if (filters.currency === 'LBP' && Number(expense.amount_lbp) === 0) return false;
      }
      
      // Amount range filters
      const amount = Number(expense.amount_usd) || Number(expense.amount_lbp);
      if (filters.minAmount && amount < Number(filters.minAmount)) {
        return false;
      }
      if (filters.maxAmount && amount > Number(filters.maxAmount)) {
        return false;
      }
      
      return true;
    });
  }, [allExpenses, filters]);

  const totals = useMemo(() => {
    return filteredExpenses.reduce(
      (acc, exp) => ({
        usd: acc.usd + Number(exp.amount_usd || 0),
        lbp: acc.lbp + Number(exp.amount_lbp || 0),
      }),
      { usd: 0, lbp: 0 }
    );
  }, [filteredExpenses]);

  const exportToCSV = () => {
    const headers = ['Date', 'Category', 'Group', 'Amount USD', 'Amount LBP', 'Notes'];
    const rows = filteredExpenses.map(exp => [
      exp.date,
      exp.expense_categories?.name || '',
      exp.expense_categories?.category_group || '',
      Number(exp.amount_usd || 0).toFixed(2),
      Number(exp.amount_lbp || 0).toString(),
      exp.notes || '',
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Showing {filteredExpenses.length} of {allExpenses?.length || 0} expenses
          </div>
          <div className="text-sm font-medium">
            Total: <span className="text-rose-600">${totals.usd.toFixed(2)}</span>
            {totals.lbp > 0 && <span className="text-muted-foreground ml-2">+ {totals.lbp.toLocaleString()} LL</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button size="sm" onClick={() => setAddExpenseOpen(true)}>
            <Receipt className="h-4 w-4 mr-2" />
            Add Expense
          </Button>
        </div>
      </div>

      <ExpenseFilters
        filters={filters}
        onFiltersChange={setFilters}
        onClear={() => setFilters(initialFilters)}
      />

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading expenses...</div>
          ) : (
            <ExpensesTable expenses={filteredExpenses} showDate />
          )}
        </CardContent>
      </Card>

      <AddExpenseDialog
        open={addExpenseOpen}
        onOpenChange={setAddExpenseOpen}
        date={new Date().toISOString().split('T')[0]}
      />
    </div>
  );
}
