import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

const clientSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  type: z.enum(['Ecom', 'Restaurant', 'Individual']),
  contact_name: z.string().max(100),
  phone: z.string().max(20),
  address: z.string().max(255),
  location_link: z.string().max(500).optional(),
  default_currency: z.enum(['USD', 'LBP']),
  fee_rule: z.enum(['ADD_ON', 'DEDUCT', 'INCLUDED']),
});

interface EditClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: any;
}

const EditClientDialog = ({ open, onOpenChange, client }: EditClientDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    type: 'Individual' as 'Ecom' | 'Restaurant' | 'Individual',
    contact_name: '',
    phone: '',
    address: '',
    location_link: '',
    default_currency: 'USD' as 'USD' | 'LBP',
    fee_rule: 'ADD_ON' as 'ADD_ON' | 'DEDUCT' | 'INCLUDED',
  });

  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name || '',
        type: client.type || 'Individual',
        contact_name: client.contact_name || '',
        phone: client.phone || '',
        address: client.address || '',
        location_link: client.location_link || '',
        default_currency: client.default_currency || 'USD',
        fee_rule: client.client_rules?.[0]?.fee_rule || 'ADD_ON',
      });
    }
  }, [client]);

  const updateClientMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error: clientError } = await supabase
        .from('clients')
        .update({
          name: data.name,
          type: data.type,
          contact_name: data.contact_name,
          phone: data.phone,
          address: data.address,
          location_link: data.location_link,
          default_currency: data.default_currency,
        })
        .eq('id', client.id);

      if (clientError) throw clientError;

      if (client.client_rules?.[0]) {
        const { error: ruleError } = await supabase
          .from('client_rules')
          .update({
            fee_rule: data.fee_rule,
          })
          .eq('id', client.client_rules[0].id);

        if (ruleError) throw ruleError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast({
        title: "Client Updated",
        description: "The client has been updated successfully.",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      clientSchema.parse(formData);
      updateClientMutation.mutate(formData);
    } catch (error: any) {
      toast({
        title: "Validation Error",
        description: error.errors?.[0]?.message || "Invalid input",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Client</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Client name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(value: any) => setFormData({ ...formData, type: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ecom">E-commerce</SelectItem>
                  <SelectItem value="Restaurant">Restaurant</SelectItem>
                  <SelectItem value="Individual">Individual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact_name">Contact Name</Label>
              <Input
                id="contact_name"
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                placeholder="Contact person"
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Client address"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location_link">Google Maps Link</Label>
            <Input
              id="location_link"
              value={formData.location_link}
              onChange={(e) => setFormData({ ...formData, location_link: e.target.value })}
              placeholder="https://maps.google.com/..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Default Currency *</Label>
              <Select
                value={formData.default_currency}
                onValueChange={(value: any) => setFormData({ ...formData, default_currency: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="LBP">LBP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fee_rule">Fee Rule *</Label>
              <Select
                value={formData.fee_rule}
                onValueChange={(value: any) => setFormData({ ...formData, fee_rule: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADD_ON">Add On</SelectItem>
                  <SelectItem value="DEDUCT">Deduct</SelectItem>
                  <SelectItem value="INCLUDED">Included</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateClientMutation.isPending}>
              {updateClientMutation.isPending ? 'Updating...' : 'Update Client'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditClientDialog;
