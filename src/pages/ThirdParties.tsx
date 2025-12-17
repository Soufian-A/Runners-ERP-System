import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
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

type ThirdParty = {
  id: string;
  name: string;
  contact: string | null;
  phone: string | null;
  active: boolean | null;
  created_at: string | null;
};

export default function ThirdParties() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingThirdParty, setEditingThirdParty] = useState<ThirdParty | null>(null);
  const [deleteThirdParty, setDeleteThirdParty] = useState<ThirdParty | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    contact: "",
    phone: "",
    active: true,
  });

  const { data: thirdParties = [], isLoading } = useQuery({
    queryKey: ["third-parties-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("third_parties")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as ThirdParty[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("third_parties").insert({
        name: data.name,
        contact: data.contact || null,
        phone: data.phone || null,
        active: data.active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["third-parties-all"] });
      queryClient.invalidateQueries({ queryKey: ["third-parties"] });
      toast.success("Third party created successfully");
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(`Failed to create third party: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("third_parties")
        .update({
          name: data.name,
          contact: data.contact || null,
          phone: data.phone || null,
          active: data.active,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["third-parties-all"] });
      queryClient.invalidateQueries({ queryKey: ["third-parties"] });
      toast.success("Third party updated successfully");
      setEditingThirdParty(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(`Failed to update third party: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Check if there are any orders referencing this third party
      const { count, error: checkError } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("third_party_id", id);
      
      if (checkError) throw checkError;
      if (count && count > 0) {
        throw new Error(`Cannot delete: ${count} order(s) are linked to this third party`);
      }

      const { error } = await supabase.from("third_parties").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["third-parties-all"] });
      queryClient.invalidateQueries({ queryKey: ["third-parties"] });
      toast.success("Third party deleted successfully");
      setDeleteThirdParty(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setDeleteThirdParty(null);
    },
  });

  const resetForm = () => {
    setFormData({ name: "", contact: "", phone: "", active: true });
  };

  const openEdit = (tp: ThirdParty) => {
    setFormData({
      name: tp.name,
      contact: tp.contact || "",
      phone: tp.phone || "",
      active: tp.active ?? true,
    });
    setEditingThirdParty(tp);
  };

  const handleCreate = () => {
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }
    createMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (editingThirdParty) {
      updateMutation.mutate({ id: editingThirdParty.id, data: formData });
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Third Parties</h1>
          </div>
          <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Third Party
          </Button>
        </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : thirdParties.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No third parties yet. Click "Add Third Party" to create one.
                      </TableCell>
                    </TableRow>
                  ) : (
                    thirdParties.map((tp) => (
                      <TableRow key={tp.id}>
                        <TableCell className="font-medium">{tp.name}</TableCell>
                        <TableCell>{tp.contact || "-"}</TableCell>
                        <TableCell>{tp.phone || "-"}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs ${tp.active ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>
                            {tp.active ? "Active" : "Inactive"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(tp)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteThirdParty(tp)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Third Party</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Toters, Careem"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact">Contact Person</Label>
              <Input
                id="contact"
                value={formData.contact}
                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                placeholder="Contact name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Phone number"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="active">Active</Label>
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingThirdParty} onOpenChange={() => setEditingThirdParty(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Third Party</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-contact">Contact Person</Label>
              <Input
                id="edit-contact"
                value={formData.contact}
                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-active">Active</Label>
              <Switch
                id="edit-active"
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingThirdParty(null)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteThirdParty} onOpenChange={() => setDeleteThirdParty(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Third Party</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteThirdParty?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteThirdParty && deleteMutation.mutate(deleteThirdParty.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
