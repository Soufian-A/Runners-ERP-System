import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InstantOrderForm } from "@/components/orders/InstantOrderForm";
import { BulkActionsBar } from "@/components/orders/BulkActionsBar";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LayoutGrid, List, Settings, Search, Pencil, Trash2 } from "lucide-react";
import EditOrderDialog from "@/components/orders/EditOrderDialog";
import CreateOrderDialog from "@/components/orders/CreateOrderDialog";
import { AddressSettingsDialog } from "@/components/orders/AddressSettingsDialog";
import { useMutation } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { formatUSD, formatLBP } from "@/lib/utils";

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
  driver_paid_for_client?: boolean;
  driver_paid_amount_usd?: number;
  driver_paid_amount_lbp?: number;
  driver_remit_status?: string;
  clients?: { name: string };
  drivers?: { name: string };
  third_parties?: { name: string };
  customers?: { phone: string; name?: string };
}

// Helper function to determine payment status
const getPaymentStatus = (order: Order) => {
  const hasAmount = (order.order_amount_usd > 0 || order.order_amount_lbp > 0 || 
                     order.delivery_fee_usd > 0 || order.delivery_fee_lbp > 0);
  
  if (!hasAmount) {
    return { label: "-", variant: "outline" as const };
  }

  if (order.driver_paid_for_client) {
    // Driver paid for client - client owes us
    if (order.driver_remit_status === 'Collected') {
      return { label: "Settled", variant: "default" as const, className: "bg-green-600" };
    }
    return { label: "Due", variant: "destructive" as const };
  }

  // Normal order - we collect for client
  if (order.status === 'Delivered') {
    if (order.driver_remit_status === 'Collected') {
      return { label: "Completed", variant: "default" as const, className: "bg-green-600" };
    }
    return { label: "Collected", variant: "default" as const };
  }

  return { label: "Pending", variant: "secondary" as const };
};

const InstantOrders = () => {
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"quick" | "form">("quick");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [addressSettingsOpen, setAddressSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["instant-orders"],
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
        .in("order_type", ["instant", "errand"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Order[];
    },
  });

  // Real-time subscription for instant updates
  useEffect(() => {
    const channel = supabase
      .channel('instant-orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: 'order_type=in.(instant,errand)'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["instant-orders"] });
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
        order.drivers?.name?.toLowerCase().includes(query) ||
        order.order_id?.toLowerCase().includes(query) ||
        order.address?.toLowerCase().includes(query) ||
        order.notes?.toLowerCase().includes(query)
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

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Order deleted successfully' });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['instant-orders'] });
      setDeleteOrderId(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Instant Orders</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddressSettingsOpen(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Address Areas
            </Button>
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
          <InstantOrderForm />
        ) : (
          <div className="flex justify-end">
            <Button onClick={() => setCreateDialogOpen(true)}>Create Instant Order</Button>
          </div>
        )}

        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">All Instant Orders</h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by client, driver, address, notes..."
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
                  <TableHead>Client</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Amount USD</TableHead>
                  <TableHead>Amount LBP</TableHead>
                  <TableHead>Delivery USD</TableHead>
                  <TableHead>Delivery LBP</TableHead>
                  <TableHead>Order Status</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
                <TableBody>
                {filteredOrders?.map((order) => {
                  const paymentStatus = getPaymentStatus(order);
                  return (
                    <TableRow key={order.id} className="hover:bg-muted/50">
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selectedIds.includes(order.id)} onCheckedChange={() => toggleSelect(order.id)} />
                      </TableCell>
                      <TableCell>{order.clients?.name}</TableCell>
                      <TableCell>{order.drivers?.name || "-"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{order.address}</TableCell>
                      <TableCell className="font-mono text-right">
                        {order.driver_paid_for_client ? (
                          <span className="text-blue-600">{formatUSD(order.driver_paid_amount_usd || order.order_amount_usd)}</span>
                        ) : (
                          formatUSD(order.order_amount_usd)
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-right">
                        {order.driver_paid_for_client ? (
                          <span className="text-blue-600">{formatLBP(order.driver_paid_amount_lbp || order.order_amount_lbp)}</span>
                        ) : (
                          formatLBP(order.order_amount_lbp)
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-right">{formatUSD(order.delivery_fee_usd)}</TableCell>
                      <TableCell className="font-mono text-right">{formatLBP(order.delivery_fee_lbp)}</TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>
                        <Badge variant={paymentStatus.variant} className={paymentStatus.className}>
                          {paymentStatus.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate">{order.notes || "-"}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(order.created_at).toLocaleDateString()} {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrder(order);
                              setDialogOpen(true);
                            }}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteOrderId(order.id);
                            }}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
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

        {createDialogOpen && <CreateOrderDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} orderType="instant" />}

        <AddressSettingsDialog open={addressSettingsOpen} onOpenChange={setAddressSettingsOpen} />

        <AlertDialog open={!!deleteOrderId} onOpenChange={(open) => !open && setDeleteOrderId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Order</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this order? This will also delete all related transactions and cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteOrderId && deleteOrderMutation.mutate(deleteOrderId)}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
};

export default InstantOrders;
