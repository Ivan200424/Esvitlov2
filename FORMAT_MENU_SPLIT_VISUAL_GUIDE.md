# Format Menu Split - Visual Guide

This document shows the new 3-level navigation structure for the "Формат публікацій" menu.

## Menu Flow

```
┌─────────────────────────────────────────────┐
│  Level 1: Main Format Menu                 │
│  (callback: channel_format or format_menu) │
├─────────────────────────────────────────────┤
│  📋 Формат публікацій                       │
│                                             │
│  Налаштуйте як бот публікуватиме           │
│  повідомлення у ваш канал:                 │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │  📊 Графік відключень               │  │
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │  ⚡ Фактичний стан                   │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  [← Назад]              [⤴ Меню]          │
└─────────────────────────────────────────────┘
         │                    │
         │ (click 📊)         │
         ↓                    │
┌─────────────────────────────────────────────┐
│  Level 2a: Schedule Format Settings        │
│  (callback: format_schedule_settings)      │
├─────────────────────────────────────────────┤
│  📊 Графік відключень                       │
│                                             │
│  Налаштуйте як виглядатиме пост з графіком │
│  у вашому каналі:                          │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │  📝 Підпис під графіком              │  │
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │  ⏰ Формат часу (08:00-12:00)        │  │
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │  ○ Видаляти старий графік            │  │
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │  ○ Без тексту (тільки картинка)     │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  [← Назад]              [⤴ Меню]          │
│  (to Level 1)                              │
└─────────────────────────────────────────────┘
         
         (from Level 1, click ⚡)
         ↓
┌─────────────────────────────────────────────┐
│  Level 2b: Power State Settings            │
│  (callback: format_power_settings)         │
├─────────────────────────────────────────────┤
│  ⚡ Фактичний стан                          │
│                                             │
│  Налаштуйте повідомлення які бот надсилає  │
│  при зміні стану світла:                   │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │  🔴 Повідомлення "Світло зникло"     │  │
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │  🟢 Повідомлення "Світло є"          │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  [← Назад]              [⤴ Меню]          │
│  (to Level 1)                              │
└─────────────────────────────────────────────┘
```

## Key Changes

### Before (Old Flat Menu)
- Single menu with 8 buttons
- Non-clickable header buttons ("── 📊 ГРАФІК ВІДКЛЮЧЕНЬ ──", "── ⚡ ФАКТИЧНИЙ СТАН ──")
- `format_noop` callback for headers (confusing for users)
- All settings mixed together
- Back button goes to `settings_channel`

### After (New 3-Level Structure)
- **Level 1**: 2 main category buttons (Schedule, Power State)
- **Level 2a**: 4 schedule-related settings
- **Level 2b**: 2 power-state settings
- All buttons are clickable and functional
- Clear navigation flow
- Back buttons from Level 2 go to `format_menu` (Level 1)

## Button Mappings

### Level 1 → Level 2a (Schedule Settings)
```
📊 Графік відключень → format_schedule_settings
```

### Level 1 → Level 2b (Power State Settings)
```
⚡ Фактичний стан → format_power_settings
```

### Level 2 → Level 1 (Back Navigation)
```
← Назад → format_menu
```

## Toggle Behavior

The toggle buttons in Level 2a work as before:
- Click toggles the setting on/off
- Page refreshes with updated toggle state (○ or ✓)
- Now stays in Level 2a (schedule settings) instead of going back to flat menu

## Text Editing Return Navigation

When editing text templates:
- **Schedule caption** → Returns to Level 2a (schedule settings)
- **Period format** → Returns to Level 2a (schedule settings)
- **Power off text** → Returns to Level 2b (power state settings)
- **Power on text** → Returns to Level 2b (power state settings)

## Implementation Details

### Files Modified
1. `src/keyboards/inline.js`
   - Updated `getFormatSettingsKeyboard()` for Level 1
   - Added `getFormatScheduleKeyboard()` for Level 2a
   - Added `getFormatPowerKeyboard()` for Level 2b

2. `src/handlers/channel.js`
   - Added `FORMAT_SCHEDULE_MESSAGE` constant
   - Added `FORMAT_POWER_MESSAGE` constant
   - Updated `FORMAT_SETTINGS_MESSAGE` text
   - Added `format_menu` handler
   - Added `format_schedule_settings` handler
   - Added `format_power_settings` handler
   - Updated toggle handlers to use Level 2a keyboard
   - Updated text input handlers to return to correct sub-menu
   - Removed `format_noop` handler

### Callback Data Changes
| Old Callback | New Callback | Purpose |
|-------------|--------------|---------|
| `format_noop` | (removed) | Non-interactive headers removed |
| N/A | `format_menu` | Navigate to Level 1 |
| N/A | `format_schedule_settings` | Navigate to Level 2a |
| N/A | `format_power_settings` | Navigate to Level 2b |
| `format_toggle_delete` | (same) | Toggle delete old message |
| `format_toggle_piconly` | (same) | Toggle picture only |
| `format_schedule_caption` | (same) | Edit schedule caption |
| `format_schedule_periods` | (same) | Edit period format |
| `format_power_off` | (same) | Edit power off text |
| `format_power_on` | (same) | Edit power on text |

## User Experience Improvements

1. **Clearer structure**: Settings are grouped logically
2. **No confusion**: All buttons are clickable and do something
3. **Better navigation**: Clear back button hierarchy
4. **Easier to find settings**: Only 2 choices at top level
5. **Less overwhelming**: Fewer buttons per screen
