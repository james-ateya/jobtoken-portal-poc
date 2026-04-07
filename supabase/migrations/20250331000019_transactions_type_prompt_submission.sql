-- Allow wallet transactions for prompt answers (type = 'prompt_submission').
-- Rebuild the CHECK from every distinct `type` already in the table plus `prompt_submission`,
-- so legacy or extra values do not violate the new constraint.

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;

DO $$
DECLARE
  allowed text[];
  in_list text;
BEGIN
  SELECT coalesce(
    (
      SELECT array_agg(sub.t ORDER BY sub.t)
      FROM (
        SELECT DISTINCT type AS t
        FROM public.transactions
        WHERE type IS NOT NULL
      ) sub
    ),
    ARRAY[]::text[]
  )
  INTO allowed;

  IF NOT ('prompt_submission' = ANY (allowed)) THEN
    allowed := array_append(allowed, 'prompt_submission');
  END IF;

  SELECT string_agg(quote_literal(t), ', ' ORDER BY t)
  INTO in_list
  FROM unnest(allowed) AS u(t);

  IF in_list IS NULL OR btrim(in_list) = '' THEN
    in_list := quote_literal('prompt_submission');
  END IF;

  EXECUTE format(
    'ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check CHECK (type IN (%s))',
    in_list
  );
END;
$$;

COMMENT ON CONSTRAINT transactions_type_check ON public.transactions IS
  'Allowed wallet transaction kinds; extended at migration time with existing distinct types + prompt_submission.';
