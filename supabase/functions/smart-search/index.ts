import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BoundingBox {
  x: number; // percentage from left (0-100)
  y: number; // percentage from top (0-100)
  width: number; // percentage of frame width
  height: number; // percentage of frame height
}

interface SearchResult {
  id: string;
  timestamp: string;
  timeInVideo: number;
  description: string;
  confidence: number;
  matchedCriteria: string[];
  boundingBox?: BoundingBox;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, frames, videoDuration } = await req.json();
    
    if (!query) {
      return new Response(
        JSON.stringify({ error: "Query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[SmartSearch] Processing query:", query);
    console.log("[SmartSearch] Video duration:", videoDuration);
    console.log("[SmartSearch] Frames received:", frames?.length || 0);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build messages with video frames for vision analysis
    const messages: any[] = [];
    
    // System prompt for video analysis
    const systemPrompt = `You are an advanced CCTV video analysis AI. You analyze video frames to find specific objects, people, or events based on user queries.

IMPORTANT: You are analyzing REAL video frames. Look carefully at each frame and identify what is actually visible.

When given a search query, you must:
1. Carefully examine each provided video frame
2. Identify objects, people, vehicles, colors, and activities that match the query
3. Note the timestamp of each frame where you find matches
4. Estimate the bounding box location of the detected object/person

For bounding boxes, provide approximate positions as percentages:
- x: percentage from left edge (0-100)
- y: percentage from top edge (0-100)
- width: percentage of frame width (typically 10-40 for a person/object)
- height: percentage of frame height (typically 15-60 for a person/object)

Respond with a JSON object containing:
- "summary": A natural language summary of what you found (be specific about colors, counts, locations)
- "results": An array of search results, each with:
  - "id": Unique identifier (e.g., "result_001")
  - "timestamp": Human readable time from the frame (e.g., "0:15")
  - "timeInVideo": Time in seconds (number, use the frame's timestamp)
  - "description": Detailed description of what was detected
  - "confidence": Confidence score between 0.75 and 0.98
  - "matchedCriteria": Array of criteria that matched the query
  - "boundingBox": Object with x, y, width, height as percentages

If you don't find any matches for the query, be honest and say so. Only report what you actually see in the frames.`;

    messages.push({ role: "system", content: systemPrompt });

    // Build user message with frames
    if (frames && frames.length > 0) {
      const content: any[] = [
        { type: "text", text: `Search query: "${query}"\n\nAnalyze these ${frames.length} frames from the CCTV footage. Each frame has a timestamp label. Find anything matching the query and provide exact locations.` }
      ];
      
      // Add frames as images (limit to 20 frames to stay within limits)
      const maxFrames = Math.min(frames.length, 20);
      const step = Math.max(1, Math.floor(frames.length / maxFrames));
      let framesAdded = 0;
      
      for (let i = 0; i < frames.length && framesAdded < maxFrames; i += step) {
        const frame = frames[i];
        if (frame.data) {
          content.push({
            type: "image_url",
            image_url: {
              url: frame.data,
              detail: "low" // Use low detail to save tokens but still get good analysis
            }
          });
          content.push({
            type: "text",
            text: `[Frame at ${frame.timestamp}s]`
          });
          framesAdded++;
        }
      }
      
      messages.push({ role: "user", content });
    } else {
      // Fallback if no frames provided
      messages.push({ 
        role: "user", 
        content: `Search query: "${query}"\n\nNo frames were provided. Please indicate that video frames are required for accurate analysis.`
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash", // Vision-capable model (Lovable gateway format)
        messages,
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
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
      parsedResponse = {
        summary: "I analyzed the footage but encountered an error parsing the results. Please try again.",
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
