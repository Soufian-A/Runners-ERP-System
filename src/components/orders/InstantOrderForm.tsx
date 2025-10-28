import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

export function InstantOrderForm() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    client_id: "",
    address: "",
    driver_id: "",
    order_amount_usd: "",
    delivery_fee_usd: "",
    notes: "",
  });

  const [openClient, setOpenClient] = useState(false);
  const [openAddress, setOpenAddress] = useState(false);
  const [openDriver, setOpenDriver] = useState(false);

  // Fetch clients
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch drivers
  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("drivers").select("*").eq("active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch addresses from customers for autofill
  const { data: addresses = [] } = useQuery({
    queryKey: ["customer-addresses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("address")
        .not("address", "is", null)
        .order("address");
      if (error) throw error;
      return [...new Set(data.map((c) => c.address))].filter(Boolean);
    },
  });

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      // Get client info
      const { data: client } = await supabase
        .from("clients")
        .select("*, client_rules(*)")
        .eq("id", formData.client_id)
        .single();

      if (!client) throw new Error("Client not found");

      // Generate order_id
      const prefix = client.name.substring(0, 3).toUpperCase();
      const timestamp = Date.now().toString().slice(-6);
      const order_id = `${prefix}-${timestamp}`;

      // Create order
      const { error } = await supabase.from("orders").insert({
        order_id,
        order_type: "instant",
        client_id: formData.client_id,
        client_type: client.type,
        fulfillment: "InHouse",
        driver_id: formData.driver_id || null,
        order_amount_usd: parseFloat(formData.order_amount_usd) || 0,
        delivery_fee_usd: parseFloat(formData.delivery_fee_usd) || 0,
        client_fee_rule: client.client_rules?.[0]?.fee_rule || "ADD_ON",
        status: "New",
        address: formData.address,
        notes: formData.notes || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Instant order created");
      setFormData({
        client_id: "",
        address: "",
        driver_id: "",
        order_amount_usd: "",
        delivery_fee_usd: "",
        notes: "",
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createOrderMutation.mutate();
  };

  const selectedClient = clients.find((c) => c.id === formData.client_id);
  const selectedDriver = drivers.find((d) => d.id === formData.driver_id);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg">
      <div className="space-y-2">
        <Label>Client Name *</Label>
        <Popover open={openClient} onOpenChange={setOpenClient}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              {selectedClient?.name || "Select client..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0 bg-popover">
            <Command>
              <CommandInput placeholder="Search client..." />
              <CommandList>
                <CommandEmpty>No client found.</CommandEmpty>
                <CommandGroup>
                  {clients.map((client) => (
                    <CommandItem
                      key={client.id}
                      onSelect={() => {
                        setFormData({ ...formData, client_id: client.id });
                        setOpenClient(false);
                      }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", formData.client_id === client.id ? "opacity-100" : "opacity-0")} />
                      {client.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-2">
        <Label>Address *</Label>
        <Popover open={openAddress} onOpenChange={setOpenAddress}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              {formData.address || "Select or enter address..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0 bg-popover">
            <Command>
              <CommandInput
                placeholder="Search or type address..."
                value={formData.address}
                onValueChange={(value) => setFormData({ ...formData, address: value })}
              />
              <CommandList>
                <CommandEmpty>
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setOpenAddress(false);
                    }}
                  >
                    Use "{formData.address}"
                  </Button>
                </CommandEmpty>
                <CommandGroup>
                  {addresses.map((address, idx) => (
                    <CommandItem
                      key={idx}
                      onSelect={() => {
                        setFormData({ ...formData, address: address as string });
                        setOpenAddress(false);
                      }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", formData.address === address ? "opacity-100" : "opacity-0")} />
                      {address}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-2">
        <Label>Driver</Label>
        <Popover open={openDriver} onOpenChange={setOpenDriver}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              {selectedDriver?.name || "Select driver..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0 bg-popover">
            <Command>
              <CommandInput placeholder="Search driver..." />
              <CommandList>
                <CommandEmpty>No driver found.</CommandEmpty>
                <CommandGroup>
                  {drivers.map((driver) => (
                    <CommandItem
                      key={driver.id}
                      onSelect={() => {
                        setFormData({ ...formData, driver_id: driver.id });
                        setOpenDriver(false);
                      }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", formData.driver_id === driver.id ? "opacity-100" : "opacity-0")} />
                      {driver.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Order Amount (USD) *</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.order_amount_usd}
            onChange={(e) => setFormData({ ...formData, order_amount_usd: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>Delivery Fee (USD)</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.delivery_fee_usd}
            onChange={(e) => setFormData({ ...formData, delivery_fee_usd: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Input value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
      </div>

      <Button type="submit" className="w-full" disabled={createOrderMutation.isPending}>
        {createOrderMutation.isPending ? "Creating..." : "Create Instant Order"}
      </Button>
    </form>
  );
}
