-- Create address_areas table for managing delivery areas
CREATE TABLE public.address_areas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.address_areas ENABLE ROW LEVEL SECURITY;

-- Create policies for address_areas
CREATE POLICY "Operators can manage address_areas" 
ON public.address_areas 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Viewers can read address_areas" 
ON public.address_areas 
FOR SELECT 
USING (has_role(auth.uid(), 'viewer'::app_role));