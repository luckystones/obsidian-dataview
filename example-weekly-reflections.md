# Weekly Reflections Example

This example demonstrates how to use the weekly reflections feature to display highlights from your daily notes in a weekly view.

## Using Highlights in Daily Notes

To use this feature, you need to tag your daily notes with `#highlights` and include your highlights in one of these formats:

1. Create a section called "Highlights" with bullet points:
```markdown
# Highlights
- This is an important insight I had today
- Another important reflection from my day
```

2. Use block quotes in your daily note:
```markdown
> This quote or insight was meaningful to me today
> Another reflection worth remembering
```

3. Use highlighting syntax:
```markdown
This paragraph contains ==an important insight== I want to remember.
```

## Displaying Weekly Reflections

Once you have added highlights to your daily notes, you can display them in your weekly note:

```dataviewjs
// Get the year and week from the filename (assuming the filename is in YYYY-WW format)
const filename = dv.current().file.name;
const [year, weekStr] = filename.split('-W');
const week = parseInt(weekStr);

// Get tasks for the week
const tasks = await dv.weekly.getWeeklyTasks({
    year: parseInt(year),
    week: week,
    searchPath: "/tasks",
    component: this.component,
    container: this.container
});

// Render the dashboard with tasks and reflections
await dv.weekly.weeklyView.renderWeeklyDashboard(
    tasks, 
    filename, 
    this.component, 
    this.container
);
```

## Accessing Just the Reflections

If you only want to display the reflections without the tasks, you can use this:

```dataviewjs
// Render just the reflections section
await dv.weekly.weeklyView.renderReflections(
    dv.current().file.name,
    this.component,
    this.container
);
```

## Using Tag Categories

You can categorize your highlights by using hierarchical tags:

```markdown
#highlights/insight This was an interesting insight
#highlights/quote A meaningful quote from my reading
#highlights/decision An important decision I made today
```

These categories will be displayed as colored badges in the reflections view, making it easier to distinguish between different types of highlights. 