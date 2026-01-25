-- Add column to track who paid for the order when driver didn't collect
-- company_paid_for_order: company paid from cashbox instead of driver
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS company_paid_for_order boolean DEFAULT false;

-- Add the paid amount fields for company payments (uses same as driver paid amounts)
COMMENT ON COLUMN public.orders.company_paid_for_order IS 'True when company paid from cashbox instead of driver paying';