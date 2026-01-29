-- Strengthen RLS policies by adding explicit auth.uid() IS NOT NULL checks
-- This addresses the supabase_lov security findings about potential auth bypass

-- Drop existing policies and recreate with explicit auth checks

-- CUSTOMERS table
DROP POLICY IF EXISTS "Operators can manage customers" ON public.customers;
DROP POLICY IF EXISTS "Viewers can read customers" ON public.customers;

CREATE POLICY "Operators can manage customers" ON public.customers
FOR ALL USING (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'))
);

CREATE POLICY "Viewers can read customers" ON public.customers
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  has_role(auth.uid(), 'viewer')
);

-- DRIVERS table
DROP POLICY IF EXISTS "Operators can manage drivers" ON public.drivers;

CREATE POLICY "Operators can manage drivers" ON public.drivers
FOR ALL USING (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'))
);

-- CLIENTS table
DROP POLICY IF EXISTS "Operators can manage clients" ON public.clients;
DROP POLICY IF EXISTS "Viewers can read clients" ON public.clients;

CREATE POLICY "Operators can manage clients" ON public.clients
FOR ALL USING (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'))
);

CREATE POLICY "Viewers can read clients" ON public.clients
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  has_role(auth.uid(), 'viewer')
);

-- ORDERS table
DROP POLICY IF EXISTS "Operators can manage orders" ON public.orders;
DROP POLICY IF EXISTS "Viewers can read orders" ON public.orders;

CREATE POLICY "Operators can manage orders" ON public.orders
FOR ALL USING (
  auth.uid() IS NOT NULL AND 
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'))
);

CREATE POLICY "Viewers can read orders" ON public.orders
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  has_role(auth.uid(), 'viewer')
);