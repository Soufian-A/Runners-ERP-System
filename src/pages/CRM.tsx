import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Plus, Copy } from 'lucide-react';
import CreateClientDialog from '@/components/clients/CreateClientDialog';
import { useToast } from '@/hooks/use-toast';

const CRM = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();
  
  const { data: clients, isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*, client_rules(*)')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const copyClientInfo = (client: any) => {
    const info = `
📋 CLIENT INFORMATION

Name: ${client.name}
Type: ${client.type}
Contact: ${client.contact_name || 'N/A'}
Phone: ${client.phone || 'N/A'}
Address: ${client.address || 'N/A'}
${client.location_link ? `Location: ${client.location_link}` : ''}
Currency: ${client.default_currency}
Fee Rule: ${client.client_rules?.[0]?.fee_rule || 'N/A'}
    `.trim();
    
    navigator.clipboard.writeText(info);
    toast({
      title: "Copied!",
      description: "Client information copied to clipboard",
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">CRM</h1>
            <p className="text-muted-foreground mt-1">Manage client accounts and relationships</p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Client
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Client List
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Fee Rule</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">Loading...</TableCell>
                  </TableRow>
                ) : clients && clients.length > 0 ? (
                  clients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{client.type}</Badge>
                      </TableCell>
                      <TableCell>{client.contact_name}</TableCell>
                      <TableCell>{client.phone}</TableCell>
                      <TableCell>{client.default_currency}</TableCell>
                      <TableCell>
                        {client.client_rules?.[0]?.fee_rule || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => copyClientInfo(client)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">No clients found</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <CreateClientDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </Layout>
  );
};

export default CRM;