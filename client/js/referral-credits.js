(function () {
  'use strict';

  function getDb() {
    return window.SUPABASE_CLIENT || window.supabaseClient || null;
  }

  function toNumber(value) {
    var n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  }

  async function loadClientRewardCredits(clientId) {
    var db = getDb();
    if (!db || !clientId) return [];

    var res = await db
      .from('client_reward_credits')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (res.error) throw res.error;
    return res.data || [];
  }

  function calculateTotalCredits(credits) {
    return (credits || []).reduce(function (sum, credit) {
      if (credit.status === 'cancelled') return sum;
      return sum + toNumber(credit.amount_chf);
    }, 0);
  }

  function calculateAvailableCredits(credits) {
    return (credits || []).reduce(function (sum, credit) {
      if (credit.status !== 'available' && credit.status !== 'partially_used') return sum;
      return sum + toNumber(credit.remaining_amount_chf);
    }, 0);
  }

  function calculateUsedCredits(credits) {
    return (credits || []).reduce(function (sum, credit) {
      if (credit.status === 'cancelled') return sum;
      return sum + toNumber(credit.used_amount_chf);
    }, 0);
  }

  function simulateInvoiceCreditDeduction(invoiceTotal, availableCredit, maxPercent) {
    var invoice = Math.max(toNumber(invoiceTotal), 0);
    var credit = Math.max(toNumber(availableCredit), 0);
    var percent = Math.max(toNumber(maxPercent || 50), 0);
    var maxDeduction = Math.round(invoice * percent) / 100;
    var applied = Math.min(credit, maxDeduction);

    return {
      invoice_total_chf: invoice,
      available_credit_chf: credit,
      max_deduction_chf: maxDeduction,
      credit_applied_chf: applied,
      amount_to_pay_chf: Math.max(invoice - applied, 0),
      remaining_credit_chf: Math.max(credit - applied, 0)
    };
  }

  window.ColixoReferralCredits = {
    loadClientRewardCredits: loadClientRewardCredits,
    calculateTotalCredits: calculateTotalCredits,
    calculateAvailableCredits: calculateAvailableCredits,
    calculateUsedCredits: calculateUsedCredits,
    simulateInvoiceCreditDeduction: simulateInvoiceCreditDeduction
  };
})();
