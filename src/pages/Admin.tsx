import ImportPrices from '@/components/Admin/ImportPrices';
import { ImportFromSupabase } from '@/components/Admin/ImportFromSupabase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Admin() {
  return (
    <div className="container mx-auto p-4 max-w-4xl" dir="rtl">
      <h1 className="text-2xl font-bold mb-6">ניהול מחירים</h1>
      
      <Tabs defaultValue="supabase" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="supabase">יבוא מ-Supabase</TabsTrigger>
          <TabsTrigger value="file">יבוא מקובץ XML</TabsTrigger>
        </TabsList>
        
        <TabsContent value="supabase">
          <ImportFromSupabase />
        </TabsContent>
        
        <TabsContent value="file">
          <ImportPrices />
        </TabsContent>
      </Tabs>
    </div>
  );
}
