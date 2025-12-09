import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, DollarSign, Users, Package, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

interface Alert {
  id: string;
  type: "error" | "warning" | "info";
  title: string;
  description: string;
  count?: number;
  action?: { label: string; path: string };
}

export function AlertsWidget() {
  const navigate = useNavigate();

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["dashboard-alerts"],
    queryFn: async () => {
      const alertsList: Alert[] = [];

      // Check for drivers with negative balance (they owe us money)
      const { data: driversOwing } = await supabase
        .from("drivers")
        .select("id, name, wallet_usd, wallet_lbp")
        .or("wallet_usd.lt.0,wallet_lbp.lt.0");

      if (driversOwing && driversOwing.length > 0) {
        alertsList.push({
          id: "drivers-negative-balance",
          type: "warning",
          title: "Drivers with Negative Balance",
          description: `${driversOwing.length} driver(s) owe cash to the company`,
          count: driversOwing.length,
          action: { label: "View Drivers", path: "/drivers" },
        });
      }

      // Check for pending remittances
      const { data: pendingRemit, count: pendingCount } = await supabase
        .from("orders")
        .select("id", { count: "exact" })
        .eq("status", "Delivered")
        .eq("driver_remit_status", "Pending");

      if (pendingCount && pendingCount > 0) {
        alertsList.push({
          id: "pending-remittance",
          type: "warning",
          title: "Pending Remittances",
          description: `${pendingCount} delivered order(s) awaiting driver remittance`,
          count: pendingCount,
          action: { label: "View Drivers", path: "/drivers" },
        });
      }

      // Check for orders assigned but not picked up for over 2 hours
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data: staleOrders, count: staleCount } = await supabase
        .from("orders")
        .select("id", { count: "exact" })
        .eq("status", "Assigned")
        .lt("created_at", twoHoursAgo);

      if (staleCount && staleCount > 0) {
        alertsList.push({
          id: "stale-orders",
          type: "error",
          title: "Stale Orders",
          description: `${staleCount} order(s) assigned but not picked up for 2+ hours`,
          count: staleCount,
          action: { label: "View Orders", path: "/orders/instant" },
        });
      }

      // Check for unpaid client statements
      const { data: unpaidStatements, count: unpaidCount } = await supabase
        .from("client_statements")
        .select("id", { count: "exact" })
        .eq("status", "unpaid");

      if (unpaidCount && unpaidCount > 0) {
        alertsList.push({
          id: "unpaid-statements",
          type: "info",
          title: "Unpaid Client Statements",
          description: `${unpaidCount} client statement(s) pending payment`,
          count: unpaidCount,
          action: { label: "View Clients", path: "/clients" },
        });
      }

      // If no alerts, add a success state
      if (alertsList.length === 0) {
        alertsList.push({
          id: "all-clear",
          type: "info",
          title: "All Clear",
          description: "No issues requiring attention",
        });
      }

      return alertsList;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const getAlertStyles = (type: Alert["type"]) => {
    switch (type) {
      case "error":
        return "border-l-4 border-l-[hsl(var(--status-error))] bg-[hsl(var(--status-error-bg))]";
      case "warning":
        return "border-l-4 border-l-[hsl(var(--status-warning))] bg-[hsl(var(--status-warning-bg))]";
      case "info":
        return "border-l-4 border-l-[hsl(var(--status-info))] bg-[hsl(var(--status-info-bg))]";
    }
  };

  const getAlertIcon = (type: Alert["type"]) => {
    switch (type) {
      case "error":
        return <AlertTriangle className="h-4 w-4 text-[hsl(var(--status-error))]" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-[hsl(var(--status-warning))]" />;
      case "info":
        return <Package className="h-4 w-4 text-[hsl(var(--status-info))]" />;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4" />
          What Needs Attention
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-md p-3 ${getAlertStyles(alert.type)}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  {getAlertIcon(alert.type)}
                  <div className="min-w-0">
                    <p className="font-medium text-sm leading-tight">{alert.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {alert.description}
                    </p>
                  </div>
                </div>
                {alert.action && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs shrink-0"
                    onClick={() => navigate(alert.action!.path)}
                  >
                    {alert.action.label}
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
