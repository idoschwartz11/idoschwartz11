import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation constants
const MAX_ARRAY_LENGTH = 100;
const MAX_ITEM_LENGTH = 100;

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

// Validate and sanitize arrays
function validateArrayInput(arr: any, fieldName: string): { valid: boolean; error?: string; sanitized?: string[] } {
  // Allow missing/null arrays
  if (arr === null || arr === undefined) {
    return { valid: true, sanitized: [] };
  }

  if (!Array.isArray(arr)) {
    return { valid: false, error: `${fieldName} must be an array` };
  }

  if (arr.length > MAX_ARRAY_LENGTH) {
    return { valid: false, error: `${fieldName} exceeds maximum length of ${MAX_ARRAY_LENGTH}` };
  }

  const sanitized: string[] = [];
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    if (typeof item !== 'string') {
      continue; // Skip non-string items
    }
    
    const trimmed = item.trim();
    if (trimmed.length === 0) {
      continue; // Skip empty strings
    }
    
    if (trimmed.length > MAX_ITEM_LENGTH) {
      return { valid: false, error: `Item in ${fieldName} exceeds maximum length of ${MAX_ITEM_LENGTH}` };
    }
    
    // Basic sanitization - remove control characters
    const clean = trimmed.replace(/[\x00-\x1F\x7F]/g, '');
    sanitized.push(clean);
  }

  return { valid: true, sanitized };
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
    const { currentItems, history } = body;
    
    // Validate inputs
    const currentItemsValidation = validateArrayInput(currentItems, 'currentItems');
    if (!currentItemsValidation.valid) {
      return new Response(JSON.stringify({ error: currentItemsValidation.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const historyValidation = validateArrayInput(history, 'history');
    if (!historyValidation.valid) {
      return new Response(JSON.stringify({ error: historyValidation.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validCurrentItems = currentItemsValidation.sanitized!;
    const validHistory = historyValidation.sanitized!;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const currentItemsList = validCurrentItems.length > 0 
      ? validCurrentItems.join(", ") 
      : "אין פריטים ברשימה";
    
    const historyList = validHistory.length > 0 
      ? validHistory.slice(0, 30).join(", ") 
      : "אין היסטוריה";

    const systemPrompt = `אתה עוזר קניות חכם. על בסיס רשימת הקניות הנוכחית והיסטוריית הקניות של המשתמש, הצע 3-5 פריטים שכנראה שכחו להוסיף.

כללים:
- הצע רק פריטים שלא נמצאים כבר ברשימה הנוכחית
- התמקד בפריטים משלימים הגיוניים (למשל: אם יש חלב - אולי חסרים ביצים או לחם)
- תן עדיפות לפריטים שהמשתמש קנה בעבר
- ענה בעברית בלבד
- ענה אך ורק בפורמט JSON`;

    const userPrompt = `רשימה נוכחית: ${currentItemsList}

היסטוריית קניות: ${historyList}

הצע פריטים חסרים.`;

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
          { role: "user", content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_items",
              description: "מחזיר רשימת פריטים מוצעים לקנייה",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "שם הפריט" },
                        reason: { type: "string", description: "סיבה קצרה להצעה" }
                      },
                      required: ["name", "reason"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["suggestions"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "suggest_items" } }
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
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      throw new Error("No suggestions returned");
    }

    const suggestions = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(suggestions), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("suggest-items error:", error);
    return new Response(JSON.stringify({ error: "An error occurred processing your request" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
