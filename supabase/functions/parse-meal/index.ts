// Parse a free-text meal description into kcal + protein using Lovable AI
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sys = `Tu es un expert en nutrition. Analyse la description d'un aliment ou repas en français et retourne UNIQUEMENT un JSON strict { "name": string, "kcal": number, "protein_g": number }.
- name: reformulation courte et propre (ex: "3 œufs + 300g dinde")
- kcal: total estimé en kilocalories (entier)
- protein_g: total estimé en grammes de protéines (entier)
Bases: 1 œuf ≈ 70 kcal / 6g prot. Dinde cuite 100g ≈ 135 kcal / 28g prot. Poulet cuit 100g ≈ 165 kcal / 31g prot. Riz cuit 100g ≈ 130 kcal / 2.5g prot. Pain 100g ≈ 250 kcal / 8g prot. Avocat 100g ≈ 160 kcal / 2g prot. Lait 100ml ≈ 60 kcal / 3g prot. Banane moy ≈ 90 kcal / 1g prot.
Réponds UNIQUEMENT le JSON, sans texte autour.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: text },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      return new Response(JSON.stringify({ error: "AI error", detail: t }), {
        status: aiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await aiRes.json();
    const content = data?.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }
    return new Response(JSON.stringify({
      name: String(parsed.name || text).slice(0, 200),
      kcal: Math.max(0, Math.round(Number(parsed.kcal) || 0)),
      protein_g: Math.max(0, Math.round(Number(parsed.protein_g) || 0)),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
