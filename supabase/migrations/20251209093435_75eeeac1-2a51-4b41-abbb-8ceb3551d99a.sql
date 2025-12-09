-- Fix: Remove viewer access to third_parties table to protect vendor contact information
-- This prevents viewers from accessing sensitive vendor names, contact names, and phone numbers

DROP POLICY IF EXISTS "Viewers can read third_parties" ON public.third_parties;