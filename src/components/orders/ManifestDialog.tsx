import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Printer, FileText, Truck } from "lucide-react";
import { format } from "date-fns";

interface ManifestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedOrderIds: string[];
  onSuccess?: () => void;
}

export function ManifestDialog({
  open,
  onOpenChange,
  selectedOrderIds,
  onSuccess,
}: ManifestDialogProps) {
  const queryClient = useQueryClient();
  const [selectedDriver, setSelectedDriver] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select("*")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: selectedOrders = [] } = useQuery({
    queryKey: ["selected-orders-manifest", selectedOrderIds],
    queryFn: async () => {
      if (selectedOrderIds.length === 0) return [];
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          clients(name),
          customers(phone, name, address)
        `)
        .in("id", selectedOrderIds);
      if (error) throw error;
      return data;
    },
    enabled: selectedOrderIds.length > 0,
  });

  const totalCodUsd = selectedOrders.reduce((sum, o) => sum + (o.order_amount_usd || 0), 0);
  const totalCodLbp = selectedOrders.reduce((sum, o) => sum + (o.order_amount_lbp || 0), 0);

  const createManifestMutation = useMutation({
    mutationFn: async () => {
      // 1. Generate manifest number
      const { data: manifestNumber } = await supabase.rpc("generate_manifest_number");

      // 2. Create manifest
      const { data: manifest, error: manifestError } = await supabase
        .from("driver_manifests")
        .insert({
          manifest_number: manifestNumber,
          driver_id: selectedDriver,
          manifest_date: new Date().toISOString().split("T")[0],
          status: "pending",
          total_orders: selectedOrderIds.length,
          total_cod_usd: totalCodUsd,
          total_cod_lbp: totalCodLbp,
        })
        .select()
        .single();

      if (manifestError) throw manifestError;

      // 3. Link orders to manifest
      const manifestOrders = selectedOrderIds.map((orderId, index) => ({
        manifest_id: manifest.id,
        order_id: orderId,
        sequence_number: index + 1,
        pickup_or_delivery: "delivery",
        status: "pending",
      }));

      const { error: linkError } = await supabase
        .from("manifest_orders")
        .insert(manifestOrders);

      if (linkError) throw linkError;

      // 4. Update orders with manifest_id and assign driver
      const { error: orderError } = await supabase
        .from("orders")
        .update({
          manifest_id: manifest.id,
          driver_id: selectedDriver,
          status: "Assigned",
          fulfillment: "InHouse",
        })
        .in("id", selectedOrderIds);

      if (orderError) throw orderError;

      // 5. Add tracking events for all orders
      const trackingEvents = selectedOrderIds.map((orderId) => ({
        order_id: orderId,
        event_code: "DISPATCHED",
        event_description: `Added to manifest ${manifestNumber}`,
        notes: `Driver assigned for delivery`,
      }));

      await supabase.from("order_tracking_events").insert(trackingEvents);

      return manifest;
    },
    onSuccess: (manifest) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["ecom-orders"] });
      queryClient.invalidateQueries({ queryKey: ["driver-manifests"] });
      toast.success(`Manifest ${manifest.manifest_number} created`);
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handlePrint = () => {
    if (printRef.current) {
      const printContent = printRef.current.innerHTML;
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Delivery Manifest</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
                th { background-color: #f4f4f4; }
                .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
                .title { font-size: 24px; font-weight: bold; }
                .summary { margin-top: 20px; padding: 10px; background: #f9f9f9; }
                .signature-line { margin-top: 40px; border-top: 1px solid #000; width: 200px; }
                @media print { body { -webkit-print-color-adjust: exact; } }
              </style>
            </head>
            <body>
              ${printContent}
              <div style="margin-top: 60px; display: flex; justify-content: space-between;">
                <div>
                  <div class="signature-line"></div>
                  <p>Driver Signature</p>
                </div>
                <div>
                  <div class="signature-line"></div>
                  <p>Dispatcher Signature</p>
                </div>
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  const selectedDriverData = drivers.find((d) => d.id === selectedDriver);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Create Delivery Manifest / Runsheet
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Assign Driver *</Label>
              <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                <SelectTrigger>
                  <SelectValue placeholder="Select driver..." />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Manifest Date</Label>
              <div className="p-2 bg-muted rounded text-sm">
                {format(new Date(), "EEEE, MMMM dd, yyyy")}
              </div>
            </div>
          </div>

          {/* Preview / Print Content */}
          <div ref={printRef} className="border rounded-lg p-4">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold">Delivery Manifest</h2>
                <p className="text-sm text-muted-foreground">
                  Date: {format(new Date(), "MMM dd, yyyy")}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">
                  Driver: {selectedDriverData?.name || "Not assigned"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Total Orders: {selectedOrders.length}
                </p>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Voucher/AWB</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className="text-right">COD USD</TableHead>
                  <TableHead className="w-20">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedOrders.map((order, index) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {order.tracking_number || order.voucher_no || order.order_id.slice(0, 8)}
                    </TableCell>
                    <TableCell>{order.clients?.name}</TableCell>
                    <TableCell>{order.customers?.name || "-"}</TableCell>
                    <TableCell>{order.customers?.phone || "-"}</TableCell>
                    <TableCell className="max-w-[150px] truncate">
                      {order.address}
                    </TableCell>
                    <TableCell className="text-right">
                      ${order.order_amount_usd?.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        ☐
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-4 p-3 bg-muted rounded-lg grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total Orders:</span>
                <span className="font-medium ml-2">{selectedOrders.length}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Total COD (USD):</span>
                <span className="font-medium ml-2">${totalCodUsd.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Total COD (LBP):</span>
                <span className="font-medium ml-2">{totalCodLbp.toLocaleString()} LL</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print Preview
            </Button>
            <Button
              onClick={() => createManifestMutation.mutate()}
              disabled={!selectedDriver || createManifestMutation.isPending}
            >
              <Truck className="h-4 w-4 mr-2" />
              {createManifestMutation.isPending ? "Creating..." : "Create & Dispatch"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
