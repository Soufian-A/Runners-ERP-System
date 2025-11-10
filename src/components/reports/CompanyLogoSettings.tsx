import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Building2, Save } from 'lucide-react';

export function CompanyLogoSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [logoUrl, setLogoUrl] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');

  const { data: settings } = useQuery({
    queryKey: ['company-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setLogoUrl(data.logo_url || '');
        setCompanyName(data.company_name || '');
        setCompanyAddress(data.company_address || '');
        setCompanyPhone(data.company_phone || '');
        setCompanyEmail(data.company_email || '');
      }
      
      return data;
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async () => {
      const updates = {
        logo_url: logoUrl,
        company_name: companyName,
        company_address: companyAddress,
        company_phone: companyPhone,
        company_email: companyEmail,
        updated_at: new Date().toISOString(),
      };

      if (settings?.id) {
        const { error } = await supabase
          .from('company_settings')
          .update(updates)
          .eq('id', settings.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_settings')
          .insert(updates);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-settings'] });
      toast({
        title: 'Settings Saved',
        description: 'Company information updated successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save settings',
        variant: 'destructive',
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Company Information & Logo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="logo-url">Logo URL</Label>
          <Input
            id="logo-url"
            type="url"
            placeholder="https://example.com/logo.png"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
          />
          {logoUrl && (
            <div className="mt-2 p-4 border rounded-lg bg-muted/50 flex items-center justify-center">
              <img src={logoUrl} alt="Company Logo" className="max-h-20 object-contain" />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="company-name">Company Name</Label>
          <Input
            id="company-name"
            placeholder="Your Company Name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="company-address">Address</Label>
          <Input
            id="company-address"
            placeholder="Company address"
            value={companyAddress}
            onChange={(e) => setCompanyAddress(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="company-phone">Phone</Label>
            <Input
              id="company-phone"
              placeholder="+1 234 567 8900"
              value={companyPhone}
              onChange={(e) => setCompanyPhone(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company-email">Email</Label>
            <Input
              id="company-email"
              type="email"
              placeholder="info@company.com"
              value={companyEmail}
              onChange={(e) => setCompanyEmail(e.target.value)}
            />
          </div>
        </div>

        <Button
          className="w-full"
          onClick={() => updateSettingsMutation.mutate()}
          disabled={updateSettingsMutation.isPending}
        >
          <Save className="mr-2 h-4 w-4" />
          {updateSettingsMutation.isPending ? 'Saving...' : 'Save Company Information'}
        </Button>
      </CardContent>
    </Card>
  );
}
