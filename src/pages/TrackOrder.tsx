import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OrderTrackingTimeline } from "@/components/orders/OrderTrackingTimeline";
import { Package, Search, MapPin, Phone, User, Building, Calendar, Truck } from "lucide-react";

export default function TrackOrder() {
  const [searchInput, setSearchInput] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");

  const { data: order, isLoading, error } = useQuery({
    queryKey: ["track-order", trackingNumber],
    queryFn: async () => {
      if (!trackingNumber) return null;

      // Search by tracking number, voucher_no, or order_id
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          clients(name),
          customers(phone, name),
          delivery_zones(name, code)
        `)
        .or(`tracking_number.eq.${trackingNumber},voucher_no.eq.${trackingNumber},order_id.eq.${trackingNumber}`)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null; // Not found
        throw error;
      }
      return data;
    },
    enabled: !!trackingNumber,
  });

  const handleSearch = () => {
    setTrackingNumber(searchInput.trim().toUpperCase());
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      New: "bg-blue-500",
      Assigned: "bg-yellow-500",
      PickedUp: "bg-orange-500",
      Delivered: "bg-green-600",
      Returned: "bg-red-500",
      Cancelled: "bg-gray-500",
    };
    return colors[status] || "bg-gray-400";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
              <Package className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">Track Your Order</h1>
          <p className="text-muted-foreground">
            Enter your tracking number to see the delivery status
          </p>
        </div>

        {/* Search Box */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Enter tracking number, voucher, or order ID..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-10 text-lg h-12"
                />
              </div>
              <Button onClick={handleSearch} size="lg" className="h-12 px-8">
                Track
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {isLoading && (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p>Searching for your order...</p>
            </CardContent>
          </Card>
        )}

        {/* Not Found State */}
        {trackingNumber && !isLoading && !order && (
          <Card>
            <CardContent className="p-12 text-center">
              <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-xl font-semibold mb-2">Order Not Found</h3>
              <p className="text-muted-foreground">
                We couldn't find an order with tracking number "{trackingNumber}".
                <br />
                Please check the number and try again.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Order Found */}
        {order && (
          <div className="space-y-6">
            {/* Order Summary Card */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Order {order.tracking_number || order.voucher_no || order.order_id}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Placed on {new Date(order.created_at).toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <Badge className={`${getStatusColor(order.status)} text-white`}>
                    {order.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <Building className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Shipped by</p>
                        <p className="font-medium">{order.clients?.name}</p>
                      </div>
                    </div>
                    {order.customers?.name && (
                      <div className="flex items-start gap-2">
                        <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Recipient</p>
                          <p className="font-medium">{order.customers.name}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Delivery Address</p>
                        <p className="font-medium">{order.address}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {order.delivery_zones && (
                      <div className="flex items-start gap-2">
                        <Truck className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Delivery Zone</p>
                          <p className="font-medium">
                            {order.delivery_zones.name} ({order.delivery_zones.code})
                          </p>
                        </div>
                      </div>
                    )}
                    {order.promised_date && (
                      <div className="flex items-start gap-2">
                        <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Expected Delivery</p>
                          <p className="font-medium">
                            {new Date(order.promised_date).toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                    )}
                    {order.delivery_attempts > 0 && (
                      <div className="p-2 bg-orange-50 dark:bg-orange-950 rounded border border-orange-200 dark:border-orange-800">
                        <p className="text-sm text-orange-600 dark:text-orange-400">
                          Delivery attempted {order.delivery_attempts} time(s)
                          {order.failure_reason && `: ${order.failure_reason}`}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tracking Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Tracking History</CardTitle>
              </CardHeader>
              <CardContent>
                <OrderTrackingTimeline orderId={order.id} />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12 text-sm text-muted-foreground">
          <p>Need help? Contact us for assistance with your delivery.</p>
        </div>
      </div>
    </div>
  );
}
