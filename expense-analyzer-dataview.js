// Expense Analyzer for Dataview scripts
// Usage: Copy this code into a Dataview JS code block

// Configuration
const configFilePath = 'game/financial/budget/credit_card_analysis.md';
const monthFilename = '2025-June.md'; // Replace with the desired month file
const analyzeOther = true;

class DataEntry {
    constructor(month, year, monthyear, category, amount) {
        this.month = month;
        this.year = year;
        this.monthyear = monthyear;
        this.category = category;
        this.amount = amount;
    }
}

// Main function
async function analyzeExpenses() {
    try {
        // Load category configuration
        const categoryConfig = await loadCategoryConfig();
        if (!categoryConfig) {
            dv.paragraph("Failed to load category configuration");
            return;
        }

        // Load expense data
        const expenseData = await loadExpenseData();
        if (!expenseData || expenseData.length === 0) {
            dv.paragraph("No expense data found");
            return;
        }

        // Process the data
        const aggregatedData = processExpenseData(expenseData, categoryConfig);

        // Convert to data entries and sort
        const dataEntries = convertToDataEntries(aggregatedData);

        // Display the results
        displayResults(dataEntries);
    } catch (error) {
        dv.paragraph(`Error analyzing expenses: ${error.message}`);
    }
}

// Load category configuration from the specified file
async function loadCategoryConfig() {
    const configFile = app.vault.getAbstractFileByPath(configFilePath);

    if (!configFile) {
        dv.paragraph(`Config file not found: ${configFilePath}`);
        return null;
    }

    const fileContent = await app.vault.read(configFile);

    // Parse frontmatter to get categories
    const frontmatterMatch = fileContent.match(/^---\n([\s\S]*?)\n---/);

    if (frontmatterMatch && frontmatterMatch[1]) {
        const frontmatter = frontmatterMatch[1];

        // Parse YAML-like structure
        const categories = [];
        let currentCategory = null;

        frontmatter.split('\n').forEach(line => {
            const trimmedLine = line.trim();

            if (trimmedLine.startsWith('categories:')) {
                // Start of categories section
            } else if (trimmedLine.startsWith('- name:')) {
                // New category
                if (currentCategory) {
                    categories.push(currentCategory);
                }

                currentCategory = {
                    name: trimmedLine.substring(7).trim(),
                    places: []
                };
            } else if (trimmedLine.startsWith('- ') && currentCategory) {
                // Place within a category
                currentCategory.places.push(trimmedLine.substring(2).trim());
            }
        });

        // Add the last category
        if (currentCategory) {
            categories.push(currentCategory);
        }

        return { categories };
    }

    return null;
}

// Load expense data from the specified file
async function loadExpenseData() {
    const expenseFile = app.vault.getAbstractFileByPath(monthFilename);

    if (!expenseFile) {
        dv.paragraph(`Expense file not found: ${monthFilename}`);
        return null;
    }

    const fileContent = await app.vault.read(expenseFile);
    return fileContent.split('\n').filter(line => line.trim() !== '');
}

// Process expense data and aggregate by month/year and category
function processExpenseData(expenseData, categoryConfig) {
    const aggregatedData = {};

    expenseData.forEach(expense => {
        // Split the expense data by space
        const expenseDetails = expense.split(" ");

        // Extract the date and amount
        const date = expenseDetails[0];
        const shop = expenseDetails.slice(1, -2).join(" ");
        const amountStr = expenseDetails[expenseDetails.length - 2];
        const amount = parseFloat(amountStr.replace(".", "").replace(",", "."));

        // Get category for this shop
        const category = getCategory(shop, amount, categoryConfig);

        // Extract day, month, year from the date
        const [day, month, year] = date.split("/");
        const monthYear = `${month}/${year}`;

        // Initialize aggregated data for this month/year if needed
        if (!aggregatedData[monthYear]) {
            aggregatedData[monthYear] = {};
        }

        // Initialize category for this month/year if needed
        if (!aggregatedData[monthYear][category]) {
            aggregatedData[monthYear][category] = 0;
        }

        // Add the amount to the corresponding category
        aggregatedData[monthYear][category] += amount;
    });

    return aggregatedData;
}

// Determine the category for a purchase
function getCategory(purchaseName, amount, categoryConfig) {
    for (const category of categoryConfig.categories) {
        for (const place of category.places) {
            if (purchaseName.toLowerCase().includes(place.toLowerCase())) {
                return category.name;
            }
        }
    }

    return analyzeOther ? purchaseName : "OTHER";
}

// Convert aggregated data to DataEntry array and sort
function convertToDataEntries(aggregatedData) {
    const dataEntries = [];

    for (const monthYear in aggregatedData) {
        for (const category in aggregatedData[monthYear]) {
            const amount = aggregatedData[monthYear][category];
            const [month, year] = monthYear.split("/");

            dataEntries.push(new DataEntry(
                month,
                year,
                monthYear,
                category,
                amount
            ));
        }
    }

    // Sort by year (desc), month (desc), then amount (desc)
    return dataEntries.sort((a, b) => {
        if (a.year !== b.year) {
            return b.year.localeCompare(a.year);
        }

        if (a.month !== b.month) {
            return b.month.localeCompare(a.month);
        }

        return b.amount - a.amount;
    });
}

// Display the results using Dataview
function displayResults(entries) {
    let prevMonthYear = "";

    entries.forEach(entry => {
        if (entry.monthyear !== prevMonthYear) {
            prevMonthYear = entry.monthyear;
            dv.header(2, `${entry.monthyear}:`);
        }

        dv.paragraph(` ${entry.category} : ${entry.amount.toFixed(2)} TL`);
    });
}

// Run the analysis
analyzeExpenses(); 