-- Create price lookup table for national average prices
CREATE TABLE public.price_lookup (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  canonical_key TEXT NOT NULL UNIQUE,
  avg_price_ils DECIMAL(10,2) NOT NULL,
  sample_count INTEGER NOT NULL DEFAULT 1,
  category TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast text search
CREATE INDEX idx_price_lookup_canonical_key ON public.price_lookup(canonical_key);
CREATE INDEX idx_price_lookup_category ON public.price_lookup(category);

-- Enable RLS
ALTER TABLE public.price_lookup ENABLE ROW LEVEL SECURITY;

-- Anyone can read prices (public data)
CREATE POLICY "Anyone can read price lookup"
ON public.price_lookup
FOR SELECT
USING (true);

-- Create price cache table for storing query->price mappings
CREATE TABLE public.price_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query TEXT NOT NULL,
  canonical_key TEXT,
  avg_price_ils DECIMAL(10,2),
  confidence DECIMAL(3,2),
  sample_count INTEGER,
  cached_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '30 days')
);

-- Create unique index on query for fast lookups
CREATE UNIQUE INDEX idx_price_cache_query ON public.price_cache(query);

-- Enable RLS
ALTER TABLE public.price_cache ENABLE ROW LEVEL SECURITY;

-- Anyone can read/write cache (public app)
CREATE POLICY "Anyone can read price cache"
ON public.price_cache
FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert price cache"
ON public.price_cache
FOR INSERT
WITH CHECK (true);

-- Enable realtime for price updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.price_lookup;