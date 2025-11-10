import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClientStatementReport } from '@/components/reports/ClientStatementReport';
import { PaymentHistoryTab } from '@/components/reports/PaymentHistoryTab';
import { CompanyLogoSettings } from '@/components/reports/CompanyLogoSettings';

const Reports = () => {
  const [reportType, setReportType] = useState('driver-statement');
  const [selectedEntity, setSelectedEntity] = useState('');
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  const { data: drivers } = useQuery({
    queryKey: ['drivers-for-report'],
    queryFn: async () => {
      const { data, error } = await supabase.from('drivers').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: clients } = useQuery({
    queryKey: ['clients-for-report'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: reportData, isLoading } = useQuery({
    queryKey: ['report-data', reportType, selectedEntity, dateFrom, dateTo],
    queryFn: async () => {
      if (!selectedEntity) return null;

      if (reportType === 'driver-statement') {
        const { data, error } = await supabase
          .from('driver_transactions')
          .select('*')
          .eq('driver_id', selectedEntity)
          .gte('ts', dateFrom)
          .lte('ts', dateTo + 'T23:59:59')
          .order('ts', { ascending: false });
        
        if (error) throw error;
        return data;
      } else if (reportType === 'client-statement') {
        const { data, error } = await supabase
          .from('client_transactions')
          .select('*')
          .eq('client_id', selectedEntity)
          .gte('ts', dateFrom)
          .lte('ts', dateTo + 'T23:59:59')
          .order('ts', { ascending: false });
        
        if (error) throw error;
        return data;
      }

      return null;
    },
    enabled: !!selectedEntity,
  });

  const calculateTotals = () => {
    if (!reportData) return { usd: 0, lbp: 0 };
    
    return reportData.reduce(
      (acc: any, row: any) => {
        const multiplier = row.type === 'Credit' ? 1 : -1;
        return {
          usd: acc.usd + Number(row.amount_usd || 0) * multiplier,
          lbp: acc.lbp + Number(row.amount_lbp || 0) * multiplier,
        };
      },
      { usd: 0, lbp: 0 }
    );
  };

  const totals = calculateTotals();

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Reports & Statements</h1>
          <p className="text-muted-foreground mt-1">Generate statements and view analytics</p>
        </div>

        <Tabs defaultValue="client-statements" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="client-statements">Client Statements</TabsTrigger>
            <TabsTrigger value="payment-history">Payment History</TabsTrigger>
            <TabsTrigger value="company-settings">Company Info</TabsTrigger>
            <TabsTrigger value="transaction-reports">Transaction Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="client-statements">
            <ClientStatementReport />
          </TabsContent>

          <TabsContent value="payment-history">
            <PaymentHistoryTab />
          </TabsContent>

          <TabsContent value="company-settings">
            <CompanyLogoSettings />
          </TabsContent>

          <TabsContent value="transaction-reports">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Generate Report
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="report-type">Report Type</Label>
                      <Select value={reportType} onValueChange={setReportType}>
                        <SelectTrigger id="report-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="driver-statement">Driver Statement</SelectItem>
                          <SelectItem value="client-statement">Client Statement</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="entity">
                        {reportType === 'driver-statement' ? 'Driver' : 'Client'}
                      </Label>
                      <Select value={selectedEntity} onValueChange={setSelectedEntity}>
                        <SelectTrigger id="entity">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {reportType === 'driver-statement'
                            ? drivers?.map((driver) => (
                                <SelectItem key={driver.id} value={driver.id}>
                                  {driver.name}
                                </SelectItem>
                              ))
                            : clients?.map((client) => (
                                <SelectItem key={client.id} value={client.id}>
                                  {client.name}
                                </SelectItem>
                              ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="date-from">From Date</Label>
                      <Input
                        id="date-from"
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="date-to">To Date</Label>
                      <Input
                        id="date-to"
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {selectedEntity && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Transaction Details</CardTitle>
                      <Button variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        Export PDF
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <p className="text-center text-muted-foreground">Loading...</p>
                    ) : reportData && reportData.length > 0 ? (
                      <>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Amount USD</TableHead>
                                <TableHead>Amount LBP</TableHead>
                                <TableHead>Order Ref</TableHead>
                                <TableHead>Note</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {reportData.map((row: any) => (
                                <TableRow key={row.id}>
                                  <TableCell>{format(new Date(row.ts), 'MMM dd, yyyy HH:mm')}</TableCell>
                                  <TableCell>
                                    <span
                                      className={
                                        row.type === 'Credit' ? 'text-green-600' : 'text-red-600'
                                      }
                                    >
                                      {row.type}
                                    </span>
                                  </TableCell>
                                  <TableCell
                                    className={row.type === 'Credit' ? 'text-green-600' : 'text-red-600'}
                                  >
                                    {row.type === 'Credit' ? '+' : '-'}$
                                    {Number(row.amount_usd).toFixed(2)}
                                  </TableCell>
                                  <TableCell
                                    className={row.type === 'Credit' ? 'text-green-600' : 'text-red-600'}
                                  >
                                    {row.type === 'Credit' ? '+' : '-'}
                                    {Number(row.amount_lbp).toLocaleString()} LBP
                                  </TableCell>
                                  <TableCell>{row.order_ref || '-'}</TableCell>
                                  <TableCell className="max-w-xs truncate">{row.note || '-'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                        <div className="mt-6 flex justify-end">
                          <div className="rounded-md bg-muted p-4">
                            <p className="font-semibold text-lg">
                              Net Balance: ${totals.usd.toFixed(2)} / {totals.lbp.toLocaleString()} LBP
                            </p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-center text-muted-foreground">
                        No transactions found for the selected period.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Reports;
