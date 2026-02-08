import { useState, useRef, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
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
  company_paid_for_order: z.boolean(),
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
  company_paid_for_order: boolean;
};

// Separate component to properly use hooks (refs) for each row
function OrderRow({
  row,
  clients,
  drivers,
  addresses,
  updateRow,
  removeRow,
  addNewRow,
  createOrderMutation,
}: {
  row: NewOrderRow;
  clients: any[];
  drivers: any[];
  addresses: string[];
  updateRow: (id: string, field: keyof NewOrderRow, value: any) => void;
  removeRow: (id: string) => void;
  addNewRow: (duplicateLast?: boolean) => void;
  createOrderMutation: any;
}) {
  const addressRef = useRef<HTMLButtonElement>(null);
  const driverRef = useRef<HTMLButtonElement>(null);
  const amountLbpRef = useRef<HTMLInputElement>(null);
  const amountUsdRef = useRef<HTMLInputElement>(null);
  const feeLbpRef = useRef<HTMLInputElement>(null);
  const feeUsdRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLInputElement>(null);

  const [clientOpen, setClientOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [driverOpen, setDriverOpen] = useState(false);
  const [driverSearch, setDriverSearch] = useState("");
  const [addressOpen, setAddressOpen] = useState(false);
  const [addressSearch, setAddressSearch] = useState("");

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );
  const filteredDrivers = drivers.filter((d) =>
    d.name.toLowerCase().includes(driverSearch.toLowerCase())
  );
  const filteredAddresses = addresses.filter((addr) =>
    typeof addr === 'string' && addr.toLowerCase().includes(addressSearch.toLowerCase())
  );

  const selectedClient = clients.find((c) => c.id === row.client_id);
  const selectedDriver = drivers.find((d) => d.id === row.driver_id);

  const handleClientSelect = useCallback((id: string) => {
    updateRow(row.id, "client_id", id);
    setClientSearch("");
    setClientOpen(false);
    setTimeout(() => addressRef.current?.click(), 0);
  }, [row.id, updateRow]);

  const handleDriverSelect = useCallback((id: string) => {
    updateRow(row.id, "driver_id", id);
    setDriverSearch("");
    setDriverOpen(false);
    setTimeout(() => amountLbpRef.current?.focus(), 0);
  }, [row.id, updateRow]);

  const handleAddressSelect = useCallback((address: string) => {
    updateRow(row.id, "address", address);
    setAddressSearch("");
    setAddressOpen(false);
    setTimeout(() => driverRef.current?.click(), 0);
  }, [row.id, updateRow]);

  return (
    <TableRow 
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
      {/* Client */}
      <TableCell>
        <Popover open={clientOpen} onOpenChange={setClientOpen}>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              className="w-full justify-between h-8 text-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || (e.key.length === 1 && !e.ctrlKey && !e.metaKey)) {
                  e.preventDefault();
                  setClientOpen(true);
                }
              }}
            >
              {selectedClient?.name || "Client"}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0 bg-popover z-50" onOpenAutoFocus={(e) => e.preventDefault()}>
            <Command shouldFilter={false}>
              <CommandInput 
                placeholder="Search..." 
                value={clientSearch}
                onValueChange={setClientSearch}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Tab' && filteredClients.length > 0) {
                    e.preventDefault();
                    handleClientSelect(filteredClients[0].id);
                  }
                }}
              />
              <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>
                <CommandGroup>
                  {filteredClients.map((client) => (
                    <CommandItem key={client.id} onSelect={() => handleClientSelect(client.id)}>
                      <Check className={cn("mr-2 h-4 w-4", row.client_id === client.id ? "opacity-100" : "opacity-0")} />
                      {client.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </TableCell>

      {/* Address */}
      <TableCell>
        <Popover open={addressOpen} onOpenChange={setAddressOpen}>
          <PopoverTrigger asChild>
            <Button 
              ref={addressRef}
              variant="outline" 
              className="w-full justify-between h-8 text-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || (e.key.length === 1 && !e.ctrlKey && !e.metaKey)) {
                  e.preventDefault();
                  setAddressOpen(true);
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
                value={addressSearch}
                onValueChange={setAddressSearch}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Tab') {
                    e.preventDefault();
                    const addr = filteredAddresses.length > 0 ? filteredAddresses[0] : addressSearch;
                    if (addr) handleAddressSelect(addr);
                  }
                }}
              />
              <CommandList>
                <CommandEmpty>
                  <Button variant="ghost" className="w-full text-xs" onClick={() => handleAddressSelect(addressSearch)}>
                    Use "{addressSearch}"
                  </Button>
                </CommandEmpty>
                <CommandGroup>
                  {filteredAddresses.map((address, idx) => (
                    <CommandItem key={idx} onSelect={() => handleAddressSelect(address)}>
                      <Check className={cn("mr-2 h-4 w-4", row.address === address ? "opacity-100" : "opacity-0")} />
                      {address}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </TableCell>

      {/* Driver */}
      <TableCell>
        <Popover open={driverOpen} onOpenChange={setDriverOpen}>
          <PopoverTrigger asChild>
            <Button 
              ref={driverRef}
              variant="outline" 
              className="w-full justify-between h-8 text-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || (e.key.length === 1 && !e.ctrlKey && !e.metaKey)) {
                  e.preventDefault();
                  setDriverOpen(true);
                }
              }}
            >
              {selectedDriver?.name || "Driver"}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0 bg-popover z-50" onOpenAutoFocus={(e) => e.preventDefault()}>
            <Command shouldFilter={false}>
              <CommandInput 
                placeholder="Search..." 
                value={driverSearch}
                onValueChange={setDriverSearch}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Tab' && filteredDrivers.length > 0) {
                    e.preventDefault();
                    handleDriverSelect(filteredDrivers[0].id);
                  }
                }}
              />
              <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>
                <CommandGroup>
                  {filteredDrivers.map((driver) => (
                    <CommandItem key={driver.id} onSelect={() => handleDriverSelect(driver.id)}>
                      <Check className={cn("mr-2 h-4 w-4", row.driver_id === driver.id ? "opacity-100" : "opacity-0")} />
                      {driver.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </TableCell>

      {/* Amount LBP */}
      <TableCell>
        <CurrencyInput
          ref={amountLbpRef}
          currency="LBP"
          value={row.order_amount_lbp}
          onChange={(val) => updateRow(row.id, "order_amount_lbp", val)}
        />
      </TableCell>

      {/* Amount USD */}
      <TableCell className="border-r border-border">
        <CurrencyInput
          ref={amountUsdRef}
          currency="USD"
          value={row.order_amount_usd}
          onChange={(val) => updateRow(row.id, "order_amount_usd", val)}
        />
      </TableCell>

      {/* Fee LBP */}
      <TableCell className="bg-muted/30">
        <CurrencyInput
          ref={feeLbpRef}
          currency="LBP"
          value={row.delivery_fee_lbp}
          onChange={(val) => updateRow(row.id, "delivery_fee_lbp", val)}
        />
      </TableCell>

      {/* Fee USD */}
      <TableCell className="bg-muted/30 border-r border-border">
        <CurrencyInput
          ref={feeUsdRef}
          currency="USD"
          value={row.delivery_fee_usd}
          onChange={(val) => updateRow(row.id, "delivery_fee_usd", val)}
        />
      </TableCell>

      {/* Notes */}
      <TableCell>
        <Input 
          ref={notesRef}
          value={row.notes} 
          onChange={(e) => updateRow(row.id, "notes", e.target.value)} 
          className="h-8 text-xs"
        />
      </TableCell>

      {/* Driver Paid */}
      <TableCell>
        <div className="flex justify-center">
          <Checkbox 
            checked={row.driver_paid_for_client}
            onCheckedChange={(checked) => {
              const next = checked === true;
              if (next) {
                updateRow(row.id, "driver_paid_for_client", true);
                updateRow(row.id, "company_paid_for_order", false);
              } else {
                updateRow(row.id, "driver_paid_for_client", false);
              }
            }}
            title="Driver paid for client"
          />
        </div>
      </TableCell>

      {/* Company Paid */}
      <TableCell>
        <div className="flex justify-center">
          <Checkbox 
            checked={row.company_paid_for_order}
            onCheckedChange={(checked) => {
              const next = checked === true;
              if (next) {
                updateRow(row.id, "company_paid_for_order", true);
                updateRow(row.id, "driver_paid_for_client", false);
              } else {
                updateRow(row.id, "company_paid_for_order", false);
              }
            }}
            title="Company paid from cashbox"
          />
        </div>
      </TableCell>

      {/* Actions */}
      <TableCell>
        <div className="flex gap-1">
          <Button 
            size="sm" 
            onClick={() => createOrderMutation.mutate(row)} 
            disabled={!row.client_id || !row.address} 
            className="h-8 text-xs"
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
}

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
      company_paid_for_order: false,
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
      company_paid_for_order: lastRow.company_paid_for_order,
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
      company_paid_for_order: false,
    };
    
    setNewRows((prev) => [...prev, newRow]);
  };

  const updateRow = (id: string, field: keyof NewOrderRow, value: any) => {
    setNewRows((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const removeRow = (id: string) => {
    setNewRows((prev) => prev.filter((row) => row.id !== id));
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
        company_paid_for_order: rowData.company_paid_for_order,
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
        company_paid_for_order: validatedData.company_paid_for_order,
      };

      // If driver paid for client, set the paid amounts based on order amounts
      if (validatedData.driver_paid_for_client) {
        orderData.driver_paid_amount_usd = validatedData.order_amount_usd;
        orderData.driver_paid_amount_lbp = validatedData.order_amount_lbp;
        if (validatedData.notes) {
          orderData.driver_paid_reason = validatedData.notes;
        }
      }
      
      // If company paid from cashbox, also set the paid amounts and debit cashbox
      if (validatedData.company_paid_for_order) {
        orderData.driver_paid_amount_usd = validatedData.order_amount_usd;
        orderData.driver_paid_amount_lbp = validatedData.order_amount_lbp;
        
        // Debit cashbox atomically when company pays for the order
        const today = new Date().toISOString().split('T')[0];
        const { error: cashboxError } = await (supabase.rpc as any)('update_cashbox_atomic', {
          p_date: today,
          p_cash_in_usd: 0,
          p_cash_in_lbp: 0,
          p_cash_out_usd: validatedData.order_amount_usd,
          p_cash_out_lbp: validatedData.order_amount_lbp,
        });
        
        if (cashboxError) {
          throw new Error('Failed to update cashbox: ' + cashboxError.message);
        }
      }

      const { error } = await supabase.from("orders").insert(orderData);

      if (error) throw error;
      return rowData.id;
    },
    onSuccess: (rowId, variables) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["instant-orders"] });
      if (variables.company_paid_for_order) {
        queryClient.invalidateQueries({ queryKey: ["cashbox"] });
      }
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
            company_paid_for_order: false,
          }];
        }
        return filtered;
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });


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
              <TableHead className="w-[130px]">Client</TableHead>
              <TableHead className="w-[140px]">Address</TableHead>
              <TableHead className="w-[120px]">Driver</TableHead>
              <TableHead className="w-[130px]">Amount LBP</TableHead>
              <TableHead className="w-[100px] border-r border-border">Amount USD</TableHead>
              <TableHead className="w-[130px] bg-muted/50 text-primary">Fee LBP</TableHead>
              <TableHead className="w-[100px] bg-muted/50 text-primary border-r border-border">Fee USD</TableHead>
              <TableHead className="w-[120px]">Notes</TableHead>
              <TableHead className="w-[60px]" title="Driver paid for client">DRV</TableHead>
              <TableHead className="w-[60px]" title="Company paid from cashbox">CO</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {newRows.map((row) => (
              <OrderRow
                key={row.id}
                row={row}
                clients={clients}
                drivers={drivers}
                addresses={addresses}
                updateRow={updateRow}
                removeRow={removeRow}
                addNewRow={addNewRow}
                createOrderMutation={createOrderMutation}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
