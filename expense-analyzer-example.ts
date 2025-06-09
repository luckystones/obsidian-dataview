import { ExpenseAnalyzer, DataEntry } from './expense-analyzer';
import { Plugin } from 'obsidian';

export class ExpenseAnalyzerExample {
    private plugin: Plugin;

    constructor(plugin: Plugin) {
        this.plugin = plugin;
    }

    /**
     * Run an expense analysis for a given month
     * @param monthFilename The expense file (e.g. "2025-June.md")
     * @returns Formatted expense analysis
     */
    async runAnalysis(monthFilename: string): Promise<string> {
        // Create the analyzer
        const analyzer = new ExpenseAnalyzer(this.plugin.app);

        // Set analyze other option (optional)
        analyzer.setAnalyzeOther(true);

        try {
            // Config file path - adjust as needed
            const configFilePath = 'game/financial/budget/credit_card_analysis.md';

            // Run the analysis
            const dataEntries = await analyzer.analyzeExpenses(monthFilename, configFilePath);

            // Format the results
            return analyzer.formatExpenseData(dataEntries);
        } catch (error) {
            console.error('Error analyzing expenses:', error);
            return `Error analyzing expenses: ${error.message}`;
        }
    }

    /**
     * Example of how to use the expense analyzer in a Dataview context
     * This can be called from a Dataview script code block
     */
    async dataviewExample(dv: any, monthFilename: string): Promise<void> {
        // Create the analyzer
        const analyzer = new ExpenseAnalyzer(this.plugin.app);

        try {
            // Config file path - adjust as needed
            const configFilePath = 'game/financial/budget/credit_card_analysis.md';

            // Run the analysis
            const dataEntries = await analyzer.analyzeExpenses(monthFilename, configFilePath);

            // Display the results using Dataview
            let prevMonthYear = "";

            dataEntries.forEach(entry => {
                if (entry.monthyear !== prevMonthYear) {
                    prevMonthYear = entry.monthyear;
                    dv.header(2, `${entry.monthyear}:\n`);
                }

                const categoryPurchase = ` ${entry.category} : ${entry.amount.toFixed(2)} TL\n`;
                dv.paragraph(categoryPurchase);
            });
        } catch (error) {
            console.error('Error analyzing expenses:', error);
            dv.paragraph(`Error analyzing expenses: ${error.message}`);
        }
    }
} 