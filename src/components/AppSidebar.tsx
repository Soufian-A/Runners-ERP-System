import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Package,
  Zap,
  ShoppingCart,
  Truck,
  DollarSign,
  Users,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronRight,
  Home,
  History,
  FileText,
  Wallet,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";

interface NavItem {
  icon: any;
  label: string;
  path: string;
}

interface NavGroup {
  label: string;
  icon: any;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Operations",
    icon: Package,
    items: [
      { icon: Zap, label: "Instant Orders", path: "/orders/instant" },
      { icon: ShoppingCart, label: "E-com Orders", path: "/orders/ecom" },
    ],
  },
  {
    label: "Finance",
    icon: DollarSign,
    items: [
      { icon: Wallet, label: "Cashbox", path: "/cashbox" },
      { icon: FileText, label: "Driver Settlements", path: "/drivers?tab=statements" },
      { icon: FileText, label: "Client Settlements", path: "/clients?tab=statements" },
      { icon: Truck, label: "3P Settlements", path: "/third-party-statements" },
      { icon: History, label: "Transactions", path: "/transactions" },
    ],
  },
  {
    label: "People",
    icon: Truck,
    items: [
      { icon: Truck, label: "Drivers", path: "/drivers" },
    ],
  },
  {
    label: "Clients",
    icon: Users,
    items: [
      { icon: Users, label: "Client Management", path: "/clients" },
    ],
  },
  {
    label: "Reports",
    icon: BarChart3,
    items: [
      { icon: BarChart3, label: "Analytics", path: "/reports" },
    ],
  },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState<string[]>(["Operations", "Finance"]);

  const isActive = (path: string) => location.pathname === path;
  const isGroupActive = (group: NavGroup) => 
    group.items.some(item => location.pathname === item.path);

  const toggleGroup = (label: string) => {
    setOpenGroups(prev =>
      prev.includes(label)
        ? prev.filter(g => g !== label)
        : [...prev, label]
    );
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r transition-all duration-200",
        "bg-sidebar text-sidebar-foreground border-sidebar-border",
        collapsed ? "w-14" : "w-56"
      )}
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className={cn(
          "flex h-14 items-center border-b border-sidebar-border px-3",
          collapsed ? "justify-center" : "justify-between"
        )}>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-sidebar-primary">
                <Package className="h-4 w-4 text-sidebar-primary-foreground" />
              </div>
              <span className="font-semibold text-sm">Delivery ERP</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={onToggle}
          >
            {collapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-2 py-2">
          {/* Dashboard Link */}
          <Button
            variant="ghost"
            className={cn(
              "w-full mb-1",
              collapsed ? "justify-center px-2" : "justify-start px-3",
              isActive("/")
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
            onClick={() => navigate("/")}
          >
            <Home className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="ml-2 text-sm">Dashboard</span>}
          </Button>

          {/* Nav Groups */}
          {navGroups.map((group) => (
            <div key={group.label} className="mb-1">
              {collapsed ? (
                // Collapsed: show only icons for first item
                <div className="py-1">
                  {group.items.map((item) => (
                    <Button
                      key={item.path}
                      variant="ghost"
                      className={cn(
                        "w-full justify-center px-2 mb-0.5",
                        isActive(item.path)
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                      onClick={() => navigate(item.path)}
                      title={item.label}
                    >
                      <item.icon className="h-4 w-4" />
                    </Button>
                  ))}
                </div>
              ) : (
                // Expanded: show collapsible groups
                <Collapsible
                  open={openGroups.includes(group.label)}
                  onOpenChange={() => toggleGroup(group.label)}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className={cn(
                        "w-full justify-between px-3 text-sidebar-muted hover:text-sidebar-foreground hover:bg-transparent",
                        isGroupActive(group) && "text-sidebar-foreground"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <group.icon className="h-4 w-4" />
                        <span className="text-xs font-medium uppercase tracking-wider">
                          {group.label}
                        </span>
                      </span>
                      {openGroups.includes(group.label) ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-2">
                    {group.items.map((item) => (
                      <Button
                        key={item.path}
                        variant="ghost"
                        className={cn(
                          "w-full justify-start px-3 h-9",
                          isActive(item.path)
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                        onClick={() => navigate(item.path)}
                      >
                        <item.icon className="h-4 w-4 mr-2" />
                        <span className="text-sm">{item.label}</span>
                      </Button>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          ))}
        </ScrollArea>
      </div>
    </aside>
  );
}
