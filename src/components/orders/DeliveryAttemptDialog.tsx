import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface DeliveryAttemptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderRef: string;
  currentAttempts: number;
  driverId?: string;
}

const FAILURE_REASONS = [
  { code: "NOT_HOME", label: "Customer not at home" },
  { code: "WRONG_ADDRESS", label: "Wrong/incomplete address" },
  { code: "REFUSED", label: "Customer refused delivery" },
  { code: "NO_PAYMENT", label: "Customer unable to pay COD" },
  { code: "CLOSED", label: "Business/location closed" },
  { code: "INACCESSIBLE", label: "Location inaccessible" },
  { code: "DAMAGED", label: "Package damaged" },
  { code: "CUSTOMER_REQUEST", label: "Customer requested reschedule" },
  { code: "WEATHER", label: "Weather conditions" },
  { code: "OTHER", label: "Other reason" },
];

export function DeliveryAttemptDialog({
  open,
  onOpenChange,
  orderId,
  orderRef,
  currentAttempts,
  driverId,
}: DeliveryAttemptDialogProps) {
  const queryClient = useQueryClient();
  const [failureCode, setFailureCode] = useState("");
  const [notes, setNotes] = useState("");
  const [nextAttemptDate, setNextAttemptDate] = useState<Date | undefined>(undefined);

  const recordAttemptMutation = useMutation({
    mutationFn: async () => {
      const failureReason = FAILURE_REASONS.find(r => r.code === failureCode)?.label || failureCode;
      const attemptNumber = currentAttempts + 1;

      // 1. Create delivery attempt record
      const { error: attemptError } = await supabase
        .from("delivery_attempts")
        .insert({
          order_id: orderId,
          attempt_number: attemptNumber,
          driver_id: driverId || null,
          status: "failed",
          failure_code: failureCode,
          failure_reason: failureReason,
          notes: notes || null,
          next_attempt_date: nextAttemptDate ? format(nextAttemptDate, "yyyy-MM-dd") : null,
        });

      if (attemptError) throw attemptError;

      // 2. Update order with attempt count and failure reason
      const { error: orderError } = await supabase
        .from("orders")
        .update({
          delivery_attempts: attemptNumber,
          last_attempt_date: new Date().toISOString(),
          failure_reason: failureReason,
        })
        .eq("id", orderId);

      if (orderError) throw orderError;

      // 3. Add tracking event
      const { error: trackingError } = await supabase
        .from("order_tracking_events")
        .insert({
          order_id: orderId,
          event_code: "DELIVERY_ATTEMPTED",
          event_description: `Delivery attempt #${attemptNumber} failed: ${failureReason}`,
          notes: nextAttemptDate ? `Next attempt scheduled: ${format(nextAttemptDate, "MMM dd, yyyy")}` : null,
        });

      if (trackingError) throw trackingError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["ecom-orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-tracking-events", orderId] });
      toast.success("Delivery attempt recorded");
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFailureCode("");
    setNotes("");
    setNextAttemptDate(undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Failed Delivery Attempt</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm">
              Order: <span className="font-medium">{orderRef}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              This will be attempt #{currentAttempts + 1}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Failure Reason *</Label>
            <Select value={failureCode} onValueChange={setFailureCode}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason..." />
              </SelectTrigger>
              <SelectContent>
                {FAILURE_REASONS.map((reason) => (
                  <SelectItem key={reason.code} value={reason.code}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Next Attempt Date (Optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !nextAttemptDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {nextAttemptDate ? format(nextAttemptDate, "PPP") : "Schedule next attempt"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={nextAttemptDate}
                  onSelect={setNextAttemptDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Additional Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional details about the failed attempt..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={() => recordAttemptMutation.mutate()}
              disabled={!failureCode || recordAttemptMutation.isPending}
            >
              {recordAttemptMutation.isPending ? "Recording..." : "Record Attempt"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
