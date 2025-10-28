-- Add location_link column to clients table
ALTER TABLE public.clients 
ADD COLUMN location_link text;