import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, FileText, Download } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export function StatementHistory() {
  const queryClient = useQueryClient();
  const [selectedStatement, setSelectedStatement] = useState<any>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNotes, setPaymentNotes] = useState('');

  const { data: driverStatements, isLoading: loadingDrivers } = useQuery({
    queryKey: ['driver-statements-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driver_statements')
        .select(`
          *,
          drivers(name)
        `)
        .order('issued_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: clientStatements, isLoading: loadingClients } = useQuery({
    queryKey: ['client-statements-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_statements')
        .select(`
          *,
          clients(name)
        `)
        .order('issued_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async ({ statementId, type }: { statementId: string; type: 'driver' | 'client' }) => {
      const table = type === 'driver' ? 'driver_statements' : 'client_statements';
      
      const { error } = await supabase
        .from(table)
        .update({
          status: 'paid',
          paid_date: new Date().toISOString(),
          payment_method: paymentMethod,
          notes: paymentNotes || null,
        })
        .eq('id', statementId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Statement marked as paid');
      queryClient.invalidateQueries({ queryKey: ['driver-statements-history'] });
      queryClient.invalidateQueries({ queryKey: ['client-statements-history'] });
      setPaymentDialogOpen(false);
      setSelectedStatement(null);
      setPaymentMethod('cash');
      setPaymentNotes('');
    },
    onError: (error) => {
      toast.error(`Failed to mark as paid: ${error.message}`);
    },
  });

  const handleMarkAsPaid = (statement: any, type: 'driver' | 'client') => {
    setSelectedStatement({ ...statement, type });
    setPaymentDialogOpen(true);
  };

  const renderDriverStatements = () => (
    <Card>
      <CardHeader>
        <CardTitle>Driver Statements</CardTitle>
      </CardHeader>
      <CardContent>
        {loadingDrivers ? (
          <p className="text-center text-muted-foreground">Loading...</p>
        ) : driverStatements && driverStatements.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Statement ID</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Net Due USD</TableHead>
                <TableHead>Net Due LBP</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issued Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {driverStatements.map((statement) => (
                <TableRow key={statement.id}>
                  <TableCell className="font-mono text-sm">{statement.statement_id}</TableCell>
                  <TableCell>{statement.drivers?.name}</TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(statement.period_from), 'MMM dd')} - {format(new Date(statement.period_to), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell className="font-semibold">${Number(statement.net_due_usd).toFixed(2)}</TableCell>
                  <TableCell className="font-semibold">{Number(statement.net_due_lbp).toLocaleString()} LL</TableCell>
                  <TableCell>{statement.order_refs?.length || 0}</TableCell>
                  <TableCell>
                    <Badge variant={statement.status === 'paid' ? 'default' : 'secondary'}>
                      {statement.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(new Date(statement.issued_date), 'MMM dd, yyyy')}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {statement.status === 'unpaid' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkAsPaid(statement, 'driver')}
                        >
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Mark Paid
                        </Button>
                      )}
                      <Button variant="ghost" size="sm">
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-muted-foreground">No driver statements found.</p>
        )}
      </CardContent>
    </Card>
  );

  const renderClientStatements = () => (
    <Card>
      <CardHeader>
        <CardTitle>Client Statements</CardTitle>
      </CardHeader>
      <CardContent>
        {loadingClients ? (
          <p className="text-center text-muted-foreground">Loading...</p>
        ) : clientStatements && clientStatements.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Statement ID</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Net Due USD</TableHead>
                <TableHead>Net Due LBP</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issued Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientStatements.map((statement) => (
                <TableRow key={statement.id}>
                  <TableCell className="font-mono text-sm">{statement.statement_id}</TableCell>
                  <TableCell>{statement.clients?.name}</TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(statement.period_from), 'MMM dd')} - {format(new Date(statement.period_to), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell className="font-semibold">${Number(statement.net_due_usd).toFixed(2)}</TableCell>
                  <TableCell className="font-semibold">{Number(statement.net_due_lbp).toLocaleString()} LL</TableCell>
                  <TableCell>{statement.order_refs?.length || 0}</TableCell>
                  <TableCell>
                    <Badge variant={statement.status === 'paid' ? 'default' : 'secondary'}>
                      {statement.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(new Date(statement.issued_date), 'MMM dd, yyyy')}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {statement.status === 'unpaid' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkAsPaid(statement, 'client')}
                        >
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Mark Paid
                        </Button>
                      )}
                      <Button variant="ghost" size="sm">
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-muted-foreground">No client statements found.</p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <>
      <Tabs defaultValue="drivers" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="drivers">Driver Statements</TabsTrigger>
          <TabsTrigger value="clients">Client Statements</TabsTrigger>
        </TabsList>

        <TabsContent value="drivers">{renderDriverStatements()}</TabsContent>
        <TabsContent value="clients">{renderClientStatements()}</TabsContent>
      </Tabs>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Statement as Paid</DialogTitle>
            <DialogDescription>
              {selectedStatement && (
                <>
                  Statement ID: <span className="font-mono">{selectedStatement.statement_id}</span>
                  <br />
                  Amount: ${Number(selectedStatement.net_due_usd).toFixed(2)} / {Number(selectedStatement.net_due_lbp).toLocaleString()} LL
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payment-method">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-notes">Notes (Optional)</Label>
              <Input
                id="payment-notes"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Add any notes about this payment..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedStatement) {
                  markAsPaidMutation.mutate({
                    statementId: selectedStatement.id,
                    type: selectedStatement.type,
                  });
                }
              }}
              disabled={markAsPaidMutation.isPending}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              {markAsPaidMutation.isPending ? 'Processing...' : 'Confirm Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
