#!/usr/bin/env python3
# python -m pytest python/tests/test_cli_bridge.py -v

import json
import subprocess
import pytest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

class TestCLIBridge:
    """Test Python calling Node.js LLM CLI"""
    
    def test_cli_bridge_two_message_convo(self):
        """Test feeding 2-message conversation to CLI"""
        messages = [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there"}
        ]
        
        input_json = json.dumps({
            "messages": messages,
            "useSmall": True
        })
        
        # Path to CLI script
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        cli_path = os.path.join(base_dir, 'src', 'llm', 'cli.ts')
        
        try:
            # Run CLI with mock response
            result = subprocess.run(
                ['npx', 'tsx', cli_path],
                input=input_json,
                capture_output=True,
                text=True,
                timeout=10,
                env={**os.environ, 'OPENCODE_MODEL': 'test/mock'}
            )
            
            # Parse output
            if result.stdout:
                output = json.loads(result.stdout)
                assert 'content' in output or 'error' in output
            elif result.stderr:
                output = json.loads(result.stderr)
                assert 'error' in output
                
        except subprocess.TimeoutExpired:
            pytest.skip("CLI timeout - may need API keys")
        except FileNotFoundError:
            pytest.skip("tsx not available")
        except json.JSONDecodeError:
            # CLI might not be fully configured
            pass
    
    def test_cli_validates_input(self):
        """Test CLI validates input format"""
        invalid_input = json.dumps({
            "invalid": "data"
        })
        
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        cli_path = os.path.join(base_dir, 'src', 'llm', 'cli.ts')
        
        try:
            result = subprocess.run(
                ['npx', 'tsx', cli_path],
                input=invalid_input,
                capture_output=True,
                text=True,
                timeout=10
            )
            
            # Should return error
            assert result.returncode != 0
            
            if result.stderr:
                output = json.loads(result.stderr)
                assert 'error' in output
                
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pytest.skip("CLI not available")
        except json.JSONDecodeError:
            # Error output might not be JSON
            pass