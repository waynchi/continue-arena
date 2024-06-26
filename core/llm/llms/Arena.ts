import { TRIAL_FIM_MODEL } from "../../config/onboarding.js";
import { getHeaders } from "../../continueServer/stubs/headers.js";
import { ChatMessage, CompletionOptions, ModelProvider } from "../../index.js";
import { ARENA_SERVER_URL } from "../../util/parameters.js";
import { Telemetry } from "../../util/posthog.js";
import { BaseLLM } from "../index.js";
import { streamResponse } from "../stream.js";

class Arena extends BaseLLM {
  static providerName: ModelProvider = "arena";

  private async _getHeaders() {
    return {
      "Content-Type": "application/json",
      ...(await getHeaders()),
    };
  }

  private _convertArgs(options: CompletionOptions): any {
    return {
      model: options.model,
      frequency_penalty: options.frequencyPenalty,
      presence_penalty: options.presencePenalty,
      max_tokens: options.maxTokens,
      stop:
        options.model === TRIAL_FIM_MODEL
          ? options.stop
          : options.stop?.slice(0, 2),
      temperature: options.temperature,
      top_p: options.topP,
    };
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const args = this._convertArgs(this.collectArgs(options));

    // Wayne this is how they call their model
    const response = await this.fetch(`${ARENA_SERVER_URL}/stream_complete`, {
      method: "POST",
      headers: await this._getHeaders(),
      body: JSON.stringify({
        prompt,
        ...args,
      }),
    });

    let completion = "";
    for await (const value of streamResponse(response)) {
      yield value;
      completion += value;
    }
  }

  protected _convertMessage(message: ChatMessage) {
    if (typeof message.content === "string") {
      return message;
    }

    const parts = message.content.map((part) => {
      return {
        type: part.type,
        text: part.text,
        image_url: { ...part.imageUrl, detail: "low" },
      };
    });
    return {
      ...message,
      content: parts,
    };
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    throw new Error("streamChat not implemented.");
  }

  supportsFim(): boolean {
    return false;
  }

  async *_streamFim(
    prefix: string,
    suffix: string,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    throw new Error("streamFim not implemented.");
  }

  async listModels(): Promise<string[]> {
    return [
      "llama3-8b-8192",
      "llama3-70b-8192",
      "mixtral-8x7b-32768",
      "gemma-7b-it"
    ];
  }
}

export default Arena;
