# Typography Migration Guide

## Overview
The typography system has been refactored to be cleaner and more semantic. This guide helps you migrate existing components to the new system.

## New Typography Structure

### Font Families
- `FONT.family.logo` - Ubuntu-Regular (for app logo)
- `FONT.family.heading` - Ubuntu-Regular (for screen titles)
- `FONT.family.body` - Inter-Regular (for body text)
- `FONT.family.bold` - Inter-SemiBold (for emphasized text)

### Font Sizes
- `FONT.size.meta` - 12px (metadata, small labels)
- `FONT.size.caption` - 14px (captions, secondary text)
- `FONT.size.body` - 16px (main body text)
- `FONT.size.sectionHeader` - 18px (section headers)
- `FONT.size.screenTitle` - 24px (screen titles)
- `FONT.size.logo` - 32px (app logo)

### Line Heights
- `FONT.lineHeight.tight` - 20px (compact)
- `FONT.lineHeight.normal` - 24px (standard)
- `FONT.lineHeight.relaxed` - 28px (spacious)
- `FONT.lineHeight.spacious` - 32px (very spacious)

## Migration Map

### Old → New

#### Predefined Styles
- `screenTitleText` → `screenTitleText` (updated)
- `titleText` → `screenTitleText` (legacy export)
- `sectionHeaderText` → `sectionHeaderText` (updated)
- `bodyText` → `bodyText` (updated)
- `bodyStrongText` → `bodyStrongText` (updated)
- `bodyTextLoose` → `bodyText` (legacy export)
- `captionText` → `captionText` (updated)
- `captionStrongText` → `captionStrongText` (updated)

#### Direct FONT Usage
- `FONT.family.ubuntu` → `FONT.family.heading` or `FONT.family.logo`
- `FONT.family.inter` → `FONT.family.body`
- `FONT.family.interSemiBold` → `FONT.family.bold`

- `FONT.size.xs` → `FONT.size.meta`
- `FONT.size.caption` → `FONT.size.caption` (updated size)
- `FONT.size.smBody` → `FONT.size.caption`
- `FONT.size.bodyMedium` → `FONT.size.body`
- `FONT.size.body` → `FONT.size.body`
- `FONT.size.lg` → `FONT.size.sectionHeader`
- `FONT.size.sectionHeader` → `FONT.size.sectionHeader` (updated size)
- `FONT.size.xl` → `FONT.size.screenTitle`
- `FONT.size.title` → `FONT.size.screenTitle`
- `FONT.size.screenTitle` → `FONT.size.screenTitle` (updated size)
- `FONT.size.h1` → `FONT.size.screenTitle`
- `FONT.size.xxl` → `FONT.size.logo`

## Usage Examples

### App Logo
```tsx
<Text style={{ fontFamily: FONT.family.logo, fontSize: FONT.size.logo }}>Meez</Text>
// or use predefined style
<Text style={logoText}>Meez</Text>
```

### Screen Titles
```tsx
<Text style={{ fontFamily: FONT.family.heading, fontSize: FONT.size.screenTitle, fontWeight: '600' }}>Recipe library</Text>
// or use predefined style
<Text style={screenTitleText}>Recipe library</Text>
```

### Section Headers
```tsx
<Text style={{ fontFamily: FONT.family.body, fontSize: FONT.size.sectionHeader, fontWeight: '600' }}>Swap ingredients</Text>
// or use predefined style
<Text style={sectionHeaderText}>Swap ingredients</Text>
```

### Recipe Titles
```tsx
<Text style={{ fontFamily: FONT.family.body, fontSize: FONT.size.body, fontWeight: '600' }}>Broccoli Tots</Text>
// or use predefined style
<Text style={bodyStrongText}>Broccoli Tots</Text>
```

### Ingredient Items
```tsx
<Text style={{ fontFamily: FONT.family.body, fontSize: FONT.size.caption }}>peeled and deveined (1 lb)</Text>
// or use predefined style
<Text style={captionText}>peeled and deveined (1 lb)</Text>
```

### Metadata
```tsx
<Text style={{ fontFamily: FONT.family.body, fontSize: FONT.size.meta }}>servings: 6</Text>
// or use predefined style
<Text style={metaText}>servings: 6</Text>
```

## Migration Steps

1. **Update imports** - Replace old typography imports with new ones
2. **Replace direct FONT usage** - Use the migration map above
3. **Update predefined styles** - Use the new predefined styles where possible
4. **Test visual appearance** - Ensure text still looks correct
5. **Remove legacy usage** - Clean up any remaining old patterns

## Backward Compatibility

Legacy exports are provided for smooth migration:
- `titleText` → `screenTitleText`
- `bodyTextLoose` → `bodyText`

These will be removed in a future update after all components are migrated. 