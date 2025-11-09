-- Create client_payments table to track statement payments
CREATE TABLE public.client_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  statement_id TEXT NOT NULL UNIQUE,
  client_id UUID NOT NULL,
  payment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  amount_usd NUMERIC DEFAULT 0,
  amount_lbp NUMERIC DEFAULT 0,
  period_from DATE NOT NULL,
  period_to DATE NOT NULL,
  payment_method TEXT,
  notes TEXT,
  order_refs TEXT[], -- Array of order IDs included in this statement
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Operators can manage client_payments"
  ON public.client_payments
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Viewers can read client_payments"
  ON public.client_payments
  FOR SELECT
  USING (has_role(auth.uid(), 'viewer'::app_role));

-- Create index for faster lookups
CREATE INDEX idx_client_payments_client_id ON public.client_payments(client_id);
CREATE INDEX idx_client_payments_statement_id ON public.client_payments(statement_id);
CREATE INDEX idx_client_payments_payment_date ON public.client_payments(payment_date);

-- Function to generate statement ID
CREATE OR REPLACE FUNCTION generate_statement_id()
RETURNS TEXT AS $$
DECLARE
  new_id TEXT;
  counter INTEGER;
BEGIN
  -- Get current date in YYYYMMDD format
  new_id := 'ST-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-';
  
  -- Get count of statements created today
  SELECT COUNT(*) INTO counter
  FROM public.client_payments
  WHERE DATE(created_at) = CURRENT_DATE;
  
  -- Append counter with leading zeros
  new_id := new_id || LPAD((counter + 1)::TEXT, 4, '0');
  
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Create company_settings table for logo and other settings
CREATE TABLE IF NOT EXISTS public.company_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  logo_url TEXT,
  company_name TEXT,
  company_address TEXT,
  company_phone TEXT,
  company_email TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Operators can manage company_settings"
  ON public.company_settings
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Everyone can read company_settings"
  ON public.company_settings
  FOR SELECT
  USING (true);

-- Insert default row if none exists
INSERT INTO public.company_settings (company_name)
VALUES ('Your Company Name')
ON CONFLICT DO NOTHING;