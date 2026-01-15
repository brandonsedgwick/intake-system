// Type declarations for @google-cloud/vertexai
// This allows the project to compile without the package installed
// Install the package when ready to enable LLM features:
// npm install @google-cloud/vertexai

declare module "@google-cloud/vertexai" {
  export class VertexAI {
    constructor(options: { project: string; location: string });
    getGenerativeModel(options: { model: string }): GenerativeModel;
  }

  interface GenerativeModel {
    generateContent(prompt: string): Promise<GenerateContentResponse>;
  }

  interface GenerateContentResponse {
    response: {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
          }>;
        };
      }>;
      usageMetadata?: {
        totalTokenCount?: number;
        promptTokenCount?: number;
        candidatesTokenCount?: number;
      };
    };
  }
}
