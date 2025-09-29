# llm_service.py - Handles communication with Ollama LLM
import aiohttp
import json
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class LLMService:
    """Service for interacting with Ollama LLM"""
    
    def __init__(self, 
                 base_url: str = "http://localhost:11434",
                 model: str = "llama3.2",
                 temperature: float = 0.3):
        self.base_url = base_url
        self.model = model
        self.temperature = temperature
        self.is_initialized = False
        
    async def initialize(self):
        """Initialize and verify connection to Ollama"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.base_url}/api/tags") as response:
                    if response.status == 200:
                        data = await response.json()
                        models = [m['name'] for m in data.get('models', [])]
                        
                        if self.model not in models:
                            logger.warning(f"Model {self.model} not found. Available: {models}")
                            if models:
                                self.model = models[0]
                                logger.info(f"Using {self.model} instead")
                        
                        self.is_initialized = True
                        logger.info(f"LLM Service initialized with model: {self.model}")
                        return True
                    else:
                        logger.error(f"Failed to connect to Ollama: {response.status}")
                        return False
        except Exception as e:
            logger.error(f"Error initializing LLM service: {str(e)}")
            return False
    
    async def generate_completion(self, 
                                  prompt: str, 
                                  system_prompt: Optional[str] = None) -> str:
        """Generate a completion from the LLM"""
        try:
            payload = {
                "model": self.model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": self.temperature
                }
            }
            
            if system_prompt:
                payload["system"] = system_prompt
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/api/generate",
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=120)
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get('response', '')
                    else:
                        error_text = await response.text()
                        logger.error(f"LLM generation failed: {error_text}")
                        return ""
                        
        except Exception as e:
            logger.error(f"Error generating completion: {str(e)}")
            return ""
    
    async def chat_completion(self, messages: list) -> str:
        """Generate a chat completion from the LLM"""
        try:
            payload = {
                "model": self.model,
                "messages": messages,
                "stream": False,
                "options": {
                    "temperature": self.temperature
                }
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/api/chat",
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=120)
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get('message', {}).get('content', '')
                    else:
                        error_text = await response.text()
                        logger.error(f"LLM chat failed: {error_text}")
                        return ""
                        
        except Exception as e:
            logger.error(f"Error in chat completion: {str(e)}")
            return ""
    
    async def fill_form_fields(self, 
                              fields: Dict[str, str], 
                              context: str,
                              url: Optional[str] = None,
                              title: Optional[str] = None) -> Dict[str, Any]:
        """Use LLM to fill form fields based on user context"""
        
        # Build the system prompt
        system_prompt = """You are an intelligent form-filling assistant. Your job is to analyze form fields and fill them with appropriate information from the user's context.

CRITICAL RULES:
1. Return ONLY a valid JSON object with field names as keys and filled values as the values
2. Do NOT include any explanatory text, markdown formatting, or code blocks
3. Use the EXACT field names from the input
4. If you don't have information for a field, use an empty string ""
5. For dates, use format: MM/DD/YYYY or YYYY-MM-DD
6. For yes/no questions, respond with: "Yes" or "No"
7. For dropdown/select fields, match the expected option exactly
8. Be concise and professional in your responses

Example format:
{
  "First Name": "John",
  "Email": "john@example.com",
  "Are you willing to relocate?": "Yes"
}"""

        # Build the user prompt
        field_list = "\n".join([f'- "{key}"' for key in fields.keys()])
        
        user_prompt = f"""Fill out the following form fields using the provided context about the user.

FORM FIELDS TO FILL:
{field_list}

USER CONTEXT:
{context}
"""
        
        if url:
            user_prompt += f"\n\nFORM URL: {url}"
        if title:
            user_prompt += f"\nFORM TITLE: {title}"
        
        user_prompt += "\n\nProvide the filled form as a JSON object with field names as keys."
        
        # Generate completion
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        logger.info("Sending request to LLM...")
        response = await self.chat_completion(messages)
        
        if not response:
            logger.error("Empty response from LLM")
            return {}
        
        logger.debug(f"LLM Response: {response}")
        
        # Parse the JSON response
        try:
            # Try to extract JSON from response
            response = response.strip()
            
            # Remove markdown code blocks if present
            if response.startswith("```"):
                lines = response.split("\n")
                response = "\n".join(lines[1:-1])
            
            # Try to find JSON object
            start = response.find('{')
            end = response.rfind('}')
            
            if start != -1 and end != -1:
                json_str = response[start:end+1]
                filled_data = json.loads(json_str)
                
                # Ensure all original fields are present
                result = {}
                for field_key in fields.keys():
                    if field_key in filled_data:
                        result[field_key] = filled_data[field_key]
                    else:
                        result[field_key] = ""
                
                logger.info(f"Successfully parsed {len(result)} fields")
                return result
            else:
                logger.error("No JSON object found in response")
                return {key: "" for key in fields.keys()}
                
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {str(e)}")
            logger.error(f"Response was: {response}")
            return {key: "" for key in fields.keys()}
        except Exception as e:
            logger.error(f"Error processing LLM response: {str(e)}")
            return {key: "" for key in fields.keys()}