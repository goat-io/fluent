#!/usr/bin/env python3
"""
LLM Adapter for Python agents - bridges to Node.js LLM CLI
"""

import json
import subprocess
import os
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

class LLMAdapter:
    """Adapter to call Node.js LLM CLI from Python"""
    
    def __init__(self, cli_path: Optional[str] = None):
        """
        Initialize LLM adapter
        
        Args:
            cli_path: Path to Node.js CLI script (defaults to src/llm/cli.ts)
        """
        if cli_path:
            self.cli_path = cli_path
        else:
            # Default path relative to python directory
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            self.cli_path = os.path.join(base_dir, 'src', 'llm', 'cli.ts')
        
        # Check if tsx is available, otherwise use node with compiled JS
        self.node_command = self._get_node_command()
    
    def _get_node_command(self) -> List[str]:
        """Determine the best Node.js command to use"""
        try:
            # Try tsx first (TypeScript execution)
            subprocess.run(['npx', 'tsx', '--version'], 
                         capture_output=True, check=True, timeout=5)
            return ['npx', 'tsx']
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError):
            # Fall back to node with compiled JS
            js_path = self.cli_path.replace('.ts', '.js')
            if os.path.exists(js_path):
                return ['node']
            else:
                # Last resort - try to compile
                logger.warning("No compiled JS found, using tsx")
                return ['npx', 'tsx']
    
    def chat(self, 
             messages: List[Dict[str, str]], 
             use_small: bool = False,
             max_tokens: Optional[int] = None,
             temperature: Optional[float] = None) -> str:
        """
        Send chat request to LLM via Node.js CLI
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            use_small: Whether to use the small/cheap model
            max_tokens: Maximum tokens to generate
            temperature: Temperature for generation
        
        Returns:
            Generated text content
        
        Raises:
            RuntimeError: If LLM call fails
        """
        # Prepare input
        cli_input = {
            "messages": messages,
            "useSmall": use_small
        }
        
        if max_tokens:
            cli_input["maxTokens"] = max_tokens
        if temperature is not None:
            cli_input["temperature"] = temperature
        
        input_json = json.dumps(cli_input)
        
        # Determine CLI path
        cli_file = self.cli_path
        if self.node_command == ['node']:
            cli_file = cli_file.replace('.ts', '.js')
        
        # Execute Node.js CLI
        try:
            result = subprocess.run(
                self.node_command + [cli_file],
                input=input_json,
                capture_output=True,
                text=True,
                timeout=60,  # 60 second timeout
                check=False  # Don't raise on non-zero exit
            )
            
            # Parse output (could be from stdout or stderr)
            output_text = result.stdout if result.returncode == 0 else result.stderr
            
            if not output_text:
                raise RuntimeError(f"No output from LLM CLI, exit code: {result.returncode}")
            
            try:
                output = json.loads(output_text)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse LLM output: {output_text}")
                raise RuntimeError(f"Invalid JSON from LLM CLI: {e}")
            
            # Check for errors
            if 'error' in output and output['error']:
                raise RuntimeError(f"LLM error: {output['error']}")
            
            # Extract content
            if 'content' not in output:
                raise RuntimeError(f"No content in LLM response: {output}")
            
            # Log usage if available
            if 'usage' in output:
                logger.info(f"LLM usage - Model: {output.get('model', 'unknown')}, "
                          f"Tokens: {output['usage'].get('totalTokens', 'unknown')}")
            
            return output['content']
            
        except subprocess.TimeoutExpired:
            raise RuntimeError("LLM call timed out after 60 seconds")
        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            raise RuntimeError(f"Failed to call LLM: {e}")


class Agent:
    """Base agent class using LLM adapter"""
    
    def __init__(self, name: str, system_message: str, use_small: bool = False):
        """
        Initialize agent
        
        Args:
            name: Agent name
            system_message: System prompt for the agent
            use_small: Whether to use small/cheap model
        """
        self.name = name
        self.system_message = system_message
        self.use_small = use_small
        self.llm = LLMAdapter()
    
    def generate_reply(self, messages: List[Dict[str, str]]) -> str:
        """
        Generate a reply based on messages
        
        Args:
            messages: Conversation history
        
        Returns:
            Generated response
        """
        # Prepend system message
        full_messages = [
            {"role": "system", "content": self.system_message}
        ] + messages
        
        # Call LLM
        try:
            response = self.llm.chat(
                messages=full_messages,
                use_small=self.use_small
            )
            return response
        except Exception as e:
            logger.error(f"Agent {self.name} failed to generate reply: {e}")
            # Return a fallback response
            return f"I apologize, but I encountered an error: {str(e)}"


# Convenience functions for backward compatibility
def create_planner_agent() -> Agent:
    """Create a planner agent"""
    return Agent(
        name="Planner",
        system_message="""You are a software planning specialist. Given a user request, 
        create a detailed, actionable specification that can be implemented by a developer.
        Focus on clarity, completeness, and technical accuracy.""",
        use_small=False
    )


def create_refiner_agent(variant: str = "gpt") -> Agent:
    """Create a refiner agent"""
    if variant == "claude":
        return Agent(
            name="RefinerClaude",
            system_message="""You are a senior technical architect. Review specifications 
            for architectural soundness, best practices, and potential issues. Suggest 
            improvements to ensure robust, scalable implementation.
            If the specification is clear and ready, include 'CLEAR: TRUE' in your response.""",
            use_small=False
        )
    else:
        return Agent(
            name="RefinerGPT",
            system_message="""You are a technical specification refiner. Review and improve 
            specifications to ensure they are unambiguous, complete, and implementation-ready.
            Add missing details and clarify any vague requirements.""",
            use_small=True  # Use small model for cost efficiency
        )


def create_reviewer_agent() -> Agent:
    """Create a reviewer agent"""
    return Agent(
        name="Reviewer",
        system_message="""You are a code review specialist. Analyze diffs and test results 
        to determine if the implementation meets requirements and follows best practices.
        Respond with '✅ Approved' if everything looks good, or provide specific feedback 
        for improvements.""",
        use_small=False
    )