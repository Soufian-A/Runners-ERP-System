import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, ChevronDown, ChevronRight, Search, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface AuditLogEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_fields: string[] | null;
  user_id: string | null;
  user_email: string | null;
  created_at: string;
}

const AuditLog = () => {
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data: auditLogs, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["audit-log", tableFilter, actionFilter],
    queryFn: async () => {
      let query = supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (tableFilter !== "all") {
        query = query.eq("table_name", tableFilter);
      }

      if (actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AuditLogEntry[];
    },
  });

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "INSERT":
        return <Badge className="bg-green-500 hover:bg-green-600">INSERT</Badge>;
      case "UPDATE":
        return <Badge className="bg-blue-500 hover:bg-blue-600">UPDATE</Badge>;
      case "DELETE":
        return <Badge variant="destructive">DELETE</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  const tables = [
    "orders",
    "driver_transactions",
    "client_transactions",
    "accounting_entries",
    "cashbox_daily",
    "drivers",
    "clients",
    "driver_statements",
    "client_statements",
    "daily_expenses",
    "third_party_transactions",
    "user_roles",
  ];

  const filteredLogs = auditLogs?.filter((log) => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      log.table_name.toLowerCase().includes(searchLower) ||
      log.record_id.toLowerCase().includes(searchLower) ||
      log.user_email?.toLowerCase().includes(searchLower) ||
      log.user_id?.toLowerCase().includes(searchLower) ||
      JSON.stringify(log.changed_fields).toLowerCase().includes(searchLower)
    );
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Audit Log</h1>
            <p className="text-muted-foreground">Track all changes to financial and operational data</p>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by record ID, email, or field..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={tableFilter} onValueChange={setTableFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by table" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tables</SelectItem>
                  {tables.map((table) => (
                    <SelectItem key={table} value={table}>
                      {table}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="INSERT">INSERT</SelectItem>
                  <SelectItem value="UPDATE">UPDATE</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit Entries</CardTitle>
            <CardDescription>
              Showing {filteredLogs?.length || 0} entries (max 500)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredLogs && filteredLogs.length > 0 ? (
              <div className="space-y-2">
                {filteredLogs.map((log) => (
                  <Collapsible
                    key={log.id}
                    open={expandedRows.has(log.id)}
                    onOpenChange={() => toggleRow(log.id)}
                  >
                    <div className="border rounded-lg">
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer">
                          <div className="flex items-center gap-3">
                            {expandedRows.has(log.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            {getActionBadge(log.action)}
                            <Badge variant="outline" className="font-mono text-xs">
                              {log.table_name}
                            </Badge>
                            {log.changed_fields && log.changed_fields.length > 0 && (
                              <span className="text-sm text-muted-foreground">
                                Changed: {log.changed_fields.join(", ")}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{log.user_email || log.user_id?.slice(0, 8) || "System"}</span>
                            <span>{format(new Date(log.created_at), "MMM d, yyyy HH:mm:ss")}</span>
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="p-4 border-t bg-muted/20">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="text-xs">
                              <div className="font-semibold mb-1">Record ID:</div>
                              <code className="font-mono bg-muted p-1 rounded">{log.record_id}</code>
                            </div>
                            <div className="text-xs">
                              <div className="font-semibold mb-1">User ID:</div>
                              <code className="font-mono bg-muted p-1 rounded">{log.user_id || "N/A"}</code>
                            </div>
                          </div>
                          
                          {log.action === "UPDATE" && log.old_data && log.new_data && (
                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                              <div>
                                <div className="font-semibold text-sm mb-2 text-destructive">Before:</div>
                                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-[200px]">
                                  {JSON.stringify(
                                    log.changed_fields?.reduce((acc, field) => {
                                      acc[field] = log.old_data?.[field];
                                      return acc;
                                    }, {} as Record<string, unknown>) || log.old_data,
                                    null,
                                    2
                                  )}
                                </pre>
                              </div>
                              <div>
                                <div className="font-semibold text-sm mb-2 text-green-600">After:</div>
                                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-[200px]">
                                  {JSON.stringify(
                                    log.changed_fields?.reduce((acc, field) => {
                                      acc[field] = log.new_data?.[field];
                                      return acc;
                                    }, {} as Record<string, unknown>) || log.new_data,
                                    null,
                                    2
                                  )}
                                </pre>
                              </div>
                            </div>
                          )}

                          {log.action === "INSERT" && log.new_data && (
                            <div className="mt-4">
                              <div className="font-semibold text-sm mb-2 text-green-600">Created Data:</div>
                              <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-[300px]">
                                {JSON.stringify(log.new_data, null, 2)}
                              </pre>
                            </div>
                          )}

                          {log.action === "DELETE" && log.old_data && (
                            <div className="mt-4">
                              <div className="font-semibold text-sm mb-2 text-destructive">Deleted Data:</div>
                              <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-[300px]">
                                {JSON.stringify(log.old_data, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No audit entries found.</p>
                <p className="text-sm mt-1">Changes to monitored tables will appear here.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AuditLog;
