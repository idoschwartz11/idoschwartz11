import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { Database, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface ImportResult {
  success: boolean;
  tableName?: string;
  totalFetched?: number;
  imported?: number;
  errors?: string[];
  sampleRecord?: Record<string, unknown>;
  error?: string;
}

export const ImportFromSupabase = () => {
  const [externalUrl, setExternalUrl] = useState('');
  const [externalAnonKey, setExternalAnonKey] = useState('');
  const [tableName, setTableName] = useState('chain_prices');
  const [priceColumn, setPriceColumn] = useState('');
  const [nameColumn, setNameColumn] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleImport = async () => {
    if (!externalUrl || !externalAnonKey || !tableName) {
      setResult({ success: false, error: 'נא למלא את כל השדות החובה' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('import-external-supabase', {
        body: { 
          externalUrl, 
          externalAnonKey, 
          tableName,
          priceColumn: priceColumn || undefined,
          nameColumn: nameColumn || undefined
        }
      });

      if (error) {
        setResult({ success: false, error: error.message });
      } else {
        setResult(data as ImportResult);
      }
    } catch (err) {
      setResult({ success: false, error: err instanceof Error ? err.message : 'שגיאה לא ידועה' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          יבוא מ-Supabase חיצוני
        </CardTitle>
        <CardDescription>
          העבר נתוני מחירים מפרויקט Supabase אחר
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="externalUrl">כתובת Supabase (חובה)</Label>
          <Input
            id="externalUrl"
            placeholder="https://xxxxx.supabase.co"
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            dir="ltr"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="externalAnonKey">Anon Key (חובה)</Label>
          <Input
            id="externalAnonKey"
            type="password"
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            value={externalAnonKey}
            onChange={(e) => setExternalAnonKey(e.target.value)}
            dir="ltr"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tableName">שם הטבלה (חובה)</Label>
          <Input
            id="tableName"
            placeholder="chain_prices / price_lookup / prices"
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
            dir="ltr"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="nameColumn">עמודת שם המוצר (אופציונלי)</Label>
            <Input
              id="nameColumn"
              placeholder="canonical_key / name"
              value={nameColumn}
              onChange={(e) => setNameColumn(e.target.value)}
              dir="ltr"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="priceColumn">עמודת מחיר (אופציונלי)</Label>
            <Input
              id="priceColumn"
              placeholder="price_ils / price"
              value={priceColumn}
              onChange={(e) => setPriceColumn(e.target.value)}
              dir="ltr"
            />
          </div>
        </div>

        <Button 
          onClick={handleImport} 
          disabled={loading || !externalUrl || !externalAnonKey || !tableName}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              מייבא...
            </>
          ) : (
            'יבא מחירים'
          )}
        </Button>

        {result && (
          <Alert variant={result.success ? "default" : "destructive"}>
            {result.success ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <AlertTitle>
              {result.success ? 'הייבוא הושלם בהצלחה!' : 'שגיאה בייבוא'}
            </AlertTitle>
            <AlertDescription>
              {result.success ? (
                <div className="mt-2 space-y-1">
                  <p>טבלה: {result.tableName}</p>
                  <p>נשלפו: {result.totalFetched} רשומות</p>
                  <p>יובאו: {result.imported} רשומות</p>
                  {result.errors && result.errors.length > 0 && (
                    <p className="text-destructive">שגיאות: {result.errors.length}</p>
                  )}
                </div>
              ) : (
                result.error
              )}
            </AlertDescription>
          </Alert>
        )}

        <Card className="bg-muted/50">
          <CardContent className="pt-4 text-sm text-muted-foreground">
            <p className="font-medium mb-2">איך למצוא את הפרטים:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>היכנס לפרויקט ב-Supabase Dashboard</li>
              <li>Settings → API</li>
              <li>העתק את ה-Project URL (כתובת)</li>
              <li>העתק את ה-anon public key</li>
            </ol>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
};
