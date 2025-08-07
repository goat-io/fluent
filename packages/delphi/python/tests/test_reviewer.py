#!/usr/bin/env python3
# python -m pytest python/tests/test_reviewer.py -v

import pytest
from unittest.mock import patch
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from llm_adapter import create_reviewer_agent

class TestReviewerAgent:
    """Test reviewer agent approval logic"""
    
    def test_reviewer_approves(self):
        """Test reviewer approves good implementation"""
        reviewer = create_reviewer_agent()
        
        with patch.object(reviewer.llm, 'chat') as mock_chat:
            mock_chat.return_value = "✅ Approved - The implementation looks good with proper error handling"
            
            messages = [{
                "role": "user",
                "content": "Review this diff: +function add(a,b){return a+b}"
            }]
            
            response = reviewer.generate_reply(messages)
            
            assert "✅" in response
            assert "Approved" in response
    
    def test_reviewer_requests_changes(self):
        """Test reviewer requests changes for issues"""
        reviewer = create_reviewer_agent()
        
        with patch.object(reviewer.llm, 'chat') as mock_chat:
            mock_chat.return_value = "The implementation needs error handling for null inputs"
            
            messages = [{
                "role": "user", 
                "content": "Review this diff: +function divide(a,b){return a/b}"
            }]
            
            response = reviewer.generate_reply(messages)
            
            assert "✅" not in response
            assert "error handling" in response
    
    def test_reviewer_system_prompt(self):
        """Test reviewer has correct system prompt"""
        reviewer = create_reviewer_agent()
        
        assert reviewer.system_message
        assert "code review specialist" in reviewer.system_message
        assert "✅ Approved" in reviewer.system_message
    
    def test_reviewer_uses_main_model(self):
        """Test reviewer uses main model not small"""
        reviewer = create_reviewer_agent()
        
        with patch.object(reviewer.llm, 'chat') as mock_chat:
            mock_chat.return_value = "Response"
            
            reviewer.generate_reply([{"role": "user", "content": "Test"}])
            
            # Should not use small model for review
            call_args = mock_chat.call_args[1]
            assert call_args['use_small'] == False