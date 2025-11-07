import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { orderId } = await req.json()

    if (!orderId) {
      throw new Error('Order ID is required')
    }

    console.log('Attempting to delete order with accounting reversal for orderId:', orderId)

    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (orderError) {
      console.error('Error fetching order:', orderError)
      throw orderError
    }

    if (!order) {
      throw new Error('Order not found')
    }

    let reversalNotes = `Order ${order.order_id} deleted. Accounting reversed.`;

    if (order.status === 'Delivered') {
      console.log('Order was delivered, reversing accounting entries...');

      // 1. Reverse Driver Wallet Changes
      if (order.driver_id) {
        console.log(`Reversing driver wallet for driver ${order.driver_id}...`);
        const { data: driver, error: driverFetchError } = await supabaseClient
          .from('drivers')
          .select('wallet_usd, wallet_lbp')
          .eq('id', order.driver_id)
          .single();

        if (driverFetchError) {
          console.error('Error fetching driver for reversal:', driverFetchError);
          throw driverFetchError;
        }

        if (driver) {
          let newWalletUsd = Number(driver.wallet_usd);
          let newWalletLbp = Number(driver.wallet_lbp);

          if (order.driver_paid_for_client) {
            // If driver paid for client, they were debited. Credit them back.
            newWalletUsd += Number(order.driver_paid_amount_usd);
            newWalletLbp += Number(order.driver_paid_amount_lbp);
            reversalNotes += ` Driver wallet credited back $${Number(order.driver_paid_amount_usd).toFixed(2)} / ${Number(order.driver_paid_amount_lbp).toLocaleString()} LBP (driver paid for client).`;
          } else {
            // If normal delivery, driver was credited delivery fee. Debit them back.
            newWalletUsd -= Number(order.delivery_fee_usd);
            newWalletLbp -= Number(order.delivery_fee_lbp);
            reversalNotes += ` Driver wallet debited $${Number(order.delivery_fee_usd).toFixed(2)} / ${Number(order.delivery_fee_lbp).toLocaleString()} LBP (delivery fee).`;
          }

          const { error: walletUpdateError } = await supabaseClient
            .from('drivers')
            .update({
              wallet_usd: newWalletUsd,
              wallet_lbp: newWalletLbp,
            })
            .eq('id', order.driver_id);

          if (walletUpdateError) {
            console.error('Error updating driver wallet during reversal:', walletUpdateError);
            throw walletUpdateError;
          }
          console.log(`Driver ${order.driver_id} wallet updated. New USD: ${newWalletUsd}, New LBP: ${newWalletLbp}`);
        }
      }

      // 2. Reverse Cashbox entries if order was prepaid by company
      if (order.prepaid_by_company && (Number(order.prepay_amount_usd) > 0 || Number(order.prepay_amount_lbp) > 0)) {
        console.log('Reversing cashbox entries for prepayment...');
        const today = new Date().toISOString().split('T')[0];
        const { data: cashbox, error: cashboxFetchError } = await supabaseClient
          .from('cashbox_daily')
          .select('*')
          .eq('date', today)
          .maybeSingle();

        if (cashboxFetchError) {
          console.error('Error fetching cashbox for reversal:', cashboxFetchError);
          throw cashboxFetchError;
        }

        if (cashbox) {
          const { error: cashboxUpdateError } = await supabaseClient
            .from('cashbox_daily')
            .update({
              cash_out_usd: Number(cashbox.cash_out_usd) - Number(order.prepay_amount_usd),
              cash_out_lbp: Number(cashbox.cash_out_lbp) - Number(order.prepay_amount_lbp),
              notes: `${cashbox.notes || ''}\n${new Date().toLocaleString()}: Reversed prepayment for order ${order.order_id} ($${Number(order.prepay_amount_usd).toFixed(2)} / ${Number(order.prepay_amount_lbp).toLocaleString()} LBP).`
            })
            .eq('id', cashbox.id);

          if (cashboxUpdateError) {
            console.error('Error updating cashbox for prepayment reversal:', cashboxUpdateError);
            throw cashboxUpdateError;
          }
          reversalNotes += ` Cashbox cash-out reversed for prepayment $${Number(order.prepay_amount_usd).toFixed(2)} / ${Number(order.prepay_amount_lbp).toLocaleString()} LBP.`;
          console.log('Cashbox updated for prepayment reversal.');
        }
      }
    }

    // 3. Delete all associated transactions and accounting entries
    console.log(`Deleting driver transactions for order_ref: ${order.order_id}...`);
    const { error: driverTxDeleteError } = await supabaseClient
      .from('driver_transactions')
      .delete()
      .eq('order_ref', order.order_id);
    if (driverTxDeleteError) {
      console.error('Error deleting driver transactions:', driverTxDeleteError);
      throw driverTxDeleteError;
    }
    console.log('Driver transactions deleted.');

    console.log(`Deleting client transactions for order_ref: ${order.order_id}...`);
    const { error: clientTxDeleteError } = await supabaseClient
      .from('client_transactions')
      .delete()
      .eq('order_ref', order.order_id);
    if (clientTxDeleteError) {
      console.error('Error deleting client transactions:', clientTxDeleteError);
      throw clientTxDeleteError;
    }
    console.log('Client transactions deleted.');

    console.log(`Deleting accounting entries for order_ref: ${order.order_id}...`);
    const { error: accountingDeleteError } = await supabaseClient
      .from('accounting_entries')
      .delete()
      .eq('order_ref', order.order_id);
    if (accountingDeleteError) {
      console.error('Error deleting accounting entries:', accountingDeleteError);
      throw accountingDeleteError;
    }
    console.log('Accounting entries deleted.');

    // 4. Finally, delete the order itself
    console.log(`Deleting order with ID: ${orderId}...`);
    const { error: orderDeleteError } = await supabaseClient
      .from('orders')
      .delete()
      .eq('id', orderId);

    if (orderDeleteError) {
      console.error('Error deleting order:', orderDeleteError);
      throw orderDeleteError;
    }
    console.log('Order deleted successfully.');

    return new Response(
      JSON.stringify({
        success: true,
        message: reversalNotes,
        order_id: order.order_id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Error in delete-order-with-accounting function:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})