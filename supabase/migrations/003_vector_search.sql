-- ====================================================================
-- INFORA — MIGRATION 003: PGVECTOR VECTOR SEARCH RPC
-- Function for semantic search over material chunks
-- ====================================================================

CREATE OR REPLACE FUNCTION match_material_chunks (
  query_embedding VECTOR(768),
  match_threshold FLOAT DEFAULT 0.28,
  match_count INT DEFAULT 4
)
RETURNS TABLE (
  id UUID,
  material_id UUID,
  chunk_index INT,
  chunk_text TEXT,
  similarity FLOAT,
  material_title TEXT,
  material_category TEXT,
  material_summary TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mc.id,
    mc.material_id,
    mc.chunk_index,
    mc.chunk_text,
    1 - (mc.embedding <=> query_embedding) AS similarity,
    m.title AS material_title,
    m.category AS material_category,
    m.summary AS material_summary
  FROM public.material_chunks mc
  JOIN public.materials m ON mc.material_id = m.id
  WHERE m.status = 'published'
    AND 1 - (mc.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
