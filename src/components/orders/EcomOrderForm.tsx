import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

type NewOrderRow = {
  id: string;
  voucher_no: string;
  client_id: string;
  customer_phone: string;
  customer_name: string;
  customer_address: string;
  total_with_delivery_usd: string;
  delivery_fee_usd: string;
  amount_due_to_client_usd: string;
  prepaid_by_company: boolean;
};

type Customer = {
  id: string;
  phone: string;
  name: string | null;
  address: string | null;
};

export function EcomOrderForm() {
  const queryClient = useQueryClient();
  const [newRows, setNewRows] = useState<NewOrderRow[]>([
    {
      id: `new-${Date.now()}`,
      voucher_no: "",
      client_id: "",
      customer_phone: "",
      customer_name: "",
      customer_address: "",
      total_with_delivery_usd: "",
      delivery_fee_usd: "",
      amount_due_to_client_usd: "",
      prepaid_by_company: false,
    },
  ]);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("phone");
      if (error) throw error;
      return data;
    },
  });

  const addNewRow = () => {
    setNewRows([
      ...newRows,
      {
        id: `new-${Date.now()}`,
        voucher_no: "",
        client_id: "",
        customer_phone: "",
        customer_name: "",
        customer_address: "",
        total_with_delivery_usd: "",
        delivery_fee_usd: "",
        amount_due_to_client_usd: "",
        prepaid_by_company: false,
      },
    ]);
  };

  const updateRow = (id: string, field: keyof NewOrderRow, value: any) => {
    setNewRows((prevRows) => prevRows.map((row) => {
      if (row.id !== id) return row;
      
      const updatedRow = { ...row, [field]: value };
      
      // Auto-calculate Due USD when total or delivery fee changes
      if (field === "total_with_delivery_usd" || field === "delivery_fee_usd") {
        const total = parseFloat(field === "total_with_delivery_usd" ? value : row.total_with_delivery_usd) || 0;
        const deliveryFee = parseFloat(field === "delivery_fee_usd" ? value : row.delivery_fee_usd) || 0;
        updatedRow.amount_due_to_client_usd = (total - deliveryFee).toString();
      }
      
      return updatedRow;
    }));
  };

  const createOrderMutation = useMutation({
    mutationFn: async (rowData: NewOrderRow) => {
      let customerId = null;
      if (rowData.customer_phone) {
        const { data: existingCustomer } = await supabase.from("customers").select("id").eq("phone", rowData.customer_phone).maybeSingle();

        if (existingCustomer) {
          customerId = existingCustomer.id;
          await supabase
            .from("customers")
            .update({
              name: rowData.customer_name || null,
              address: rowData.customer_address || null,
            })
            .eq("id", customerId);
        } else {
          const { data: newCustomer, error } = await supabase
            .from("customers")
            .insert({
              phone: rowData.customer_phone,
              name: rowData.customer_name || null,
              address: rowData.customer_address || null,
            })
            .select()
            .single();

          if (error) throw error;
          customerId = newCustomer.id;
        }
      }

      const { data: client } = await supabase.from("clients").select("*, client_rules(*)").eq("id", rowData.client_id).single();
      if (!client) throw new Error("Client not found");

      const prefix = client.name.substring(0, 3).toUpperCase();
      const timestamp = Date.now().toString().slice(-6);
      const order_id = `${prefix}-${timestamp}`;

      const totalWithDelivery = parseFloat(rowData.total_with_delivery_usd) || 0;
      const deliveryFee = parseFloat(rowData.delivery_fee_usd) || 0;
      const orderAmount = totalWithDelivery - deliveryFee;
      const amountDue = parseFloat(rowData.amount_due_to_client_usd) || 0;

      const { error } = await supabase.from("orders").insert({
        order_id,
        order_type: "ecom",
        voucher_no: rowData.voucher_no || null,
        client_id: rowData.client_id,
        customer_id: customerId,
        client_type: client.type,
        fulfillment: "InHouse",
        order_amount_usd: orderAmount,
        delivery_fee_usd: deliveryFee,
        amount_due_to_client_usd: amountDue,
        client_fee_rule: client.client_rules?.[0]?.fee_rule || "ADD_ON",
        prepaid_by_runners: rowData.prepaid_by_company,
        prepaid_by_company: rowData.prepaid_by_company,
        status: "New",
        address: rowData.customer_address || "",
      });

      if (error) throw error;
      return rowData.id;
    },
    onSuccess: (rowId) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Order created");
      setNewRows(newRows.filter((r) => r.id !== rowId));
      if (newRows.length === 1) addNewRow();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const ComboboxField = ({
    value,
    onSelect,
    items,
    placeholder,
  }: {
    value: string;
    onSelect: (id: string) => void;
    items: any[];
    placeholder: string;
  }) => {
    const [open, setOpen] = useState(false);
    const selected = items.find((item) => item.id === value);

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            className="w-full justify-between h-8 text-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setOpen(true);
              }
            }}
          >
            {selected?.name || placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0 bg-popover" onOpenAutoFocus={(e) => {
          e.preventDefault();
          const target = e.currentTarget as HTMLElement;
          const input = target.querySelector('input');
          input?.focus();
        }}>
          <Command>
            <CommandInput placeholder="Search..." />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {items.map((item) => (
                  <CommandItem
                    key={item.id}
                    onSelect={() => {
                      onSelect(item.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === item.id ? "opacity-100" : "opacity-0")} />
                    {item.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };


  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">Quick E-commerce Entry</h3>
        <Button onClick={addNewRow} size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-1" />
          Add Row
        </Button>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Voucher</TableHead>
              <TableHead className="w-[150px]">Client</TableHead>
              <TableHead className="w-[120px]">Customer Phone</TableHead>
              <TableHead className="w-[120px]">Name</TableHead>
              <TableHead className="w-[150px]">Address</TableHead>
              <TableHead className="w-[100px]">Total USD</TableHead>
              <TableHead className="w-[90px]">Fee USD</TableHead>
              <TableHead className="w-[100px]">Due USD</TableHead>
              <TableHead className="w-[80px]">Prepaid</TableHead>
              <TableHead className="w-[80px]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {newRows.map((row) => (
              <TableRow key={row.id} className="bg-accent/20">
                <TableCell>
                  <Input value={row.voucher_no} onChange={(e) => updateRow(row.id, "voucher_no", e.target.value)} className="h-8 text-xs" placeholder="#" />
                </TableCell>
                <TableCell>
                  <ComboboxField value={row.client_id} onSelect={(id) => updateRow(row.id, "client_id", id)} items={clients} placeholder="Client" />
                </TableCell>
                <TableCell>
                  <Input 
                    value={row.customer_phone} 
                    onChange={(e) => {
                      updateRow(row.id, "customer_phone", e.target.value);
                    }}
                    onBlur={() => {
                      const matchingCustomer = customers.find((c) => c.phone === row.customer_phone);
                      if (matchingCustomer) {
                        setNewRows((prevRows) => prevRows.map((r) => 
                          r.id === row.id 
                            ? { 
                                ...r, 
                                customer_name: matchingCustomer.name || r.customer_name,
                                customer_address: matchingCustomer.address || r.customer_address
                              }
                            : r
                        ));
                      }
                    }}
                    className="h-8 text-xs" 
                    placeholder="Phone..."
                  />
                </TableCell>
                <TableCell>
                  <Input value={row.customer_name} onChange={(e) => updateRow(row.id, "customer_name", e.target.value)} className="h-8 text-xs" />
                </TableCell>
                <TableCell>
                  <Input value={row.customer_address} onChange={(e) => updateRow(row.id, "customer_address", e.target.value)} className="h-8 text-xs" />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    value={row.total_with_delivery_usd}
                    onChange={(e) => updateRow(row.id, "total_with_delivery_usd", e.target.value)}
                    className="h-8 text-xs"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    value={row.delivery_fee_usd}
                    onChange={(e) => updateRow(row.id, "delivery_fee_usd", e.target.value)}
                    className="h-8 text-xs"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    value={row.amount_due_to_client_usd}
                    onChange={(e) => updateRow(row.id, "amount_due_to_client_usd", e.target.value)}
                    className="h-8 text-xs"
                    readOnly
                    title="Auto-calculated: Total - Delivery Fee"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex justify-center">
                    <Checkbox
                      checked={row.prepaid_by_company}
                      onCheckedChange={(checked) => updateRow(row.id, "prepaid_by_company", checked)}
                      title="Prepaid by Company"
                    />
                  </div>
                </TableCell>
                <TableCell>
                  <Button size="sm" onClick={() => createOrderMutation.mutate(row)} disabled={!row.client_id || !row.customer_phone} className="h-8 text-xs">
                    Save
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
