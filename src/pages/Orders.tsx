import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EcomOrderForm } from "@/components/orders/EcomOrderForm";
import { InstantOrderForm } from "@/components/orders/InstantOrderForm";
import { BulkActionsBar } from "@/components/orders/BulkActionsBar";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { LayoutGrid, List } from "lucide-react";
import EditOrderDialog from "@/components/orders/EditOrderDialog";
import CreateOrderDialog from "@/components/orders/CreateOrderDialog";

interface Order {
  id: string;
  order_id: string;
  order_type: "ecom" | "instant" | "errand";
  voucher_no?: string;
  status: string;
  client_id: string;
  driver_id?: string;
  third_party_id?: string;
  order_amount_usd: number;
  delivery_fee_usd: number;
  address: string;
  notes?: string;
  created_at: string;
  clients?: { name: string };
  drivers?: { name: string };
  third_parties?: { name: string };
  customers?: { phone: string; name?: string };
}

const Orders = () => {
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"quick" | "form">("quick");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Fetch all orders
  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          clients(name),
          drivers(name),
          third_parties(name),
          customers(phone, name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Order[];
    },
  });

  // Real-time subscription for instant updates
  useEffect(() => {
    const channel = supabase
      .channel('all-orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["orders"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      New: "secondary",
      Assigned: "outline",
      PickedUp: "default",
      Delivered: "default",
      Returned: "destructive",
      Cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  const ecomOrders = orders?.filter((o) => o.order_type === "ecom") || [];
  const instantOrders = orders?.filter((o) => o.order_type === "instant" || o.order_type === "errand") || [];

  const toggleSelectAll = (orderList: Order[]) => {
    const allIds = orderList.map((o) => o.id);
    if (allIds.every((id) => selectedIds.includes(id))) {
      setSelectedIds(selectedIds.filter((id) => !allIds.includes(id)));
    } else {
      setSelectedIds([...new Set([...selectedIds, ...allIds])]);
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((selectedId) => selectedId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Orders</h1>
          <div className="flex gap-2">
            <Button variant={viewMode === "quick" ? "default" : "outline"} size="sm" onClick={() => setViewMode("quick")}>
              <List className="h-4 w-4 mr-2" />
              Quick Entry
            </Button>
            <Button variant={viewMode === "form" ? "default" : "outline"} size="sm" onClick={() => setViewMode("form")}>
              <LayoutGrid className="h-4 w-4 mr-2" />
              Form Entry
            </Button>
          </div>
        </div>

        <Tabs defaultValue="ecom" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ecom">E-commerce Orders</TabsTrigger>
            <TabsTrigger value="instant">Instant Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="ecom" className="space-y-4">
            {viewMode === "quick" ? (
              <EcomOrderForm />
            ) : (
              <div className="flex justify-end">
                <Button onClick={() => setCreateDialogOpen(true)}>Create E-commerce Order</Button>
              </div>
            )}

            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">E-commerce Orders</h3>
                  {ecomOrders.length > 0 && (
                    <Checkbox
                      checked={ecomOrders.every((o) => selectedIds.includes(o.id))}
                      onCheckedChange={() => toggleSelectAll(ecomOrders)}
                    />
                  )}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Voucher</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ecomOrders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-muted/50">
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={selectedIds.includes(order.id)} onCheckedChange={() => toggleSelect(order.id)} />
                        </TableCell>
                        <TableCell
                          className="font-medium cursor-pointer"
                          onClick={() => {
                            setSelectedOrder(order);
                            setDialogOpen(true);
                          }}
                        >
                          {order.order_id}
                        </TableCell>
                        <TableCell>{order.voucher_no || "-"}</TableCell>
                        <TableCell>{order.clients?.name}</TableCell>
                        <TableCell>
                          {order.customers ? (
                            <div className="flex flex-col">
                              <span className="text-xs">{order.customers.phone}</span>
                              {order.customers.name && <span className="text-xs text-muted-foreground">{order.customers.name}</span>}
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{order.address}</TableCell>
                        <TableCell>${order.order_amount_usd.toFixed(2)}</TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                        <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="instant" className="space-y-4">
            {viewMode === "quick" ? (
              <InstantOrderForm />
            ) : (
              <div className="flex justify-end">
                <Button onClick={() => setCreateDialogOpen(true)}>Create Instant Order</Button>
              </div>
            )}

            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Instant Orders</h3>
                  {instantOrders.length > 0 && (
                    <Checkbox
                      checked={instantOrders.every((o) => selectedIds.includes(o.id))}
                      onCheckedChange={() => toggleSelectAll(instantOrders)}
                    />
                  )}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {instantOrders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-muted/50">
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={selectedIds.includes(order.id)} onCheckedChange={() => toggleSelect(order.id)} />
                        </TableCell>
                        <TableCell
                          className="font-medium cursor-pointer"
                          onClick={() => {
                            setSelectedOrder(order);
                            setDialogOpen(true);
                          }}
                        >
                          {order.order_id}
                        </TableCell>
                        <TableCell>{order.clients?.name}</TableCell>
                        <TableCell>{order.drivers?.name || "-"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{order.address}</TableCell>
                        <TableCell>${order.order_amount_usd.toFixed(2)}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{order.notes || "-"}</TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                        <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <BulkActionsBar selectedIds={selectedIds} onClearSelection={() => setSelectedIds([])} />

        {selectedOrder && (
          <EditOrderDialog
            order={selectedOrder}
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) setSelectedOrder(null);
            }}
          />
        )}

        {createDialogOpen && <CreateOrderDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />}
      </div>
    </Layout>
  );
};

export default Orders;

