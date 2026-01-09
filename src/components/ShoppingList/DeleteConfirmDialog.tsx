import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  itemName: string;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  itemName,
}: DeleteConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[90%] sm:max-w-md rounded-2xl" dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-right">מחיקת פריט</AlertDialogTitle>
          <AlertDialogDescription className="text-right">
            האם אתה בטוח שברצונך למחוק את "{itemName}" מהרשימה?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row-reverse gap-2 sm:gap-0">
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            מחק
          </AlertDialogAction>
          <AlertDialogCancel>ביטול</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
