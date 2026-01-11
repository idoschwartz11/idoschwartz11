import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation constants
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB max
const VALID_IMAGE_PREFIXES = ['data:image/jpeg', 'data:image/png', 'data:image/gif', 'data:image/webp'];

// Validate API key to prevent unauthorized access
function validateApiKey(req: Request): boolean {
  const apiKey = req.headers.get('apikey');
  const authHeader = req.headers.get('authorization');
  const expectedAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  
  // Accept either apikey header or Bearer token with anon key
  if (apiKey && expectedAnonKey && apiKey === expectedAnonKey) {
    return true;
  }
  if (authHeader?.startsWith('Bearer ') && expectedAnonKey) {
    const token = authHeader.replace('Bearer ', '');
    if (token === expectedAnonKey) {
      return true;
    }
  }
  return false;
}

// Validate image input
function validateImageInput(imageBase64: any): { valid: boolean; error?: string } {
  if (!imageBase64) {
    return { valid: false, error: 'No image provided' };
  }

  if (typeof imageBase64 !== 'string') {
    return { valid: false, error: 'Image must be a string' };
  }

  // Check size (base64 is ~33% larger than original)
  const estimatedSizeBytes = (imageBase64.length * 3) / 4;
  if (estimatedSizeBytes > MAX_IMAGE_SIZE_BYTES) {
    return { valid: false, error: `Image exceeds maximum size of ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB` };
  }

  // Check format - must be data URL or raw base64
  if (imageBase64.startsWith('data:')) {
    const isValidPrefix = VALID_IMAGE_PREFIXES.some(prefix => imageBase64.startsWith(prefix));
    if (!isValidPrefix) {
      return { valid: false, error: 'Invalid image format. Supported: JPEG, PNG, GIF, WebP' };
    }
  } else {
    // Raw base64 - basic validation that it looks like base64
    const base64Regex = /^[A-Za-z0-9+/]+=*$/;
    // Check first 100 chars to avoid regex on huge strings
    if (!base64Regex.test(imageBase64.slice(0, 100).replace(/\s/g, ''))) {
      return { valid: false, error: 'Invalid base64 encoding' };
    }
  }

  return { valid: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate API key
    if (!validateApiKey(req)) {
      console.log('Unauthorized request - invalid API key');
      return new Response(JSON.stringify({ 
        error: 'Unauthorized - valid API key required' 
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { imageBase64 } = body;
    
    // Validate input
    const validation = validateImageInput(imageBase64);
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
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
    return new Response(JSON.stringify({ error: "An error occurred processing your request" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
