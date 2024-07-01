import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface GitLabNotesSettings {
    rootFolder: string,

    mergeRequestIdFormat: string,
    mergeRequestAlternateIdFormat: string,
    mergeRequestFileNameFormat: string,
    mergeRequestTemplate?: string,

    issueIdFormat: string,
    issueAlternateIdFormat: string,
    issueFileNameFormat: string,
    issueTemplate?: string
}

// Format
// Template
// Folder
// https://gitlab.acme.com/acme/it/projects/acmeapps/-/merge_requests/1314
// {
//   fullProject: acme/it/projects/acmeapps
//   shortProject: acmeapps
//   number: 1314,
//   title: Implement New Fixture Naming Scheme For Release
//   fileNameSafeTitle: Implement New Fixture Naming Scheme For Release
//   mergeRequestId: acmeapps!1314
//   mergeRequestAlternateId: MR-1314
// }
const DEFAULT_SETTINGS: GitLabNotesSettings = {
    rootFolder: 'GitLab Projects',

    mergeRequestIdFormat: '{shortProject}!{number}',
    mergeRequestAlternateIdFormat: 'MR-{number}',
    mergeRequestFileNameFormat: '{shortProject}/merge-requests/{alternateRef} - {fileNameSafeTitle}',
    mergeRequestTemplate: '',

    issueIdFormat: '{shortProject}!{number}',
    issueAlternateIdFormat: 'I-{number}',
    issueFileNameFormat: '{shortProject}/issues/{alternateRef} - {fileNameSafeTitle}',
    issueTemplate: '',
}

export default class GitLabNotes extends Plugin {
    settings: GitLabNotesSettings;
    gitLabInfos: { [key: string]: GitLabInfo }

    async onload() {
        await this.loadSettings();
        this.gitLabInfos = {};

        this.registerObsidianProtocolHandler("gitlab-notes/open", async (e) => {
            const gitLabInfo = extractGitLabInfo(this, e.location, e.title)

            const existingNote = this.app.vault.getFileByPath(`${gitLabInfo.fullPath}.md`)

            if (existingNote) {
                console.log('Already there!')
                console.log({existingNote})
                const activeLeaf = this.app.workspace.getLeaf(false);

                if (!activeLeaf) {
                    console.log("No active leaf found")
                    return;
                }

                await activeLeaf.openFile(existingNote, {
                    state: { mode: "source" },
                });
            } else {
                if (gitLabInfo.template) {
                    const tp = this.app.plugins.plugins['templater-obsidian'].templater.current_functions_object
                    const userTemplate = tp.file.find_tfile(gitLabInfo.template)
                    const fabricatedUrl = `[${gitLabInfo.ref}](${gitLabInfo.url}) - \`${gitLabInfo.title}\``
                    await navigator.clipboard.writeText(fabricatedUrl);
                    this.gitLabInfos[gitLabInfo.fullPath] = gitLabInfo
                    tp.file.create_new(
                        userTemplate,
                        gitLabInfo.fullPath,
                        true
                    )
                } else {
                    tp.file.create_new("", `${gitLabInfo.fullPath}`, true)
                }
            }
        })

        // This creates an icon in the left ribbon.
        //const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
        //  // Called when the user clicks the icon.
        //  new Notice('This is a notice!');
        //});
        // Perform additional things with the ribbon
        //ribbonIconEl.addClass('my-plugin-ribbon-class');

        // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
        //const statusBarItemEl = this.addStatusBarItem();
        //statusBarItemEl.setText('Status Bar Text');

        // This adds a simple command that can be triggered anywhere
        //this.addCommand({
        //  id: 'open-sample-modal-simple',
        //  name: 'Open sample modal (simple) FOO',
        //  callback: () => {
        //      new SampleModal(this.app).open();
        //  }
        //});
        // This adds an editor command that can perform some operation on the current editor instance
        //this.addCommand({
        //  id: 'sample-editor-command',
        //  name: 'Sample editor command foo',
        //  editorCallback: (editor: Editor, view: MarkdownView) => {
        //      console.log(editor.getSelection());
        //      editor.replaceSelection('Sample Editor Command');
        //  }
        //});
        // This adds a complex command that can check whether the current state of the app allows execution of the command
        //this.addCommand({
        //  id: 'open-sample-modal-complex',
        //  name: 'Open sample modal (complex) BAR',
        //  checkCallback: (checking: boolean) => {
        //      // Conditions to check
        //      const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
        //      if (markdownView) {
        //          // If checking is true, we're simply "checking" if the command can be run.
        //          // If checking is false, then we want to actually perform the operation.
        //          if (!checking) {
        //              new SampleModal(this.app).open();
        //          }
        //
        //          // This command will only show up in Command Palette when the check function returns true
        //          return true;
        //      }
        //  }
        //});

        // This adds a settings tab so the user can configure various aspects of the plugin
        this.addSettingTab(new GitLabNotesSettingTab(this.app, this));

        // If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
        // Using this function will automatically remove the event listener when this plugin is disabled.
        //this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
        //  console.log('click', evt);
        //});

        // When registering intervals, this function will automatically clear the interval when the plugin is disabled.
        //this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
    }

    yaml(info: GitLabNotes): string {
        return [
            "gitLab:",
            ...Object.keys(info).map(k => `    ${k}: "${JSON.stringify(info[k]).slice(1, -1)}"`),
        ].join("\n")
    }

    getGitLabInfoForTemplate(tp) {
        const filePath = tp.file.path(true).replace(/\.md$/, '')

        return this.gitLabInfos[filePath]
    }

    onunload() {

    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

//class SampleModal extends Modal {
//  constructor(app: App) {
//      super(app);
//  }
//
//  onOpen() {
//      const {contentEl} = this;
//  }
//
//  onClose() {
//      const {contentEl} = this;
//      contentEl.empty();
//  }
//}

class GitLabNotesSettingTab extends PluginSettingTab {
    plugin: GitLabNotes;

    constructor(app: App, plugin: GitLabNotes) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;

        containerEl.empty();

        containerEl.createEl('h3', { text: "General" })
        const generalContainerEl = containerEl.createEl('div')

        new Setting(generalContainerEl)
            .setName('Root folder')
            .setDesc('GitLab Notes will live here')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.rootFolder)
                .setValue(this.plugin.settings.rootFolder)
                .onChange(async (value) => {
                    this.plugin.settings.rootFolder = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h3', { text: "Issues" })
        const issueContainerEl = containerEl.createEl('div')

        new Setting(issueContainerEl)
            .setName('Issue ID Format')
            .setDesc('Format for creating GitLab Issue IDs')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.issueIdFormat)
                .setValue(this.plugin.settings.issueIdFormat)
                .onChange(async (value) => {
                    this.plugin.settings.issueIdFormat = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(issueContainerEl)
            .setName('Alternate ID Format')
            .setDesc('Format for creating alternate GitLab Issue IDs')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.issueAlternateIdFormat)
                .setValue(this.plugin.settings.issueAlternateIdFormat)
                .onChange(async (value) => {
                    this.plugin.settings.issueAlternateIdFormat = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(issueContainerEl)
            .setName('Issue File Name Format')
            .setDesc('Format for creating GitLab Issue Files')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.issueFileNameFormat)
                .setValue(this.plugin.settings.issueFileNameFormat)
                .onChange(async (value) => {
                    this.plugin.settings.issueFileNameFormat = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(issueContainerEl)
            .setName('Issue Template')
            .setDesc('Template for new GitLab Issues')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.issueTemplate)
                .setValue(this.plugin.settings.issueTemplate)
                .onChange(async (value) => {
                    this.plugin.settings.issueTemplate = value;
                    await this.plugin.saveSettings();
                }));


        containerEl.createEl('h3', { text: "Merge Requests" })
        const mergeRequestContainerEl = containerEl.createEl('div')

        new Setting(mergeRequestContainerEl)
            .setName('Merge Request ID Format')
            .setDesc('Format for creating GitLab Merge Request IDs')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.mergeRequestIdFormat)
                .setValue(this.plugin.settings.mergeRequestIdFormat)
                .onChange(async (value) => {
                    this.plugin.settings.mergeRequestIdFormat = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(mergeRequestContainerEl)
            .setName('Alternate ID Format')
            .setDesc('Format for creating alternate GitLab Merge Request IDs')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.mergeRequestAlternateIdFormat)
                .setValue(this.plugin.settings.mergeRequestAlternateIdFormat)
                .onChange(async (value) => {
                    this.plugin.settings.mergeRequestAlternateIdFormat = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(mergeRequestContainerEl)
            .setName('Merge Request File Name Format')
            .setDesc('Format for creating GitLab Merge Request Files')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.mergeRequestFileNameFormat)
                .setValue(this.plugin.settings.mergeRequestFileNameFormat)
                .onChange(async (value) => {
                    this.plugin.settings.mergeRequestFileNameFormat = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(mergeRequestContainerEl)
            .setName('Merge Request Template')
            .setDesc('Template for new GitLab Merge Requests ')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.mergeRequestTemplate)
                .setValue(this.plugin.settings.mergeRequestTemplate)
                .onChange(async (value) => {
                    this.plugin.settings.mergeRequestTemplate = value;
                    await this.plugin.saveSettings();
                }));
    }
}

interface RawGitLabInfo {
    url: string
    fullProject: string
    shortProject: string
    type: string
    number: number
    title: string
}

interface GitLabInfo {
    url: string
    fullProject: string
    shortProject: string
    type: string
    number: number
    title: string
    fileNameSafeTitle: string
    ref: string
    alternateRef: string
    fileName: string
    filePath: string
    fullPath: string
    template: string
}

const gitLabUrlRe = /^https:\/\/[^\/]+\/(.*?([^\/]+?))\/-\/(issues|merge_requests)\/(\d+)/

function extractRawGitLabInfo(location: string, title: string): RawGitLabInfo {
    const matches = location.match(gitLabUrlRe)
    const url = matches[0]
    const fullProject = matches[1]
    const shortProject = matches[2]
    const type = matches[3] === "issues" ? "issue" : "merge-reqest"
    const number = matches[4]
    return {
        url,
        fullProject,
        shortProject,
        type,
        number,
        title,
    }
}

function renderTemplate(template: string, rawGitLabInfo: { [key: string]: string }): string
{
    let rendered = template
    for (let key in rawGitLabInfo) {
        rendered = rendered.replace(new RegExp(`{${key}}`), rawGitLabInfo[key])
    }

    return rendered
}

function extractGitLabInfo(plugin: GitLabNotes, location: string, title: string): GitLabInfo {
    const rawGitLabInfo = extractRawGitLabInfo(location, title)
    const gitLabInfo = rawGitLabInfo
    
    const refFormat = gitLabInfo.type === "issue"
        ? plugin.settings.issueIdFormat
        : plugin.settings.mergeRequestIdFormat

    const alternateRefFormat = gitLabInfo.type === "issue"
        ? plugin.settings.issueAlternateIdFormat
        : plugin.settings.mergeRequestAlternateIdFormat

    const fileNameFormat = gitLabInfo.type === "issue"
        ? plugin.settings.issueFileNameFormat
        : plugin.settings.mergeRequestFileNameFormat

    const templateFormat = gitLabInfo.type === "issue"
        ? plugin.settings.issueTemplate
        : plugin.settings.mergeRequestTemplate

    gitLabInfo.fileNameSafeTitle = gitLabInfo.title.replace(/[":\/\\]+/, "")

    gitLabInfo.ref = renderTemplate(refFormat, rawGitLabInfo)
    gitLabInfo.alternateRef = renderTemplate(alternateRefFormat, rawGitLabInfo)

    gitLabInfo.filePath = renderTemplate(fileNameFormat, gitLabInfo)
    gitLabInfo.fileName = gitLabInfo.filePath.split(/[\/]/).pop()
    gitLabInfo.fullPath = plugin.settings.rootFolder !== ''
        ? `${plugin.settings.rootFolder}/${gitLabInfo.filePath}`
        : `${gitLabInfo.filePath}`
    gitLabInfo.template = renderTemplate(templateFormat, gitLabInfo)

    return gitLabInfo
}
