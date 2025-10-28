-- Create order type enum
CREATE TYPE public.order_type AS ENUM ('ecom', 'instant', 'errand');

-- Create customers table for storing end customer data
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  name TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(phone)
);

-- Enable RLS on customers
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- RLS policies for customers
CREATE POLICY "Operators can manage customers"
  ON public.customers
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Viewers can read customers"
  ON public.customers
  FOR SELECT
  USING (has_role(auth.uid(), 'viewer'::app_role));

-- Add new columns to orders table
ALTER TABLE public.orders 
  ADD COLUMN order_type public.order_type DEFAULT 'instant',
  ADD COLUMN customer_id UUID REFERENCES public.customers(id),
  ADD COLUMN amount_due_to_client_usd NUMERIC DEFAULT 0,
  ADD COLUMN prepaid_by_company BOOLEAN DEFAULT false;

-- Create index for better performance
CREATE INDEX idx_customers_phone ON public.customers(phone);
CREATE INDEX idx_orders_order_type ON public.orders(order_type);