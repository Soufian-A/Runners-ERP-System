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
import { z } from "zod";

// Validation schema for instant order creation
const instantOrderSchema = z.object({
  client_id: z.string().uuid("Invalid client selected"),
  address: z.string().min(1, "Address is required").max(500, "Address is too long"),
  driver_id: z.string().uuid().optional().or(z.literal("")),
  order_amount_usd: z.number().min(0, "Amount must be non-negative"),
  order_amount_lbp: z.number().min(0, "Amount must be non-negative"),
  delivery_fee_usd: z.number().min(0, "Fee must be non-negative"),
  delivery_fee_lbp: z.number().min(0, "Fee must be non-negative"),
  notes: z.string().max(1000, "Notes are too long").optional(),
  driver_paid_for_client: z.boolean(),
});
type NewOrderRow = {
  id: string;
  client_id: string;
  address: string;
  driver_id: string;
  order_amount_usd: string;
  order_amount_lbp: string;
  delivery_fee_usd: string;
  delivery_fee_lbp: string;
  notes: string;
  driver_paid_for_client: boolean;
};

export function InstantOrderForm() {
  const queryClient = useQueryClient();
  const [newRows, setNewRows] = useState<NewOrderRow[]>([
    {
      id: `new-${Date.now()}`,
      client_id: "",
      address: "",
      driver_id: "",
      order_amount_usd: "",
      order_amount_lbp: "",
      delivery_fee_usd: "",
      delivery_fee_lbp: "",
      notes: "",
      driver_paid_for_client: false,
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

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("drivers").select("*").eq("active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: addresses = [], isLoading: addressesLoading } = useQuery({
    queryKey: ["address-areas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("address_areas")
        .select("name")
        .order("name");
      if (error) {
        console.error("Error fetching address areas:", error);
        throw error;
      }
      return data.map((area) => area.name).filter((name): name is string => typeof name === 'string' && name.length > 0);
    },
  });

  const addNewRow = (duplicateLast = false) => {
    const lastRow = newRows[newRows.length - 1];
    const newRow: NewOrderRow = duplicateLast && lastRow ? {
      id: `new-${Date.now()}`,
      client_id: lastRow.client_id,
      address: lastRow.address,
      driver_id: lastRow.driver_id,
      order_amount_usd: lastRow.order_amount_usd,
      order_amount_lbp: lastRow.order_amount_lbp,
      delivery_fee_usd: lastRow.delivery_fee_usd,
      delivery_fee_lbp: lastRow.delivery_fee_lbp,
      notes: "",
      driver_paid_for_client: lastRow.driver_paid_for_client,
    } : {
      id: `new-${Date.now()}`,
      client_id: lastRow?.client_id || "",
      address: lastRow?.address || "",
      driver_id: lastRow?.driver_id || "",
      order_amount_usd: "",
      order_amount_lbp: "",
      delivery_fee_usd: lastRow?.delivery_fee_usd || "",
      delivery_fee_lbp: lastRow?.delivery_fee_lbp || "",
      notes: "",
      driver_paid_for_client: false,
    };
    
    setNewRows([...newRows, newRow]);
  };

  const updateRow = (id: string, field: keyof NewOrderRow, value: any) => {
    setNewRows(newRows.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const removeRow = (id: string) => {
    setNewRows(newRows.filter(row => row.id !== id));
  };

  const createOrderMutation = useMutation({
    mutationFn: async (rowData: NewOrderRow) => {
      // Validate input data before processing
      const validationData = {
        client_id: rowData.client_id,
        address: rowData.address.trim(),
        driver_id: rowData.driver_id || "",
        order_amount_usd: parseFloat(rowData.order_amount_usd) || 0,
        order_amount_lbp: parseFloat(rowData.order_amount_lbp) || 0,
        delivery_fee_usd: parseFloat(rowData.delivery_fee_usd) || 0,
        delivery_fee_lbp: parseFloat(rowData.delivery_fee_lbp) || 0,
        notes: rowData.notes?.trim() || "",
        driver_paid_for_client: rowData.driver_paid_for_client,
      };

      const validationResult = instantOrderSchema.safeParse(validationData);
      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        throw new Error(firstError.message);
      }

      const validatedData = validationResult.data;

      const { data: client } = await supabase.from("clients").select("*, client_rules(*)").eq("id", validatedData.client_id).single();
      if (!client) throw new Error("Client not found");

      const prefix = client.name.substring(0, 3).toUpperCase();
      const timestamp = Date.now().toString().slice(-6);
      const order_id = `${prefix}-${timestamp}`;

      const clientFeeRule = client.client_rules?.[0]?.fee_rule || "ADD_ON";

      const orderData: any = {
        order_id,
        order_type: "instant",
        client_id: validatedData.client_id,
        client_type: client.type,
        fulfillment: "InHouse",
        driver_id: validatedData.driver_id || null,
        order_amount_usd: validatedData.order_amount_usd,
        order_amount_lbp: validatedData.order_amount_lbp,
        delivery_fee_usd: validatedData.delivery_fee_usd,
        delivery_fee_lbp: validatedData.delivery_fee_lbp,
        client_fee_rule: clientFeeRule,
        status: "New",
        address: validatedData.address,
        notes: validatedData.notes || null,
        driver_paid_for_client: validatedData.driver_paid_for_client,
      };

      // If driver paid for client, set the paid amounts based on order amounts
      if (validatedData.driver_paid_for_client) {
        orderData.driver_paid_amount_usd = validatedData.order_amount_usd;
        orderData.driver_paid_amount_lbp = validatedData.order_amount_lbp;
        if (validatedData.notes) {
          orderData.driver_paid_reason = validatedData.notes;
        }
      }

      const { error } = await supabase.from("orders").insert(orderData);

      if (error) throw error;
      return rowData.id;
    },
    onSuccess: (rowId) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["instant-orders"] });
      toast.success("Order created");
      setNewRows((currentRows) => {
        const filtered = currentRows.filter((r) => r.id !== rowId);
        // If we just removed the last row, add a new one with pre-filled values
        if (filtered.length === 0) {
          const savedRow = currentRows.find((r) => r.id === rowId);
          return [{
            id: `new-${Date.now()}`,
            client_id: savedRow?.client_id || "",
            address: savedRow?.address || "",
            driver_id: savedRow?.driver_id || "",
            order_amount_usd: "",
            order_amount_lbp: "",
            delivery_fee_usd: savedRow?.delivery_fee_usd || "",
            delivery_fee_lbp: savedRow?.delivery_fee_lbp || "",
            notes: "",
            driver_paid_for_client: false,
          }];
        }
        return filtered;
      });
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
    tabIndex,
  }: {
    value: string;
    onSelect: (id: string) => void;
    items: any[];
    placeholder: string;
    tabIndex?: number;
  }) => {
    const [open, setOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const selected = items.find((item) => item.id === value);

    const filteredItems = items.filter((item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleTabSelect = () => {
      if (filteredItems.length > 0) {
        onSelect(filteredItems[0].id);
        setSearchTerm("");
        setOpen(false);
        return true;
      }
      return false;
    };

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            className="w-full justify-between h-8 text-xs"
            tabIndex={tabIndex}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || (e.key.length === 1 && !e.ctrlKey && !e.metaKey)) {
                e.preventDefault();
                setOpen(true);
              }
            }}
          >
            {selected?.name || placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0 bg-popover z-50" onOpenAutoFocus={(e) => e.preventDefault()}>
          <Command shouldFilter={false}>
            <CommandInput 
              placeholder="Search..." 
              value={searchTerm}
              onValueChange={setSearchTerm}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Tab') {
                  e.preventDefault();
                  handleTabSelect();
                }
              }}
            />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {filteredItems.map((item) => (
                  <CommandItem
                    key={item.id}
                    onSelect={() => {
                      onSelect(item.id);
                      setOpen(false);
                      setSearchTerm("");
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

  const AddressField = ({ row, tabIndex }: { row: NewOrderRow; tabIndex?: number }) => {
    const [open, setOpen] = useState(false);
    const [searchValue, setSearchValue] = useState("");

    const filteredAddresses = addresses.filter((addr): addr is string =>
      typeof addr === 'string' && addr.toLowerCase().includes(searchValue.toLowerCase())
    );

    const handleTabSelect = () => {
      const addressToUse = filteredAddresses.length > 0 
        ? filteredAddresses[0]
        : searchValue;
      
      if (addressToUse) {
        updateRow(row.id, "address", addressToUse);
        setSearchValue("");
        setOpen(false);
        return true;
      }
      return false;
    };

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            className="w-full justify-between h-8 text-xs"
            tabIndex={tabIndex}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || (e.key.length === 1 && !e.ctrlKey && !e.metaKey)) {
                e.preventDefault();
                setOpen(true);
              }
            }}
          >
            {row.address || "Address..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0 bg-popover z-50" onOpenAutoFocus={(e) => e.preventDefault()}>
          <Command shouldFilter={false}>
            <CommandInput 
              placeholder="Type address..." 
              value={searchValue}
              onValueChange={setSearchValue}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Tab') {
                  e.preventDefault();
                  handleTabSelect();
                }
              }}
            />
            <CommandList>
              <CommandEmpty>
                <Button 
                  variant="ghost" 
                  className="w-full text-xs" 
                  onClick={() => {
                    updateRow(row.id, "address", searchValue);
                    setOpen(false);
                    setSearchValue("");
                  }}
                >
                  Use "{searchValue}"
                </Button>
              </CommandEmpty>
              <CommandGroup>
                {filteredAddresses.map((address, idx) => (
                  <CommandItem
                    key={idx}
                    onSelect={() => {
                      updateRow(row.id, "address", address);
                      setOpen(false);
                      setSearchValue("");
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", row.address === address ? "opacity-100" : "opacity-0")} />
                    {address}
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
        <h3 className="text-sm font-semibold">Quick Instant Order Entry</h3>
        <Button onClick={() => addNewRow(false)} size="sm" variant="outline" tabIndex={-1}>
          <Plus className="h-4 w-4 mr-1" />
          Add Row
        </Button>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">Client</TableHead>
              <TableHead className="w-[180px]">Address</TableHead>
              <TableHead className="w-[150px]">Driver</TableHead>
              <TableHead className="w-[100px]">Amount LBP</TableHead>
              <TableHead className="w-[100px]">Amount USD</TableHead>
              <TableHead className="w-[90px]">Fee LBP</TableHead>
              <TableHead className="w-[90px]">Fee USD</TableHead>
              <TableHead className="w-[150px]">Notes</TableHead>
              <TableHead className="w-[80px]">Driver Paid</TableHead>
              <TableHead className="w-[140px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {newRows.map((row, rowIndex) => {
              const baseTabIndex = rowIndex * 100;
              return (
                <TableRow 
                  key={row.id} 
                  className="bg-accent/20"
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                      e.preventDefault();
                      addNewRow(true);
                    } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      e.preventDefault();
                      if (row.client_id && row.address) {
                        createOrderMutation.mutate(row);
                      }
                    }
                  }}
                >
                  <TableCell>
                    <ComboboxField 
                      value={row.client_id} 
                      onSelect={(id) => updateRow(row.id, "client_id", id)} 
                      items={clients} 
                      placeholder="Client"
                      tabIndex={baseTabIndex + 1}
                    />
                  </TableCell>
                  <TableCell>
                    <AddressField row={row} tabIndex={baseTabIndex + 2} />
                  </TableCell>
                  <TableCell>
                    <ComboboxField 
                      value={row.driver_id} 
                      onSelect={(id) => updateRow(row.id, "driver_id", id)} 
                      items={drivers} 
                      placeholder="Driver"
                      tabIndex={baseTabIndex + 3}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="1"
                      value={row.order_amount_lbp}
                      onChange={(e) => updateRow(row.id, "order_amount_lbp", e.target.value)}
                      className="h-8 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      tabIndex={baseTabIndex + 4}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      value={row.order_amount_usd}
                      onChange={(e) => updateRow(row.id, "order_amount_usd", e.target.value)}
                      className="h-8 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      tabIndex={baseTabIndex + 5}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="1"
                      value={row.delivery_fee_lbp}
                      onChange={(e) => updateRow(row.id, "delivery_fee_lbp", e.target.value)}
                      className="h-8 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      tabIndex={baseTabIndex + 6}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      value={row.delivery_fee_usd}
                      onChange={(e) => updateRow(row.id, "delivery_fee_usd", e.target.value)}
                      className="h-8 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      tabIndex={baseTabIndex + 7}
                    />
                  </TableCell>
                  <TableCell>
                    <Input 
                      value={row.notes} 
                      onChange={(e) => updateRow(row.id, "notes", e.target.value)} 
                      className="h-8 text-xs"
                      tabIndex={baseTabIndex + 8}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center">
                      <Checkbox 
                        checked={row.driver_paid_for_client}
                        onCheckedChange={(checked) => updateRow(row.id, "driver_paid_for_client", checked)}
                        title="Driver paid for client"
                        tabIndex={baseTabIndex + 9}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button 
                        size="sm" 
                        onClick={() => createOrderMutation.mutate(row)} 
                        disabled={!row.client_id || !row.address} 
                        className="h-8 text-xs"
                        tabIndex={baseTabIndex + 10}
                      >
                        Save
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => removeRow(row.id)} 
                        className="h-8 text-xs"
                        tabIndex={-1}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
