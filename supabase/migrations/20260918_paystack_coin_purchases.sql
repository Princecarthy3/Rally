create or replace function public.credit_paystack_purchase(
  p_user_id uuid,
  p_reference text,
  p_package_id text,
  p_amount_pesewas integer
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  coins integer;
  expected_amount integer;
  new_balance integer;
begin
  select package_coins, package_amount
  into coins, expected_amount
  from (values
    ('starter', 1000, 200),
    ('popular', 4000, 500),
    ('pro', 9500, 1000),
    ('mega', 21500, 2000),
    ('ultimate', 37500, 3000)
  ) as packages(id, package_coins, package_amount)
  where id = p_package_id;
  if coins is null or expected_amount <> p_amount_pesewas then raise exception 'Invalid payment package'; end if;
  if exists (
    select 1 from public.coin_transactions
    where user_id = p_user_id and transaction_type = 'paystack_purchase' and reference_id = p_reference
  ) then
    return jsonb_build_object('alreadyCredited', true, 'balance', (select balance from public.user_wallets where user_id = p_user_id));
  end if;
  update public.user_wallets
  set balance = balance + coins, updated_at = now()
  where user_id = p_user_id
  returning balance into new_balance;
  if new_balance is null then raise exception 'Wallet not found'; end if;
  insert into public.coin_transactions(user_id, amount, transaction_type, description, reference_id)
  values (p_user_id, coins, 'paystack_purchase', 'Purchased ' || coins || ' Rally Coins', p_reference);
  return jsonb_build_object('alreadyCredited', false, 'balance', new_balance, 'coins', coins);
end;
$$;

revoke execute on function public.credit_paystack_purchase(uuid, text, text, integer) from public, authenticated;
grant execute on function public.credit_paystack_purchase(uuid, text, text, integer) to service_role;
