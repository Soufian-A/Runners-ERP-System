import { supabase } from '@/integrations/supabase/client';

/**
 * Atomically updates driver wallet balance using SQL increment/decrement
 * Prevents race conditions from concurrent updates
 */
export async function updateDriverWallet(
  driverId: string, 
  amountUsd: number, 
  amountLbp: number,
  operation: 'credit' | 'debit'
): Promise<{ success: boolean; error?: string }> {
  const multiplier = operation === 'credit' ? 1 : -1;
  
  const { error } = await supabase.rpc('update_driver_wallet_atomic', {
    p_driver_id: driverId,
    p_amount_usd: amountUsd * multiplier,
    p_amount_lbp: amountLbp * multiplier,
  });

  if (error) {
    console.error('Failed to update driver wallet:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Creates a driver transaction record
 */
export async function createDriverTransaction(
  driverId: string,
  type: 'Credit' | 'Debit',
  amountUsd: number,
  amountLbp: number,
  note: string,
  orderRef?: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('driver_transactions').insert({
    driver_id: driverId,
    type,
    amount_usd: amountUsd,
    amount_lbp: amountLbp,
    note,
    order_ref: orderRef || null,
  });

  if (error) {
    console.error('Failed to create driver transaction:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Updates cashbox with atomic increment/decrement
 */
export async function updateCashbox(
  date: string,
  cashInUsd: number = 0,
  cashInLbp: number = 0,
  cashOutUsd: number = 0,
  cashOutLbp: number = 0
): Promise<{ success: boolean; error?: string }> {
  const { data: existing } = await supabase
    .from('cashbox_daily')
    .select('*')
    .eq('date', date)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('cashbox_daily')
      .update({
        cash_in_usd: (existing.cash_in_usd || 0) + cashInUsd,
        cash_in_lbp: (existing.cash_in_lbp || 0) + cashInLbp,
        cash_out_usd: (existing.cash_out_usd || 0) + cashOutUsd,
        cash_out_lbp: (existing.cash_out_lbp || 0) + cashOutLbp,
      })
      .eq('id', existing.id);

    if (error) {
      console.error('Failed to update cashbox:', error);
      return { success: false, error: error.message };
    }
  } else {
    const { error } = await supabase.from('cashbox_daily').insert({
      date,
      opening_usd: 0,
      opening_lbp: 0,
      cash_in_usd: cashInUsd,
      cash_in_lbp: cashInLbp,
      cash_out_usd: cashOutUsd,
      cash_out_lbp: cashOutLbp,
    });

    if (error) {
      console.error('Failed to create cashbox entry:', error);
      return { success: false, error: error.message };
    }
  }

  return { success: true };
}

/**
 * Validates an order before statement inclusion
 */
export function validateOrderForStatement(order: any): { valid: boolean; reason?: string } {
  if (!order) {
    return { valid: false, reason: 'Order not found' };
  }

  if (order.driver_remit_status === 'Collected') {
    return { valid: false, reason: 'Order already collected' };
  }

  if (!order.delivered_at) {
    return { valid: false, reason: 'Order has no delivery date' };
  }

  return { valid: true };
}

/**
 * Calculate statement totals from orders
 */
export function calculateStatementTotals(orders: any[]) {
  return orders.reduce((acc, order) => {
    const isDriverPaid = order.driver_paid_for_client === true;
    
    if (isDriverPaid) {
      // Driver paid for client - no collection, only refund
      return {
        ...acc,
        totalDeliveryFeesUsd: acc.totalDeliveryFeesUsd + Number(order.delivery_fee_usd || 0),
        totalDeliveryFeesLbp: acc.totalDeliveryFeesLbp + Number(order.delivery_fee_lbp || 0),
        totalDriverPaidUsd: acc.totalDriverPaidUsd + Number(order.driver_paid_amount_usd || 0),
        totalDriverPaidLbp: acc.totalDriverPaidLbp + Number(order.driver_paid_amount_lbp || 0),
      };
    } else {
      // Normal order - driver collected full amount
      const collectedUsd = Number(order.order_amount_usd || 0) + Number(order.delivery_fee_usd || 0);
      const collectedLbp = Number(order.order_amount_lbp || 0) + Number(order.delivery_fee_lbp || 0);
      
      return {
        ...acc,
        totalCollectedUsd: acc.totalCollectedUsd + collectedUsd,
        totalCollectedLbp: acc.totalCollectedLbp + collectedLbp,
        totalOrderAmountUsd: acc.totalOrderAmountUsd + Number(order.order_amount_usd || 0),
        totalOrderAmountLbp: acc.totalOrderAmountLbp + Number(order.order_amount_lbp || 0),
        totalDeliveryFeesUsd: acc.totalDeliveryFeesUsd + Number(order.delivery_fee_usd || 0),
        totalDeliveryFeesLbp: acc.totalDeliveryFeesLbp + Number(order.delivery_fee_lbp || 0),
      };
    }
  }, {
    totalCollectedUsd: 0,
    totalCollectedLbp: 0,
    totalOrderAmountUsd: 0,
    totalOrderAmountLbp: 0,
    totalDeliveryFeesUsd: 0,
    totalDeliveryFeesLbp: 0,
    totalDriverPaidUsd: 0,
    totalDriverPaidLbp: 0,
  });
}

/**
 * Standard query keys for consistency
 */
export const QUERY_KEYS = {
  drivers: ['drivers'],
  driversForStatement: ['drivers'],
  driverPendingOrders: (driverId: string) => ['driver-pending-orders', driverId],
  driverStatements: (driverId?: string) => driverId ? ['driver-statements', driverId] : ['driver-statements'],
  orders: ['orders'],
  cashbox: (date: string) => ['cashbox', date],
  clients: ['clients'],
  clientTransactions: (clientId: string) => ['client-transactions', clientId],
} as const;
