import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import OrderActionsDialog from "@/components/orders/OrderActionsDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EcomOrderForm } from "@/components/orders/EcomOrderForm";
import { InstantOrderForm } from "@/components/orders/InstantOrderForm";

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
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Orders</h1>

        <Tabs defaultValue="ecom" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ecom">E-commerce Orders</TabsTrigger>
            <TabsTrigger value="instant">Instant Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="ecom" className="space-y-4">
            <EcomOrderForm />

            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">E-commerce Orders</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Voucher</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Amount (USD)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ecomOrders.map((order) => (
                      <TableRow
                        key={order.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => {
                          setSelectedOrder(order);
                          setDialogOpen(true);
                        }}
                      >
                        <TableCell className="font-medium">{order.order_id}</TableCell>
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
            <InstantOrderForm />

            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Instant Orders</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Amount (USD)</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {instantOrders.map((order) => (
                      <TableRow
                        key={order.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => {
                          setSelectedOrder(order);
                          setDialogOpen(true);
                        }}
                      >
                        <TableCell className="font-medium">{order.order_id}</TableCell>
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

        {selectedOrder && (
          <OrderActionsDialog
            order={selectedOrder}
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) setSelectedOrder(null);
            }}
          />
        )}
      </div>
    </Layout>
  );
};

export default Orders;
