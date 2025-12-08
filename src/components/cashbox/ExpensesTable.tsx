import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import EditExpenseDialog from './EditExpenseDialog';

interface Expense {
  id: string;
  date: string;
  category_id: string;
  amount_usd: number;
  amount_lbp: number;
  notes: string | null;
  created_at: string;
  expense_categories?: {
    id: string;
    name: string;
    category_group: string;
  };
}

interface ExpensesTableProps {
  expenses: Expense[];
  showDate?: boolean;
}

export default function ExpensesTable({ expenses, showDate = false }: ExpensesTableProps) {
  const queryClient = useQueryClient();
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [deleteExpense, setDeleteExpense] = useState<Expense | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('daily_expenses')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Expense deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['daily-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['all-expenses'] });
      setDeleteExpense(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete expense: ${error.message}`);
    },
  });

  if (expenses.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No expenses found
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            {showDate && <TableHead>Date</TableHead>}
            <TableHead>Category</TableHead>
            <TableHead>Group</TableHead>
            <TableHead className="text-right">Amount USD</TableHead>
            <TableHead className="text-right">Amount LBP</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((expense) => (
            <TableRow key={expense.id}>
              {showDate && (
                <TableCell className="font-medium">
                  {format(new Date(expense.date), 'MMM dd, yyyy')}
                </TableCell>
              )}
              <TableCell className="font-medium">
                {expense.expense_categories?.name || '-'}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {expense.expense_categories?.category_group || '-'}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-mono">
                {Number(expense.amount_usd) > 0 ? `$${Number(expense.amount_usd).toFixed(2)}` : '-'}
              </TableCell>
              <TableCell className="text-right font-mono">
                {Number(expense.amount_lbp) > 0 ? `${Number(expense.amount_lbp).toLocaleString()} LL` : '-'}
              </TableCell>
              <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
                {expense.notes || '-'}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover">
                    <DropdownMenuItem onClick={() => setEditExpense(expense)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setDeleteExpense(expense)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <EditExpenseDialog
        open={!!editExpense}
        onOpenChange={(open) => !open && setEditExpense(null)}
        expense={editExpense}
      />

      <AlertDialog open={!!deleteExpense} onOpenChange={(open) => !open && setDeleteExpense(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this expense? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteExpense && deleteMutation.mutate(deleteExpense.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
