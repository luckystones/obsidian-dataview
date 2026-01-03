import { App, MarkdownView, Modal, Plugin, Setting } from 'obsidian';
import { OpenAI } from 'openai';

import { GoogleGenerativeAI } from "@google/generative-ai";

// Interface for settings needed by the wizard
export interface WizardSettings {
    openAPIKEY: string;
    geminiAPIKey: string;
}

// Modal for prompting user input
export class WishPromptModal extends Modal {
    onSubmit: (prompt: string) => void;
    promptValue = '';

    constructor(app: App, onSubmit: (prompt: string) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Enter the prompt for AI' });

        new Setting(contentEl)
            .setName('Prompt')
            .addText(text => text.onChange(value => this.promptValue = value));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Submit')
                .setCta()
                .onClick(() => {
                    this.onSubmit(this.promptValue);
                    this.close();
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// Helper function to send text to ChatGPT
export const sendToChatGPT = async (settings: WizardSettings, text: string, prompt: string): Promise<string | null> => {
    const apiKey = settings.openAPIKEY;
    const openai = new OpenAI({ apiKey: apiKey, dangerouslyAllowBrowser: true });

    const requestBody = {
        prompt: `${prompt}\n\n${text}`,
        max_tokens: 150,
        temperature: 0.7,
    };

    console.log('Sending request to ChatGPT');
    console.log('Request Body:', requestBody);

    try {
        const completions = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'user',
                    content: text
                },
                {
                    role: 'system',
                    content: prompt
                }],
        });

        const responseData = completions.choices[0].message.content;
        console.log('Response from ChatGPT:', responseData);
        return responseData ? responseData : null;
    } catch (error) {
        console.error('Error sending to ChatGPT:', error);
        return null;
    }
}

// Helper function to send text to Gemini
export const sendToGemini = async (settings: WizardSettings, text: string, prompt: string): Promise<string | null> => {
    const apiKey = settings.geminiAPIKey || "AIzaSyADJUhzzH78mNvFmLG5x7tA3UEwXTBi_hk";
    if (!apiKey) {
        console.error('Gemini API key is not set');
        return null;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    console.log('Sending request to Gemini');

    try {
        const result = await model.generateContent([prompt, text]);
        const responseData = result.response.text();
        console.log('Response from Gemini:', responseData);
        return responseData ? responseData : null;
    } catch (error: any) {
        console.error('Error sending to Gemini:', error);
        return null;
    }
}

// Function to handle changing selected text via AI (defaulting to Gemini)
export const askGPTToChangeSelectedText = async (plugin: Plugin & { settings: WizardSettings }, prompt: string) => {
    const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView) {
        const editor = activeView.editor;
        const selectedText = editor.getSelection();
        if (selectedText) {
            console.log(`Selected text: ${selectedText}`);
            // Default to Gemini
            const response = await sendToGemini(plugin.settings, selectedText, prompt);
            if (response) {
                editor.replaceSelection(response);
                console.log(`Replaced selection with: ${response}`);
            } else {
                console.log('No response from AI');
            }
        } else {
            console.log('No text selected');
        }
    } else {
        console.log('Active view is not a MarkdownView');
    }
}

// Function to prompt user for a wish/command to AI on selected text
export const askToGPTWithSelection = async (plugin: Plugin & { settings: WizardSettings }) => {
    const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView) {
        const editor = activeView.editor;
        const selectedText = editor.getSelection();
        if (selectedText) {
            new WishPromptModal(plugin.app, async (prompt: string) => {
                // Default to Gemini
                const response = await sendToGemini(plugin.settings, selectedText, prompt);
                if (response) {
                    editor.replaceSelection(response);
                    console.log(`Replaced selection with: ${response}`);
                } else {
                    console.log('No response from AI');
                }
            }).open();
        } else {
            console.log('No text selected');
        }
    } else {
        console.log('Active view is not a MarkdownView');
    }
}

// Function to register the extracted commands
export function addWizardCommands(plugin: Plugin & { settings: WizardSettings }) {

    /*     plugin.addCommand({
            id: 'move-cursor-to-end-of-second-line-under-captures',
            name: 'Move Cursor to End of Second Line Under Captures',
            callback: async () => {
                moveToEndOfLine(plugin);
            }
        }); */

    plugin.addCommand({
        id: 'send-selection-to-chatgpt-paraphrase',
        name: 'Send Selection to ChatGPT (Paraphrase)',
        callback: async () => {
            await askGPTToChangeSelectedText(plugin, 'Fix grammar errors and paraphrase some parts if needed');
        }
    });
    plugin.addCommand({
        id: 'send-selection-to-chatgpt-reformat-markdown',
        name: 'Format selection in Markdown',
        callback: async () => {
            await askGPTToChangeSelectedText(plugin, 'Format the following text in Markdown. Highlight important parts if needed. Add headings and subheadings if needed. Add code blocks if needed. Add images if needed. Add links if needed. Number of words should not be far from the original text.');
        }
    });

    plugin.addCommand({
        id: 'translate-selected-text-into-turkish',
        name: 'to Turkish',
        callback: async () => {
            await askGPTToChangeSelectedText(plugin, 'Verilen yazıyı Türkçeye çevir Turkis, tırnak içerisine almadan orijinal metni çevir');
        }
    });

    plugin.addCommand({
        id: 'translate-selected-text-into-english',
        name: 'to English',
        callback: async () => {
            await askGPTToChangeSelectedText(plugin, 'Translate given text into English, without quoting the original text');
        }
    });

    plugin.addCommand({
        id: 'prompt-modal.ts-command',
        name: 'Make a wish',
        callback: async () => {
            await askToGPTWithSelection(plugin);
        }
    });
}
