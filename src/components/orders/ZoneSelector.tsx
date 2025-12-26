import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Clock, DollarSign } from "lucide-react";

interface DeliveryZone {
  id: string;
  name: string;
  code: string;
  base_fee_usd: number;
  estimated_delivery_hours: number;
  is_active: boolean;
}

interface ZoneSelectorProps {
  value?: string;
  onChange: (zoneId: string, zone?: DeliveryZone) => void;
  className?: string;
}

export function ZoneSelector({ value, onChange, className }: ZoneSelectorProps) {
  const { data: zones = [] } = useQuery({
    queryKey: ["delivery-zones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_zones")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as DeliveryZone[];
    },
  });

  const handleChange = (zoneId: string) => {
    const zone = zones.find((z) => z.id === zoneId);
    onChange(zoneId, zone);
  };

  const selectedZone = zones.find((z) => z.id === value);

  return (
    <div className={className}>
      <Select value={value || ""} onValueChange={handleChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select delivery zone..." />
        </SelectTrigger>
        <SelectContent>
          {zones.map((zone) => (
            <SelectItem key={zone.id} value={zone.id}>
              <div className="flex items-center gap-2">
                <MapPin className="h-3 w-3" />
                <span>{zone.name}</span>
                <span className="text-xs text-muted-foreground">({zone.code})</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedZone && (
        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            <span>${selectedZone.base_fee_usd.toFixed(2)} base fee</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{selectedZone.estimated_delivery_hours}h estimated</span>
          </div>
        </div>
      )}
    </div>
  );
}
