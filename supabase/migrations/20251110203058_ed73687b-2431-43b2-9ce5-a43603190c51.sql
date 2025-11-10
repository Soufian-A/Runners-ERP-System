-- Fix the function to have proper search_path security
DROP FUNCTION IF EXISTS generate_statement_id();

CREATE OR REPLACE FUNCTION generate_statement_id()
RETURNS TEXT 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;