import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  getAllPendingSync, 
  clearPendingSync, 
  removePendingSync,
  PendingSyncAction 
} from '@/lib/offlineStorage';
import { useNetworkStatus } from './useNetworkStatus';

export function useOfflineSync() {
  const { isOnline, wasOffline, clearWasOffline } = useNetworkStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const syncInProgressRef = useRef(false);

  const syncToCloud = useCallback(async () => {
    if (!isOnline || syncInProgressRef.current) return;

    syncInProgressRef.current = true;
    setIsSyncing(true);

    try {
      const pendingActions = await getAllPendingSync();
      setPendingCount(pendingActions.length);
      
      if (pendingActions.length === 0) {
        setIsSyncing(false);
        syncInProgressRef.current = false;
        return;
      }

      // Process actions in order
      for (const action of pendingActions) {
        try {
          await processAction(action);
          await removePendingSync(action.id);
          setPendingCount(prev => Math.max(0, prev - 1));
        } catch (error) {
          console.error('Sync action failed:', error);
          // Continue with next action
        }
      }

      clearWasOffline();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
      syncInProgressRef.current = false;
    }
  }, [isOnline, clearWasOffline]);

  const processAction = async (action: PendingSyncAction) => {
    const { action: actionType, table, data } = action;

    if (table !== 'shopping_items') return;

    switch (actionType) {
      case 'INSERT':
        const { error: insertError } = await supabase
          .from('shopping_items')
          .upsert({
            id: data.id,
            name: data.name,
            quantity: data.quantity,
            bought: data.bought,
          });
        if (insertError) throw insertError;
        break;

      case 'UPDATE':
        const { error: updateError } = await supabase
          .from('shopping_items')
          .update({
            quantity: data.quantity,
            bought: data.bought,
          })
          .eq('id', data.id);
        if (updateError) throw updateError;
        break;

      case 'DELETE':
        const { error: deleteError } = await supabase
          .from('shopping_items')
          .delete()
          .eq('id', data.id);
        if (deleteError) throw deleteError;
        break;
    }
  };

  // Sync when coming back online
  useEffect(() => {
    if (isOnline && wasOffline) {
      syncToCloud();
    }
  }, [isOnline, wasOffline, syncToCloud]);

  // Check pending count on mount
  useEffect(() => {
    getAllPendingSync().then(actions => {
      setPendingCount(actions.length);
    });
  }, []);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    syncToCloud,
  };
}
