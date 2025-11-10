import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { History, FileText } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useState } from 'react';

export function PaymentHistoryTab() {
  const [selectedClient, setSelectedClient] = useState('all');

  const { data: clients } = useQuery({
    queryKey: ['clients-for-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: payments, isLoading } = useQuery({
    queryKey: ['client-payments', selectedClient],
    queryFn: async () => {
      let query = supabase
        .from('client_payments')
        .select(`
          *,
          clients(name)
        `)
        .order('payment_date', { ascending: false });

      if (selectedClient !== 'all') {
        query = query.eq('client_id', selectedClient);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const totals = payments?.reduce(
    (acc, p) => ({
      totalUsd: acc.totalUsd + Number(p.amount_usd || 0),
      totalLbp: acc.totalLbp + Number(p.amount_lbp || 0),
    }),
    { totalUsd: 0, totalLbp: 0 }
  ) || { totalUsd: 0, totalLbp: 0 };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Payment History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="space-y-2 flex-1 max-w-xs">
                <Label htmlFor="client-filter">Filter by Client</Label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger id="client-filter">
                    <SelectValue placeholder="All Clients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {clients?.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-4 ml-auto">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total USD</p>
                  <p className="text-xl font-bold">${totals.totalUsd.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total LBP</p>
                  <p className="text-xl font-bold">{totals.totalLbp.toLocaleString()} LL</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-center text-muted-foreground">Loading...</p>
          ) : payments && payments.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Statement ID</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Payment Date</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Amount USD</TableHead>
                    <TableHead>Amount LBP</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment: any) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono text-sm">{payment.statement_id}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {payment.clients?.name}
                      </TableCell>
                      <TableCell>
                        {format(new Date(payment.payment_date), 'MMM dd, yyyy HH:mm')}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(payment.period_from), 'MMM dd')} - {format(new Date(payment.period_to), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell className="font-medium">
                        ${Number(payment.amount_usd).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {Number(payment.amount_lbp).toLocaleString()} LL
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {payment.payment_method?.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {payment.order_refs?.length || 0} orders
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {payment.notes || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No payment records found.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
