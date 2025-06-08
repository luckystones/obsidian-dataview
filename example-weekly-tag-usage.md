# Weekly Tag Search Example

This example demonstrates how to use the weekly tag search feature to find files with specific tags in the "daily" folder for a given week. The search also extracts and displays tag values from hierarchical tags (e.g., `#project/personal/coding`).

## Basic Usage

You can use the `weeklyTagSearch` method to find and display files with a specific tag for a given week:

```dataviewjs
// Search for files with the #project tag in week 25 of 2023
dv.weeklyTagSearch({
    year: 2023,
    week: 25,
    tag: "project",
    component: this.component,
    container: this.container
});
```

## Custom Search Path

You can specify a custom path to search for files:

```dataviewjs
// Search for files with the #meeting tag in week 30 of 2023 in a custom folder
dv.weeklyTagSearch({
    year: 2023,
    week: 30,
    tag: "meeting",
    searchPath: "/notes/daily",  // Custom search path
    component: this.component,
    container: this.container
});
```

## Working with Tag Values

The weekly tag search now extracts values from hierarchical tags. For example, if your daily notes contain tags like `#project/personal/coding` or `#meeting/team/weekly`, the search will extract the values ("personal", "coding", "team", "weekly") and display them as badges.

Here's how to use these tag values in your custom code:

```dataviewjs
// Get the weekly tag API
const weeklyTag = dv.weeklyTag;

// Search for files with the #project tag in the current week
const now = new Date();
const year = now.getFullYear();
const startOfYear = new Date(year, 0, 1);
const days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);

// Get files with #project tag
const files = await weeklyTag.searchFilesWithTag({
    year: year,
    week: week,
    tag: "project"
});

// Custom rendering of the tag values
const container = this.container.createEl('div');

// Create a summary of tag values
const allTagValues = [];
Object.values(files).forEach(dayFiles => {
    dayFiles.forEach(file => {
        if (file.tagValues && file.tagValues.length > 0) {
            allTagValues.push(...file.tagValues);
        }
    });
});

// Count occurrences of each tag value
const valueCounts = {};
allTagValues.forEach(value => {
    valueCounts[value] = (valueCounts[value] || 0) + 1;
});

// Display summary
const summaryEl = container.createEl('div');
summaryEl.innerHTML = `<h3>Project Categories This Week</h3>`;
const listEl = summaryEl.createEl('ul');

for (const [value, count] of Object.entries(valueCounts)) {
    const item = listEl.createEl('li');
    item.innerHTML = `<strong>${value}</strong>: ${count} occurrences`;
}

// Now render the actual files
weeklyTag.renderWeeklyTagResults(files, container);
```

## Current Week

You can use JavaScript to dynamically get the current year and week:

```dataviewjs
// Get current date
const now = new Date();
// Get current year
const year = now.getFullYear();
// Get current week (approximate calculation)
const startOfYear = new Date(year, 0, 1);
const days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);

// Search for files with the #task tag in the current week
dv.weeklyTagSearch({
    year: year,
    week: week,
    tag: "task",
    component: this.component,
    container: this.container
});
```

## Advanced Usage

You can use the API directly for more customized functionality:

```dataviewjs
// Get the weekly tag API
const weeklyTag = dv.weeklyTag;

// Search for files with the #important tag in week 20 of 2023
const files = await weeklyTag.searchFilesWithTag({
    year: 2023,
    week: 20,
    tag: "important"
});

// Do something custom with the results
const totalFiles = Object.values(files).flat().length;
dv.paragraph(`Found ${totalFiles} files with the #important tag in week 20 of 2023.`);

// Render the results in a custom container
const customContainer = this.container.createEl('div');
customContainer.setAttribute('style', 'border: 1px solid #ccc; padding: 10px;');
weeklyTag.renderWeeklyTagResults(files, customContainer);
``` 