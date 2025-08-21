# TODO List

## ✅ **Completed Features:**

### **1. Type System Updates**
- ✅ **InstructionStep type** - Added `id`, `text`, and optional `note` fields
- ✅ **Backward compatibility** - Supports both legacy `string[]` and new `InstructionStep[]` formats

### **2. Backend Validation**
- ✅ **PATCH endpoint validation** - Only allows updates on `is_user_modified = true` recipes
- ✅ **Instruction validation** - Ensures proper `{id, text, note}` structure with ≤100 char notes
- ✅ **Data integrity** - Re-enforces `recipe_data.id = row.id` after merge

### **3. Frontend Drag & Drop**
- ✅ **Step reordering** - Full drag-and-drop functionality with react-native-draggable-flatlist
- ✅ **Step notes** - Per-step note editing with 100-character limit
- ✅ **Visual feedback** - Step completion states, note indicators, drag handles
- ✅ **Auto-scroll** - Smart navigation to next uncompleted step

### **4. Save System**
- ✅ **Conditional save button** - Appears only when changes detected
- ✅ **Fork-vs-patch logic** - Automatically creates forks for original recipes, patches existing forks
- ✅ **Shared helper function** - `isUserFork()` utility for consistent logic across components
- ✅ **Proper state management** - Baseline tracking and change detection

### **5. UI/UX Improvements**
- ✅ **Clickable step text** - Entire step area toggles completion (no more blue circles)
- ✅ **Note modal system** - Clean modal interface for note editing
- ✅ **Footer integration** - Save button properly positioned in recipe footer
- ✅ **Responsive design** - Proper spacing, visual hierarchy, and touch targets

## 🔄 **In Progress:**
- None currently

## 📋 **Pending:**
- **Multiple local timers** - Attach timers to specific steps (local state only, no persistence)

## 🎯 **Next Steps:**
1. Test the fork-vs-patch logic with both original and user-modified recipes
2. Implement multiple local timers for step-specific timing
3. Add success notifications for save operations
4. Consider adding folder selection for new forks

## 📝 **Technical Notes:**
- Uses `fast-deep-equal` for efficient change detection
- UUIDs are stable across re-renders for proper comparison
- Backend validation ensures data integrity
- Shared utility functions maintain consistency across components
