import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { materialId } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const geminiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GEMINI_API_INFORA") || "";
    if (!materialId || !supabaseUrl || !serviceRole) throw new Error("Konfigurasi Supabase tidak lengkap.");
    const materialResponse = await fetch(`${supabaseUrl}/rest/v1/materials?id=eq.${encodeURIComponent(materialId)}&select=*`, {
      headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}` }
    });
    const materials = await materialResponse.json();
    const material = Array.isArray(materials) ? materials[0] : null;
    if (!material) throw new Error("Materi tidak ditemukan.");
    const source = [material.title, material.category, material.summary, material.learning_objectives, material.content, material.examples, material.practice_steps, material.faq, material.keywords, material.aliases].filter(Boolean).join("\n\n");
    const chunks = source.split(/\n\s*\n/).map((text: string) => text.trim()).filter((text: string) => text.length > 0);
    await fetch(`${supabaseUrl}/rest/v1/material_chunks?material_id=eq.${encodeURIComponent(materialId)}`, {
      method: "DELETE",
      headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}` }
    });
    if (material.status !== "published" || chunks.length === 0) {
      return new Response(JSON.stringify({ success: true, materialId, chunksCreated: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    let chunkRows: any[] = [];
    for (let i = 0; i < chunks.length; i++) {
      let embedding: number[] | null = null;
      if (geminiKey) {
        const embeddingResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2-preview:embedContent?key=${encodeURIComponent(geminiKey)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: "models/gemini-embedding-2-preview", content: { parts: [{ text: chunks[i] }] } })
        });
        if (embeddingResponse.ok) {
          const payload = await embeddingResponse.json();
          embedding = payload?.embedding?.values || null;
        }
      }
      chunkRows.push({ material_id: materialId, chunk_index: i, chunk_text: chunks[i], embedding, embedding_model: "gemini-embedding-2-preview" });
    }
    const insertResponse = await fetch(`${supabaseUrl}/rest/v1/material_chunks`, {
      method: "POST",
      headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(chunkRows)
    });
    if (!insertResponse.ok) throw new Error(await insertResponse.text());
    return new Response(JSON.stringify({ success: true, materialId, chunksCreated: chunkRows.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
