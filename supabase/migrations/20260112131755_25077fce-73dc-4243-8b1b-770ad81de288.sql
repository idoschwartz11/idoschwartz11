-- Allow service role to manage chain_prices
CREATE POLICY "Service role can manage chain_prices"
ON public.chain_prices
FOR ALL
USING (true)
WITH CHECK (true);

-- Allow service role to manage price_lookup
CREATE POLICY "Service role can insert price_lookup"
ON public.price_lookup
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service role can update price_lookup"
ON public.price_lookup
FOR UPDATE
USING (true);