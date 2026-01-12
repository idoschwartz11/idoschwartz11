import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Upload, CheckCircle2, AlertCircle } from 'lucide-react';

const CHAINS = [
  { value: 'שופרסל', label: 'שופרסל' },
  { value: 'רמי לוי', label: 'רמי לוי' },
  { value: 'ויקטורי', label: 'ויקטורי' },
  { value: 'יוחננוף', label: 'יוחננוף' },
  { value: 'מגה', label: 'מגה' },
  { value: 'חצי חינם', label: 'חצי חינם' },
  { value: 'סופר יודה', label: 'סופר יודה' },
  { value: 'סטופ מרקט', label: 'סטופ מרקט' },
];

interface ImportResult {
  success: boolean;
  chainName?: string;
  itemsProcessed?: number;
  uniqueProducts?: number;
  batchErrors?: number;
  error?: string;
}

export default function ImportPrices() {
  const [chainName, setChainName] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleImport = async () => {
    if (!chainName || !fileUrl) {
      setResult({ success: false, error: 'נא לבחור רשת ולהזין URL לקובץ' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('import-chain-prices', {
        body: { chainName, fileUrl }
      });

      if (error) {
        setResult({ success: false, error: error.message });
      } else {
        setResult(data as ImportResult);
      }
    } catch (err: any) {
      setResult({ success: false, error: err.message || 'שגיאה לא צפויה' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8" dir="rtl">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              יבוא מחירים מקובץ
            </CardTitle>
            <CardDescription>
              יבוא מחירים מקבצי XML דחוסים (gz) של רשתות השיווק
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="chain">רשת</Label>
              <Select value={chainName} onValueChange={setChainName}>
                <SelectTrigger id="chain">
                  <SelectValue placeholder="בחר רשת" />
                </SelectTrigger>
                <SelectContent>
                  {CHAINS.map((chain) => (
                    <SelectItem key={chain.value} value={chain.value}>
                      {chain.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="url">URL לקובץ</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://example.com/prices.xml.gz"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">
                קובץ XML או XML.gz עם מחירי המוצרים
              </p>
            </div>

            <Button 
              onClick={handleImport} 
              disabled={loading || !chainName || !fileUrl}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  מייבא מחירים...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 ml-2" />
                  יבא מחירים
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {result && (
          <Alert variant={result.success ? 'default' : 'destructive'}>
            {result.success ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertTitle>
              {result.success ? 'הייבוא הושלם בהצלחה!' : 'שגיאה בייבוא'}
            </AlertTitle>
            <AlertDescription>
              {result.success ? (
                <div className="mt-2 space-y-1">
                  <p>רשת: <strong>{result.chainName}</strong></p>
                  <p>מוצרים שעובדו: <strong>{result.itemsProcessed?.toLocaleString()}</strong></p>
                  <p>מוצרים ייחודיים: <strong>{result.uniqueProducts?.toLocaleString()}</strong></p>
                  {result.batchErrors && result.batchErrors > 0 && (
                    <p className="text-yellow-600">שגיאות: {result.batchErrors}</p>
                  )}
                </div>
              ) : (
                <p>{result.error}</p>
              )}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">פורמט נתמך</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>הפונקציה תומכת בפורמט הסטנדרטי של קבצי מחירים בישראל:</p>
            <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto" dir="ltr">
{`<Item>
  <ItemCode>123456789</ItemCode>
  <ItemName>חלב תנובה 3%</ItemName>
  <ItemPrice>6.90</ItemPrice>
</Item>`}
            </pre>
            <p>נתמכים גם וריאציות כמו ProductName, Price וכו'.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
