import { Button } from "@/components/ui/button";
import { Trash2, UserPlus, CheckCircle } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
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

interface BulkActionsBarProps {
  selectedIds: string[];
  onClearSelection: () => void;
}

export function BulkActionsBar({ selectedIds, onClearSelection }: BulkActionsBarProps) {
  const queryClient = useQueryClient();
  const [driverOpen, setDriverOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("drivers").select("*").eq("active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const assignDriverMutation = useMutation({
    mutationFn: async (driverId: string) => {
      const { error } = await supabase.from("orders").update({ driver_id: driverId }).in("id", selectedIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["instant-orders"] });
      queryClient.invalidateQueries({ queryKey: ["ecom-orders"] });
      toast.success(`Driver assigned to ${selectedIds.length} orders`);
      onClearSelection();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      // Validate: Cannot mark as Delivered without a driver for any selected order
      if (status === 'Delivered') {
        const { data: orders } = await supabase
          .from("orders")
          .select("id, order_id, driver_id")
          .in("id", selectedIds);
        
        const ordersWithoutDriver = orders?.filter(order => !order.driver_id) || [];
        if (ordersWithoutDriver.length > 0) {
          throw new Error(`Cannot mark orders as Delivered without assigning drivers. ${ordersWithoutDriver.length} order(s) have no driver assigned.`);
        }
      }
      
      // First update the status
      const updateData: any = { status };
      if (status === 'Delivered') {
        updateData.delivered_at = new Date().toISOString();
      }
      
      const { error } = await supabase.from("orders").update(updateData).in("id", selectedIds);
      if (error) throw error;

      // If status is Delivered, process accounting for each order
      if (status === 'Delivered') {
        console.log(`Processing delivery accounting for ${selectedIds.length} orders...`);
        
        // Process each order through the edge function
        for (const orderId of selectedIds) {
          const { error: functionError } = await supabase.functions.invoke('process-order-delivery', {
            body: { orderId }
          });
          
          if (functionError) {
            console.error(`Error processing delivery for order ${orderId}:`, functionError);
            // Continue processing other orders even if one fails
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["instant-orders"] });
      queryClient.invalidateQueries({ queryKey: ["ecom-orders"] });
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      toast.success(`Status updated for ${selectedIds.length} orders`);
      onClearSelection();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteOrdersMutation = useMutation({
    mutationFn: async () => {
      let allSuccessful = true;
      // Call the new edge function for each selected order
      for (const orderId of selectedIds) {
        const { data, error } = await supabase.functions.invoke('delete-order-with-accounting', {
          body: { orderId }
        });

        if (error) {
          console.error(`Error invoking delete-order-with-accounting for order ${orderId}:`, error);
          allSuccessful = false;
          // Display error for individual order
          toast.error(`Failed to delete order ${orderId}: ${data?.error || error.message}`);
        } else {
          console.log(`Order ${orderId} deleted with accounting reversal.`);
        }
      }
      if (!allSuccessful) {
        throw new Error("Some orders failed to delete. Check individual error messages.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["instant-orders"] });
      queryClient.invalidateQueries({ queryKey: ["ecom-orders"] });
      queryClient.invalidateQueries({ queryKey: ["cashbox"] }); // Invalidate cashbox as well
      toast.success(`${selectedIds.length} orders deleted`);
      onClearSelection();
      setDeleteDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error("Error deleting orders", { description: error.message });
      setDeleteDialogOpen(false);
    },
  });

  if (selectedIds.length === 0) return null;

  return (
    <>
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-6 py-3 rounded-lg shadow-lg flex items-center gap-4 z-50">
        <span className="font-medium">{selectedIds.length} selected</span>

        <Popover open={driverOpen} onOpenChange={setDriverOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="secondary">
              <UserPlus className="h-4 w-4 mr-2" />
              Assign Driver
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0 bg-popover">
            <Command>
              <CommandInput placeholder="Search driver..." />
              <CommandList>
                <CommandEmpty>No driver found.</CommandEmpty>
                <CommandGroup>
                  {drivers.map((driver) => (
                    <CommandItem
                      key={driver.id}
                      onSelect={() => {
                        assignDriverMutation.mutate(driver.id);
                        setDriverOpen(false);
                      }}
                    >
                      {driver.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Popover open={statusOpen} onOpenChange={setStatusOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="secondary">
              <CheckCircle className="h-4 w-4 mr-2" />
              Update Status
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0 bg-popover">
            <Command>
              <CommandInput placeholder="Search status..." />
              <CommandList>
                <CommandEmpty>No status found.</CommandEmpty>
                <CommandGroup>
                  {["New", "Assigned", "PickedUp", "Delivered", "Returned", "Cancelled"].map((status) => (
                    <CommandItem
                      key={status}
                      onSelect={() => {
                        updateStatusMutation.mutate(status);
                        setStatusOpen(false);
                      }}
                    >
                      {status}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Button size="sm" variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>

        <Button size="sm" variant="ghost" onClick={onClearSelection}>
          Clear
        </Button>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.length} orders?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the selected orders and reverse any associated accounting entries.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteOrdersMutation.mutate()} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}