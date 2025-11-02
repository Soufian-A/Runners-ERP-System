-- Drop the existing triggers and function with CASCADE
DROP TRIGGER IF EXISTS on_order_delete ON public.orders CASCADE;
DROP TRIGGER IF EXISTS cleanup_order_related_records ON public.orders CASCADE;
DROP FUNCTION IF EXISTS public.delete_order_related_records() CASCADE;

-- Create improved function that reverses driver wallet balances
CREATE OR REPLACE FUNCTION public.delete_order_related_records()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  driver_tx RECORD;
BEGIN
  -- First, reverse driver wallet balances before deleting transactions
  FOR driver_tx IN 
    SELECT driver_id, type, amount_usd, amount_lbp 
    FROM public.driver_transactions 
    WHERE order_ref = OLD.order_id
  LOOP
    -- Reverse the transaction effect on driver wallet
    IF driver_tx.type = 'Credit' THEN
      -- If it was a credit, subtract it back
      UPDATE public.drivers
      SET 
        wallet_usd = wallet_usd - driver_tx.amount_usd,
        wallet_lbp = wallet_lbp - driver_tx.amount_lbp
      WHERE id = driver_tx.driver_id;
    ELSIF driver_tx.type = 'Debit' THEN
      -- If it was a debit, add it back
      UPDATE public.drivers
      SET 
        wallet_usd = wallet_usd + driver_tx.amount_usd,
        wallet_lbp = wallet_lbp + driver_tx.amount_lbp
      WHERE id = driver_tx.driver_id;
    END IF;
  END LOOP;
  
  -- Delete from accounting_entries
  DELETE FROM public.accounting_entries
  WHERE order_ref = OLD.order_id;
  
  -- Delete from driver_transactions
  DELETE FROM public.driver_transactions
  WHERE order_ref = OLD.order_id;
  
  -- Delete from client_transactions
  DELETE FROM public.client_transactions
  WHERE order_ref = OLD.order_id;
  
  -- Delete from third_party_transactions
  DELETE FROM public.third_party_transactions
  WHERE order_ref = OLD.order_id;
  
  RETURN OLD;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_order_delete
  BEFORE DELETE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_order_related_records();