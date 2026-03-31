-- Atomic apply: deduct tokens, record transaction, insert application.
-- Replace any existing function with the same signature.

CREATE OR REPLACE FUNCTION public.apply_to_job(p_job_id uuid, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cost int;
  v_balance int;
  v_expires timestamptz;
  v_wallet_id uuid;
  v_existing uuid;
  v_ref text;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT token_cost INTO v_cost FROM jobs WHERE id = p_job_id;
  IF v_cost IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Job not found');
  END IF;

  SELECT id, token_balance, expires_at
  INTO v_wallet_id, v_balance, v_expires
  FROM wallets
  WHERE user_id = p_user_id;

  IF v_wallet_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  IF v_expires IS NOT NULL AND v_expires < now() THEN
    RETURN json_build_object('success', false, 'error', 'Tokens expired');
  END IF;

  IF v_balance < v_cost THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient tokens');
  END IF;

  SELECT id INTO v_existing
  FROM applications
  WHERE job_id = p_job_id AND user_id = p_user_id;

  IF v_existing IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Already applied');
  END IF;

  UPDATE wallets
  SET token_balance = token_balance - v_cost
  WHERE id = v_wallet_id;

  INSERT INTO applications (job_id, user_id, status)
  VALUES (p_job_id, p_user_id, 'pending');

  v_ref := 'APP-' || substring(replace(gen_random_uuid()::text, '-', ''), 1, 12);

  INSERT INTO transactions (wallet_id, tokens_added, type, reference_id, status)
  VALUES (v_wallet_id, -v_cost, 'application', v_ref, 'completed');

  RETURN json_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_to_job(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_to_job(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_to_job(uuid, uuid) TO service_role;
