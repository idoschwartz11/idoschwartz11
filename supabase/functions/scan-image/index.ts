import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!imageBase64) {
      throw new Error("No image provided");
    }

    console.log("Processing image for item detection...");

    const systemPrompt = `אתה עוזר שמזהה מוצרי מזון ומוצרי בית בתמונות של מקרר, מזווה או ארון.

משימתך:
1. זהה את כל המוצרים שנראים בתמונה
2. החזר רק מוצרים שברור שהם קיימים
3. תן שמות בעברית פשוטה וקצרה (לדוגמה: "חלב", "ביצים", "עגבניות")
4. אל תכלול מוצרים שאתה לא בטוח לגביהם

ענה אך ורק בפורמט JSON באמצעות הפונקציה.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: [
              {
                type: "text",
                text: "זהה את המוצרים בתמונה הזו. אלה מוצרים שכבר יש לי - אני רוצה לדעת מה יש כדי לא לקנות שוב."
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "detected_items",
              description: "מחזיר רשימת מוצרים שזוהו בתמונה",
              parameters: {
                type: "object",
                properties: {
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "שם המוצר בעברית" },
                        confidence: { type: "string", enum: ["high", "medium"], description: "רמת הוודאות" }
                      },
                      required: ["name", "confidence"],
                      additionalProperties: false
                    }
                  },
                  summary: { type: "string", description: "תיאור קצר של מה שנראה בתמונה" }
                },
                required: ["items", "summary"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "detected_items" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "יותר מדי בקשות, נסו שוב מאוחר יותר" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "נגמרו הקרדיטים" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    console.log("AI response received");
    
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      throw new Error("No items detected");
    }

    const result = JSON.parse(toolCall.function.arguments);
    console.log(`Detected ${result.items?.length || 0} items`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("scan-image error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
