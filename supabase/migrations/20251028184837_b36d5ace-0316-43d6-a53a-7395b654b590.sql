-- Create ENUM types
CREATE TYPE client_type AS ENUM ('Ecom', 'Restaurant', 'Individual');
CREATE TYPE currency_type AS ENUM ('USD', 'LBP');
CREATE TYPE fee_rule_type AS ENUM ('ADD_ON', 'DEDUCT', 'INCLUDED');
CREATE TYPE transaction_type AS ENUM ('Credit', 'Debit');
CREATE TYPE order_status AS ENUM ('New', 'Assigned', 'PickedUp', 'Delivered', 'Returned', 'Cancelled');
CREATE TYPE fulfillment_type AS ENUM ('InHouse', 'ThirdParty');
CREATE TYPE remit_status AS ENUM ('Pending', 'Collected');
CREATE TYPE third_party_status AS ENUM ('New', 'With3P', 'Delivered', 'Paid');
CREATE TYPE accounting_category AS ENUM ('DeliveryIncome', 'ThirdPartyCost', 'PrepaidFloat', 'OtherExpense', 'OtherIncome');
CREATE TYPE app_role AS ENUM ('admin', 'operator', 'viewer');

-- User Roles Table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Clients Table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type client_type NOT NULL,
  contact_name TEXT,
  phone TEXT,
  default_currency currency_type DEFAULT 'USD',
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Client Rules Table
CREATE TABLE public.client_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  fee_rule fee_rule_type NOT NULL DEFAULT 'ADD_ON',
  default_fee_usd NUMERIC(10,2) DEFAULT 0,
  default_fee_lbp NUMERIC(12,0) DEFAULT 0,
  allow_override BOOLEAN DEFAULT true
);

-- Drivers Table
CREATE TABLE public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  wallet_usd NUMERIC(12,2) DEFAULT 0,
  wallet_lbp NUMERIC(14,0) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Driver Transactions Table
CREATE TABLE public.driver_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE NOT NULL,
  ts TIMESTAMPTZ DEFAULT now(),
  type transaction_type NOT NULL,
  amount_usd NUMERIC(12,2) DEFAULT 0,
  amount_lbp NUMERIC(14,0) DEFAULT 0,
  order_ref TEXT,
  note TEXT
);

-- Third Parties Table
CREATE TABLE public.third_parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Third Party Transactions Table
CREATE TABLE public.third_party_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  third_party_id UUID REFERENCES public.third_parties(id) ON DELETE CASCADE NOT NULL,
  ts TIMESTAMPTZ DEFAULT now(),
  sell_fee_usd NUMERIC(10,2) DEFAULT 0,
  sell_fee_lbp NUMERIC(12,0) DEFAULT 0,
  buy_cost_usd NUMERIC(10,2) DEFAULT 0,
  buy_cost_lbp NUMERIC(12,0) DEFAULT 0,
  order_ref TEXT,
  status third_party_status DEFAULT 'New'
);

-- Orders Table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL,
  voucher_no TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  entered_by UUID REFERENCES auth.users(id),
  client_id UUID REFERENCES public.clients(id) NOT NULL,
  client_type client_type NOT NULL,
  fulfillment fulfillment_type NOT NULL,
  third_party_id UUID REFERENCES public.third_parties(id),
  driver_id UUID REFERENCES public.drivers(id),
  address TEXT NOT NULL,
  order_amount_usd NUMERIC(12,2) DEFAULT 0,
  order_amount_lbp NUMERIC(14,0) DEFAULT 0,
  delivery_fee_usd NUMERIC(10,2) DEFAULT 0,
  delivery_fee_lbp NUMERIC(12,0) DEFAULT 0,
  client_fee_rule fee_rule_type NOT NULL,
  prepaid_by_runners BOOLEAN DEFAULT false,
  prepay_amount_usd NUMERIC(12,2) DEFAULT 0,
  prepay_amount_lbp NUMERIC(14,0) DEFAULT 0,
  driver_paid_for_client BOOLEAN DEFAULT false,
  driver_paid_amount_usd NUMERIC(12,2) DEFAULT 0,
  driver_paid_amount_lbp NUMERIC(14,0) DEFAULT 0,
  driver_paid_reason TEXT,
  status order_status DEFAULT 'New',
  delivered_at TIMESTAMPTZ,
  driver_remit_status remit_status,
  driver_remit_date TIMESTAMPTZ,
  collected_amount_usd NUMERIC(12,2) DEFAULT 0,
  collected_amount_lbp NUMERIC(14,0) DEFAULT 0,
  notes TEXT
);

-- Client Transactions Table
CREATE TABLE public.client_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  ts TIMESTAMPTZ DEFAULT now(),
  type transaction_type NOT NULL,
  amount_usd NUMERIC(12,2) DEFAULT 0,
  amount_lbp NUMERIC(14,0) DEFAULT 0,
  order_ref TEXT,
  note TEXT
);

-- Accounting Entries Table
CREATE TABLE public.accounting_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts TIMESTAMPTZ DEFAULT now(),
  category accounting_category NOT NULL,
  amount_usd NUMERIC(12,2) DEFAULT 0,
  amount_lbp NUMERIC(14,0) DEFAULT 0,
  order_ref TEXT,
  memo TEXT
);

-- Cashbox Daily Table
CREATE TABLE public.cashbox_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE UNIQUE NOT NULL,
  opening_usd NUMERIC(12,2) DEFAULT 0,
  opening_lbp NUMERIC(14,0) DEFAULT 0,
  cash_in_usd NUMERIC(12,2) DEFAULT 0,
  cash_in_lbp NUMERIC(14,0) DEFAULT 0,
  cash_out_usd NUMERIC(12,2) DEFAULT 0,
  cash_out_lbp NUMERIC(14,0) DEFAULT 0,
  closing_usd NUMERIC(12,2) DEFAULT 0,
  closing_lbp NUMERIC(14,0) DEFAULT 0,
  notes TEXT
);

-- Enable RLS on all tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.third_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.third_party_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashbox_daily ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS Policies - Admin and Operator can do everything, Viewer can only read
CREATE POLICY "Admin full access" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Operators can manage clients" ON public.clients FOR ALL USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator')
);
CREATE POLICY "Viewers can read clients" ON public.clients FOR SELECT USING (public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Operators can manage client_rules" ON public.client_rules FOR ALL USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator')
);
CREATE POLICY "Viewers can read client_rules" ON public.client_rules FOR SELECT USING (public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Operators can manage drivers" ON public.drivers FOR ALL USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator')
);
CREATE POLICY "Viewers can read drivers" ON public.drivers FOR SELECT USING (public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Operators can manage driver_transactions" ON public.driver_transactions FOR ALL USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator')
);
CREATE POLICY "Viewers can read driver_transactions" ON public.driver_transactions FOR SELECT USING (public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Operators can manage third_parties" ON public.third_parties FOR ALL USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator')
);
CREATE POLICY "Viewers can read third_parties" ON public.third_parties FOR SELECT USING (public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Operators can manage third_party_transactions" ON public.third_party_transactions FOR ALL USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator')
);
CREATE POLICY "Viewers can read third_party_transactions" ON public.third_party_transactions FOR SELECT USING (public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Operators can manage orders" ON public.orders FOR ALL USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator')
);
CREATE POLICY "Viewers can read orders" ON public.orders FOR SELECT USING (public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Operators can manage client_transactions" ON public.client_transactions FOR ALL USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator')
);
CREATE POLICY "Viewers can read client_transactions" ON public.client_transactions FOR SELECT USING (public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Operators can manage accounting_entries" ON public.accounting_entries FOR ALL USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator')
);
CREATE POLICY "Viewers can read accounting_entries" ON public.accounting_entries FOR SELECT USING (public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Operators can manage cashbox_daily" ON public.cashbox_daily FOR ALL USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator')
);
CREATE POLICY "Viewers can read cashbox_daily" ON public.cashbox_daily FOR SELECT USING (public.has_role(auth.uid(), 'viewer'));

-- Create indexes for better performance
CREATE INDEX idx_orders_client_id ON public.orders(client_id);
CREATE INDEX idx_orders_driver_id ON public.orders(driver_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at);
CREATE INDEX idx_driver_transactions_driver_id ON public.driver_transactions(driver_id);
CREATE INDEX idx_client_transactions_client_id ON public.client_transactions(client_id);
CREATE INDEX idx_third_party_transactions_third_party_id ON public.third_party_transactions(third_party_id);

-- Insert seed data
-- Clients
INSERT INTO public.clients (name, type, contact_name, phone, default_currency, address) VALUES
('FastFood Express', 'Restaurant', 'John Doe', '+961-1-234567', 'LBP', 'Beirut, Hamra Street'),
('ShopNow Online', 'Ecom', 'Jane Smith', '+961-3-456789', 'USD', 'Jounieh, Main Road'),
('Ahmad Hassan', 'Individual', 'Ahmad Hassan', '+961-70-123456', 'LBP', 'Tripoli, City Center');

-- Client Rules
INSERT INTO public.client_rules (client_id, fee_rule, default_fee_usd, default_fee_lbp, allow_override)
SELECT id, 'ADD_ON', 3.00, 90000, true FROM public.clients WHERE name = 'FastFood Express';

INSERT INTO public.client_rules (client_id, fee_rule, default_fee_usd, default_fee_lbp, allow_override)
SELECT id, 'DEDUCT', 2.50, 75000, true FROM public.clients WHERE name = 'ShopNow Online';

INSERT INTO public.client_rules (client_id, fee_rule, default_fee_usd, default_fee_lbp, allow_override)
SELECT id, 'INCLUDED', 0, 0, false FROM public.clients WHERE name = 'Ahmad Hassan';

-- Drivers
INSERT INTO public.drivers (name, phone, active, wallet_usd, wallet_lbp) VALUES
('Ali Mahmoud', '+961-76-111222', true, 0, 0),
('Karim Youssef', '+961-71-333444', true, 0, 0),
('Hassan Omar', '+961-70-555666', true, 0, 0);

-- Third Parties
INSERT INTO public.third_parties (name, contact, phone, active) VALUES
('Express Delivery Co', 'Support Team', '+961-1-777888', true),
('Quick Transport', 'Operations', '+961-3-999000', true);