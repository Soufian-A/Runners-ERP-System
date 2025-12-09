import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  XCircle, 
  Truck, 
  Package, 
  DollarSign,
  Lock,
  RotateCcw,
  Ban,
  ArrowUpCircle,
  ArrowDownCircle,
  Loader2
} from "lucide-react";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        success: "bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success))]",
        warning: "bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning))]",
        error: "bg-[hsl(var(--status-error-bg))] text-[hsl(var(--status-error))]",
        info: "bg-[hsl(var(--status-info-bg))] text-[hsl(var(--status-info))]",
        neutral: "bg-[hsl(var(--status-neutral-bg))] text-[hsl(var(--status-neutral))]",
      },
      size: {
        sm: "text-xs px-1.5 py-0.5",
        md: "text-xs px-2 py-1",
        lg: "text-sm px-2.5 py-1",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: "md",
    },
  }
);

// Order status mapping
const orderStatusConfig = {
  New: { variant: "info" as const, icon: Package, label: "New" },
  Assigned: { variant: "info" as const, icon: Truck, label: "Assigned" },
  PickedUp: { variant: "warning" as const, icon: ArrowUpCircle, label: "Picked Up" },
  Delivered: { variant: "success" as const, icon: CheckCircle2, label: "Delivered" },
  Returned: { variant: "warning" as const, icon: RotateCcw, label: "Returned" },
  Cancelled: { variant: "error" as const, icon: Ban, label: "Cancelled" },
};

// Payment status mapping
const paymentStatusConfig = {
  Pending: { variant: "warning" as const, icon: Clock, label: "Pending" },
  Collected: { variant: "info" as const, icon: DollarSign, label: "Collected" },
  Completed: { variant: "success" as const, icon: CheckCircle2, label: "Completed" },
  Due: { variant: "warning" as const, icon: AlertCircle, label: "Due" },
  Settled: { variant: "success" as const, icon: CheckCircle2, label: "Settled" },
  Processing: { variant: "info" as const, icon: Loader2, label: "Processing" },
  Mismatch: { variant: "error" as const, icon: XCircle, label: "Mismatch" },
};

// Remit status mapping  
const remitStatusConfig = {
  Pending: { variant: "warning" as const, icon: Clock, label: "Pending" },
  Collected: { variant: "success" as const, icon: CheckCircle2, label: "Collected" },
};

// Statement status mapping
const statementStatusConfig = {
  unpaid: { variant: "warning" as const, icon: Clock, label: "Unpaid" },
  paid: { variant: "success" as const, icon: CheckCircle2, label: "Paid" },
  locked: { variant: "neutral" as const, icon: Lock, label: "Locked" },
};

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusBadgeVariants> {
  status?: string;
  type?: "order" | "payment" | "remit" | "statement" | "custom";
  showIcon?: boolean;
  customLabel?: string;
}

export function StatusBadge({
  className,
  variant,
  size,
  status,
  type = "custom",
  showIcon = true,
  customLabel,
  ...props
}: StatusBadgeProps) {
  let config: { variant: "success" | "warning" | "error" | "info" | "neutral"; icon: any; label: string } | null = null;

  if (type === "order" && status && status in orderStatusConfig) {
    config = orderStatusConfig[status as keyof typeof orderStatusConfig];
  } else if (type === "payment" && status && status in paymentStatusConfig) {
    config = paymentStatusConfig[status as keyof typeof paymentStatusConfig];
  } else if (type === "remit" && status && status in remitStatusConfig) {
    config = remitStatusConfig[status as keyof typeof remitStatusConfig];
  } else if (type === "statement" && status && status in statementStatusConfig) {
    config = statementStatusConfig[status as keyof typeof statementStatusConfig];
  }

  const finalVariant = variant || config?.variant || "neutral";
  const Icon = config?.icon;
  const label = customLabel || config?.label || status || "";

  return (
    <div
      className={cn(statusBadgeVariants({ variant: finalVariant, size }), className)}
      {...props}
    >
      {showIcon && Icon && <Icon className="h-3 w-3 flex-shrink-0" />}
      <span>{label}</span>
    </div>
  );
}

// Convenience exports for direct usage
export function OrderStatusBadge({ status, ...props }: Omit<StatusBadgeProps, "type">) {
  return <StatusBadge type="order" status={status} {...props} />;
}

export function PaymentStatusBadge({ status, ...props }: Omit<StatusBadgeProps, "type">) {
  return <StatusBadge type="payment" status={status} {...props} />;
}

export function RemitStatusBadge({ status, ...props }: Omit<StatusBadgeProps, "type">) {
  return <StatusBadge type="remit" status={status} {...props} />;
}

export function StatementStatusBadge({ status, ...props }: Omit<StatusBadgeProps, "type">) {
  return <StatusBadge type="statement" status={status} {...props} />;
}
