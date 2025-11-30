-- Create driver_statements table to track issued driver statements
CREATE TABLE IF NOT EXISTS public.driver_statements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  statement_id TEXT NOT NULL UNIQUE,
  period_from DATE NOT NULL,
  period_to DATE NOT NULL,
  total_collected_usd NUMERIC DEFAULT 0,
  total_collected_lbp NUMERIC DEFAULT 0,
  total_delivery_fees_usd NUMERIC DEFAULT 0,
  total_delivery_fees_lbp NUMERIC DEFAULT 0,
  total_driver_paid_refund_usd NUMERIC DEFAULT 0,
  total_driver_paid_refund_lbp NUMERIC DEFAULT 0,
  net_due_usd NUMERIC DEFAULT 0,
  net_due_lbp NUMERIC DEFAULT 0,
  order_refs TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
  issued_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  paid_date TIMESTAMP WITH TIME ZONE,
  payment_method TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id)
);

-- Create client_statements table to track issued client statements
CREATE TABLE IF NOT EXISTS public.client_statements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  statement_id TEXT NOT NULL UNIQUE,
  period_from DATE NOT NULL,
  period_to DATE NOT NULL,
  total_orders INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  total_order_amount_usd NUMERIC DEFAULT 0,
  total_order_amount_lbp NUMERIC DEFAULT 0,
  total_delivery_fees_usd NUMERIC DEFAULT 0,
  total_delivery_fees_lbp NUMERIC DEFAULT 0,
  net_due_usd NUMERIC DEFAULT 0,
  net_due_lbp NUMERIC DEFAULT 0,
  order_refs TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
  issued_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  paid_date TIMESTAMP WITH TIME ZONE,
  payment_method TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.driver_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_statements ENABLE ROW LEVEL SECURITY;

-- RLS policies for driver_statements
CREATE POLICY "Operators can manage driver_statements"
ON public.driver_statements
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Viewers can read driver_statements"
ON public.driver_statements
FOR SELECT
USING (has_role(auth.uid(), 'viewer'::app_role));

-- RLS policies for client_statements
CREATE POLICY "Operators can manage client_statements"
ON public.client_statements
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Viewers can read client_statements"
ON public.client_statements
FOR SELECT
USING (has_role(auth.uid(), 'viewer'::app_role));

-- Create indexes for better query performance
CREATE INDEX idx_driver_statements_driver_id ON public.driver_statements(driver_id);
CREATE INDEX idx_driver_statements_status ON public.driver_statements(status);
CREATE INDEX idx_driver_statements_period ON public.driver_statements(period_from, period_to);

CREATE INDEX idx_client_statements_client_id ON public.client_statements(client_id);
CREATE INDEX idx_client_statements_status ON public.client_statements(status);
CREATE INDEX idx_client_statements_period ON public.client_statements(period_from, period_to);

-- Function to generate statement IDs for drivers
CREATE OR REPLACE FUNCTION public.generate_driver_statement_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_id TEXT;
  counter INTEGER;
BEGIN
  new_id := 'DRV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-';
  
  SELECT COUNT(*) INTO counter
  FROM public.driver_statements
  WHERE DATE(issued_date) = CURRENT_DATE;
  
  new_id := new_id || LPAD((counter + 1)::TEXT, 4, '0');
  
  RETURN new_id;
END;
$$;

-- Function to generate statement IDs for clients
CREATE OR REPLACE FUNCTION public.generate_client_statement_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_id TEXT;
  counter INTEGER;
BEGIN
  new_id := 'CLT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-';
  
  SELECT COUNT(*) INTO counter
  FROM public.client_statements
  WHERE DATE(issued_date) = CURRENT_DATE;
  
  new_id := new_id || LPAD((counter + 1)::TEXT, 4, '0');
  
  RETURN new_id;
END;
$$;