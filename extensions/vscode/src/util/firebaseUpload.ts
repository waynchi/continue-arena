import { collection, addDoc } from "firebase/firestore"; // Firestore SDK
import { AutocompleteOutcome } from 'core/autocomplete/completionProvider';
import { db } from './firebase'

export interface ArenaAutocompleteOutcome {
  accepted: boolean;
  time: number;
  prefix: string;
  suffix: string;
  prompt: string;
  completion: string;
  modelProvider: string;
  modelName: string;
  completionOptions: any;
  filepath: string;
  completionId: string;
  uniqueId: string;
  useCopyBuffer: boolean;
  useSuffix: boolean;
  maxPromptTokens: number;
  debounceDelay: number;
  maxSuffixPercentage: number;
  prefixPercentage: number;
  template: string;
  multilineCompletions: "always" | "never" | "auto";
  slidingWindowPrefixPercentage: number;
  slidingWindowSize: number;
  maxSnippetPercentage: number;
  recentlyEditedSimilarityThreshold: number;
  useCache: boolean;
  onlyMyCode: boolean;
  useOtherFiles: boolean;
  useRecentlyEdited: boolean;
  recentLinePrefixMatchMinLength: number;
}

export interface ArenaDatapoint {
  outcome1: ArenaAutocompleteOutcome,
  outcome2: ArenaAutocompleteOutcome,
  version: string
}

export function convertToArenaAutocompleteOutcome(data: AutocompleteOutcome, accepted: boolean): ArenaAutocompleteOutcome {
  return {
    accepted: accepted,
    time: data.time,
    prefix: data.prefix,
    suffix: data.suffix,
    prompt: data.prompt,
    completion: data.completion,
    modelProvider: data.modelProvider,
    modelName: data.modelName,
    completionOptions: data.completionOptions,
    filepath: data.filepath,
    completionId: data.completionId,
    uniqueId: data.uniqueId,
    useCopyBuffer: data.disable, // Assuming disable maps to useCopyBuffer; clarify this mapping if incorrect.
    useSuffix: data.useSuffix,
    maxPromptTokens: data.maxPromptTokens,
    debounceDelay: data.debounceDelay,
    maxSuffixPercentage: data.maxSuffixPercentage,
    prefixPercentage: data.prefixPercentage,
    template: data.template || "", // Providing a default empty string if template is undefined.
    multilineCompletions: data.multilineCompletions,
    slidingWindowPrefixPercentage: data.slidingWindowPrefixPercentage,
    slidingWindowSize: data.slidingWindowSize,
    maxSnippetPercentage: data.maxSnippetPercentage,
    recentlyEditedSimilarityThreshold: data.recentlyEditedSimilarityThreshold,
    useCache: data.useCache,
    onlyMyCode: data.onlyMyCode,
    useOtherFiles: data.useOtherFiles,
    useRecentlyEdited: data.useRecentlyEdited,
    recentLinePrefixMatchMinLength: data.recentLinePrefixMatchMinLength
  };
}

export async function uploadArenaDatapoint(outcome1: ArenaAutocompleteOutcome, outcome2: ArenaAutocompleteOutcome): Promise<void> {
  try {
    // Reference to the collection
    const autocompleteCollection = collection(db, 'autocompleteData');
    // Add the document to the collection
    const version = "0.1.0";
    const arenaDatapoint: ArenaDatapoint = {
      outcome1,
      outcome2,
      version
    }

    await addDoc(autocompleteCollection, arenaDatapoint);

    console.log('Data uploaded successfully');
  } catch (error) {
    console.error('Error uploading data:', error);
  }
}