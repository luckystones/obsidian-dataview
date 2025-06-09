import { App, TFile } from 'obsidian';

export interface Category {
    name: string;
    places: string[];
}

export interface CategoryConfig {
    categories: Category[];
}

export interface DataEntry {
    month: string;
    year: string;
    monthyear: string;
    category: string;
    amount: number;
}

export class ExpenseAnalyzer {
    private app: App;
    private categoryConfig: CategoryConfig | null = null;
    private analyzeOther: boolean = true;

    constructor(app: App) {
        this.app = app;
    }

    /**
     * Analyzes expenses for a given month
     * @param monthFileName The file name in format YYYY-Month (e.g., 2025-June)
     * @param configFilePath The path to the category configuration file
     * @returns Promise<DataEntry[]> Sorted expense data entries
     */
    async analyzeExpenses(monthFileName: string, configFilePath: string): Promise<DataEntry[]> {
        // Load category configuration
        await this.loadCategoryConfig(configFilePath);

        if (!this.categoryConfig) {
            throw new Error('Failed to load category configuration');
        }

        // Load expense data
        const expenseData = await this.loadExpenseData(monthFileName);

        // Process expense data
        const aggregatedData = this.processExpenseData(expenseData);

        // Convert to data entries and sort
        return this.convertToDataEntries(aggregatedData);
    }

    /**
     * Loads category configuration from a file
     * @param configFilePath Path to the config file
     */
    private async loadCategoryConfig(configFilePath: string): Promise<void> {
        const configFile = this.app.vault.getAbstractFileByPath(configFilePath);

        if (configFile instanceof TFile) {
            const fileContent = await this.app.vault.read(configFile);

            // Parse frontmatter to get categories
            const frontmatterMatch = fileContent.match(/^---\n([\s\S]*?)\n---/);

            if (frontmatterMatch && frontmatterMatch[1]) {
                const frontmatter = frontmatterMatch[1];

                // Parse YAML-like structure (basic implementation)
                const categories: Category[] = [];
                let currentCategory: Category | null = null;

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

                this.categoryConfig = { categories };
            }
        }
    }

    /**
     * Loads expense data from a file
     * @param monthFileName The month file to analyze
     * @returns Array of expense lines
     */
    private async loadExpenseData(monthFileName: string): Promise<string[]> {
        const expenseFile = this.app.vault.getAbstractFileByPath(monthFileName);

        if (expenseFile instanceof TFile) {
            const fileContent = await this.app.vault.read(expenseFile);
            return fileContent.split('\n').filter(line => line.trim() !== '');
        }

        return [];
    }

    /**
     * Process expense data and aggregate by month/year and category
     * @param expenseData Array of expense lines
     * @returns Aggregated expense data
     */
    private processExpenseData(expenseData: string[]): Record<string, Record<string, number>> {
        const aggregatedData: Record<string, Record<string, number>> = {};

        expenseData.forEach(expense => {
            try {
                // Skip empty lines
                if (!expense || expense.trim() === '') {
                    return;
                }

                // Split the expense data by space
                const expenseDetails = expense.split(" ");

                // Skip lines with insufficient data
                if (expenseDetails.length < 3) {
                    console.warn(`Skipping expense line with insufficient data: "${expense}"`);
                    return;
                }

                // Extract the date and amount
                const date = expenseDetails[0];

                // Validate date format (DD/MM/YYYY)
                if (!date.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
                    console.warn(`Skipping expense line with invalid date format: "${expense}"`);
                    return;
                }

                // Get shop name (everything between date and amount)
                const shop = expenseDetails.slice(1, -2).join(" ");

                // Get and parse amount
                const amountStr = expenseDetails[expenseDetails.length - 2];

                // Remove any non-numeric characters except for comma and period
                const cleanedAmountStr = amountStr.replace(/[^\d,\.]/g, '');

                // Replace comma with period for proper parsing
                const normalizedAmountStr = cleanedAmountStr.replace(".", "").replace(",", ".");

                // Parse amount
                const amount = parseFloat(normalizedAmountStr);

                // Validate amount
                if (isNaN(amount) || amount <= 0) {
                    console.warn(`Skipping expense line with invalid amount: "${expense}"`);
                    return;
                }

                // Get category for this shop
                const category = this.getCategory(shop, amount);

                // Extract day, month, year from the date
                const [day, month, year] = date.split("/");
                if (isNaN(Number(month)) || isNaN(Number(year))) {
                    console.warn(`Skipping expense line with invalid date: "${expense}" ${day}${month} ${year}`);
                    return;
                }
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
            } catch (e) {
                console.error(`Error processing expense line: "${expense}"`, e);
            }
        });

        return aggregatedData;
    }

    /**
     * Determine the category for a purchase
     * @param purchaseName The name of the shop or purchase
     * @param amount The purchase amount
     * @returns The category name
     */
    private getCategory(purchaseName: string, amount: number): string {
        if (!this.categoryConfig) {
            return this.analyzeOther ? purchaseName : "OTHER";
        }

        for (const category of this.categoryConfig.categories) {
            for (const place of category.places) {
                if (purchaseName.toLowerCase().includes(place.toLowerCase())) {
                    return category.name;
                }
            }
        }

        return this.analyzeOther ? purchaseName : "OTHER";
    }

    /**
     * Convert aggregated data to DataEntry array and sort
     * @param aggregatedData The aggregated expense data
     * @returns Sorted array of DataEntry objects
     */
    private convertToDataEntries(aggregatedData: Record<string, Record<string, number>>): DataEntry[] {
        const dataEntries: DataEntry[] = [];

        for (const monthYear in aggregatedData) {
            for (const category in aggregatedData[monthYear]) {
                const amount = aggregatedData[monthYear][category];
                const [month, year] = monthYear.split("/");

                dataEntries.push({
                    month,
                    year,
                    monthyear: monthYear,
                    category,
                    amount
                });
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

    /**
     * Set whether to analyze "other" expenses
     * @param analyze Whether to analyze other expenses
     */
    setAnalyzeOther(analyze: boolean): void {
        this.analyzeOther = analyze;
    }

    /**
     * Format expense data for display
     * @param entries Sorted data entries
     * @returns Formatted string for display
     */
    formatExpenseData(entries: DataEntry[]): string {
        let output = "";
        let prevMonthYear = "";

        entries.forEach(entry => {
            if (entry.monthyear !== prevMonthYear) {
                prevMonthYear = entry.monthyear;
                output += `## ${entry.monthyear}:\n`;
            }

            output += ` ${entry.category} : ${entry.amount.toFixed(2)} TL\n`;
        });

        return output;
    }
} 