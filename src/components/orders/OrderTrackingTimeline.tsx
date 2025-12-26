import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, Truck, CheckCircle, XCircle, Clock, MapPin, AlertTriangle, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TrackingEvent {
  id: string;
  event_code: string;
  event_description: string;
  location: string | null;
  notes: string | null;
  created_at: string;
}

interface OrderTrackingTimelineProps {
  orderId: string;
  trackingNumber?: string;
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  ORDER_CREATED: <Package className="h-4 w-4" />,
  ORDER_RECEIVED: <Package className="h-4 w-4" />,
  ASSIGNED: <Truck className="h-4 w-4" />,
  DISPATCHED: <Truck className="h-4 w-4" />,
  PICKED_UP: <CheckCircle className="h-4 w-4" />,
  IN_TRANSIT: <Truck className="h-4 w-4" />,
  OUT_FOR_DELIVERY: <Truck className="h-4 w-4" />,
  DELIVERED: <CheckCircle className="h-4 w-4" />,
  DELIVERY_ATTEMPTED: <AlertTriangle className="h-4 w-4" />,
  RETURNED: <RotateCcw className="h-4 w-4" />,
  CANCELLED: <XCircle className="h-4 w-4" />,
  HOLD: <Clock className="h-4 w-4" />,
};

const EVENT_COLORS: Record<string, string> = {
  ORDER_CREATED: "bg-blue-500",
  ORDER_RECEIVED: "bg-blue-500",
  ASSIGNED: "bg-yellow-500",
  DISPATCHED: "bg-yellow-500",
  PICKED_UP: "bg-green-500",
  IN_TRANSIT: "bg-blue-500",
  OUT_FOR_DELIVERY: "bg-orange-500",
  DELIVERED: "bg-green-600",
  DELIVERY_ATTEMPTED: "bg-orange-500",
  RETURNED: "bg-red-500",
  CANCELLED: "bg-red-600",
  HOLD: "bg-gray-500",
};

export function OrderTrackingTimeline({ orderId, trackingNumber }: OrderTrackingTimelineProps) {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["order-tracking-events", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_tracking_events")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as TrackingEvent[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No tracking events yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {trackingNumber && (
        <div className="flex items-center gap-2 pb-4 border-b">
          <span className="text-sm text-muted-foreground">Tracking #:</span>
          <Badge variant="outline" className="font-mono text-lg">
            {trackingNumber}
          </Badge>
        </div>
      )}

      <div className="relative">
        {events.map((event, index) => (
          <div key={event.id} className="flex gap-4 pb-6 last:pb-0">
            {/* Timeline line */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-white",
                  EVENT_COLORS[event.event_code] || "bg-gray-400"
                )}
              >
                {EVENT_ICONS[event.event_code] || <Package className="h-4 w-4" />}
              </div>
              {index < events.length - 1 && (
                <div className="w-0.5 flex-1 bg-border mt-2" />
              )}
            </div>

            {/* Event content */}
            <div className="flex-1 pt-1">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{event.event_description}</p>
                  {event.location && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <MapPin className="h-3 w-3" />
                      {event.location}
                    </div>
                  )}
                  {event.notes && (
                    <p className="text-sm text-muted-foreground mt-1">{event.notes}</p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(event.created_at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
