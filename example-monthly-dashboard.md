# Monthly Dashboard Example

This example demonstrates how to use the monthly dashboard feature in Dataview.

## Basic Monthly Dashboard

```dataviewjs
// Render a monthly dashboard for the current month
const now = new Date();
await dv.monthlyDashboard({
    year: now.getFullYear(),
    month: now.getMonth() // 0-based month index (0 = January, 11 = December)
});
```

## Monthly Dashboard for a Specific Month

```dataviewjs
// Render a monthly dashboard for June 2025
await dv.monthlyDashboard({
    year: 2025,
    month: "June" // You can use either month name or month index (0-11)
});
```

## Using Month Number (1-12)

```dataviewjs
// Render a monthly dashboard for March 2024
// Note: When using numbers 1-12, they'll be interpreted as 1-based month numbers
await dv.monthlyDashboard({
    year: 2024,
    month: 3 // March (3rd month)
});
```

## Usage Notes

The monthly dashboard provides:

1. **Monthly Time View**: Shows age indicators and time progress within the year
2. **Task Statistics**: Visualizes task completion rates
3. **Monthly Reflections**: Displays notes and reflections tagged with specific fields

### Required File Structure

- Month files should be named in the format `YYYY-Month` (e.g., `2025-June`)
- Daily notes should be in a folder named "daily" and follow the format `YYYY-MM-DD`
- To include reflections, add inline fields to your daily notes:
  - `highlight:: Your highlight text`
  - `feeling:: Your feeling`
  - `tefekkur:: Your reflection`
  - `sohbet:: Your conversation notes`
  - `words:: Notable quote or words`

### Example Daily Note Structure

```markdown
# 2025-06-15

## Notes

Today was productive.

highlight:: I finished the monthly dashboard feature
feeling:: Accomplished, Satisfied
words:: "Simplicity is the ultimate sophistication."
``` 