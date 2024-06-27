import {
  ARENA_SERVER_URL
} from "../util/parameters.js";
import { AutocompleteOutcome } from '../autocomplete/completionProvider';
import { VisionEncoderDecoderModel } from "@xenova/transformers";


const version = "0.1.0";

// Define the interface for the data structure
export interface ArenaCompletion {
    pair_id: string;
    completion_id: string;
    user_id: string;
    timestamp: number;
    prompt: string;
    completion: string;
    model: string;
    provider: string;
    version?: string;
}

export interface ArenaAutocompleteOutcome {
    accepted: boolean;
    time: number;
    prefix: string;
    suffix: string;
    prompt: string;
    completion: string;
    provider: string;
    model: string;
    completion_options: any;
    filepath: string;
    completion_id: string;
    user_id: string;
    use_copy_buffer: boolean;
    use_suffix: boolean;
    max_prompt_tokens: number;
    debounce_delay: number;
    max_suffix_percentage: number;
    prefix_percentage: number;
    template: string;
    multiline_completions: "always" | "never" | "auto";
    sliding_window_prefix_percentage: number;
    sliding_window_size: number;
    max_snippet_percentage: number;
    recently_edited_similarity_threshold: number;
    use_cache: boolean;
    only_my_code: boolean;
    use_other_files: boolean;
    use_recently_edited: boolean;
    recent_line_prefix_match_min_length: number;
}

export interface ArenaDatapoint {
  outcome_1: ArenaAutocompleteOutcome,
  outcome_2: ArenaAutocompleteOutcome,
  pair_id: string,
  timestamp: number,
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
        provider: data.modelProvider,
        model: data.modelName,
        completion_options: data.completionOptions,
        filepath: data.filepath,
        completion_id: data.completionId,
        user_id: data.uniqueId,
        use_copy_buffer: data.disable, // Assuming disable maps to use_copy_buffer; clarify this mapping if incorrect.
        use_suffix: data.useSuffix,
        max_prompt_tokens: data.maxPromptTokens,
        debounce_delay: data.debounceDelay,
        max_suffix_percentage: data.maxSuffixPercentage,
        prefix_percentage: data.prefixPercentage,
        template: data.template || "", // Providing a default empty string if template is undefined.
        multiline_completions: data.multilineCompletions,
        sliding_window_prefix_percentage: data.slidingWindowPrefixPercentage,
        sliding_window_size: data.slidingWindowSize,
        max_snippet_percentage: data.maxSnippetPercentage,
        recently_edited_similarity_threshold: data.recentlyEditedSimilarityThreshold,
        use_cache: data.useCache,
        only_my_code: data.onlyMyCode,
        use_other_files: data.useOtherFiles,
        use_recently_edited: data.useRecentlyEdited,
        recent_line_prefix_match_min_length: data.recentLinePrefixMatchMinLength
    };
}

export async function uploadArenaCompletion(completion: ArenaCompletion): Promise<void> {
    // Make the HTTP PUT request
    try {
        completion['version'] = version;
        const response = await fetch(`${ARENA_SERVER_URL}/add_completion`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(completion),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        console.log("Data successfully uploaded.");
    } catch (error) {
        console.error("Failed to upload completion:", error);
    }
}


export async function uploadArenaOutcomes(outcome_1: ArenaAutocompleteOutcome, outcome_2: ArenaAutocompleteOutcome, pair_id: string): Promise<void> {
    try {
        const arenaDatapoint: ArenaDatapoint = {
            outcome_1: outcome_1,
            outcome_2: outcome_2,
            pair_id: pair_id,
            timestamp: Date.now(),
            version
        }
        const response = await fetch(`${ARENA_SERVER_URL}/add_completion_outcome`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(arenaDatapoint),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        console.log("Data successfully uploaded.");
    } catch (error) {
        console.error("Failed to upload outcomes:", error);
    }
}
