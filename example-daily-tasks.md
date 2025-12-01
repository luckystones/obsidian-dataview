# Example Daily Tasks Usage

This example demonstrates how to use the `dailyTasks` API in your daily notes.

## Basic Usage in a Daily Note (e.g., 21-07-2025.md)

```dataviewjs
// Automatically detects the current file's date (YYYY-MM-DD format)
// This will render tasks with built-in filters by file
await dv.dailyTasks({
    searchPath: '"game/objectives"',  // Path to search for tasks
    trimTaskText: true                 // Show only description (remove metadata)
});
```

## Advanced Usage with Specific Date

```dataviewjs
// Specify a specific date
// This will automatically render with filters and grouping
await dv.dailyTasks({
    year: 2025,
    month: 7,        // Month as 1-12 (July = 7)
    day: 21,
    searchPath: '"game/objectives"',
    trimTaskText: false  // Show full task text with metadata
});
```

## Features

The `dailyTasks` API automatically renders tasks with the following built-in features:

### **💪 Physical Activity Tracker**
An integrated widget at the top of your daily view that helps you track 7 physical activities with progressive difficulty.

#### Activities (7 total):
1. **Pushup** - Upper body
2. **Crunch** - Core
3. **Sideplank** - Lateral core
4. **Plank** - Core endurance
5. **Bridge** - Lower back
6. **Squat** - Lower body
7. **DeadHang** - Grip strength

#### Progressive System:
- **Starts at Set 5** (5 reps of each activity)
- **Formula**: Each set lasts for `setNumber × 3` days
  - Set 5: 15 days (days 1-15)
  - Set 6: 18 days (days 16-33)
  - Set 7: 21 days (days 34-54)
  - Continues automatically
- **Progress Display**: Shows "Set X - Day Y/Z" at the top

#### Features:
- **5-Day Chain View**: Shows today plus the last 4 days
- **Interactive Button**: Click today's button to mark all 7 activities as done
- **Auto-Progression**: Set number increases automatically
- **Visual Chains**: Green lines (6px thick) connect consecutive completed days
- **CSV Storage**: `physical-activity-tracker.csv` (auto-created)
- **Spacing**: 40px gap between circles for better readability

#### How It Works:
1. Widget appears at the top of your daily view
2. Click today's button → All 7 activities marked complete (✅)
3. Click again → Undo
4. Previous 4 days shown for reference (not clickable)
5. Set number calculated automatically based on start date
6. Lines connect through the center of circles, turning green when both adjacent days are complete

#### CSV Format:
```csv
done,date,set,Pushup,Crunch,Sideplank,Plank,Bridge,Squat,DeadHang
true,2025-01-01,5,✅,✅,✅,✅,✅,✅,✅
false,2025-01-02,5,,,,,,,
true,2025-01-16,6,✅,✅,✅,✅,✅,✅,✅
```

### **Interactive Filters**
- Filter tasks by source file
- "All" button to show all tasks
- Visual indicators for active filters
- Task counts for each filter
- **Automatic grouping**: Files and their archived versions are combined
  - Example: `repetitives.md` and `repetitives_archive.md` appear as a single "repetitives" filter
  - The count includes tasks from both versions

### **Smart Grouping**
- Tasks automatically separated into:
  - ⏳ **Incomplete Tasks** - Tasks not yet completed
  - ✅ **Completed Tasks** - Tasks marked as done
- Each group shows the task count
- Tasks grouped by file within each category

### **Clean Display**
- Modern, styled filter buttons
- Hover effects for better interaction
- Color-coded filters for easy identification
- Empty state message when no tasks found

## File Naming Convention

The `dailyTasks` API expects daily files to be named in the format: **YYYY-MM-DD.md**

Examples:
- `2025-07-21.md` - July 21, 2025
- `2025-01-01.md` - January 1, 2025
- `2024-12-15.md` - December 15, 2024

## Task Filtering

The API uses smart filtering logic:

### Excluded Tasks
Tasks are **automatically excluded** if they:
- ❌ Have cancelled status (`- [-]`) - checked via `status === "-"`
- ❌ Are completed without a completion date

### Completed Tasks
Shows tasks **completed on the specific day** only
- ✅ Must have a completion date (`✅ YYYY-MM-DD`)

### Uncompleted Tasks
Shows tasks that are:
- **Due** (`📅`) on or **before** the specified day
- **Scheduled** (`⏳`) on or **before** the specified day

This means uncompleted tasks from previous days will "carry forward" to today's view, so you never lose track of pending tasks!

## Options

### DailyTaskOptions

- `year` (number, optional): The year to get tasks for
- `month` (number, optional): The month to get tasks for (1-12)
- `day` (number, optional): The day to get tasks for (1-31)
- `searchPath` (string, optional): The path to search for tasks. Defaults to `"/"`
- `filename` (string, optional): The filename in YYYY-MM-DD format. Auto-detected if not provided
- `trimTaskText` (boolean, optional): Show only description (true) or full text (false). Defaults to true

## Notes

- If `year`, `month`, and `day` are not provided, the API will attempt to parse them from the current file name
- The `searchPath` should be a valid Dataview path query (e.g., `"/folder"` or `"#tag"`)
- The `trimTaskText` option removes metadata like `@duration()`, `@start()`, etc., showing only the task description

