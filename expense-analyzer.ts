import { App, TFile } from 'obsidian';
import { ExpenseConfigManager } from './expense-config';

export interface ExpenseItem {
    date: string;
    description: string;
    amount: number;
    rawText?: string;
}

export interface DataEntry {
    month: string;
    year: string;
    monthyear: string;
    category: string;
    amount: number;
    expenses: ExpenseItem[]; // List of individual expenses in this category
}

export class ExpenseAnalyzer {
    private app: App;
    private configManager: ExpenseConfigManager;
    private analyzeOther: boolean = true;

    constructor(app: App) {
        this.app = app;
        this.configManager = new ExpenseConfigManager(app);
    }

    /**
     * Analyzes expenses for a given month
     * @param monthFileName The file name in format YYYY-Month (e.g., 2025-June)
     * @param configFilePath The path to the category configuration file
     * @returns Promise<DataEntry[]> Sorted expense data entries
     */
    async analyzeExpenses(monthFileName: string, configFilePath: string): Promise<DataEntry[]> {
        // Set the config file path and load configuration
        this.configManager.setConfigPath(configFilePath);
        await this.configManager.loadConfig();

        // Load expense data
        const expenseData = await this.loadExpenseData(monthFileName);

        // Process expense data
        const aggregatedData = this.processExpenseData(expenseData);

        // Convert to data entries and sort
        return this.convertToDataEntries(aggregatedData);
    }

    /**
     * Set the config manager to use
     * @param configManager The ExpenseConfigManager to use
     */
    setConfigManager(configManager: ExpenseConfigManager): void {
        this.configManager = configManager;
    }

    /**
     * Get the current config manager
     * @returns The current ExpenseConfigManager
     */
    getConfigManager(): ExpenseConfigManager {
        return this.configManager;
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
     * @returns Aggregated expense data with individual expense items
     */
    private processExpenseData(expenseData: string[]): Record<string, Record<string, { total: number, items: ExpenseItem[] }>> {
        const aggregatedData: Record<string, Record<string, { total: number, items: ExpenseItem[] }>> = {};

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

                // Extract day, month, year from the date
                const [day, month, year] = date.split("/");
                if (isNaN(Number(month)) || isNaN(Number(year))) {
                    console.warn(`Skipping expense line with invalid date: "${expense}" ${day}${month} ${year}`);
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

                // Get category for this shop using the config manager
                const category = this.getCategory(shop, amount);

                const monthYear = `${month}/${year}`;

                // Initialize aggregated data for this month/year if needed
                if (!aggregatedData[monthYear]) {
                    aggregatedData[monthYear] = {};
                }

                // Initialize category for this month/year if needed
                if (!aggregatedData[monthYear][category]) {
                    aggregatedData[monthYear][category] = {
                        total: 0,
                        items: []
                    };
                }

                // Create expense item
                const expenseItem: ExpenseItem = {
                    date,
                    description: shop,
                    amount,
                    rawText: expense
                };

                // Add the expense item to the category
                aggregatedData[monthYear][category].items.push(expenseItem);

                // Add the amount to the corresponding category total
                aggregatedData[monthYear][category].total += amount;
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
        return this.configManager.getCategoryForPurchase(purchaseName, amount, this.analyzeOther);
    }

    /**
     * Convert aggregated data to DataEntry array and sort
     * @param aggregatedData The aggregated expense data
     * @returns Sorted array of DataEntry objects
     */
    private convertToDataEntries(aggregatedData: Record<string, Record<string, { total: number, items: ExpenseItem[] }>>): DataEntry[] {
        const dataEntries: DataEntry[] = [];

        for (const monthYear in aggregatedData) {
            for (const category in aggregatedData[monthYear]) {
                const { total, items } = aggregatedData[monthYear][category];
                const [month, year] = monthYear.split("/");

                dataEntries.push({
                    month,
                    year,
                    monthyear: monthYear,
                    category,
                    amount: total,
                    expenses: items
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

            // Optionally add detailed expense items
            if (entry.expenses && entry.expenses.length > 0) {
                output += "   Details:\n";
                entry.expenses.forEach(item => {
                    output += `   - ${item.date} ${item.description}: ${item.amount.toFixed(2)} TL\n`;
                });
            }
        });

        return output;
    }

    /**
     * Add a new category keyword
     * @param categoryName Category to add the keyword to
     * @param keyword The keyword to add
     * @returns Promise resolving to boolean indicating success
     */
    async addCategoryKeyword(categoryName: string, keyword: string): Promise<boolean> {
        return await this.configManager.addCategoryKeyword(categoryName, keyword);
    }
} 