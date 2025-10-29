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

  const { data: addresses = [] } = useQuery({
    queryKey: ["address-areas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("address_areas")
        .select("name")
        .order("name");
      if (error) throw error;
      return data.map((area) => area.name).filter((name): name is string => typeof name === 'string' && name.length > 0);
    },
  });

  const addNewRow = () => {
    setNewRows([
      ...newRows,
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
      },
    ]);
  };

  const updateRow = (id: string, field: keyof NewOrderRow, value: any) => {
    setNewRows(newRows.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const createOrderMutation = useMutation({
    mutationFn: async (rowData: NewOrderRow) => {
      const { data: client } = await supabase.from("clients").select("*, client_rules(*)").eq("id", rowData.client_id).single();
      if (!client) throw new Error("Client not found");

      const prefix = client.name.substring(0, 3).toUpperCase();
      const timestamp = Date.now().toString().slice(-6);
      const order_id = `${prefix}-${timestamp}`;

      const { error } = await supabase.from("orders").insert({
        order_id,
        order_type: "instant",
        client_id: rowData.client_id,
        client_type: client.type,
        fulfillment: "InHouse",
        driver_id: rowData.driver_id || null,
        order_amount_usd: parseFloat(rowData.order_amount_usd) || 0,
        order_amount_lbp: parseFloat(rowData.order_amount_lbp) || 0,
        delivery_fee_usd: parseFloat(rowData.delivery_fee_usd) || 0,
        delivery_fee_lbp: parseFloat(rowData.delivery_fee_lbp) || 0,
        client_fee_rule: client.client_rules?.[0]?.fee_rule || "ADD_ON",
        status: "New",
        address: rowData.address,
        notes: rowData.notes || null,
      });

      if (error) throw error;
      return rowData.id;
    },
    onSuccess: (rowId) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["instant-orders"] });
      toast.success("Order created");
      setNewRows((currentRows) => {
        const filtered = currentRows.filter((r) => r.id !== rowId);
        // If we just removed the last row, add a new empty one
        if (filtered.length === 0) {
          return [{
            id: `new-${Date.now()}`,
            client_id: "",
            address: "",
            driver_id: "",
            order_amount_usd: "",
            order_amount_lbp: "",
            delivery_fee_usd: "",
            delivery_fee_lbp: "",
            notes: "",
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
        <Button onClick={addNewRow} size="sm" variant="outline" tabIndex={-1}>
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
              <TableHead className="w-[100px]">Amount USD</TableHead>
              <TableHead className="w-[100px]">Amount LBP</TableHead>
              <TableHead className="w-[90px]">Fee USD</TableHead>
              <TableHead className="w-[90px]">Fee LBP</TableHead>
              <TableHead className="w-[150px]">Notes</TableHead>
              <TableHead className="w-[80px]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {newRows.map((row, rowIndex) => {
              const baseTabIndex = rowIndex * 100;
              return (
                <TableRow key={row.id} className="bg-accent/20">
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
                      step="0.01"
                      value={row.order_amount_usd}
                      onChange={(e) => updateRow(row.id, "order_amount_usd", e.target.value)}
                      className="h-8 text-xs"
                      tabIndex={baseTabIndex + 4}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="1"
                      value={row.order_amount_lbp}
                      onChange={(e) => updateRow(row.id, "order_amount_lbp", e.target.value)}
                      className="h-8 text-xs"
                      tabIndex={baseTabIndex + 5}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      value={row.delivery_fee_usd}
                      onChange={(e) => updateRow(row.id, "delivery_fee_usd", e.target.value)}
                      className="h-8 text-xs"
                      tabIndex={baseTabIndex + 6}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="1"
                      value={row.delivery_fee_lbp}
                      onChange={(e) => updateRow(row.id, "delivery_fee_lbp", e.target.value)}
                      className="h-8 text-xs"
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
                    <Button 
                      size="sm" 
                      onClick={() => createOrderMutation.mutate(row)} 
                      disabled={!row.client_id || !row.address} 
                      className="h-8 text-xs"
                      tabIndex={baseTabIndex + 9}
                    >
                      Save
                    </Button>
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
