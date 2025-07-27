import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';

import { COLORS, SPACING, RADIUS } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  screenTitleText,
  bodyStrongText,
  bodyText,
  bodyTextLoose,
  FONT,
} from '@/constants/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import ScreenHeader from '@/components/ScreenHeader';

type SavedFolder = {
  id: number;
  name: string;
  color: string;
  icon: string;
  display_order: number;
  recipe_count: number;
};

export default function SavedFoldersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const [folders, setFolders] = useState<SavedFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Component Mount/Unmount logging
  useEffect(() => {
    console.log('[SavedFoldersScreen] Component DID MOUNT');
    return () => {
      console.log('[SavedFoldersScreen] Component WILL UNMOUNT');
    };
  }, []);

  // Stable fetchFolders function
  const fetchFolders = useCallback(async () => {
    const startTime = performance.now();
    console.log(`[PERF: SavedFoldersScreen] Start fetchFolders at ${startTime.toFixed(2)}ms`);

    if (!session?.user) {
      console.warn('[SavedFoldersScreen] No user session found. Skipping fetch.');
      setIsLoading(false);
      setFolders([]); // Clear folders if user logs out
      return;
    }

    setIsLoading(true);
    setError(null);
    
    const dbQueryStart = performance.now();
    console.log(`[PERF: SavedFoldersScreen] Starting Supabase query at ${dbQueryStart.toFixed(2)}ms`);

    try {
      // Get folders with recipe counts
      const { data: foldersData, error: foldersError } = await supabase
        .from('user_saved_folders')
        .select(`
          id,
          name,
          color,
          icon,
          display_order,
          user_saved_recipes!folder_id(count)
        `)
        .eq('user_id', session.user.id)
        .order('display_order', { ascending: true });

      const dbQueryEnd = performance.now();
      console.log(`[PERF: SavedFoldersScreen] Supabase query finished in ${(dbQueryEnd - dbQueryStart).toFixed(2)}ms`);
      
      if (foldersError) {
        console.error('[SavedFoldersScreen] Error fetching folders:', foldersError);
        setError('Could not load folders. Please try again.');
        return;
      }

      const processingStart = performance.now();
      console.log(`[PERF: SavedFoldersScreen] Starting data processing at ${processingStart.toFixed(2)}ms`);
      
      const formattedFolders = foldersData?.map(folder => ({
        id: folder.id,
        name: folder.name,
        color: folder.color,
        icon: folder.icon,
        display_order: folder.display_order,
        recipe_count: (folder.user_saved_recipes as any)?.[0]?.count || 0,
      })) || [];

      console.log(`[SavedFoldersScreen] Fetched ${formattedFolders.length} folders from DB.`);
      setFolders(formattedFolders);
      
      const processingEnd = performance.now();
      console.log(`[PERF: SavedFoldersScreen] Data processing and state update took ${(processingEnd - processingStart).toFixed(2)}ms`);
    } catch (err) {
      console.error('[SavedFoldersScreen] Unexpected error:', err);
      setError('An unexpected error occurred.');
    } finally {
      const finalStateUpdateStart = performance.now();
      setIsLoading(false);
      const finalStateUpdateEnd = performance.now();
      console.log(`[PERF: SavedFoldersScreen] setIsLoading(false) took ${(finalStateUpdateEnd - finalStateUpdateStart).toFixed(2)}ms`);
      
      const totalTime = performance.now() - startTime;
      console.log(`[PERF: SavedFoldersScreen] Total fetchFolders duration: ${totalTime.toFixed(2)}ms`);
    }
  }, [session?.user?.id]);

  // Mount stability detection to differentiate between focus and remount
  const mountIdRef = useRef(Math.random());
  const lastMountId = useRef(mountIdRef.current);
  
  // Improved caching strategy
  const lastFetchTimeRef = useRef(0);
  const lastSessionIdRef = useRef<string | null>(null);
  const CACHE_DURATION_MS = 30000; // Cache data for 30 seconds
  const DEBOUNCE_MS = 500; // Prevent calls within 500ms of each other

  // Optimized useFocusEffect with smart caching
  useFocusEffect(
    useCallback(() => {
      const now = performance.now();
      const timeSinceLastFetch = now - lastFetchTimeRef.current;
      const currentMountId = mountIdRef.current;
      const currentSessionId = session?.user?.id || null;
      
      console.log('[SavedFoldersScreen] 🎯 useFocusEffect triggered for:', currentSessionId);
      
      // Check if this is a remount vs just a focus event
      const isRemount = currentMountId !== lastMountId.current;
      const isSessionChange = currentSessionId !== lastSessionIdRef.current;
      const isCacheExpired = timeSinceLastFetch > CACHE_DURATION_MS;
      const isDebounced = timeSinceLastFetch < DEBOUNCE_MS;
      
      if (isRemount) {
        console.log('[SavedFoldersScreen] 🔄 Screen remounted - full refetch needed');
        lastMountId.current = currentMountId;
      } else if (isDebounced && !isSessionChange) {
        console.log('[SavedFoldersScreen] 🚫 DEBOUNCED: Ignoring rapid successive focus without significant changes');
        return () => {
          console.log('[SavedFoldersScreen] 🌀 useFocusEffect cleanup (debounced focus)');
        };
      } else if (isSessionChange) {
        console.log('[SavedFoldersScreen] 👤 Session changed - refetch needed');
      } else if (isCacheExpired) {
        console.log('[SavedFoldersScreen] ⏰ Cache expired - refetch needed');
      } else if (folders.length === 0) {
        console.log('[SavedFoldersScreen] 💾 No cached data - initial fetch needed');
      } else {
        console.log('[SavedFoldersScreen] ✅ Using cached data - no refetch needed');
        return () => {
          console.log('[SavedFoldersScreen] 🌀 useFocusEffect cleanup (cached data used)');
        };
      }
      
      // Update tracking variables
      lastFetchTimeRef.current = now;
      lastSessionIdRef.current = currentSessionId;
      
      fetchFolders();
      
      // Return cleanup function to log blur events
      return () => {
        console.log('[SavedFoldersScreen] 🌀 useFocusEffect cleanup');
        console.log('[SavedFoldersScreen] 🌀 Screen is blurring (not necessarily unmounting)');
      };
    }, [fetchFolders, session?.user?.id, folders.length])
  );

  const handleFolderPress = useCallback((folder: SavedFolder) => {
    console.log(`[SavedFoldersScreen] Opening folder: ${folder.name}`, {
      id: folder.id,
      recipeCount: folder.recipe_count,
    });

    // Navigate to folder detail screen
    router.push({
      pathname: '/saved/folder-detail' as any,
      params: {
        folderId: folder.id.toString(),
        folderName: folder.name,
      },
    });
  }, [router]);

  const handleDeleteFolder = useCallback(async (folder: SavedFolder) => {
    if (!session?.user) {
      console.warn('[SavedFoldersScreen] No user session found. Cannot delete folder.');
      return;
    }

    // Prevent deletion if folder has recipes
    if (folder.recipe_count > 0) {
      Alert.alert(
        'Cannot Delete Folder', 
        `This folder contains ${folder.recipe_count} recipe${folder.recipe_count !== 1 ? 's' : ''}. Please move or delete the recipes first.`,
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Delete Folder',
      `Are you sure you want to delete "${folder.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            const { error: deleteError } = await supabase
              .from('user_saved_folders')
              .delete()
              .eq('user_id', session.user.id)
              .eq('id', folder.id);

            if (deleteError) {
              console.error('[SavedFoldersScreen] Error deleting folder:', deleteError);
              setError('Failed to delete folder. Please try again.');
            } else {
              console.log(`[SavedFoldersScreen] Folder "${folder.name}" deleted.`);
              setFolders(prev => prev.filter(f => f.id !== folder.id));
            }
            setIsLoading(false);
          },
        },
      ]
    );
  }, [session?.user]);

  const renderFolderItem = useCallback(({ item }: { item: SavedFolder }) => (
    <TouchableOpacity
      style={styles.folderCard}
      onPress={() => handleFolderPress(item)}
    >
      <View style={styles.folderIcon}>
        <MaterialCommunityIcons
          name={item.icon as any}
          size={24}
          color={item.color}
        />
      </View>
      <View style={styles.folderInfo}>
        <Text style={styles.folderName}>{item.name}</Text>
        <Text style={styles.recipeCountText}>
          {item.recipe_count} recipe{item.recipe_count !== 1 ? 's' : ''}
        </Text>
      </View>
      <View style={styles.folderActions}>
        <TouchableOpacity 
          style={styles.deleteButton} 
          onPress={() => handleDeleteFolder(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons name="delete-outline" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>
        <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.textMuted} />
      </View>
    </TouchableOpacity>
  ), [handleFolderPress, handleDeleteFolder]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <ActivityIndicator
          style={styles.centered}
          size="large"
          color={COLORS.primary}
        />
      );
    }

    if (!session) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="login"
            size={48}
            color={COLORS.lightGray}
          />
          <Text style={styles.emptyText}>Log in to see your recipe folders</Text>
          <Text style={styles.emptySubtext}>
            Your saved recipe folders will appear here once you're logged in.
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.loginButtonText}>Log In</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (error) {
      return <Text style={styles.errorText}>{error}</Text>;
    }

    if (folders.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="folder-outline"
            size={48}
            color={COLORS.lightGray}
          />
          <Text style={styles.emptyText}>No recipe folders yet</Text>
          <Text style={styles.emptySubtext}>
            Save recipes from the recipe summary screen to create your first folder.
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={folders}
        renderItem={renderFolderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Recipe folders" />
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.pageHorizontal,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xl,
    paddingTop: '30%', // Move content higher up on the screen
  },
  emptyText: {
    fontFamily: FONT.family.ubuntu,
    fontSize: 18,
    color: COLORS.textDark,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  emptySubtext: {
    ...bodyTextLoose,
    color: COLORS.darkGray,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  loginButton: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: RADIUS.sm,
  },
  loginButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
  },
  listContent: {
    paddingTop: SPACING.sm,
  },
  folderCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.sm,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    alignItems: 'center',
  },
  folderIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  folderInfo: {
    flex: 1,
  },
  folderName: {
    ...bodyStrongText,
    fontSize: FONT.size.body,
    color: COLORS.textDark,
    marginBottom: 4,
  },
  recipeCountText: {
    ...bodyText,
    fontSize: FONT.size.caption,
    color: COLORS.textMuted,
  },
  folderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButton: {
    padding: SPACING.xs,
    marginRight: SPACING.sm,
  },
  errorText: {
    ...bodyText,
    color: COLORS.error,
    textAlign: 'center',
    marginTop: SPACING.lg,
  },
});