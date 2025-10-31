-- Create expense categories table
CREATE TABLE public.expense_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category_group TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Operators can manage expense_categories"
ON public.expense_categories
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Viewers can read expense_categories"
ON public.expense_categories
FOR SELECT
USING (has_role(auth.uid(), 'viewer'::app_role));

-- Create daily expenses table
CREATE TABLE public.daily_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  category_id UUID NOT NULL REFERENCES public.expense_categories(id),
  amount_usd NUMERIC DEFAULT 0,
  amount_lbp NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_expenses ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Operators can manage daily_expenses"
ON public.daily_expenses
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Viewers can read daily_expenses"
ON public.daily_expenses
FOR SELECT
USING (has_role(auth.uid(), 'viewer'::app_role));

-- Insert expense categories
INSERT INTO public.expense_categories (name, category_group) VALUES
-- Operations / Fleet
('Driver Salaries & Wages', 'Operations / Fleet'),
('Driver Overtime', 'Operations / Fleet'),
('Delivery Fees Paid to Subcontractors', 'Operations / Fleet'),
('Fuel Expense', 'Operations / Fleet'),
('Vehicle Maintenance & Repairs', 'Operations / Fleet'),
('Vehicle Insurance', 'Operations / Fleet'),
('Vehicle Registration & Licensing', 'Operations / Fleet'),
('Bike/Car Rental', 'Operations / Fleet'),
-- Staff & HR
('Staff Salaries & Wages', 'Staff & HR'),
('Employee Benefits', 'Staff & HR'),
('Training & Recruitment', 'Staff & HR'),
-- Office & Admin
('Rent', 'Office & Admin'),
('Utilities', 'Office & Admin'),
('Office Supplies', 'Office & Admin'),
('Software Subscriptions', 'Office & Admin'),
('Phone & Communication', 'Office & Admin'),
('Bank Fees & Charges', 'Office & Admin'),
('Professional Fees', 'Office & Admin'),
-- Marketing & Sales
('Advertising & Promotions', 'Marketing & Sales'),
('Branding & Design', 'Marketing & Sales'),
('Sponsorships / Community Events', 'Marketing & Sales'),
-- Operations Support
('Packaging Materials', 'Operations Support'),
('Uniforms', 'Operations Support'),
-- Technology & Systems
('Website & Hosting', 'Technology & Systems'),
('App Development & Maintenance', 'Technology & Systems'),
('IT Support & Repairs', 'Technology & Systems'),
-- Financial & Other
('Depreciation', 'Financial & Other'),
('Currency Exchange / Transfer Fees', 'Financial & Other'),
('Miscellaneous Expenses', 'Financial & Other');