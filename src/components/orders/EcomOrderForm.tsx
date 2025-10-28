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
import { Checkbox } from "@/components/ui/checkbox";

export function EcomOrderForm() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    voucher_no: "",
    client_id: "",
    customer_phone: "",
    customer_name: "",
    customer_address: "",
    total_with_delivery_usd: "",
    delivery_fee_usd: "",
    amount_due_to_client_usd: "",
    prepaid_by_driver: false,
    prepaid_by_company: false,
  });

  const [openClient, setOpenClient] = useState(false);
  const [openCustomer, setOpenCustomer] = useState(false);

  // Fetch clients
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch customers for autofill
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("phone");
      if (error) throw error;
      return data;
    },
  });

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      // First, create or get customer
      let customerId = null;
      if (formData.customer_phone) {
        const { data: existingCustomer } = await supabase
          .from("customers")
          .select("id")
          .eq("phone", formData.customer_phone)
          .maybeSingle();

        if (existingCustomer) {
          customerId = existingCustomer.id;
          // Update customer info if provided
          await supabase
            .from("customers")
            .update({
              name: formData.customer_name || null,
              address: formData.customer_address || null,
            })
            .eq("id", customerId);
        } else {
          const { data: newCustomer, error } = await supabase
            .from("customers")
            .insert({
              phone: formData.customer_phone,
              name: formData.customer_name || null,
              address: formData.customer_address || null,
            })
            .select()
            .single();

          if (error) throw error;
          customerId = newCustomer.id;
        }
      }

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

      // Calculate amounts
      const totalWithDelivery = parseFloat(formData.total_with_delivery_usd) || 0;
      const deliveryFee = parseFloat(formData.delivery_fee_usd) || 0;
      const orderAmount = totalWithDelivery - deliveryFee;
      const amountDue = parseFloat(formData.amount_due_to_client_usd) || 0;

      // Create order
      const { error } = await supabase.from("orders").insert({
        order_id,
        order_type: "ecom",
        voucher_no: formData.voucher_no || null,
        client_id: formData.client_id,
        customer_id: customerId,
        client_type: client.type,
        fulfillment: "InHouse",
        order_amount_usd: orderAmount,
        delivery_fee_usd: deliveryFee,
        amount_due_to_client_usd: amountDue,
        client_fee_rule: client.client_rules?.[0]?.fee_rule || "ADD_ON",
        prepaid_by_runners: formData.prepaid_by_driver,
        prepaid_by_company: formData.prepaid_by_company,
        status: "New",
        address: formData.customer_address || "",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("E-commerce order created");
      setFormData({
        voucher_no: "",
        client_id: "",
        customer_phone: "",
        customer_name: "",
        customer_address: "",
        total_with_delivery_usd: "",
        delivery_fee_usd: "",
        amount_due_to_client_usd: "",
        prepaid_by_driver: false,
        prepaid_by_company: false,
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleCustomerSelect = (phone: string) => {
    const customer = customers.find((c) => c.phone === phone);
    if (customer) {
      setFormData({
        ...formData,
        customer_phone: phone,
        customer_name: customer.name || "",
        customer_address: customer.address || "",
      });
    }
    setOpenCustomer(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createOrderMutation.mutate();
  };

  const selectedClient = clients.find((c) => c.id === formData.client_id);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Date</Label>
          <Input value={new Date().toLocaleDateString()} disabled />
        </div>

        <div className="space-y-2">
          <Label>Voucher Number</Label>
          <Input
            value={formData.voucher_no}
            onChange={(e) => setFormData({ ...formData, voucher_no: e.target.value })}
            onKeyDown={(e) => e.key === "Tab" && e.preventDefault()}
          />
        </div>
      </div>

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
        <Label>Customer Phone (Key ID) *</Label>
        <Popover open={openCustomer} onOpenChange={setOpenCustomer}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              {formData.customer_phone || "Select or enter phone..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0 bg-popover">
            <Command>
              <CommandInput
                placeholder="Search or type phone..."
                value={formData.customer_phone}
                onValueChange={(value) => setFormData({ ...formData, customer_phone: value })}
              />
              <CommandList>
                <CommandEmpty>
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setOpenCustomer(false);
                    }}
                  >
                    Use "{formData.customer_phone}"
                  </Button>
                </CommandEmpty>
                <CommandGroup>
                  {customers.map((customer) => (
                    <CommandItem key={customer.id} onSelect={() => handleCustomerSelect(customer.phone)}>
                      <Check className={cn("mr-2 h-4 w-4", formData.customer_phone === customer.phone ? "opacity-100" : "opacity-0")} />
                      <div className="flex flex-col">
                        <span>{customer.phone}</span>
                        {customer.name && <span className="text-xs text-muted-foreground">{customer.name}</span>}
                      </div>
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
          <Label>Customer Name</Label>
          <Input value={formData.customer_name} onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })} />
        </div>

        <div className="space-y-2">
          <Label>Customer Address</Label>
          <Input value={formData.customer_address} onChange={(e) => setFormData({ ...formData, customer_address: e.target.value })} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Total with Delivery (USD) *</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.total_with_delivery_usd}
            onChange={(e) => setFormData({ ...formData, total_with_delivery_usd: e.target.value })}
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

        <div className="space-y-2">
          <Label>Amount Due to Client (USD)</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.amount_due_to_client_usd}
            onChange={(e) => setFormData({ ...formData, amount_due_to_client_usd: e.target.value })}
          />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="prepaid-driver"
            checked={formData.prepaid_by_driver}
            onCheckedChange={(checked) => setFormData({ ...formData, prepaid_by_driver: checked as boolean })}
          />
          <Label htmlFor="prepaid-driver">Prepaid by Driver</Label>
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

      <Button type="submit" className="w-full" disabled={createOrderMutation.isPending}>
        {createOrderMutation.isPending ? "Creating..." : "Create E-commerce Order"}
      </Button>
    </form>
  );
}
