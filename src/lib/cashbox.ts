import { supabase } from '@/integrations/supabase/client';

interface CashboxUpdateParams {
  date: string;
  cashInUsdChange?: number;
  cashInLbpChange?: number;
  cashOutUsdChange?: number;
  cashOutLbpChange?: number;
  note?: string;
}

export async function updateCashboxDaily({
  date,
  cashInUsdChange = 0,
  cashInLbpChange = 0,
  cashOutUsdChange = 0,
  cashOutLbpChange = 0,
  note,
}: CashboxUpdateParams) {
  const { data: existingCashbox, error: fetchError } = await supabase
    .from('cashbox_daily')
    .select('*')
    .eq('date', date)
    .maybeSingle();

  if (fetchError) {
    console.error('Error fetching cashbox_daily:', fetchError);
    throw fetchError;
  }

  let currentOpeningUsd = existingCashbox?.opening_usd || 0;
  let currentOpeningLbp = existingCashbox?.opening_lbp || 0;
  let currentCashInUsd = existingCashbox?.cash_in_usd || 0;
  let currentCashInLbp = existingCashbox?.cash_in_lbp || 0;
  let currentCashOutUsd = existingCashbox?.cash_out_usd || 0;
  let currentCashOutLbp = existingCashbox?.cash_out_lbp || 0;
  let currentNotes = existingCashbox?.notes || '';

  const newCashInUsd = currentCashInUsd + cashInUsdChange;
  const newCashInLbp = currentCashInLbp + cashInLbpChange;
  const newCashOutUsd = currentCashOutUsd + cashOutUsdChange;
  const newCashOutLbp = currentCashOutLbp + cashOutLbpChange;

  const newClosingUsd = currentOpeningUsd + newCashInUsd - newCashOutUsd;
  const newClosingLbp = currentOpeningLbp + newCashInLbp - newCashOutLbp;

  const updateData = {
    cash_in_usd: newCashInUsd,
    cash_in_lbp: newCashInLbp,
    cash_out_usd: newCashOutUsd,
    cash_out_lbp: newCashOutLbp,
    closing_usd: newClosingUsd,
    closing_lbp: newClosingLbp,
    notes: note ? `${currentNotes}\n${new Date().toLocaleString()}: ${note}`.trim() : currentNotes,
  };

  if (existingCashbox) {
    const { error: updateError } = await supabase
      .from('cashbox_daily')
      .update(updateData)
      .eq('id', existingCashbox.id);
    if (updateError) {
      console.error('Error updating cashbox_daily:', updateError);
      throw updateError;
    }
  } else {
    const { error: insertError } = await supabase
      .from('cashbox_daily')
      .insert({
        date,
        opening_usd: 0, // Assuming opening balance is 0 for a new day's first entry
        opening_lbp: 0,
        ...updateData,
      });
    if (insertError) {
      console.error('Error inserting cashbox_daily:', insertError);
      throw insertError;
    }
  }
}