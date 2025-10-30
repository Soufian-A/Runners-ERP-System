import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EcomOrderForm } from "@/components/orders/EcomOrderForm";
import { BulkActionsBar } from "@/components/orders/BulkActionsBar";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LayoutGrid, List, Search } from "lucide-react";
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
  order_amount_lbp: number;
  delivery_fee_usd: number;
  delivery_fee_lbp: number;
  address: string;
  notes?: string;
  created_at: string;
  clients?: { name: string };
  drivers?: { name: string };
  third_parties?: { name: string };
  customers?: { phone: string; name?: string };
}

const EcomOrders = () => {
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"quick" | "form">("quick");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: orders, isLoading } = useQuery({
    queryKey: ["ecom-orders"],
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
        .eq("order_type", "ecom")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Order[];
    },
  });

  // Real-time subscription for instant updates
  useEffect(() => {
    const channel = supabase
      .channel('ecom-orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: 'order_type=eq.ecom'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["ecom-orders"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const filteredOrders = useMemo(() => {
    if (!orders || !searchQuery.trim()) return orders;
    
    const query = searchQuery.toLowerCase();
    return orders.filter((order) => {
      return (
        order.clients?.name?.toLowerCase().includes(query) ||
        order.voucher_no?.toLowerCase().includes(query) ||
        order.customers?.name?.toLowerCase().includes(query) ||
        order.customers?.phone?.toLowerCase().includes(query) ||
        order.address?.toLowerCase().includes(query)
      );
    });
  }, [orders, searchQuery]);

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

  const toggleSelectAll = () => {
    const allIds = filteredOrders?.map((o) => o.id) || [];
    if (allIds.every((id) => selectedIds.includes(id))) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allIds);
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
          <h1 className="text-3xl font-bold">E-commerce Orders</h1>
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
              <h3 className="text-lg font-semibold">All E-commerce Orders</h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by client, voucher, customer, address..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 w-[350px]"
                    autoFocus
                  />
                </div>
                {filteredOrders && filteredOrders.length > 0 && (
                  <Checkbox
                    checked={filteredOrders.every((o) => selectedIds.includes(o.id))}
                    onCheckedChange={toggleSelectAll}
                  />
                )}
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Voucher</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders?.map((order) => (
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
                      {order.voucher_no || "-"}
                    </TableCell>
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
                    <TableCell className="text-xs">
                      {new Date(order.created_at).toLocaleString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

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

        {createDialogOpen && <CreateOrderDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} orderType="ecom" />}
      </div>
    </Layout>
  );
};

export default EcomOrders;
