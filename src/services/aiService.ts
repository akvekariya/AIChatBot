import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { AIModel, AIResponse, ChatTopic } from '../types';
import logger from '../utils/logger';
import SessionMemoryService from './sessionMemoryService';

/**
 * AI Service
 * Handles integration with multiple AI models including GPT-4, Claude 3, Mistral, and Composio
 * Implements routing, fallback mechanisms, and response handling
 */

// Initialize AI clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Mistral client (using OpenAI-compatible API)
const mistral = new OpenAI({
  apiKey: process.env.MISTRAL_API_KEY,
  baseURL: 'https://api.mistral.ai/v1',
});

/**
 * Generate system prompt based on chat topics
 * @param topics - Array of chat topics
 * @returns System prompt string
 */
const generateSystemPrompt = (topics: ChatTopic[]): string => {
  const topicPrompts = {
    [ChatTopic.HEALTH]: 'You are a helpful health assistant. Provide accurate, evidence-based health information while emphasizing that you cannot replace professional medical advice. Always recommend consulting healthcare professionals for serious concerns.',
    [ChatTopic.EDUCATION]: 'You are an educational assistant. Help users learn new concepts, explain complex topics in simple terms, and provide study guidance. Encourage critical thinking and lifelong learning.',
  };
  
  if (topics.length === 1) {
    return topicPrompts[topics[0]];
  } else {
    return `You are a helpful assistant specializing in ${topics.join(' and ')}. ${topicPrompts[topics[0]]} ${topicPrompts[topics[1]]}`;
  }
};

/**
 * Call GPT-4 model
 * @param prompt - User prompt
 * @param topics - Chat topics for context
 * @returns AI response
 */
const callGPT4 = async (prompt: string, topics: ChatTopic[]): Promise<AIResponse> => {
  const startTime = Date.now();
  
  try {
    const systemPrompt = generateSystemPrompt(topics);
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });
    
    const responseTime = Date.now() - startTime;
    const response = completion.choices[0]?.message?.content || 'No response generated';
    
    return {
      text: response,
      model: AIModel.GPT4,
      success: true,
      tokensUsed: completion.usage?.total_tokens,
      responseTime,
    };
  } catch (error) {
    logger.error('GPT-4 API error:', error);
    return {
      text: '',
      model: AIModel.GPT4,
      success: false,
      error: error instanceof Error ? error.message : 'GPT-4 API error',
      responseTime: Date.now() - startTime,
    };
  }
};

/**
 * Call Claude 3 model (DISABLED - No API key)
 * @param prompt - User prompt
 * @param topics - Chat topics for context
 * @returns AI response
 */
const callClaude3 = async (prompt: string, topics: ChatTopic[]): Promise<AIResponse> => {
  const startTime = Date.now();

  return {
    text: '',
    model: AIModel.CLAUDE3,
    success: false,
    error: 'Claude 3 API key not configured',
    responseTime: Date.now() - startTime,
  };
};

/**
 * Call Mistral model (DISABLED - No API key)
 * @param prompt - User prompt
 * @param topics - Chat topics for context
 * @returns AI response
 */
const callMistral = async (prompt: string, topics: ChatTopic[]): Promise<AIResponse> => {
  const startTime = Date.now();

  return {
    text: '',
    model: AIModel.MISTRAL,
    success: false,
    error: 'Mistral API key not configured',
    responseTime: Date.now() - startTime,
  };
};

/**
 * Call Composio model (DISABLED - No API key)
 * @param prompt - User prompt
 * @param topics - Chat topics for context
 * @returns AI response
 */
const callComposio = async (prompt: string, topics: ChatTopic[]): Promise<AIResponse> => {
  const startTime = Date.now();

  return {
    text: '',
    model: AIModel.COMPOSIO,
    success: false,
    error: 'Composio API key not configured',
    responseTime: Date.now() - startTime,
  };
};

/**
 * Model routing based on topics and availability
 * @param topics - Chat topics
 * @returns Preferred AI model (Only GPT-4 available)
 */
const selectModel = (topics: ChatTopic[]): AIModel => {
  // Only GPT-4 is available with current API keys
  return AIModel.GPT4;
};

/**
 * Generate AI response with fallback mechanism and session memory
 * @param prompt - User prompt
 * @param topics - Chat topics for context
 * @param chatId - Chat ID for session memory (optional)
 * @param preferredModel - Preferred AI model (optional)
 * @returns AI response with fallback handling
 */
export const generateAIResponse = async (
  prompt: string,
  topics: ChatTopic[],
  chatId?: string,
  preferredModel?: AIModel
): Promise<AIResponse> => {
  const selectedModel = preferredModel || selectModel(topics);

  // Build enhanced prompt with session memory
  let enhancedPrompt = prompt;
  if (chatId) {
    const sessionContext = await SessionMemoryService.buildContextForAI(chatId);
    if (sessionContext) {
      enhancedPrompt = `Context from previous conversation:\n${sessionContext}\n\nCurrent message: ${prompt}`;
      logger.info(`Enhanced prompt with session context for chat ${chatId}`);
    }
  }

  // Define model call functions
  const modelFunctions = {
    [AIModel.GPT4]: callGPT4,
    [AIModel.CLAUDE3]: callClaude3,
    [AIModel.MISTRAL]: callMistral,
    [AIModel.COMPOSIO]: callComposio,
  };

  // Try primary model (GPT-4 only)
  logger.info(`Attempting to use ${selectedModel} for prompt: ${enhancedPrompt.substring(0, 50)}...`);
  let response = await modelFunctions[selectedModel](enhancedPrompt, topics);

  if (response.success) {
    logger.info(`${selectedModel} responded successfully in ${response.responseTime}ms`);
    return response;
  }

  // Since only GPT-4 is available, no fallback needed
  logger.error(`${selectedModel} failed, no fallback available`);

  // Return error response
  logger.error('AI model failed');
  return {
    text: 'I apologize, but I\'m currently experiencing technical difficulties. Please try again in a moment.',
    model: AIModel.GPT4,
    success: false,
    error: 'AI model unavailable',
  };
};

/**
 * Check health status of all AI models
 * @returns Health status of each model
 */
export const checkAIModelsHealth = async (): Promise<{
  [key in AIModel]: {
    available: boolean;
    lastChecked: Date;
    error?: string;
    responseTime?: number;
  };
}> => {
  const testPrompt = 'Hello, this is a health check.';
  const testTopics = [ChatTopic.EDUCATION];
  
  const results: {
    [key in AIModel]: {
      available: boolean;
      lastChecked: Date;
      error?: string;
      responseTime?: number;
    };
  } = {
    [AIModel.GPT4]: { available: false, lastChecked: new Date() },
    [AIModel.CLAUDE3]: { available: false, lastChecked: new Date() },
    [AIModel.MISTRAL]: { available: false, lastChecked: new Date() },
    [AIModel.COMPOSIO]: { available: false, lastChecked: new Date() },
  };
  
  // Test each model
  const gpt4Result = await callGPT4(testPrompt, testTopics);
  results[AIModel.GPT4] = {
    available: gpt4Result.success,
    lastChecked: new Date(),
    error: gpt4Result.error,
    responseTime: gpt4Result.responseTime,
  };
  
  const claude3Result = await callClaude3(testPrompt, testTopics);
  results[AIModel.CLAUDE3] = {
    available: claude3Result.success,
    lastChecked: new Date(),
    error: claude3Result.error,
    responseTime: claude3Result.responseTime,
  };
  
  const mistralResult = await callMistral(testPrompt, testTopics);
  results[AIModel.MISTRAL] = {
    available: mistralResult.success,
    lastChecked: new Date(),
    error: mistralResult.error,
    responseTime: mistralResult.responseTime,
  };
  
  const composioResult = await callComposio(testPrompt, testTopics);
  results[AIModel.COMPOSIO] = {
    available: composioResult.success,
    lastChecked: new Date(),
    error: composioResult.error,
    responseTime: composioResult.responseTime,
  };
  
  return results;
};
