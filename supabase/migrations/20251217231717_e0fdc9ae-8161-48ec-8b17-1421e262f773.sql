-- Make order_id nullable in order_transactions to support standalone third party payments
ALTER TABLE public.order_transactions 
ALTER COLUMN order_id DROP NOT NULL;

-- Drop the existing foreign key constraint
ALTER TABLE public.order_transactions 
DROP CONSTRAINT IF EXISTS order_transactions_order_id_fkey;

-- Add a new foreign key that allows null values
ALTER TABLE public.order_transactions 
ADD CONSTRAINT order_transactions_order_id_fkey 
FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;