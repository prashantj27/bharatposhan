import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { district, state, indicators } = await req.json();
    if (!district || !state) {
      return new Response(JSON.stringify({ error: "district and state are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const ind = indicators || {};
    const prompt = `You are an expert Indian public health policy analyst specializing in district-level nutrition programs.

Analyze ${district} district in ${state}, India for malnutrition interventions.

NFHS-5 (2019-21) indicators for this district:
- Stunting: ${ind.stunting ?? "N/A"}%
- Wasting: ${ind.wasting ?? "N/A"}%
- Underweight: ${ind.underweight ?? "N/A"}%
- Anemia (Children <5): ${ind.anemia_children ?? "N/A"}%
- Anemia (Women 15-49): ${ind.anemia_women ?? "N/A"}%
- Exclusive Breastfeeding: ${ind.breastfeeding ?? "N/A"}%
- Full Immunization: ${ind.immunization ?? "N/A"}%
- Composite Risk Score: ${ind.risk ?? "N/A"}

Based on these indicators and your knowledge of:
1. ${district}'s geography, tribal population %, urban/rural split, major livelihoods
2. Existing government schemes running in ${state}
3. Success/failure of past interventions in similar districts
4. State-specific nutrition mission status
5. Infrastructure gaps (health centers, AWCs, water supply)

Generate a JSON response with EXACTLY this structure:
{
  "interventions": [
    {
      "name": "Short intervention name (max 8 words)",
      "description": "One sentence on what this does for this specific district",
      "rationale": "Why this is critical for ${district} specifically based on its data",
      "expected_impact": "Specific measurable outcome e.g. 'Reduce stunting from 55% to 40% in 3 years'",
      "budget_cr": 150,
      "priority": "critical|high|medium",
      "category": "nutrition|wash|health|livelihood|education",
      "implementing_agency": "Which ministry/department leads this",
      "timeline_months": 36,
      "target_beneficiaries": "Who and how many",
      "key_activities": ["activity1", "activity2", "activity3"],
      "risks": ["risk1", "risk2"],
      "success_indicators": ["kpi1", "kpi2"]
    }
  ],
  "district_context": {
    "geography": "Brief geography/terrain description",
    "population_profile": "Demographics, tribal %, literacy, major occupations",
    "infrastructure_gaps": "Key infrastructure deficits",
    "existing_schemes": ["scheme1", "scheme2"],
    "key_challenges": ["challenge1", "challenge2", "challenge3"]
  },
  "five_year_projection": {
    "stunting_target": 25,
    "wasting_target": 15,
    "underweight_target": 22,
    "anemia_children_target": 40,
    "immunization_target": 95
  }
}

RULES:
- Generate exactly 4 interventions, tailored to THIS district's specific problems
- Budget estimates must be realistic for Indian district-level programs (in ₹ Crores)
- If stunting > 40%, prioritize WASH and maternal nutrition
- If wasting > 25%, prioritize therapeutic feeding and health infrastructure
- If immunization < 70%, include health outreach as top priority
- If anemia > 70%, include IFA supplementation
- If breastfeeding < 50%, include MAA programme
- Reference real Indian government schemes (Poshan Abhiyaan, ICDS, SBM, JJM, etc.)
- Be specific to this district, not generic India-wide recommendations
- Return ONLY valid JSON, no markdown or explanation`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: "You are a district-level nutrition policy expert for India. Always return valid JSON only.\n\n" + prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI analysis failed", fallback: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await response.json();
    let content = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          console.error("Failed to parse AI response:", content.substring(0, 500));
          return new Response(JSON.stringify({ error: "Failed to parse AI analysis.", fallback: true }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        return new Response(JSON.stringify({ error: "Failed to parse AI analysis.", fallback: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ success: true, analysis: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-district error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", fallback: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
