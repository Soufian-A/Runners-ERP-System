import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus } from "lucide-react";

interface AddressSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddressSettingsDialog = ({ open, onOpenChange }: AddressSettingsDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newArea, setNewArea] = useState("");

  const { data: areas } = useQuery({
    queryKey: ["address-areas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("address_areas")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const addAreaMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase
        .from("address_areas")
        .insert([{ name: name.trim() }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["address-areas"] });
      toast({
        title: "Success",
        description: "Address area added successfully.",
      });
      setNewArea("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteAreaMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("address_areas")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["address-areas"] });
      toast({
        title: "Success",
        description: "Address area deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newArea.trim()) {
      addAreaMutation.mutate(newArea);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Address Areas</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleAdd} className="flex gap-2 mb-4">
          <div className="flex-1">
            <Label htmlFor="area-name" className="sr-only">Area Name</Label>
            <Input
              id="area-name"
              value={newArea}
              onChange={(e) => setNewArea(e.target.value)}
              placeholder="Enter new area name"
            />
          </div>
          <Button type="submit" disabled={addAreaMutation.isPending || !newArea.trim()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Area
          </Button>
        </form>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Area Name</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {areas?.map((area) => (
                <TableRow key={area.id}>
                  <TableCell>{area.name}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteAreaMutation.mutate(area.id)}
                      disabled={deleteAreaMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!areas || areas.length === 0) && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    No address areas defined yet. Add one above.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
};
