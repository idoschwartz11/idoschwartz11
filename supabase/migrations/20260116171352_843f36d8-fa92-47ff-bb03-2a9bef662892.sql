-- Create the resolve_query function that resolves user input to canonical products
CREATE OR REPLACE FUNCTION public.resolve_query(q TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  normalized_query TEXT;
  found_key TEXT;
  match_confidence NUMERIC;
  match_source TEXT;
BEGIN
  -- Normalize the query
  normalized_query := lower(trim(regexp_replace(q, '[\s]+', ' ', 'g')));
  
  -- First, try exact match in price_lookup
  SELECT canonical_key INTO found_key
  FROM price_lookup
  WHERE lower(canonical_key) = normalized_query
  LIMIT 1;
  
  IF found_key IS NOT NULL THEN
    result := json_build_object(
      'resolved', found_key,
      'confidence', 1.0,
      'source', 'exact'
    );
    RETURN result;
  END IF;
  
  -- Second, try exact match in price_cache
  SELECT canonical_key INTO found_key
  FROM price_cache
  WHERE lower(query) = normalized_query
    AND canonical_key IS NOT NULL
  LIMIT 1;
  
  IF found_key IS NOT NULL THEN
    result := json_build_object(
      'resolved', found_key,
      'confidence', 0.95,
      'source', 'cache'
    );
    RETURN result;
  END IF;
  
  -- Third, try partial match in price_lookup (contains all words)
  SELECT canonical_key INTO found_key
  FROM price_lookup
  WHERE lower(canonical_key) LIKE '%' || normalized_query || '%'
  ORDER BY length(canonical_key) ASC
  LIMIT 1;
  
  IF found_key IS NOT NULL THEN
    result := json_build_object(
      'resolved', found_key,
      'confidence', 0.8,
      'source', 'partial'
    );
    RETURN result;
  END IF;
  
  -- Fourth, try word-based matching (all words from query must appear)
  DECLARE
    word TEXT;
    words TEXT[];
    query_pattern TEXT := '';
  BEGIN
    words := string_to_array(normalized_query, ' ');
    
    IF array_length(words, 1) > 0 THEN
      -- Build pattern for matching all words
      SELECT canonical_key INTO found_key
      FROM price_lookup
      WHERE (
        SELECT bool_and(lower(canonical_key) LIKE '%' || word || '%')
        FROM unnest(words) AS word
      )
      ORDER BY length(canonical_key) ASC
      LIMIT 1;
      
      IF found_key IS NOT NULL THEN
        result := json_build_object(
          'resolved', found_key,
          'confidence', 0.6,
          'source', 'words'
        );
        RETURN result;
      END IF;
    END IF;
  END;
  
  -- No match found - return fallback
  result := json_build_object(
    'resolved', NULL,
    'confidence', 0,
    'source', 'fallback'
  );
  RETURN result;
END;
$$;