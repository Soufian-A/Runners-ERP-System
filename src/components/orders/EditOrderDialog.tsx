import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner"; // Using sonner for toasts as per AI_RULES.md
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Order {
  id: string;
  order_id: string;
  order_type: "ecom" | "instant" | "errand";
  voucher_no?: string;
  status: string;
  client_id: string;
  driver_id?: string;
  order_amount_usd: number;
  order_amount_lbp: number; // Added
  delivery_fee_usd: number;
  delivery_fee_lbp: number; // Added
  amount_due_to_client_usd?: number;
  prepaid_by_runners?: boolean;
  prepaid_by_company?: boolean;
  driver_remit_status?: string;
  address: string;
  notes?: string;
  created_at: string;
  clients?: { name: string };
  drivers?: { name: string };
  customers?: { phone: string; name?: string };
  customer_id?: string;
  prepay_amount_usd?: number;
  prepay_amount_lbp?: number;
  driver_paid_for_client?: boolean;
  driver_paid_amount_usd?: number;
  driver_paid_amount_lbp?: number;
}

interface EditOrderDialogProps {
  order: Order;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditOrderDialog({ order, open, onOpenChange }: EditOrderDialogProps) {
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    voucher_no: order.voucher_no || "",
    address: order.address,
    order_amount_usd: order.order_amount_usd.toString(),
    order_amount_lbp: order.order_amount_lbp?.toString() || "0", // Initialize LBP
    delivery_fee_usd: order.delivery_fee_usd.toString(),
    delivery_fee_lbp: order.delivery_fee_lbp?.toString() || "0", // Initialize LBP
    amount_due_to_client_usd: order.amount_due_to_client_usd?.toString() || "0",
    notes: order.notes || "",
    status: order.status as "New" | "Assigned" | "PickedUp" | "Delivered" | "Returned" | "Cancelled",
    driver_id: order.driver_id || "",
    prepaid_by_runners: order.prepaid_by_runners || false,
    prepaid_by_company: order.prepaid_by_company || false,
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("drivers").select("*").eq("active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: customer } = useQuery({
    queryKey: ["customer", order.customer_id],
    queryFn: async () => {
      if (!order.customer_id) return null;
      const { data, error } = await supabase.from("customers").select("*").eq("id", order.customer_id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!order.customer_id,
  });

  const updateOrderMutation = useMutation({
    mutationFn: async () => {
      const previousStatus = order.status;
      
      // Validate: Cannot mark as Delivered without a driver
      if (formData.status === 'Delivered' && !formData.driver_id) {
        throw new Error('Cannot mark order as Delivered without assigning a driver');
      }
      
      // Prepare update data
      const updateData: any = {
        voucher_no: formData.voucher_no || null,
        address: formData.address,
        order_amount_usd: parseFloat(formData.order_amount_usd),
        order_amount_lbp: parseFloat(formData.order_amount_lbp), // Include LBP
        delivery_fee_usd: parseFloat(formData.delivery_fee_usd),
        delivery_fee_lbp: parseFloat(formData.delivery_fee_lbp), // Include LBP
        amount_due_to_client_usd: parseFloat(formData.amount_due_to_client_usd) || 0,
        notes: formData.notes || null,
        status: formData.status,
        driver_id: formData.driver_id || null,
        prepaid_by_runners: formData.prepaid_by_runners,
        prepaid_by_company: formData.prepaid_by_company,
      };

      // Set delivered_at timestamp when status changes to Delivered
      if (previousStatus !== 'Delivered' && formData.status === 'Delivered') {
        updateData.delivered_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("orders")
        .update(updateData)
        .eq("id", order.id);

      if (error) throw error;

      // If status changed to Delivered, process the accounting
      if (previousStatus !== 'Delivered' && formData.status === 'Delivered') {
        console.log('Order marked as delivered, processing accounting...');
        const { error: functionError } = await supabase.functions.invoke('process-order-delivery', {
          body: { orderId: order.id }
        });
        
        if (functionError) {
          console.error('Error processing delivery:', functionError);
          throw new Error('Order updated but accounting failed: ' + functionError.message);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["instant-orders"] });
      queryClient.invalidateQueries({ queryKey: ["ecom-orders"] });
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      toast.success("Order updated successfully"); // Using sonner toast
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error("Error", { description: error.message }); // Using sonner toast
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async () => {
      // Call the new edge function for deleting the order with accounting reversal
      const { data, error } = await supabase.functions.invoke('delete-order-with-accounting', {
        body: { orderId: order.id }
      });

      if (error) {
        console.error('Error invoking delete-order-with-accounting:', error);
        throw new Error(data?.error || 'Failed to delete order with accounting reversal.');
      }
      console.log('Delete order with accounting successful:', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["instant-orders"] });
      queryClient.invalidateQueries({ queryKey: ["ecom-orders"] });
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      queryClient.invalidateQueries({ queryKey: ["cashbox"] }); // Invalidate cashbox as well
      toast.success("Order deleted successfully"); // Using sonner toast
      setDeleteDialogOpen(false);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error("Error", { description: error.message }); // Using sonner toast
      setDeleteDialogOpen(false);
    },
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Edit Order: {order.order_id}</span>
              <Badge variant={order.order_type === "ecom" ? "default" : "secondary"}>{order.order_type.toUpperCase()}</Badge>
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="status">Status & Driver</TabsTrigger>
              <TabsTrigger value="payment">Payment</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Client</Label>
                    <Input value={order.clients?.name || ""} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Order ID</Label>
                    <Input value={order.order_id} disabled />
                  </div>
                </div>

                {order.order_type === "ecom" && (
                  <>
                    <div className="space-y-2">
                      <Label>Voucher Number</Label>
                      <Input value={formData.voucher_no} onChange={(e) => setFormData({ ...formData, voucher_no: e.target.value })} />
                    </div>

                    {customer && (
                      <div className="p-4 border rounded-lg space-y-2">
                        <h4 className="font-semibold text-sm">Customer Information</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Phone:</span> {customer.phone}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Name:</span> {customer.name || "N/A"}
                          </div>
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Address:</span> {customer.address || "N/A"}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className="space-y-2">
                  <Label>Delivery Address</Label>
                  <Textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} rows={2} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Order Amount (USD)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.order_amount_usd}
                      onChange={(e) => setFormData({ ...formData, order_amount_usd: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Order Amount (LBP)</Label>
                    <Input
                      type="number"
                      step="1"
                      value={formData.order_amount_lbp}
                      onChange={(e) => setFormData({ ...formData, order_amount_lbp: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Delivery Fee (USD)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.delivery_fee_usd}
                      onChange={(e) => setFormData({ ...formData, delivery_fee_usd: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Delivery Fee (LBP)</Label>
                    <Input
                      type="number"
                      step="1"
                      value={formData.delivery_fee_lbp}
                      onChange={(e) => setFormData({ ...formData, delivery_fee_lbp: e.target.value })}
                    />
                  </div>
                </div>

                {order.order_type === "ecom" && (
                  <div className="space-y-2">
                    <Label>Amount Due to Client (USD)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.amount_due_to_client_usd}
                      onChange={(e) => setFormData({ ...formData, amount_due_to_client_usd: e.target.value })}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="status" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Order Status</Label>
                  <Select value={formData.status} onValueChange={(value: "New" | "Assigned" | "PickedUp" | "Delivered" | "Returned" | "Cancelled") => setFormData({ ...formData, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="New">New</SelectItem>
                      <SelectItem value="Assigned">Assigned</SelectItem>
                      <SelectItem value="PickedUp">Picked Up</SelectItem>
                      <SelectItem value="Delivered">Delivered</SelectItem>
                      <SelectItem value="Returned">Returned</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Assign Driver</Label>
                  <Select 
                    value={formData.driver_id || "unassigned"} 
                    onValueChange={(value) => setFormData({ ...formData, driver_id: value === "unassigned" ? null : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select driver..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">No Driver</SelectItem>
                      {drivers.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id}>
                          {driver.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold text-sm mb-2">Timeline</h4>
                  <div className="space-y-1 text-sm">
                    <div>
                      <span className="text-muted-foreground">Created:</span> {new Date(order.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="payment" className="space-y-4">
              <div className="space-y-4">
                {order.order_type === "ecom" && (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="prepaid-runners"
                        checked={formData.prepaid_by_runners}
                        onCheckedChange={(checked) => setFormData({ ...formData, prepaid_by_runners: checked as boolean })}
                      />
                      <Label htmlFor="prepaid-runners">Prepaid by Driver</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="prepaid-company"
                        checked={formData.prepaid_by_company}
                        onCheckedChange={(checked) => setFormData({ ...formData, prepaid_by_company: checked as boolean })}
                      />
                      <Label htmlFor="prepaid-company">Prepaid by Company</Label>
                    </div>
                  </div>
                )}

                <div className="p-4 border rounded-lg space-y-2">
                  <h4 className="font-semibold text-sm">Payment Summary</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Order Amount (USD):</span>
                      <span className="font-medium">${parseFloat(formData.order_amount_usd).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Order Amount (LBP):</span>
                      <span className="font-medium">{parseFloat(formData.order_amount_lbp).toLocaleString()} LBP</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Delivery Fee (USD):</span>
                      <span className="font-medium">${parseFloat(formData.delivery_fee_usd).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Delivery Fee (LBP):</span>
                      <span className="font-medium">{parseFloat(formData.delivery_fee_lbp).toLocaleString()} LBP</span>
                    </div>
                    <div className="flex justify-between border-t pt-1 mt-1">
                      <span className="text-muted-foreground">Total (USD):</span>
                      <span className="font-semibold">${(parseFloat(formData.order_amount_usd) + parseFloat(formData.delivery_fee_usd)).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total (LBP):</span>
                      <span className="font-semibold">{(parseFloat(formData.order_amount_lbp) + parseFloat(formData.delivery_fee_lbp)).toLocaleString()} LBP</span>
                    </div>
                    {order.order_type === "ecom" && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Due to Client (USD):</span>
                        <span className="font-medium">${parseFloat(formData.amount_due_to_client_usd).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-between pt-4">
            <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
              Delete Order
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={() => updateOrderMutation.mutate()} disabled={updateOrderMutation.isPending}>
                {updateOrderMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order {order.order_id}?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the order and all associated data.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteOrderMutation.mutate()} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}