import { useState } from 'react';
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
  default_currency: z.enum(['USD', 'LBP']),
  fee_rule: z.enum(['ADD_ON', 'DEDUCT', 'INCLUDED']),
  default_fee_usd: z.number().min(0),
  default_fee_lbp: z.number().min(0),
});

interface CreateClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CreateClientDialog = ({ open, onOpenChange }: CreateClientDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    type: 'Individual' as 'Ecom' | 'Restaurant' | 'Individual',
    contact_name: '',
    phone: '',
    address: '',
    default_currency: 'USD' as 'USD' | 'LBP',
    fee_rule: 'ADD_ON' as 'ADD_ON' | 'DEDUCT' | 'INCLUDED',
    default_fee_usd: 0,
    default_fee_lbp: 0,
  });

  const createClientMutation = useMutation({
    mutationFn: async (data: any) => {
      // Create client
      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert([{
          name: data.name,
          type: data.type,
          contact_name: data.contact_name,
          phone: data.phone,
          address: data.address,
          default_currency: data.default_currency,
        }])
        .select()
        .single();

      if (clientError) throw clientError;

      // Create client rule
      const { error: ruleError } = await supabase
        .from('client_rules')
        .insert([{
          client_id: newClient.id,
          fee_rule: data.fee_rule,
          default_fee_usd: data.default_fee_usd,
          default_fee_lbp: data.default_fee_lbp,
          allow_override: true,
        }]);

      if (ruleError) throw ruleError;
      return newClient;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast({
        title: "Client Created",
        description: "The client has been added successfully.",
      });
      onOpenChange(false);
      setFormData({
        name: '',
        type: 'Individual',
        contact_name: '',
        phone: '',
        address: '',
        default_currency: 'USD',
        fee_rule: 'ADD_ON',
        default_fee_usd: 0,
        default_fee_lbp: 0,
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      clientSchema.parse(formData);
      createClientMutation.mutate(formData);
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
          <DialogTitle>Add New Client</DialogTitle>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fee_usd">Default Fee (USD)</Label>
              <Input
                id="fee_usd"
                type="number"
                step="0.01"
                min="0"
                value={formData.default_fee_usd}
                onChange={(e) =>
                  setFormData({ ...formData, default_fee_usd: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fee_lbp">Default Fee (LBP)</Label>
              <Input
                id="fee_lbp"
                type="number"
                step="1"
                min="0"
                value={formData.default_fee_lbp}
                onChange={(e) =>
                  setFormData({ ...formData, default_fee_lbp: parseInt(e.target.value) || 0 })
                }
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createClientMutation.isPending}>
              {createClientMutation.isPending ? 'Creating...' : 'Create Client'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateClientDialog;
