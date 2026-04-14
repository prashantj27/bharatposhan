import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { district, state, indicators, interventions, drivers, reportType } = await req.json();
    if (!district || !state) {
      return new Response(JSON.stringify({ error: "district and state are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY is not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ind = indicators || {};
    const driversText = (drivers || []).map((d: any) => `${d.factor}: ${d.contribution}%`).join(", ");
    const interventionsText = (interventions || []).join(", ");

    const isSingleIntervention = reportType === "single";

    const prompt = isSingleIntervention
      ? `You are an expert Indian public health policy analyst. Generate a DETAILED single-intervention execution blueprint for "${interventions[0]}" in ${district} district, ${state}.

District NFHS-5 Data: Stunting ${ind.stunting}%, Wasting ${ind.wasting}%, Underweight ${ind.underweight}%, Anemia Children ${ind.anemia_children}%, Anemia Women ${ind.anemia_women}%, Breastfeeding ${ind.breastfeeding}%, Immunization ${ind.immunization}%, Risk Score ${ind.risk}.
Causal Drivers: ${driversText}

Return JSON with this EXACT structure:
{
  "executive_summary": "3-4 sentence summary of the intervention's rationale and expected impact for this district",
  "problem_statement": "Detailed 2-paragraph problem analysis specific to this district, citing NFHS-5 data and local context",
  "intervention_details": {
    "objectives": ["objective1", "objective2", "objective3"],
    "target_population": "Who benefits and estimated numbers",
    "geographic_focus": "Which blocks/areas within the district to prioritize",
    "convergence_schemes": ["Related government scheme 1", "Related scheme 2"]
  },
  "implementation_phases": [
    {
      "phase": "Phase name",
      "duration": "0-6 months",
      "activities": ["activity1", "activity2", "activity3"],
      "budget_cr": 50,
      "responsible_agencies": ["agency1", "agency2"],
      "milestones": ["milestone1", "milestone2"]
    }
  ],
  "budget_breakdown": [
    {"item": "Component name", "amount_cr": 50, "details": "What this covers"}
  ],
  "total_budget_cr": 200,
  "risk_matrix": [
    {"risk": "Risk description", "severity": "HIGH|MEDIUM|LOW", "mitigation": "How to address"}
  ],
  "kpis": [
    {"indicator": "KPI name", "baseline": "Current value", "target": "Target value", "timeline": "By when"}
  ],
  "case_study": "2-3 paragraph case study from a similar Indian district/state that successfully implemented this intervention, with specific data",
  "policy_recommendations": ["rec1", "rec2", "rec3", "rec4", "rec5"],
  "five_year_projection": {
    "year1": "Expected outcome after year 1",
    "year3": "Expected outcome after year 3",
    "year5": "Expected outcome after year 5"
  }
}`
      : `You are an expert Indian public health policy analyst. Generate a COMPREHENSIVE district nutrition report for ${district}, ${state}.

District NFHS-5 Data: Stunting ${ind.stunting}%, Wasting ${ind.wasting}%, Underweight ${ind.underweight}%, Anemia Children ${ind.anemia_children}%, Anemia Women ${ind.anemia_women}%, Breastfeeding ${ind.breastfeeding}%, Immunization ${ind.immunization}%, Risk Score ${ind.risk}.
Causal Drivers: ${driversText}
Current Interventions: ${interventionsText}

Return JSON with this EXACT structure:
{
  "executive_summary": "5-6 sentence executive summary suitable for a NITI Aayog policy brief",
  "district_profile": {
    "geography": "Terrain, climate, urban-rural split",
    "demographics": "Population, tribal %, literacy, occupations",
    "infrastructure": "Health centers, AWCs, water supply status",
    "governance": "Key departments, convergence status"
  },
  "situation_analysis": {
    "nutrition_burden": "2-paragraph analysis of the nutrition situation using NFHS-5 data",
    "determinants": "Analysis of causal drivers and root causes",
    "comparison": "How this district compares to state and national averages",
    "trends": "Historical trends and trajectory"
  },
  "intervention_roadmap": [
    {
      "name": "Intervention name",
      "priority": "critical|high|medium",
      "description": "What this intervention does",
      "budget_cr": 100,
      "timeline_months": 36,
      "expected_impact": "Specific measurable outcome",
      "implementing_agency": "Lead agency",
      "convergence_with": ["Related scheme 1", "Related scheme 2"]
    }
  ],
  "consolidated_budget": {
    "total_cr": 500,
    "central_share_pct": 60,
    "state_share_pct": 30,
    "district_share_pct": 10,
    "breakdown_by_sector": [
      {"sector": "Nutrition", "amount_cr": 200},
      {"sector": "WASH", "amount_cr": 150}
    ]
  },
  "monitoring_framework": {
    "review_mechanism": "How progress will be tracked",
    "data_systems": ["ICDS-CAS", "HMIS", "other systems"],
    "evaluation_schedule": "When evaluations happen"
  },
  "five_year_targets": {
    "stunting": ${Math.round(ind.stunting * 0.7)},
    "wasting": ${Math.round(ind.wasting * 0.72)},
    "underweight": ${Math.round(ind.underweight * 0.7)},
    "anemia_children": ${Math.round(ind.anemia_children * 0.78)},
    "immunization": ${Math.min(Math.round(ind.immunization * 1.18), 98)}
  },
  "policy_recommendations": ["rec1", "rec2", "rec3", "rec4", "rec5"],
  "conclusion": "2-paragraph conclusion with key takeaways and call to action"
}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: "You are a government policy document writer. Return ONLY valid JSON, no markdown.\n\n" + prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
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
      return new Response(JSON.stringify({ error: "AI report generation failed", fallback: true }), {
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
          console.error("Failed to parse AI report:", content.substring(0, 500));
          return new Response(JSON.stringify({ error: "Failed to parse AI report.", fallback: true }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        return new Response(JSON.stringify({ error: "Failed to parse AI report.", fallback: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ success: true, report: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", fallback: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
