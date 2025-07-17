# Multi-Recipe Cooking System Testing Plan

## 🎯 Test Objectives
- Verify AsyncStorage data flow and persistence
- Ensure unique recipe ID handling
- Test recipe switching functionality
- Validate session recovery after app restart
- Check for memory leaks and performance issues
- **Test loading state handling and recipe card interactions**
- **Verify scroll position optimization performance**

## 📋 Test Scenarios

### Phase 1: Basic Data Flow Tests

#### Test 1: Fresh Start with 2 Recipes
**Steps:**
1. Ensure mise is empty (delete all recipes if any)
2. Add Recipe A to mise from explore screen
3. Add Recipe B to mise from explore screen  
4. Navigate to mise/cook tab
5. Verify both recipes appear in switcher
6. **🆕 Test recipe card interactions:**
   - Tap on "Loading..." recipe card to verify it loads properly
   - Confirm no duplicate key warnings in logs
   - Test recipe switching between loaded and loading recipes

**Expected Logs:**
```
[CookScreen] 🔄 Starting to load mise recipes from AsyncStorage
[CookScreen] 📦 Raw mise data from AsyncStorage: [number] characters
[CookScreen] 📊 Parsed mise recipes count: 2
[CookScreen] 📋 Mise recipes summary: [recipe details]
[CookScreen] 🚀 Starting cooking sessions for 2 recipes
[CookScreen] 🥇 Starting immediate session for first recipe: [Recipe A]
[CookScreen] ⏳ Scheduling lazy sessions for remaining 1 recipes
[RecipeSwitcher] 🔄 Rendering with props: recipesCount: 2
[RecipeSwitcher] 👆 Recipe card pressed: [when user taps loading recipe]
[CookingContext] 📥 Loading recipe data for: [recipeId]
[CookingContext] 💾 Recipe data loaded successfully: [title]
```

**Should NOT see:**
```
[CookingContext] ❓ Unknown action type: SET_SCROLL_POSITION (this should be fixed)
Warning: Encountered two children with the same key (this should be fixed)
```

#### Test 2: Scroll Position Performance Test
**Steps:**
1. Open cooking session with loaded recipe
2. Scroll up and down for 10 seconds continuously
3. Monitor logs for excessive spam

**Expected Behavior:**
- Scroll position logs should appear only every 100ms or for significant changes (>20px)
- No performance degradation or UI lag during scrolling
- Smooth scrolling experience

#### Test 3: App Restart Recovery
**Steps:**
1. Start cooking session with 2 recipes
2. Navigate between recipes to verify both load
3. Force close app (not just background)
4. Reopen app and navigate to mise/cook
5. Verify session recovery

**Expected Logs:**
```
[CookingContext] 🔄 Loading cooking state from AsyncStorage on mount
[CookingContext] 📦 Found saved state, length: [number] characters
[CookingContext] ⏰ State age: [time] ms (should be less than 24h)
[CookingContext] ✅ Session state recovered successfully
```

### Phase 2: Recipe Loading and State Management

#### Test 4: Lazy Loading Verification
**Steps:**
1. Add 3 recipes to mise 
2. Start cooking session
3. Observe which recipes load immediately vs lazily
4. Click on each recipe card and verify loading behavior

**Expected Behavior:**
- First recipe loads immediately and shows content
- Other recipes show "Loading..." initially
- Clicking on "Loading..." recipe triggers `loadRecipeDataIfNeeded`
- Recipe content appears after successful loading
- No errors or crashes during loading process

#### Test 5: Error Handling
**Steps:**
1. Test with corrupted AsyncStorage data
2. Test with missing recipe data
3. Test with network connectivity issues

**Expected Behavior:**
- Graceful error handling
- Clear error messages to user
- No app crashes
- Fallback to empty state when appropriate

### Phase 3: Performance and Memory

#### Test 6: Memory Usage Monitoring
**Steps:**
1. Start with 4-5 recipes in cooking session
2. Switch between recipes multiple times
3. Monitor memory usage over time
4. Check for memory leaks

**Expected Behavior:**
- Memory usage should remain stable
- No significant memory growth over time
- Efficient cleanup when switching recipes

#### Test 7: Rapid Recipe Switching
**Steps:**
1. Quickly tap between recipe cards multiple times
2. Observe loading states and data consistency
3. Check for race conditions or state corruption

**Expected Behavior:**
- Smooth transitions between recipes
- No duplicate loading requests
- Consistent data display
- No state corruption or conflicts

## 🔧 Testing Environment

### Logging Configuration
Ensure all debugging logs are enabled:
- CookScreen logs: ✅
- CookingContext logs: ✅  
- RecipeSwitcher logs: ✅
- AsyncStorage operations: ✅
- **Optimized scroll position logs**: ✅

### Performance Monitoring
- Monitor scroll position update frequency
- Check for excessive re-renders
- Verify smooth UI interactions
- Test on both iOS and Android if possible

## 🐛 Known Issues Fixed
- ✅ Duplicate key warnings in RecipeSwitcher
- ✅ Unknown action type warnings for SET_SCROLL_POSITION
- ✅ Excessive scroll position logging (optimized to 100ms throttle)
- ✅ Loading state handling when tapping recipe cards

## 📊 Success Criteria
- No console errors or warnings
- Smooth recipe switching
- Consistent data loading
- Performance remains good during scrolling
- Memory usage stays stable
- All recipe cards function properly (including loading states) 