# form_processor.py - Orchestrates form field processing
import logging
from typing import Dict, Any, Optional
from llm_service import LLMService
from rag_manager import RAGManager

logger = logging.getLogger(__name__)


class FormProcessor:
    """Processes form fields using LLM and RAG"""
    
    def __init__(self, llm_service: LLMService, rag_manager: RAGManager):
        self.llm_service = llm_service
        self.rag_manager = rag_manager
        
    async def process_form(self,
                          fields: Dict[str, str],
                          url: Optional[str] = None,
                          title: Optional[str] = None) -> Dict[str, Any]:
        """Process form fields and return filled values"""
        
        if not fields:
            logger.warning("No fields provided")
            return {}
        
        logger.info(f"Processing {len(fields)} form fields")
        
        # Get relevant context from RAG
        context = await self._get_context_for_fields(fields)
        
        if not context:
            logger.warning("No context available from documents")
            context = "No user information available."
        
        logger.debug(f"Context length: {len(context)} characters")
        
        # Use LLM to fill fields
        filled_fields = await self.llm_service.fill_form_fields(
            fields=fields,
            context=context,
            url=url,
            title=title
        )
        
        # Post-process the filled fields
        filled_fields = self._post_process_fields(filled_fields, fields)
        
        return filled_fields
    
    async def _get_context_for_fields(self, fields: Dict[str, str]) -> str:
        """Get relevant context for the form fields"""
        
        # For comprehensive forms, get all context
        if len(fields) > 10:
            logger.info("Large form detected, using all context")
            return self.rag_manager.get_all_context()
        
        # For smaller forms, get targeted context
        query_parts = []
        for field_name in fields.keys():
            query_parts.append(field_name)
        
        query = " ".join(query_parts)
        relevant_context = self.rag_manager.get_relevant_context(query, top_k=5)
        
        return relevant_context
    
    def _post_process_fields(self, 
                            filled_fields: Dict[str, Any],
                            original_fields: Dict[str, str]) -> Dict[str, Any]:
        """Post-process filled fields for consistency"""
        
        processed = {}
        
        for field_name, value in filled_fields.items():
            if field_name not in original_fields:
                continue
                
            # Ensure value is a string if not None
            if value is None:
                processed[field_name] = ""
                continue
            
            # Handle boolean values
            if isinstance(value, bool):
                processed[field_name] = "Yes" if value else "No"
                continue
            
            # Convert to string and clean
            str_value = str(value).strip()
            
            # Handle common patterns
            field_lower = field_name.lower()
            
            # Email validation
            if 'email' in field_lower and '@' not in str_value and str_value:
                logger.warning(f"Invalid email format for {field_name}: {str_value}")
            
            # Phone number cleaning
            if 'phone' in field_lower or 'tel' in field_lower:
                str_value = self._clean_phone_number(str_value)
            
            # Date validation
            if 'date' in field_lower or 'when' in field_lower:
                str_value = self._normalize_date(str_value)
            
            # Yes/No normalization
            if any(keyword in field_lower for keyword in ['willing', 'able', 'have you', 'do you', 'are you']):
                str_value = self._normalize_yes_no(str_value)
            
            processed[field_name] = str_value
        
        # Ensure all original fields are present
        for field_name in original_fields.keys():
            if field_name not in processed:
                processed[field_name] = ""
        
        return processed
    
    def _clean_phone_number(self, phone: str) -> str:
        """Clean and format phone number"""
        if not phone:
            return ""
        
        # Remove all non-digit characters except + at the start
        cleaned = ''.join(c for c in phone if c.isdigit() or (c == '+' and phone.index(c) == 0))
        return cleaned
    
    def _normalize_date(self, date_str: str) -> str:
        """Normalize date format"""
        if not date_str or date_str.lower() in ['', 'n/a', 'none']:
            return ""
        
        # Handle 'today' keyword
        if date_str.lower() == 'today':
            from datetime import datetime
            return datetime.now().strftime('%m/%d/%Y')
        
        return date_str
    
    def _normalize_yes_no(self, value: str) -> str:
        """Normalize yes/no responses"""
        if not value:
            return ""
        
        value_lower = value.lower().strip()
        
        # Yes variations
        if value_lower in ['yes', 'y', 'true', '1', 'yeah', 'yep', 'sure']:
            return "Yes"
        
        # No variations
        if value_lower in ['no', 'n', 'false', '0', 'nope', 'nah']:
            return "No"
        
        return value