-- Create shopping_items table for shared list
CREATE TABLE public.shopping_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  bought BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;

-- Create policy for public access (all users can read/write)
CREATE POLICY "Anyone can view shopping items" 
ON public.shopping_items 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can add shopping items" 
ON public.shopping_items 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update shopping items" 
ON public.shopping_items 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete shopping items" 
ON public.shopping_items 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_shopping_items_updated_at
BEFORE UPDATE ON public.shopping_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for the table
ALTER PUBLICATION supabase_realtime ADD TABLE public.shopping_items;