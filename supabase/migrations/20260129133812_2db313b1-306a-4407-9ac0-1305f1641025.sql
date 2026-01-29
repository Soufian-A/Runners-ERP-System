-- Fix: Add authentication and authorization checks to atomic wallet functions
-- This addresses the DEFINER_OR_RPC_BYPASS security issue

-- Update update_driver_wallet_atomic to require admin/operator role
CREATE OR REPLACE FUNCTION public.update_driver_wallet_atomic(p_driver_id uuid, p_amount_usd numeric, p_amount_lbp numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verify caller is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Verify caller has operator/admin role
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator')) THEN
    RAISE EXCEPTION 'Insufficient permissions: admin or operator role required';
  END IF;

  UPDATE public.drivers
  SET 
    wallet_usd = COALESCE(wallet_usd, 0) + p_amount_usd,
    wallet_lbp = COALESCE(wallet_lbp, 0) + p_amount_lbp
  WHERE id = p_driver_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Driver not found: %', p_driver_id;
  END IF;
END;
$$;

-- Update update_cashbox_atomic to require admin/operator role
CREATE OR REPLACE FUNCTION public.update_cashbox_atomic(p_date date, p_cash_in_usd numeric DEFAULT 0, p_cash_in_lbp numeric DEFAULT 0, p_cash_out_usd numeric DEFAULT 0, p_cash_out_lbp numeric DEFAULT 0)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verify caller is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Verify caller has operator/admin role
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator')) THEN
    RAISE EXCEPTION 'Insufficient permissions: admin or operator role required';
  END IF;

  INSERT INTO public.cashbox_daily (date, opening_usd, opening_lbp, cash_in_usd, cash_in_lbp, cash_out_usd, cash_out_lbp)
  VALUES (p_date, 0, 0, p_cash_in_usd, p_cash_in_lbp, p_cash_out_usd, p_cash_out_lbp)
  ON CONFLICT (date) 
  DO UPDATE SET
    cash_in_usd = cashbox_daily.cash_in_usd + EXCLUDED.cash_in_usd,
    cash_in_lbp = cashbox_daily.cash_in_lbp + EXCLUDED.cash_in_lbp,
    cash_out_usd = cashbox_daily.cash_out_usd + EXCLUDED.cash_out_usd,
    cash_out_lbp = cashbox_daily.cash_out_lbp + EXCLUDED.cash_out_lbp;
END;
$$;