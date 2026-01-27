import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SearchResult {
  id: string;
  timestamp: string;
  timeInVideo: number;
  description: string;
  confidence: number;
  matchedCriteria: string[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, videoDuration } = await req.json();
    
    if (!query) {
      return new Response(
        JSON.stringify({ error: "Query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[SmartSearch] Processing query:", query);
    console.log("[SmartSearch] Video duration:", videoDuration);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Use AI to analyze the query and generate realistic search results
    // In a production system, this would analyze actual video frames
    const systemPrompt = `You are an AI video analysis assistant for a CCTV security system. 
Your task is to analyze search queries about security footage and generate realistic search results.

The video is a demo CCTV footage showing people walking in a corridor/hallway area. 
The video duration is approximately ${videoDuration || 60} seconds.

When given a search query, you should:
1. Parse the natural language query to understand what the user is looking for
2. Generate 2-5 realistic search results with specific timestamps
3. Each result should include a description of what was found and confidence score

Respond with a JSON object containing:
- "summary": A brief natural language summary of what was found
- "results": An array of search results, each with:
  - "id": Unique identifier
  - "timestamp": Human readable time (e.g., "0:15")
  - "timeInVideo": Time in seconds (number)
  - "description": What was detected at this moment
  - "confidence": Confidence score between 0.7 and 0.98
  - "matchedCriteria": Array of criteria that matched the query

For this demo, generate plausible results based on typical CCTV footage scenarios.
Be creative but realistic - the footage shows people walking through a corridor.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Search query: "${query}"` }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[SmartSearch] AI API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No response from AI");
    }

    console.log("[SmartSearch] AI response:", content);

    // Parse the AI response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(content);
    } catch (parseError) {
      console.error("[SmartSearch] Failed to parse AI response:", parseError);
      // Fallback response
      parsedResponse = {
        summary: "I analyzed the footage but couldn't find specific matches for your query. Try a different search term.",
        results: []
      };
    }

    return new Response(
      JSON.stringify(parsedResponse),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[SmartSearch] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        summary: "An error occurred while searching. Please try again.",
        results: []
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
