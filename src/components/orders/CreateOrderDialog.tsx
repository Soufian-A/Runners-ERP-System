import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { z } from 'zod';

const orderSchema = z.object({
  client_id: z.string().min(1, "Client is required"),
  address: z.string().min(1, "Address is required"),
  order_amount_usd: z.number().min(0),
  order_amount_lbp: z.number().min(0),
  fulfillment: z.enum(['InHouse', 'ThirdParty']),
});

interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CreateOrderDialog = ({ open, onOpenChange }: CreateOrderDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    client_id: '',
    address: '',
    order_amount_usd: 0,
    order_amount_lbp: 0,
    fulfillment: 'InHouse' as 'InHouse' | 'ThirdParty',
    driver_id: '',
    third_party_id: '',
  });

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: drivers } = useQuery({
    queryKey: ['drivers-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: thirdParties } = useQuery({
    queryKey: ['third-parties-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('third_parties')
        .select('*')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      // Get client rules
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*, client_rules(*)')
        .eq('id', data.client_id)
        .single();

      if (clientError) throw clientError;

      const clientRule = clientData.client_rules?.[0];
      const orderIdPrefix = clientData.type === 'Individual' ? 'INST' : clientData.type === 'Ecom' ? 'EC' : 'REST';
      const orderId = `${orderIdPrefix}-${Date.now()}`;

      const orderData = {
        order_id: orderId,
        client_id: data.client_id,
        client_type: clientData.type,
        address: data.address,
        order_amount_usd: data.order_amount_usd,
        order_amount_lbp: data.order_amount_lbp,
        delivery_fee_usd: clientRule?.default_fee_usd || 0,
        delivery_fee_lbp: clientRule?.default_fee_lbp || 0,
        client_fee_rule: clientRule?.fee_rule || 'ADD_ON',
        fulfillment: data.fulfillment,
        driver_id: data.fulfillment === 'InHouse' ? data.driver_id : null,
        third_party_id: data.fulfillment === 'ThirdParty' ? data.third_party_id : null,
        status: 'New' as const,
        entered_by: user?.id,
      };

      const { data: newOrder, error } = await supabase
        .from('orders')
        .insert([orderData])
        .select()
        .single();

      if (error) throw error;
      return newOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast({
        title: "Order Created",
        description: "The order has been created successfully.",
      });
      onOpenChange(false);
      setFormData({
        client_id: '',
        address: '',
        order_amount_usd: 0,
        order_amount_lbp: 0,
        fulfillment: 'InHouse',
        driver_id: '',
        third_party_id: '',
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
    createOrderMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Order</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client">Client *</Label>
              <Select
                value={formData.client_id}
                onValueChange={(value) => setFormData({ ...formData, client_id: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fulfillment">Fulfillment *</Label>
              <Select
                value={formData.fulfillment}
                onValueChange={(value: 'InHouse' | 'ThirdParty') =>
                  setFormData({ ...formData, fulfillment: value })
                }
                required
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="InHouse">In-House</SelectItem>
                  <SelectItem value="ThirdParty">Third Party</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {formData.fulfillment === 'InHouse' && (
            <div className="space-y-2">
              <Label htmlFor="driver">Driver</Label>
              <Select
                value={formData.driver_id}
                onValueChange={(value) => setFormData({ ...formData, driver_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select driver" />
                </SelectTrigger>
                <SelectContent>
                  {drivers?.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {formData.fulfillment === 'ThirdParty' && (
            <div className="space-y-2">
              <Label htmlFor="third_party">Third Party</Label>
              <Select
                value={formData.third_party_id}
                onValueChange={(value) => setFormData({ ...formData, third_party_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select third party" />
                </SelectTrigger>
                <SelectContent>
                  {thirdParties?.map((tp) => (
                    <SelectItem key={tp.id} value={tp.id}>
                      {tp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="address">Delivery Address *</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              required
              placeholder="Enter delivery address"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount_usd">Order Amount (USD)</Label>
              <Input
                id="amount_usd"
                type="number"
                step="0.01"
                min="0"
                value={formData.order_amount_usd}
                onChange={(e) =>
                  setFormData({ ...formData, order_amount_usd: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount_lbp">Order Amount (LBP)</Label>
              <Input
                id="amount_lbp"
                type="number"
                step="1"
                min="0"
                value={formData.order_amount_lbp}
                onChange={(e) =>
                  setFormData({ ...formData, order_amount_lbp: parseInt(e.target.value) || 0 })
                }
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createOrderMutation.isPending}>
              {createOrderMutation.isPending ? 'Creating...' : 'Create Order'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateOrderDialog;