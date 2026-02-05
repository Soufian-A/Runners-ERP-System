-- Create audit_log table for verbose tracking of all data changes
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_fields text[],
  user_id uuid,
  user_email text,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for efficient querying
CREATE INDEX idx_audit_log_table_record ON public.audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_user ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_log_action ON public.audit_log(action);

-- Enable RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
ON public.audit_log FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow inserts from triggers (service role)
CREATE POLICY "Service role can insert audit logs"
ON public.audit_log FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create generic audit trigger function
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_data jsonb := NULL;
  new_data jsonb := NULL;
  changed_cols text[] := '{}';
  col_name text;
  current_user_id uuid;
  current_user_email text;
BEGIN
  -- Get current user info
  current_user_id := auth.uid();
  current_user_email := (SELECT email FROM auth.users WHERE id = current_user_id);

  IF TG_OP = 'DELETE' THEN
    old_data := to_jsonb(OLD);
    INSERT INTO public.audit_log (table_name, record_id, action, old_data, new_data, changed_fields, user_id, user_email)
    VALUES (TG_TABLE_NAME, OLD.id, TG_OP, old_data, NULL, NULL, current_user_id, current_user_email);
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    new_data := to_jsonb(NEW);
    INSERT INTO public.audit_log (table_name, record_id, action, old_data, new_data, changed_fields, user_id, user_email)
    VALUES (TG_TABLE_NAME, NEW.id, TG_OP, NULL, new_data, NULL, current_user_id, current_user_email);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    old_data := to_jsonb(OLD);
    new_data := to_jsonb(NEW);
    
    -- Find changed columns
    FOR col_name IN SELECT key FROM jsonb_object_keys(new_data) AS key
    LOOP
      IF (old_data -> col_name) IS DISTINCT FROM (new_data -> col_name) THEN
        changed_cols := array_append(changed_cols, col_name);
      END IF;
    END LOOP;
    
    -- Only log if something actually changed
    IF array_length(changed_cols, 1) > 0 THEN
      INSERT INTO public.audit_log (table_name, record_id, action, old_data, new_data, changed_fields, user_id, user_email)
      VALUES (TG_TABLE_NAME, NEW.id, TG_OP, old_data, new_data, changed_cols, current_user_id, current_user_email);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- Apply audit triggers to financial/critical tables
CREATE TRIGGER audit_orders
  AFTER INSERT OR UPDATE OR DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_driver_transactions
  AFTER INSERT OR UPDATE OR DELETE ON public.driver_transactions
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_client_transactions
  AFTER INSERT OR UPDATE OR DELETE ON public.client_transactions
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_accounting_entries
  AFTER INSERT OR UPDATE OR DELETE ON public.accounting_entries
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_cashbox_daily
  AFTER INSERT OR UPDATE OR DELETE ON public.cashbox_daily
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_drivers
  AFTER INSERT OR UPDATE OR DELETE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_clients
  AFTER INSERT OR UPDATE OR DELETE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_driver_statements
  AFTER INSERT OR UPDATE OR DELETE ON public.driver_statements
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_client_statements
  AFTER INSERT OR UPDATE OR DELETE ON public.client_statements
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_daily_expenses
  AFTER INSERT OR UPDATE OR DELETE ON public.daily_expenses
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_third_party_transactions
  AFTER INSERT OR UPDATE OR DELETE ON public.third_party_transactions
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();