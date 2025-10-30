-- Create function to clean up related records when an order is deleted
CREATE OR REPLACE FUNCTION public.delete_order_related_records()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

-- Create trigger that fires BEFORE an order is deleted
CREATE TRIGGER cleanup_order_related_records
BEFORE DELETE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.delete_order_related_records();