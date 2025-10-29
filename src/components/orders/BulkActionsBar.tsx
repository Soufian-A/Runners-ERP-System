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
      toast.success(`Driver assigned to ${selectedIds.length} orders`);
      onClearSelection();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("orders").update({ status: status as any }).in("id", selectedIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["instant-orders"] });
      toast.success(`Status updated for ${selectedIds.length} orders`);
      onClearSelection();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteOrdersMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("orders").delete().in("id", selectedIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success(`${selectedIds.length} orders deleted`);
      onClearSelection();
      setDeleteDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
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
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the selected orders.</AlertDialogDescription>
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
