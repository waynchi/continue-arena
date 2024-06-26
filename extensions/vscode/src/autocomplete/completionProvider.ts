import type { IDE } from "core";
import {
  AutocompleteOutcome,
  CompletionProvider,
  type AutocompleteInput,
} from "core/autocomplete/completionProvider";
import type { ConfigHandler } from "core/config/handler";
import { v4 as uuidv4 } from "uuid";
import * as vscode from "vscode";
import type { TabAutocompleteModel } from "../util/loadAutocompleteModel";
import { getDefinitionsFromLsp } from "./lsp";
import { RecentlyEditedTracker } from "./recentlyEdited";
import { setupStatusBar, stopStatusBarLoading } from "./statusBar";
import { integer } from "vscode-languageclient";
import { getTwoUniqueRandomInts } from "../util/util";
import { get } from "request";

interface VsCodeCompletionInput {
  document: vscode.TextDocument;
  position: vscode.Position;
  context: vscode.InlineCompletionContext;
}

export class ContinueCompletionProvider
  implements vscode.InlineCompletionItemProvider
{
  private onError(e: any) {
    const options = ["Documentation"];
    if (e.message.includes("https://ollama.ai")) {
      options.push("Download Ollama");
    }
    vscode.window.showErrorMessage(e.message, ...options).then((val) => {
      if (val === "Documentation") {
        vscode.env.openExternal(
          vscode.Uri.parse(
            "https://docs.continue.dev/walkthroughs/tab-autocomplete",
          ),
        );
      } else if (val === "Download Ollama") {
        vscode.env.openExternal(vscode.Uri.parse("https://ollama.ai"));
      }
    });
  }

  private completionProviders: CompletionProvider[] = [];
  private inlineCompletionList: vscode.InlineCompletionList | undefined;
  private recentlyEditedTracker = new RecentlyEditedTracker();

  constructor(
    private readonly configHandler: ConfigHandler,
    private readonly ide: IDE,
    private readonly tabAutocompleteModels: TabAutocompleteModel[],
  ) {

    // Wayne TODO Might want to fix something here?
    // Since now models are being chosen on the backend server.
    for (let i = 0; i < 2; i++) {
      const tabAutocompleteModel = tabAutocompleteModels[i];
      this.completionProviders.push(new CompletionProvider(
        this.configHandler,
        this.ide,
        tabAutocompleteModel.get.bind(tabAutocompleteModel),
        this.onError.bind(this),
        getDefinitionsFromLsp,
        i
      ));
    }
    // TODO Test that the models are being loaded correctly / multiple models are being loaded.

    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.fsPath === this._lastShownCompletion?.filepath) {
        // console.log("updating completion");
      }
    });
  }

  _lastShownCompletion: AutocompleteOutcome | undefined;

  _lastVsCodeCompletionInput: VsCodeCompletionInput | undefined;

  public async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken,
    //@ts-ignore
  ): ProviderResult<InlineCompletionItem[] | InlineCompletionList> {
    const enableTabAutocomplete =
      vscode.workspace
        .getConfiguration("continue")
        .get<boolean>("enableTabAutocomplete") || false;
    if (token.isCancellationRequested || !enableTabAutocomplete) {
      return null;
    }

    // If the text at the range isn't a prefix of the intellisense text,
    // no completion will be displayed, regardless of what we return
    if (
      context.selectedCompletionInfo &&
      !context.selectedCompletionInfo.text.startsWith(
        document.getText(context.selectedCompletionInfo.range),
      )
    ) {
      return null;
    }

    let injectDetails: string | undefined = undefined;
    // Here we could use the details from the intellisense dropdown
    // and place them just above the line being typed but because
    // we don't have control over the formatting of the details and
    // they could be especially long, not doing this for now
    // if (context.selectedCompletionInfo) {
    //   const results: any = await vscode.commands.executeCommand(
    //     "vscode.executeCompletionItemProvider",
    //     document.uri,
    //     position,
    //     null,
    //     1,
    //   );
    //   if (results?.items) {
    //     injectDetails = results.items?.[0]?.detail;
    //     // const label = results?.items?.[0].label;
    //     // const workspaceSymbols = (
    //     //   (await vscode.commands.executeCommand(
    //     //     "vscode.executeWorkspaceSymbolProvider",
    //     //     label,
    //     //   )) as any
    //     // ).filter((symbol: any) => symbol.name === label);
    //     // console.log(label, "=>", workspaceSymbols);
    //   }
    // }

    // The first time intellisense dropdown shows up, and the first choice is selected,
    // we should not consider this. Only once user explicitly moves down the list
    const newVsCodeInput = {
      context,
      document,
      position,
    };
    const selectedCompletionInfo = context.selectedCompletionInfo;
    this._lastVsCodeCompletionInput = newVsCodeInput;

    try {
      const abortController = new AbortController();
      const signal = abortController.signal;
      token.onCancellationRequested(() => abortController.abort());

      const config = await this.configHandler.loadConfig();
      let clipboardText = "";
      if (config.tabAutocompleteOptions?.useCopyBuffer === true) {
        clipboardText = await vscode.env.clipboard.readText();
      }

      // Handle notebook cells
      const pos = {
        line: position.line,
        character: position.character,
      };
      let manuallyPassFileContents: string | undefined = undefined;
      if (document.uri.scheme === "vscode-notebook-cell") {
        const notebook = vscode.workspace.notebookDocuments.find((notebook) =>
          notebook
            .getCells()
            .some((cell) => cell.document.uri === document.uri),
        );
        if (notebook) {
          const cells = notebook.getCells();
          manuallyPassFileContents = cells
            .map((cell) => {
              const text = cell.document.getText();
              if (cell.kind === vscode.NotebookCellKind.Markup) {
                return `"""${text}"""`;
              } else {
                return text;
              }
            })
            .join("\n\n");
          for (const cell of cells) {
            if (cell.document.uri === document.uri) {
              break;
            } else {
              pos.line += cell.document.getText().split("\n").length + 1;
            }
          }
        }
      }
      // Handle commit message input box
      let manuallyPassPrefix: string | undefined = undefined;
      if (document.uri.scheme === "vscode-scm") {
        return null;
        // let diff = await this.ide.getDiff();
        // diff = diff.split("\n").splice(-150).join("\n");
        // manuallyPassPrefix = `${diff}\n\nCommit message: `;
      }

      // Call on API for model choices

      const input1: AutocompleteInput = {
        completionId: uuidv4(),
        filepath: document.uri.fsPath,
        pos,
        recentlyEditedFiles: [],
        recentlyEditedRanges:
          await this.recentlyEditedTracker.getRecentlyEditedRanges(),
        clipboardText: clipboardText,
        manuallyPassFileContents,
        manuallyPassPrefix,
        selectedCompletionInfo,
        injectDetails,
      };

      const input2: AutocompleteInput = {
        completionId: uuidv4(),
        filepath: document.uri.fsPath,
        pos,
        recentlyEditedFiles: [],
        recentlyEditedRanges:
          await this.recentlyEditedTracker.getRecentlyEditedRanges(),
        clipboardText: clipboardText,
        manuallyPassFileContents,
        manuallyPassPrefix,
        selectedCompletionInfo,
        injectDetails,
      };

      setupStatusBar(true, true);
      // TODO: Wayne. This is where the inline completion happens in the vscode extension.
      // It calls on the inline competion items function in core
      // const providerIndices = getTwoUniqueRandomInts(0, this.completionProviders.length - 1);

      const outcome1 =
        await this.completionProviders[0].provideInlineCompletionItems(
          input1,
          signal,
      );

      const outcome2 =
        await this.completionProviders[1].provideInlineCompletionItems(
          input2,
          signal,
      );

      if (outcome1) {
        console.log("outcome 1");
        console.log(outcome1.completion);
        console.log(outcome1.modelName);
        console.log(outcome1.modelProvider);
      }

      if (outcome2) {
        console.log("outcome 2");
        console.log(outcome2.completion);
        console.log(outcome2.modelName);
        console.log(outcome2.modelProvider);
      }

      // Fails if both aren't successful
      if ((!outcome1 || !outcome1.completion) || (!outcome2 || !outcome2.completion)) {
        return null;
      } 
      
      // VS Code displays dependent on selectedCompletionInfo (their docstring below)
      // We should first always make sure we have a valid completion, but if it goes wrong we
      // want telemetry to be correct
      /**
       * Provides information about the currently selected item in the autocomplete widget if it is visible.
       *
       * If set, provided inline completions must extend the text of the selected item
       * and use the same range, otherwise they are not shown as preview.
       * As an example, if the document text is `console.` and the selected item is `.log` replacing the `.` in the document,
       * the inline completion must also replace `.` and start with `.log`, for example `.log()`.
       *
       * Inline completion providers are requested again whenever the selected item changes.
       */
      const originalOutcome2Completion = outcome2.completion;
      if (selectedCompletionInfo) {
        outcome1.completion = selectedCompletionInfo.text + outcome1.completion;
        outcome2.completion = selectedCompletionInfo.text + outcome2.completion;
      }

      const willDisplay1 = this.willDisplay(
        document,
        selectedCompletionInfo,
        signal,
        outcome1,
      );
      const willDisplay2 = this.willDisplay(
        document,
        selectedCompletionInfo,
        signal,
        outcome2,
      );
      if (!willDisplay1 || !willDisplay2) {
        return null;
      }

      // Mark displayed
      this.completionProviders[0].markDisplayed(input1.completionId, outcome1);
      this.completionProviders[1].markDisplayed(input2.completionId, outcome2);
      this._lastShownCompletion = outcome1;

      // Construct the range/text to show
      const startPos = selectedCompletionInfo?.range.start ?? position;
      const completionRange1 = new vscode.Range(
        startPos,
        startPos.translate(0, outcome1.completion.length),
      );
      const completionRange2 = new vscode.Range(
        startPos,
        startPos.translate(0, outcome2.completion.length),
      );

      const prefixStart = outcome2.prefix?.lastIndexOf('\n') + 1 || 0;
      const prefix = outcome2.prefix?.slice(prefixStart) || '';

      // Calculate the indentation after the last newline in the prefix
      const lastNewlineIndex = prefix.lastIndexOf('\n') ?? -1;
      const indentationStart = lastNewlineIndex + 1;
      const indentationEnd = prefix.length;

      let indentation = '';
      for (let i = indentationStart; i < indentationEnd; i++) {
        const char = prefix[i];
        if (char === ' ' || char === '\t') {
          indentation += char;
        } else {
          break;
        }
      }
      const spaceIndentation = " ".repeat(prefix.length)
      // const separator = `${spaceIndentation}======`;

      let combinedCompletionPrefix = "";
      if (!(prefix.trim().length === 0)) {
        // combinedCompletionPrefix = `\n${spaceIndentation}`;
        combinedCompletionPrefix = `\n${prefix}`;
      }

      // Option 2
//       const combinedCompletion = 
// `${outcome1.completion}
// ${separator}
// ${spaceIndentation}${originalOutcome2Completion}`;

      // Option 3
//       const combinedCompletion = 
// `${combinedCompletionPrefix}${outcome1.completion}
// ${separator}
// ${spaceIndentation}${originalOutcome2Completion}`;


      const separator = `${indentation}======`;
      // Option 4
      const combinedCompletion = 
`${combinedCompletionPrefix}${outcome1.completion}
${separator}
${prefix}${originalOutcome2Completion}`;


      // Option 1
// 
//       const combinedCompletion = 
// `${outcome1.completion}
// ${separator}
// ${prefix}${originalOutcome2Completion}`;

      const lines = combinedCompletion.split('\n');
      const combinedLength = lines.reduce((acc, line) => acc + line.length + 1, 0) - 1;

      const endPos = startPos.translate(0, combinedLength);
      const combinedCompletionRange = new vscode.Range(startPos, endPos);

      const combinedCompletionItem = new vscode.InlineCompletionItem(
        combinedCompletion,
        combinedCompletionRange
      );

      const completionItem1 = new vscode.InlineCompletionItem(
        outcome1.completion,
        completionRange1,
        {
          title: "Log Autocomplete Outcome",
          command: "arena.logFirstOutcomeSuccess",
          arguments: [input1.completionId, input2.completionId, this.completionProviders[0], this.completionProviders[1]],
        },
      );

      (completionItem1 as any).completeBracketPairs = true;

      const completionItem2 = new vscode.InlineCompletionItem(
        outcome2.completion,
        completionRange2,
        {
          title: "Log Autocomplete Outcome",
          command: "arena.logSecondOutcomeSuccess",
          arguments: [input1.completionId, input2.completionId, this.completionProviders[0], this.completionProviders[1]],
        },
      );

      (completionItem2 as any).completeBracketPairs = true;

      this.inlineCompletionList = new vscode.InlineCompletionList([combinedCompletionItem, completionItem1, completionItem2]);
      return this.inlineCompletionList;
    } finally {
      stopStatusBarLoading();
    }
  }

  public getInlineFirstCompletion() {
    if (!this.inlineCompletionList) {
      return undefined
    }
    return this.inlineCompletionList?.items[1];
  }

  public getInlineSecondCompletion() {
    if (!this.inlineCompletionList) {
      return undefined
    }
    return this.inlineCompletionList?.items[2];
  }

  willDisplay(
    document: vscode.TextDocument,
    selectedCompletionInfo: vscode.SelectedCompletionInfo | undefined,
    abortSignal: AbortSignal,
    outcome: AutocompleteOutcome,
  ): boolean {
    if (selectedCompletionInfo) {
      const { text, range } = selectedCompletionInfo;
      if (!outcome.completion.startsWith(text)) {
        console.log(
          `Won't display completion because text doesn't match: ${text}, ${outcome.completion}`,
          range,
        );
        return false;
      }
    }

    if (abortSignal.aborted) {
      return false;
    }

    return true;
  }
}
