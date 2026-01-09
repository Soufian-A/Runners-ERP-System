-- Create atomic wallet update function to prevent race conditions
CREATE OR REPLACE FUNCTION public.update_driver_wallet_atomic(
  p_driver_id UUID,
  p_amount_usd NUMERIC,
  p_amount_lbp NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
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

-- Create atomic cashbox update function
CREATE OR REPLACE FUNCTION public.update_cashbox_atomic(
  p_date DATE,
  p_cash_in_usd NUMERIC DEFAULT 0,
  p_cash_in_lbp NUMERIC DEFAULT 0,
  p_cash_out_usd NUMERIC DEFAULT 0,
  p_cash_out_lbp NUMERIC DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
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