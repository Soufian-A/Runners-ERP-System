import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import OrderActionsDialog from '@/components/orders/OrderActionsDialog';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

type NewOrderRow = {
  id: string;
  voucher_no: string;
  client_id: string;
  client_name: string;
  address: string;
  order_amount_usd: number;
  order_amount_lbp: number;
  delivery_fee_usd: number;
  delivery_fee_lbp: number;
  driver_id: string;
  driver_name: string;
  notes: string;
};

const Orders = () => {
  const { user } = useAuth();
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [newRows, setNewRows] = useState<NewOrderRow[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          clients (name),
          drivers (name),
          third_parties (name)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: drivers } = useQuery({
    queryKey: ['drivers-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (newRows.length === 0) {
      addNewRow();
    }
  }, []);

  const addNewRow = () => {
    setNewRows((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        voucher_no: '',
        client_id: '',
        client_name: '',
        address: '',
        order_amount_usd: 0,
        order_amount_lbp: 0,
        delivery_fee_usd: 0,
        delivery_fee_lbp: 0,
        driver_id: '',
        driver_name: '',
        notes: '',
      },
    ]);
  };

  const updateNewRow = (id: string, field: keyof NewOrderRow, value: any) => {
    setNewRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const createOrderMutation = useMutation({
    mutationFn: async (rowData: NewOrderRow) => {
      if (!rowData.client_id || !rowData.address) {
        throw new Error('Client and Address are required');
      }

      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*, client_rules(*)')
        .eq('id', rowData.client_id)
        .single();

      if (clientError) throw clientError;

      const clientRule = clientData.client_rules?.[0];
      const orderIdPrefix =
        clientData.type === 'Individual' ? 'INST' :
        clientData.type === 'Ecom' ? 'EC' :
        'REST';
      const orderId = `${orderIdPrefix}-${Date.now()}`;

      const deliveryFeeUSD = rowData.delivery_fee_usd || clientRule?.default_fee_usd || 0;
      const deliveryFeeLBP = rowData.delivery_fee_lbp || clientRule?.default_fee_lbp || 0;

      const orderData = {
        order_id: orderId,
        voucher_no: rowData.voucher_no || null,
        client_id: rowData.client_id,
        client_type: clientData.type,
        address: rowData.address,
        order_amount_usd: rowData.order_amount_usd,
        order_amount_lbp: rowData.order_amount_lbp,
        delivery_fee_usd: deliveryFeeUSD,
        delivery_fee_lbp: deliveryFeeLBP,
        client_fee_rule: clientRule?.fee_rule || 'ADD_ON',
        fulfillment: 'InHouse' as const,
        driver_id: rowData.driver_id || null,
        third_party_id: null,
        status: 'New' as const,
        entered_by: user?.id,
        notes: rowData.notes || null,
        prepaid_by_runners: false,
        driver_paid_for_client: false,
        prepay_amount_usd: 0,
        prepay_amount_lbp: 0,
        driver_paid_amount_usd: 0,
        driver_paid_amount_lbp: 0,
      };

      const { data: newOrder, error } = await supabase
        .from('orders')
        .insert([orderData])
        .select()
        .single();

      if (error) throw error;
      return { newOrder, rowId: rowData.id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast({
        title: "Order Created",
        description: `Order created successfully`,
      });
      setNewRows((prev) => prev.filter((row) => row.id !== data.rowId));
      addNewRow();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'New': 'secondary',
      'Assigned': 'outline',
      'PickedUp': 'default',
      'Delivered': 'default',
      'Returned': 'destructive',
      'Cancelled': 'destructive',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  const ComboboxField = ({
    value,
    onSelect,
    items,
    placeholder,
    className,
  }: {
    value: string;
    onSelect: (id: string, name: string) => void;
    items: any[];
    placeholder: string;
    className?: string;
  }) => {
    const [open, setOpen] = useState(false);
    const [searchValue, setSearchValue] = useState('');

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between h-8 text-xs px-2", className)}
          >
            {value ? items?.find((item) => item.id === value)?.name : placeholder}
            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[250px] p-0">
          <Command>
            <CommandInput placeholder={`Search ${placeholder.toLowerCase()}...`} />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {items?.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.name}
                    onSelect={() => {
                      onSelect(item.id, item.name);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === item.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {item.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Orders</h1>
            <p className="text-muted-foreground mt-1">Fast-paced order entry</p>
          </div>
          <Button onClick={addNewRow} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Row
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <p className="text-sm text-muted-foreground">Enter order details in rows below. Press Tab to move between fields.</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[120px]">Ref/Voucher</TableHead>
                    <TableHead className="w-[180px]">Client</TableHead>
                    <TableHead className="w-[200px]">Address</TableHead>
                    <TableHead className="w-[100px]">Amount USD</TableHead>
                    <TableHead className="w-[100px]">Amount LBP</TableHead>
                    <TableHead className="w-[100px]">Fee USD</TableHead>
                    <TableHead className="w-[100px]">Fee LBP</TableHead>
                    <TableHead className="w-[150px]">Driver</TableHead>
                    <TableHead className="w-[150px]">Notes</TableHead>
                    <TableHead className="w-[80px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* New order rows */}
                  {newRows.map((row) => (
                    <TableRow key={row.id} className="hover:bg-muted/30 bg-accent/20">
                      <TableCell>
                        <Input
                          value={row.voucher_no}
                          onChange={(e) => updateNewRow(row.id, 'voucher_no', e.target.value)}
                          placeholder="Ref#"
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <ComboboxField
                          value={row.client_id}
                          onSelect={(id, name) => {
                            updateNewRow(row.id, 'client_id', id);
                            updateNewRow(row.id, 'client_name', name);
                          }}
                          items={clients || []}
                          placeholder="Select client"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.address}
                          onChange={(e) => updateNewRow(row.id, 'address', e.target.value)}
                          placeholder="Delivery address"
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={row.order_amount_usd || ''}
                          onChange={(e) => updateNewRow(row.id, 'order_amount_usd', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={row.order_amount_lbp || ''}
                          onChange={(e) => updateNewRow(row.id, 'order_amount_lbp', parseInt(e.target.value) || 0)}
                          placeholder="0"
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={row.delivery_fee_usd || ''}
                          onChange={(e) => updateNewRow(row.id, 'delivery_fee_usd', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={row.delivery_fee_lbp || ''}
                          onChange={(e) => updateNewRow(row.id, 'delivery_fee_lbp', parseInt(e.target.value) || 0)}
                          placeholder="0"
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <ComboboxField
                          value={row.driver_id}
                          onSelect={(id, name) => {
                            updateNewRow(row.id, 'driver_id', id);
                            updateNewRow(row.id, 'driver_name', name);
                          }}
                          items={drivers || []}
                          placeholder="Select driver"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.notes}
                          onChange={(e) => updateNewRow(row.id, 'notes', e.target.value)}
                          placeholder="Notes"
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => createOrderMutation.mutate(row)}
                          disabled={createOrderMutation.isPending || !row.client_id || !row.address}
                          className="h-8 text-xs"
                        >
                          Save
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Existing orders */}
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center">Loading...</TableCell>
                    </TableRow>
                  ) : orders && orders.length > 0 ? (
                    orders.map((order: any) => (
                      <TableRow 
                        key={order.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedOrder(order)}
                      >
                        <TableCell className="font-medium text-xs">{order.voucher_no || order.order_id}</TableCell>
                        <TableCell className="text-xs">{order.clients?.name}</TableCell>
                        <TableCell className="text-xs truncate max-w-[200px]">{order.address}</TableCell>
                        <TableCell className="text-xs">{order.order_amount_usd > 0 ? `$${order.order_amount_usd}` : '-'}</TableCell>
                        <TableCell className="text-xs">{order.order_amount_lbp > 0 ? order.order_amount_lbp.toLocaleString() : '-'}</TableCell>
                        <TableCell className="text-xs">{order.delivery_fee_usd > 0 ? `$${order.delivery_fee_usd}` : '-'}</TableCell>
                        <TableCell className="text-xs">{order.delivery_fee_lbp > 0 ? order.delivery_fee_lbp.toLocaleString() : '-'}</TableCell>
                        <TableCell className="text-xs">{order.drivers?.name || order.third_parties?.name || '-'}</TableCell>
                        <TableCell className="text-xs truncate max-w-[150px]">{order.notes || '-'}</TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center">No orders yet</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {selectedOrder && (
        <OrderActionsDialog
          order={selectedOrder}
          open={!!selectedOrder}
          onOpenChange={(open) => !open && setSelectedOrder(null)}
        />
      )}
    </Layout>
  );
};

export default Orders;