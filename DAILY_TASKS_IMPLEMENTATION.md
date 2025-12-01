# Daily Tasks API Implementation

## Summary

Successfully implemented the `dailyTasks` API for Obsidian Dataview, similar to the existing `weeklyTasks` functionality. This allows you to list tasks with predefined filters in your daily files.

## Files Created

### 1. Core Implementation Files

- **`src/api/DayUtils.ts`** - Utility class for day-related date calculations
  - `getDayDateRange()` - Calculates start and end of a specific day
  - `isDateInDay()` - Checks if a date falls within a specific day
  - `parseYearMonthDayFromFilename()` - Parses date from filename in YYYY-MM-DD format

- **`src/api/daily-task-search.ts`** - Main API implementation
  - `DailyTaskApi` class with methods:
    - `getAndRenderDailyTasks()` - Gets, processes, and renders daily tasks with filters
    - `getDailyTasks()` - Gets tasks for a specific date
    - `searchForTasksWithDate()` - Searches for tasks matching date criteria
    - `parseTask()` - Parses task metadata (duration, start time, event ID, etc.)

- **`src/ui/views/daily-view.ts`** - View component for rendering daily tasks
  - `DailyView` class with methods:
    - `renderDailyTasks()` - Renders tasks with interactive filters
    - `createTaskFilters()` - Creates filter buttons for source files
    - `renderFilteredTasks()` - Renders tasks separated by completion status

### 2. Type Definition Files

- **`lib/api/DayUtils.d.ts`** - TypeScript definitions for DayUtils
- **`lib/api/daily-task-search.d.ts`** - TypeScript definitions for DailyTaskApi

### 3. Modified Files

- **`src/api/inline-api.ts`** - Updated to expose the dailyTasks API
  - Added `daily: DailyTaskApi` property
  - Added `dailyTasks()` convenience method
  - Added necessary imports (STask, DailyTaskApi, DailyTaskOptions)

- **`lib/api/inline-api.d.ts`** - Updated type definitions to match implementation

### 4. Documentation

- **`example-daily-tasks.md`** - Comprehensive usage examples and documentation

## Usage

### File Naming Convention

Daily files should be named in the format: **YYYY-MM-DD.md**

Examples:
- `2025-07-21.md` (July 21, 2025)
- `2025-01-01.md` (January 1, 2025)
- `2024-12-15.md` (December 15, 2024)

### Basic Usage in DataviewJS

```dataviewjs
// Automatically detects the current file's date and renders with filters
await dv.dailyTasks({
    searchPath: '"game/objectives"',  // Path to search for tasks
    trimTaskText: true                 // Show only description
});
```

### Advanced Usage with Specific Date

```dataviewjs
// Renders with automatic filtering and grouping
await dv.dailyTasks({
    year: 2025,
    month: 7,        // Month as 1-12
    day: 21,
    searchPath: '"game/objectives"',
    trimTaskText: false  // Show full task text with metadata
});
```

## Key Features

### **Predefined Filters** 
Just like `weeklyTasks`, the `dailyTasks` API automatically renders with:
- **Interactive filter buttons** - Click to filter by source file
- **"All" button** - Show all tasks at once
- **Color-coded filters** - Each file gets a unique color
- **Task counts** - See how many tasks are in each filter
- **Smart file grouping** - Automatically combines files with their archived versions
  - Files ending in `_archive` are grouped with their base file
  - Example: `repetitives.md` (10 tasks) + `repetitives_archive.md` (11 tasks) = `repetitives (21)`
  - Clicking the filter shows tasks from both versions

### **Smart Task Organization**
- Tasks automatically separated into:
  - ⏳ **Incomplete Tasks** - Not yet done
  - ✅ **Completed Tasks** - Marked as complete
- Tasks grouped by source file
- Empty state when no tasks found

### **Modern UI**
- Styled filter buttons with hover effects
- Clean, readable layout
- Responsive design
- Visual feedback for active filters

## API Options

### DailyTaskOptions Interface

```typescript
interface DailyTaskOptions {
    year?: number;              // The year (auto-detected if not provided)
    month?: number;             // The month 1-12 (auto-detected if not provided)
    day?: number;               // The day 1-31 (auto-detected if not provided)
    searchPath?: string;        // Path to search for tasks (default: "/")
    filename?: string;          // Filename in YYYY-MM-DD format (auto-detected)
    component?: Component;      // Obsidian component (auto-provided)
    container?: HTMLElement;    // Container element (auto-provided)
    trimTaskText?: boolean;     // Show only description (default: true)
}
```

## Task Filtering

The API uses intelligent filtering logic:

### Excluded Tasks
Tasks are automatically filtered out if:
- **Cancelled tasks**: Tasks with status `"-"` (e.g., `- [-]`)
- **Completed without date**: Completed tasks that don't have a completion date

### Completed Tasks
- Only shown if completed on the specific day
- **Must have a completion date** - completed tasks without a completion date are ignored
- Prevents cluttering today's view with old completed tasks
- Can't show tasks without knowing when they were completed

### Uncompleted Tasks  
- Shown if due or scheduled **on or before** the specified day
- Tasks from previous days automatically "carry forward"
- Never lose track of pending tasks

This means if you had a task scheduled for yesterday but didn't complete it, it will still appear in today's view!

## Task Metadata Parsing

The API can parse and strip the following metadata from task text:
- `@duration(2h)` - Task duration
- `@start(10:00)` - Start time
- `@id(123)` - Event ID
- `@repeat(daily)` - Repetition pattern
- `⏳ 2023-01-01` - Scheduled date
- `📅 2023-01-02` - Due date
- `✅ 2023-01-03` - Completion date

## Build Status

✅ Successfully compiled and built
✅ No TypeScript errors
✅ All linter checks pass
✅ All tests passing (33 tests for DayUtils)

## Integration

The new API is fully integrated into the Dataview plugin:
- Accessible via `dv.dailyTasks()` in DataviewJS code
- Accessible via `dv.daily.getAndRenderDailyTasks()` for advanced use
- TypeScript definitions available for autocomplete and type checking
- Follows the same patterns as existing `weeklyTasks` API

## Testing

To test the implementation:
1. Create a daily file with the naming format `YYYY-MM-DD.md`
2. Add a DataviewJS block with the example code above
3. Ensure you have tasks with scheduled/due/completion dates in your vault
4. View the rendered results in the note

## Notes

- The implementation follows the same architecture as `weeklyTasks` for consistency
- Date parsing is robust and handles invalid formats gracefully
- The API integrates seamlessly with existing Dataview functionality
- All public methods are documented with JSDoc comments

