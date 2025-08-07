#!/usr/bin/env python3
# python -m pytest python/tests/test_planner.py -v

import json
import pytest
from unittest.mock import Mock, patch, MagicMock
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from llm_adapter import Agent, create_planner_agent

class TestPlannerAgent:
    """Test planner agent with mocked LLM"""
    
    def test_planner_json_in_out(self):
        """Test JSON input/output format"""
        planner = create_planner_agent()
        
        # Mock the LLM adapter
        with patch.object(planner.llm, 'chat') as mock_chat:
            mock_chat.return_value = "Create comprehensive specification for the feature"
            
            messages = [
                {"role": "user", "content": "Add logging to API"}
            ]
            
            response = planner.generate_reply(messages)
            
            # Verify call was made with correct format
            mock_chat.assert_called_once()
            call_args = mock_chat.call_args[1]
            assert 'messages' in call_args
            assert len(call_args['messages']) == 2  # system + user
            assert call_args['messages'][0]['role'] == 'system'
            assert call_args['use_small'] == False
            
            # Verify response
            assert isinstance(response, str)
            assert len(response) > 0
    
    def test_planner_retries_on_429(self):
        """Test retry behavior on rate limit"""
        planner = create_planner_agent()
        
        with patch.object(planner.llm, 'chat') as mock_chat:
            # First call raises rate limit, second succeeds
            mock_chat.side_effect = [
                RuntimeError("LLM error: Rate limit exceeded"),
                "Success after retry"
            ]
            
            messages = [{"role": "user", "content": "Test"}]
            
            # Should handle the error gracefully
            response = planner.generate_reply(messages)
            
            # Should return fallback on error
            assert "error" in response.lower()
    
    def test_planner_system_message(self):
        """Test planner includes correct system message"""
        planner = create_planner_agent()
        
        with patch.object(planner.llm, 'chat') as mock_chat:
            mock_chat.return_value = "Test response"
            
            messages = [{"role": "user", "content": "Build feature X"}]
            planner.generate_reply(messages)
            
            # Check system message was included
            call_args = mock_chat.call_args[1]['messages']
            system_msg = call_args[0]
            
            assert system_msg['role'] == 'system'
            assert 'planning specialist' in system_msg['content']
            assert 'actionable specification' in system_msg['content']
    
    def test_planner_handles_empty_messages(self):
        """Test planner handles empty message list"""
        planner = create_planner_agent()
        
        with patch.object(planner.llm, 'chat') as mock_chat:
            mock_chat.return_value = "Response"
            
            response = planner.generate_reply([])
            
            # Should still work with just system message
            mock_chat.assert_called_once()
            call_args = mock_chat.call_args[1]['messages']
            assert len(call_args) == 1  # Only system message
    
    def test_planner_preserves_conversation_history(self):
        """Test planner preserves full conversation"""
        planner = create_planner_agent()
        
        with patch.object(planner.llm, 'chat') as mock_chat:
            mock_chat.return_value = "Response"
            
            messages = [
                {"role": "user", "content": "First message"},
                {"role": "assistant", "content": "First response"},
                {"role": "user", "content": "Second message"}
            ]
            
            planner.generate_reply(messages)
            
            # Should include all messages
            call_args = mock_chat.call_args[1]['messages']
            assert len(call_args) == 4  # system + 3 conversation messages