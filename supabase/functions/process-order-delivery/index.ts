import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
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

    console.log('Processing delivery for order:', orderId)

    // Get order details with client info
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('*, clients(name)')
      .eq('id', orderId)
      .maybeSingle()

    if (orderError) {
      console.error('Error fetching order:', orderError)
      throw new Error(`Failed to fetch order: ${orderError.message}`)
    }

    if (!order) {
      console.log('Order not found, may have been deleted:', orderId)
      return new Response(
        JSON.stringify({ message: 'Order not found or already deleted' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    console.log('Order found:', order.order_id, 'Status:', order.status)

    // Only process if status is Delivered and not already processed
    if (order.status !== 'Delivered') {
      return new Response(
        JSON.stringify({ message: 'Order is not delivered yet' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Check if already processed (avoid duplicates)
    const { data: existingDriverTx } = await supabaseClient
      .from('driver_transactions')
      .select('id')
      .eq('order_ref', order.order_id)
      .maybeSingle()

    if (existingDriverTx) {
      console.log('Order already processed, skipping')
      return new Response(
        JSON.stringify({ message: 'Order already processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    console.log('Creating transactions for order:', order.order_id)

    // Check if driver paid for client
    const driverPaidForClient = order.driver_paid_for_client === true
    // Check if this is a prepaid (cash) e-commerce order
    const isPrepaidEcom = order.order_type === 'ecom' && (order.prepaid_by_company === true || order.prepaid_by_runners === true)

    if (driverPaidForClient) {
      console.log('Processing driver-paid-for-client scenario')
      
      // 1. Debit client account with order amount + delivery fee
      if (order.client_id) {
        const clientDebitUsd = Number(order.order_amount_usd) + Number(order.delivery_fee_usd)
        const clientDebitLbp = Number(order.order_amount_lbp) + Number(order.delivery_fee_lbp)
        
        if (clientDebitUsd > 0 || clientDebitLbp > 0) {
          console.log('Creating client transaction (order + delivery fee):', {
            client_id: order.client_id,
            amount_usd: clientDebitUsd,
            amount_lbp: clientDebitLbp
          })
          
          const { error: clientTxError } = await supabaseClient
            .from('client_transactions')
            .insert({
              client_id: order.client_id,
              type: 'Debit',
              amount_usd: clientDebitUsd,
              amount_lbp: clientDebitLbp,
              order_ref: order.order_id,
              note: `Order ${order.order_id} delivered (driver paid)`,
            })

          if (clientTxError) {
            console.error('Error creating client transaction:', clientTxError)
            throw clientTxError
          }
        }
      }

      // 2. Debit driver wallet with order amount only (not delivery fee)
      if (order.driver_id && (Number(order.driver_paid_amount_usd) > 0 || Number(order.driver_paid_amount_lbp) > 0)) {
        console.log('Creating driver debit transaction for paid amount:', {
          driver_id: order.driver_id,
          paid_usd: order.driver_paid_amount_usd,
          paid_lbp: order.driver_paid_amount_lbp
        })
        
        const { error: driverTxError } = await supabaseClient
          .from('driver_transactions')
          .insert({
            driver_id: order.driver_id,
            type: 'Debit',
            amount_usd: Number(order.driver_paid_amount_usd),
            amount_lbp: Number(order.driver_paid_amount_lbp),
            order_ref: order.order_id,
            note: `Paid for client on ${order.order_id}${order.driver_paid_reason ? ' - ' + order.driver_paid_reason : ''}`,
          })

        if (driverTxError) {
          console.error('Error creating driver debit transaction:', driverTxError)
          throw driverTxError
        }

        // Update driver wallet balance (deduct the amount paid)
        const { data: driver, error: driverFetchError } = await supabaseClient
          .from('drivers')
          .select('wallet_usd, wallet_lbp')
          .eq('id', order.driver_id)
          .single()

        if (driverFetchError) {
          console.error('Error fetching driver:', driverFetchError)
          throw driverFetchError
        }

        if (driver) {
          const newWalletUsd = Number(driver.wallet_usd) - Number(order.driver_paid_amount_usd)
          const newWalletLbp = Number(driver.wallet_lbp) - Number(order.driver_paid_amount_lbp)
          
          console.log('Updating driver wallet (deducting):', {
            old_usd: driver.wallet_usd,
            new_usd: newWalletUsd,
            old_lbp: driver.wallet_lbp,
            new_lbp: newWalletLbp
          })
          
          const { error: walletError } = await supabaseClient
            .from('drivers')
            .update({
              wallet_usd: newWalletUsd,
              wallet_lbp: newWalletLbp,
            })
            .eq('id', order.driver_id)

          if (walletError) {
            console.error('Error updating driver wallet:', walletError)
            throw walletError
          }
        }
      }

      // Set driver_remit_status to Pending for driver-paid orders too
      const { error: remitError } = await supabaseClient
        .from('orders')
        .update({ driver_remit_status: 'Pending' })
        .eq('id', orderId)

      if (remitError) {
        console.error('Error updating remit status:', remitError)
        throw remitError
      }
      
      console.log('Driver-paid-for-client scenario processed successfully')
    } else if (isPrepaidEcom) {
      // PREPAID E-COMMERCE ORDER SCENARIO
      // Company already paid client upfront, now we collect from customer and return to cashbox
      console.log('Processing prepaid e-commerce order scenario')
      
      const collectedUsd = Number(order.order_amount_usd)
      const collectedLbp = Number(order.order_amount_lbp)
      
      // 1. Credit driver wallet with order amount (driver collected it)
      if (order.driver_id && (collectedUsd > 0 || collectedLbp > 0)) {
        console.log('Creating driver credit transaction for collected amount:', {
          driver_id: order.driver_id,
          amount_usd: collectedUsd,
          amount_lbp: collectedLbp
        })
        
        const { error: driverTxError } = await supabaseClient
          .from('driver_transactions')
          .insert({
            driver_id: order.driver_id,
            type: 'Credit',
            amount_usd: collectedUsd,
            amount_lbp: collectedLbp,
            order_ref: order.order_id,
            note: `Collected for prepaid order ${order.order_id}`,
          })

        if (driverTxError) {
          console.error('Error creating driver transaction:', driverTxError)
          throw driverTxError
        }

        // Update driver wallet balance
        const { data: driver, error: driverFetchError } = await supabaseClient
          .from('drivers')
          .select('wallet_usd, wallet_lbp')
          .eq('id', order.driver_id)
          .single()

        if (driverFetchError) {
          console.error('Error fetching driver:', driverFetchError)
          throw driverFetchError
        }

        if (driver) {
          const newWalletUsd = Number(driver.wallet_usd) + collectedUsd
          const newWalletLbp = Number(driver.wallet_lbp) + collectedLbp
          
          console.log('Updating driver wallet (adding collected):', {
            old_usd: driver.wallet_usd,
            new_usd: newWalletUsd,
            old_lbp: driver.wallet_lbp,
            new_lbp: newWalletLbp
          })
          
          const { error: walletError } = await supabaseClient
            .from('drivers')
            .update({
              wallet_usd: newWalletUsd,
              wallet_lbp: newWalletLbp,
            })
            .eq('id', order.driver_id)

          if (walletError) {
            console.error('Error updating driver wallet:', walletError)
            throw walletError
          }
        }
      }

      // 2. Update order collected amount and set remit status to Pending
      const { error: orderUpdateError } = await supabaseClient
        .from('orders')
        .update({ 
          collected_amount_usd: collectedUsd,
          collected_amount_lbp: collectedLbp,
          driver_remit_status: 'Pending'
        })
        .eq('id', orderId)

      if (orderUpdateError) {
        console.error('Error updating order collected amount:', orderUpdateError)
        throw orderUpdateError
      }
      
      // 3. Credit client account (offset the debit from prepayment)
      // This closes the loop - we prepaid client (debit), now we credit back
      if (order.client_id && (collectedUsd > 0 || collectedLbp > 0)) {
        console.log('Creating client credit transaction to offset prepayment')
        
        const { error: clientTxError } = await supabaseClient
          .from('client_transactions')
          .insert({
            client_id: order.client_id,
            type: 'Credit',
            amount_usd: collectedUsd,
            amount_lbp: collectedLbp,
            order_ref: order.order_id,
            note: `Collected for prepaid order ${order.order_id}`,
          })

        if (clientTxError) {
          console.error('Error creating client transaction:', clientTxError)
          throw clientTxError
        }
      }

      console.log('Prepaid e-commerce order processed successfully')
    } else {
      // Normal delivery scenario - driver collects payment
      console.log('Processing normal delivery scenario')
      
      // 1. Credit driver wallet with delivery fee + order amount (driver collected everything)
      if (order.driver_id) {
        const driverCreditUsd = Number(order.delivery_fee_usd) + Number(order.order_amount_usd);
        const driverCreditLbp = Number(order.delivery_fee_lbp) + Number(order.order_amount_lbp);
        
        if (driverCreditUsd > 0 || driverCreditLbp > 0) {
          console.log('Creating driver transaction for delivery fee + order amount:', {
            driver_id: order.driver_id,
            total_usd: driverCreditUsd,
            total_lbp: driverCreditLbp
          })
          
          const { error: driverTxError } = await supabaseClient
            .from('driver_transactions')
            .insert({
              driver_id: order.driver_id,
              type: 'Credit',
              amount_usd: driverCreditUsd,
              amount_lbp: driverCreditLbp,
              order_ref: order.order_id,
              note: `Delivery for ${order.order_id} (Fee: $${order.delivery_fee_usd}/${order.delivery_fee_lbp} LBP + Amount: $${order.order_amount_usd}/${order.order_amount_lbp} LBP)`,
            })

          if (driverTxError) {
            console.error('Error creating driver transaction:', driverTxError)
            throw driverTxError
          }

          // Update driver wallet balance
          const { data: driver, error: driverFetchError } = await supabaseClient
            .from('drivers')
            .select('wallet_usd, wallet_lbp')
            .eq('id', order.driver_id)
            .single()

          if (driverFetchError) {
            console.error('Error fetching driver:', driverFetchError)
            throw driverFetchError
          }

          if (driver) {
            const newWalletUsd = Number(driver.wallet_usd) + driverCreditUsd
            const newWalletLbp = Number(driver.wallet_lbp) + driverCreditLbp
            
            console.log('Updating driver wallet:', {
              old_usd: driver.wallet_usd,
              new_usd: newWalletUsd,
              old_lbp: driver.wallet_lbp,
              new_lbp: newWalletLbp
            })
            
            const { error: walletError } = await supabaseClient
              .from('drivers')
              .update({
                wallet_usd: newWalletUsd,
                wallet_lbp: newWalletLbp,
              })
              .eq('id', order.driver_id)

            if (walletError) {
              console.error('Error updating driver wallet:', walletError)
              throw walletError
            }
          }

          // Set driver_remit_status to Pending so it shows up for remittance
          const { error: remitError } = await supabaseClient
            .from('orders')
            .update({ driver_remit_status: 'Pending' })
            .eq('id', orderId)

          if (remitError) {
            console.error('Error updating remit status:', remitError)
            throw remitError
          }
          
          console.log('Driver wallet and remit status updated successfully')
        } else {
          console.log('Skipping driver transaction - no amounts to credit')
        }
      } else {
        console.log('Skipping driver transaction - no driver assigned')
      }

      // 2. Credit client account with order amount (we owe them - we collected their customer's money)
      if (order.client_id && (order.order_amount_usd > 0 || order.order_amount_lbp > 0)) {
        console.log('Creating client transaction for order amount (Credit - we owe client)')
        
        const { error: clientTxError } = await supabaseClient
          .from('client_transactions')
          .insert({
            client_id: order.client_id,
            type: 'Credit',
            amount_usd: order.order_amount_usd,
            amount_lbp: order.order_amount_lbp,
            order_ref: order.order_id,
            note: `Order ${order.order_id} delivered`,
          })

        if (clientTxError) {
          console.error('Error creating client transaction:', clientTxError)
          throw clientTxError
        }
      }
    }

    // 3. Record delivery fee as income in accounting
    if (order.delivery_fee_usd > 0 || order.delivery_fee_lbp > 0) {
      console.log('Recording delivery fee as income')
      
      const { error: incomeError } = await supabaseClient
        .from('accounting_entries')
        .insert({
          category: 'DeliveryIncome',
          amount_usd: order.delivery_fee_usd,
          amount_lbp: order.delivery_fee_lbp,
          order_ref: order.order_id,
          memo: `Delivery income from ${order.order_id}`,
        })

      if (incomeError) {
        console.error('Error creating income entry:', incomeError)
        throw incomeError
      }
    }

    console.log('Successfully processed delivery for order:', order.order_id)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Delivery processed successfully',
        order_id: order.order_id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Error processing delivery:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})