-- Create enums for settlement statuses
CREATE TYPE public.client_settlement_status AS ENUM ('Unpaid', 'Paid');
CREATE TYPE public.third_party_settlement_status AS ENUM ('Pending', 'Received');
CREATE TYPE public.party_type AS ENUM ('CLIENT', 'THIRD_PARTY', 'CASHBOX');
CREATE TYPE public.tx_direction AS ENUM ('IN', 'OUT');
CREATE TYPE public.tx_type AS ENUM (
  'CLIENT_PAYOUT', 
  'THIRD_PARTY_REMITTANCE', 
  'DELIVERY_FEE_INCOME',
  'PREPAYMENT',
  'COLLECTION',
  'ADJUSTMENT'
);

-- Add new columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS client_settlement_status public.client_settlement_status DEFAULT 'Unpaid',
ADD COLUMN IF NOT EXISTS third_party_settlement_status public.third_party_settlement_status DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS client_net_usd numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS third_party_fee_usd numeric DEFAULT 0;

-- Create append-only transactions audit log table
CREATE TABLE public.order_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE RESTRICT NOT NULL,
  party_type public.party_type NOT NULL,
  party_id uuid,
  direction public.tx_direction NOT NULL,
  amount_usd numeric NOT NULL DEFAULT 0,
  tx_type public.tx_type NOT NULL,
  tx_date timestamp with time zone NOT NULL DEFAULT now(),
  recorded_by uuid REFERENCES auth.users(id),
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on order_transactions
ALTER TABLE public.order_transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for order_transactions
CREATE POLICY "Operators can manage order_transactions" 
ON public.order_transactions 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Viewers can read order_transactions" 
ON public.order_transactions 
FOR SELECT 
USING (has_role(auth.uid(), 'viewer'::app_role));

-- Create index for performance
CREATE INDEX idx_order_transactions_order_id ON public.order_transactions(order_id);
CREATE INDEX idx_order_transactions_party ON public.order_transactions(party_type, party_id);
CREATE INDEX idx_order_transactions_tx_date ON public.order_transactions(tx_date);

-- Add comment for documentation
COMMENT ON TABLE public.order_transactions IS 'Append-only audit log for all financial transactions related to orders';