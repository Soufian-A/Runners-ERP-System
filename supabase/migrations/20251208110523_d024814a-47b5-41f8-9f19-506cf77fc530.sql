-- Drop the existing viewer policy that exposes driver phone numbers
DROP POLICY IF EXISTS "Viewers can read drivers" ON public.drivers;

-- Note: Admin and operator access remains via "Operators can manage drivers" policy
-- which uses: (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role))