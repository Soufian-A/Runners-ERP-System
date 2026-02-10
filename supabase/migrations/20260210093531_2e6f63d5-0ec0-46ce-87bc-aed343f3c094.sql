
CREATE OR REPLACE FUNCTION public.update_cashbox_atomic(
  p_date date,
  p_cash_in_usd numeric DEFAULT 0,
  p_cash_in_lbp numeric DEFAULT 0,
  p_cash_out_usd numeric DEFAULT 0,
  p_cash_out_lbp numeric DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_opening_usd numeric := 0;
  v_opening_lbp numeric := 0;
  v_row cashbox_daily%ROWTYPE;
BEGIN
  -- Verify caller is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Verify caller has operator/admin role
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator')) THEN
    RAISE EXCEPTION 'Insufficient permissions: admin or operator role required';
  END IF;

  -- Get previous day's closing as today's opening
  SELECT closing_usd, closing_lbp INTO v_opening_usd, v_opening_lbp
  FROM cashbox_daily
  WHERE date < p_date
  ORDER BY date DESC
  LIMIT 1;

  v_opening_usd := COALESCE(v_opening_usd, 0);
  v_opening_lbp := COALESCE(v_opening_lbp, 0);

  -- Upsert the row
  INSERT INTO cashbox_daily (date, opening_usd, opening_lbp, cash_in_usd, cash_in_lbp, cash_out_usd, cash_out_lbp, closing_usd, closing_lbp)
  VALUES (
    p_date,
    v_opening_usd,
    v_opening_lbp,
    p_cash_in_usd,
    p_cash_in_lbp,
    p_cash_out_usd,
    p_cash_out_lbp,
    v_opening_usd + p_cash_in_usd - p_cash_out_usd,
    v_opening_lbp + p_cash_in_lbp - p_cash_out_lbp
  )
  ON CONFLICT (date) DO UPDATE SET
    opening_usd = v_opening_usd,
    opening_lbp = v_opening_lbp,
    cash_in_usd = cashbox_daily.cash_in_usd + EXCLUDED.cash_in_usd,
    cash_in_lbp = cashbox_daily.cash_in_lbp + EXCLUDED.cash_in_lbp,
    cash_out_usd = cashbox_daily.cash_out_usd + EXCLUDED.cash_out_usd,
    cash_out_lbp = cashbox_daily.cash_out_lbp + EXCLUDED.cash_out_lbp,
    closing_usd = v_opening_usd + (cashbox_daily.cash_in_usd + EXCLUDED.cash_in_usd) - (cashbox_daily.cash_out_usd + EXCLUDED.cash_out_usd),
    closing_lbp = v_opening_lbp + (cashbox_daily.cash_in_lbp + EXCLUDED.cash_in_lbp) - (cashbox_daily.cash_out_lbp + EXCLUDED.cash_out_lbp);
END;
$$;
