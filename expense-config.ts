import { App, TFile } from 'obsidian';

/**
 * Interface for a category definition with name and matching keywords
 */
export interface Category {
    name: string;
    places: string[];
}

/**
 * Interface for the complete category configuration
 */
export interface CategoryConfig {
    categories: Category[];
}

/**
 * Class to manage expense category configurations
 */
export class ExpenseConfigManager {
    private app: App;
    private configFilePath: string;
    private categoryConfig: CategoryConfig | null = null;

    /**
     * Creates a new ExpenseConfigManager
     * @param app Obsidian App instance
     * @param configFilePath Path to the category configuration file
     */
    constructor(app: App, configFilePath: string = 'game/financial/budget/credit_card_analysis.md') {
        this.app = app;
        this.configFilePath = configFilePath;
    }

    /**
     * Gets the current category configuration
     * @returns The current category configuration or null if not loaded
     */
    public getConfig(): CategoryConfig | null {
        return this.categoryConfig;
    }

    /**
     * Sets the configuration file path
     * @param path New path to the configuration file
     */
    public setConfigPath(path: string): void {
        this.configFilePath = path;
    }

    /**
     * Loads category configuration from the specified file
     * @returns Promise resolving to the loaded CategoryConfig
     * @throws Error if loading fails
     */
    public async loadConfig(): Promise<CategoryConfig> {
        const configFile = this.app.vault.getAbstractFileByPath(this.configFilePath);

        if (!(configFile instanceof TFile)) {
            throw new Error(`Config file not found: ${this.configFilePath}`);
        }

        const fileContent = await this.app.vault.read(configFile);
        const config = this.parseConfigFile(fileContent);

        if (!config) {
            throw new Error('Failed to parse category configuration');
        }

        this.categoryConfig = config;
        return config;
    }

    /**
     * Parses a configuration file content to extract category data
     * @param fileContent The content of the configuration file
     * @returns Parsed CategoryConfig or null if parsing fails
     */
    private parseConfigFile(fileContent: string): CategoryConfig | null {
        // Parse frontmatter to get categories
        const frontmatterMatch = fileContent.match(/^---\n([\s\S]*?)\n---/);

        if (!frontmatterMatch || !frontmatterMatch[1]) {
            return null;
        }

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

        return { categories };
    }

    /**
     * Adds a new keyword to a category
     * @param categoryName The name of the category to update
     * @param keyword The new keyword to add
     * @returns Promise resolving to boolean indicating success
     */
    public async addCategoryKeyword(categoryName: string, keyword: string): Promise<boolean> {
        if (!this.categoryConfig) {
            await this.loadConfig();
        }

        if (!this.categoryConfig) {
            throw new Error('Failed to load category configuration');
        }

        // Find the category
        const category = this.categoryConfig.categories.find(c => c.name === categoryName);

        if (!category) {
            // Category doesn't exist, create a new one
            this.categoryConfig.categories.push({
                name: categoryName,
                places: [keyword]
            });
        } else {
            // Check if keyword already exists
            if (!category.places.includes(keyword)) {
                category.places.push(keyword);
            } else {
                // Keyword already exists, nothing to do
                return false;
            }
        }

        // Save the updated configuration
        return await this.saveConfig();
    }

    /**
     * Saves the current configuration back to the file
     * @returns Promise resolving to boolean indicating success
     */
    private async saveConfig(): Promise<boolean> {
        if (!this.categoryConfig) {
            return false;
        }

        const configFile = this.app.vault.getAbstractFileByPath(this.configFilePath);

        if (!(configFile instanceof TFile)) {
            return false;
        }

        try {
            // Read the current file to preserve any other content
            const currentContent = await this.app.vault.read(configFile);

            // Extract the non-frontmatter content (if any)
            const contentMatch = currentContent.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
            const contentAfterFrontmatter = contentMatch ? contentMatch[1] : '';

            // Generate new frontmatter
            let newFrontmatter = '---\n';
            newFrontmatter += 'categories:\n';

            // Add each category
            this.categoryConfig.categories.forEach(category => {
                newFrontmatter += `- name: ${category.name}\n`;
                category.places.forEach(place => {
                    newFrontmatter += `  - ${place}\n`;
                });
            });

            newFrontmatter += '---\n';

            // Combine frontmatter with original content
            const newContent = newFrontmatter + contentAfterFrontmatter;

            // Write back to file
            await this.app.vault.modify(configFile, newContent);

            return true;
        } catch (error) {
            console.error('Error saving category configuration:', error);
            return false;
        }
    }

    /**
     * Determines the category for a purchase based on loaded configuration
     * @param purchaseName The name of the shop or purchase
     * @param amount The purchase amount
     * @param defaultToName Whether to use purchase name as category if no match (true) or use "OTHER" (false)
     * @returns The category name
     */
    public getCategoryForPurchase(purchaseName: string, amount: number, defaultToName: boolean = true): string {
        if (!this.categoryConfig) {
            return defaultToName ? purchaseName : "OTHER";
        }

        for (const category of this.categoryConfig.categories) {
            for (const place of category.places) {
                if (purchaseName.toLowerCase().includes(place.toLowerCase())) {
                    return category.name;
                }
            }
        }

        return defaultToName ? purchaseName : "OTHER";
    }
} 