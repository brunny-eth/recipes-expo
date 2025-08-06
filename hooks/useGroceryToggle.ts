import { useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAnalytics } from '@/utils/analytics';
import { useErrorModal } from '@/context/ErrorModalContext';
import { GroceryItem, GroceryCategory } from './useGroceryList';

/**
 * Hook for managing grocery item toggle (check/uncheck) operations
 */
export function useGroceryToggle(
  groceryList: GroceryCategory[],
  setGroceryList: (list: GroceryCategory[]) => void
) {
  const { session } = useAuth();
  const { track } = useAnalytics();
  const { showError } = useErrorModal();

  const handleGroceryToggle = useCallback((itemId: string) => {
    // Optimistically update local state for instant feedback
    const updatedList = [...groceryList];
    
    // Find item by ID instead of index for stable identification
    let itemToUpdate: GroceryItem | null = null;
    let categoryIndex = -1;
    let itemIndex = -1;
    
    for (let i = 0; i < updatedList.length; i++) {
      const category = updatedList[i];
      const foundIndex = category.items.findIndex(item => item.id === itemId);
      if (foundIndex !== -1) {
        itemToUpdate = category.items[foundIndex];
        categoryIndex = i;
        itemIndex = foundIndex;
        break;
      }
    }
    
    if (!itemToUpdate) return;

    const newCheckedState = !itemToUpdate.checked;
    itemToUpdate.checked = newCheckedState;
    setGroceryList(updatedList);

    // Debounce the API call to prevent spamming while quickly checking items
    const timerId = setTimeout(() => {
      if (!session?.user?.id || !session.access_token) return;

      const backendUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!backendUrl) return;

      fetch(`${backendUrl}/api/mise/grocery-item-state`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: session.user.id,
          itemName: itemToUpdate!.name,
          isChecked: newCheckedState,
        }),
      }).catch(err => {
        track('grocery_item_toggle_error', {
          itemName: itemToUpdate!.name,
          isChecked: newCheckedState,
          errorMessage: err instanceof Error ? err.message : String(err),
          userId: session.user.id,
        });
        // Optionally, revert the optimistic update and show an error
        showError('Sync Error', 'Could not save check state. Please try again.');
        itemToUpdate!.checked = !newCheckedState;
        setGroceryList([...groceryList]);
      });
    }, 500); // 500ms debounce

    // Note: We don't clear the timeout on re-render because each toggle is independent.
    // A more robust implementation might use a single, cancellable timeout for the whole list.
  }, [groceryList, session?.user?.id, session?.access_token, showError, setGroceryList, track]);

  return {
    handleGroceryToggle,
  };
}