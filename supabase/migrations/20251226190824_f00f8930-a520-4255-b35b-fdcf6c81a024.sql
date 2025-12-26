-- =============================================
-- COURIER-GRADE E-COMMERCE ORDER MODULE
-- Modeled after Aramex, DHL, FedEx standards
-- =============================================

-- 1. Delivery Zones for zone-based routing and pricing
CREATE TABLE public.delivery_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  base_fee_usd NUMERIC DEFAULT 0,
  base_fee_lbp NUMERIC DEFAULT 0,
  estimated_delivery_hours INTEGER DEFAULT 24,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Order tracking events (scan history)
CREATE TABLE public.order_tracking_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_code TEXT NOT NULL,
  event_description TEXT NOT NULL,
  location TEXT,
  scanned_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_tracking_events_order ON public.order_tracking_events(order_id);
CREATE INDEX idx_tracking_events_time ON public.order_tracking_events(created_at DESC);

-- 3. Delivery attempts tracking
CREATE TABLE public.delivery_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  attempt_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  driver_id UUID REFERENCES public.drivers(id),
  status TEXT NOT NULL DEFAULT 'attempted',
  failure_reason TEXT,
  failure_code TEXT,
  notes TEXT,
  next_attempt_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_delivery_attempts_order ON public.delivery_attempts(order_id);

-- 4. Driver manifests (runsheets)
CREATE TABLE public.driver_manifests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  manifest_number TEXT NOT NULL UNIQUE,
  driver_id UUID NOT NULL REFERENCES public.drivers(id),
  manifest_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  total_orders INTEGER DEFAULT 0,
  total_cod_usd NUMERIC DEFAULT 0,
  total_cod_lbp NUMERIC DEFAULT 0,
  dispatched_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_manifests_driver ON public.driver_manifests(driver_id);
CREATE INDEX idx_manifests_date ON public.driver_manifests(manifest_date);

-- 5. Manifest orders (link table)
CREATE TABLE public.manifest_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  manifest_id UUID NOT NULL REFERENCES public.driver_manifests(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sequence_number INTEGER,
  pickup_or_delivery TEXT DEFAULT 'delivery',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(manifest_id, order_id)
);

CREATE INDEX idx_manifest_orders_manifest ON public.manifest_orders(manifest_id);
CREATE INDEX idx_manifest_orders_order ON public.manifest_orders(order_id);

-- 6. Add new columns to orders table for tracking
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS tracking_number TEXT,
ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.delivery_zones(id),
ADD COLUMN IF NOT EXISTS promised_date DATE,
ADD COLUMN IF NOT EXISTS delivery_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_attempt_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS failure_reason TEXT,
ADD COLUMN IF NOT EXISTS manifest_id UUID REFERENCES public.driver_manifests(id);

-- Create unique index for tracking number
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_tracking ON public.orders(tracking_number) WHERE tracking_number IS NOT NULL;

-- 7. Function to generate AWB/tracking number (format: RNR-YYYYMMDD-XXXXX)
CREATE OR REPLACE FUNCTION public.generate_tracking_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_tracking TEXT;
  counter INTEGER;
BEGIN
  -- Get count of orders created today
  SELECT COUNT(*) INTO counter
  FROM public.orders
  WHERE DATE(created_at) = CURRENT_DATE AND tracking_number IS NOT NULL;
  
  -- Generate tracking number: RNR-YYYYMMDD-XXXXX
  new_tracking := 'RNR-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD((counter + 1)::TEXT, 5, '0');
  
  RETURN new_tracking;
END;
$$;

-- 8. Function to generate manifest number (format: MAN-YYYYMMDD-XXX)
CREATE OR REPLACE FUNCTION public.generate_manifest_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_manifest TEXT;
  counter INTEGER;
BEGIN
  SELECT COUNT(*) INTO counter
  FROM public.driver_manifests
  WHERE DATE(created_at) = CURRENT_DATE;
  
  new_manifest := 'MAN-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD((counter + 1)::TEXT, 3, '0');
  
  RETURN new_manifest;
END;
$$;

-- 9. Enable RLS on new tables
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manifest_orders ENABLE ROW LEVEL SECURITY;

-- 10. RLS Policies for delivery_zones
CREATE POLICY "Everyone can read delivery_zones"
ON public.delivery_zones
FOR SELECT
USING (true);

CREATE POLICY "Operators can manage delivery_zones"
ON public.delivery_zones
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

-- 11. RLS Policies for order_tracking_events
CREATE POLICY "Everyone can read order_tracking_events"
ON public.order_tracking_events
FOR SELECT
USING (true);

CREATE POLICY "Operators can manage order_tracking_events"
ON public.order_tracking_events
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

-- 12. RLS Policies for delivery_attempts
CREATE POLICY "Operators can manage delivery_attempts"
ON public.delivery_attempts
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Viewers can read delivery_attempts"
ON public.delivery_attempts
FOR SELECT
USING (has_role(auth.uid(), 'viewer'::app_role));

-- 13. RLS Policies for driver_manifests
CREATE POLICY "Operators can manage driver_manifests"
ON public.driver_manifests
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Viewers can read driver_manifests"
ON public.driver_manifests
FOR SELECT
USING (has_role(auth.uid(), 'viewer'::app_role));

-- 14. RLS Policies for manifest_orders
CREATE POLICY "Operators can manage manifest_orders"
ON public.manifest_orders
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Viewers can read manifest_orders"
ON public.manifest_orders
FOR SELECT
USING (has_role(auth.uid(), 'viewer'::app_role));

-- 15. Insert default delivery zones
INSERT INTO public.delivery_zones (name, code, base_fee_usd, estimated_delivery_hours) VALUES
('Beirut Central', 'BEI-C', 3.00, 4),
('Beirut Suburbs', 'BEI-S', 4.00, 6),
('Mount Lebanon', 'MLB', 5.00, 12),
('North Lebanon', 'NLB', 7.00, 24),
('South Lebanon', 'SLB', 7.00, 24),
('Bekaa Valley', 'BKA', 6.00, 24);

-- 16. Enable realtime for tracking events
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_tracking_events;