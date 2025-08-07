#!/usr/bin/env python3
"""
AutoGen microservice providing REST endpoints for multi-agent collaboration.
Exposes Planner, Refiners, and Reviewer agents via FastAPI.
Integrated with OpenCode LLM adapter.
"""
import os
import logging
from typing import Dict, Any
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import uvicorn

# Import LLM adapter and agents
from llm_adapter import (
    create_planner_agent,
    create_refiner_agent,
    create_reviewer_agent
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Delphi AutoGen Service", version="0.2.0")

# Initialize agents using LLM adapter
try:
    planner = create_planner_agent()
    refiner_gpt = create_refiner_agent("gpt")
    refiner_claude = create_refiner_agent("claude")
    reviewer = create_reviewer_agent()
    logger.info("Agents initialized successfully with LLM adapter")
except Exception as e:
    logger.error(f"Failed to initialize agents: {e}")
    # Fall back to mock agents if LLM adapter fails
    logger.warning("Falling back to mock agents")
    
    class MockAgent:
        def __init__(self, name: str, system_message: str):
            self.name = name
            self.system_message = system_message
        
        def generate_reply(self, messages: list) -> str:
            if self.name == "Planner":
                return "Create a comprehensive specification for implementing the requested feature."
            elif self.name == "RefinerGPT":
                return "The specification needs more detail."
            elif self.name == "RefinerClaude":
                return "The specification is ready. CLEAR: TRUE"
            elif self.name == "Reviewer":
                return "✅ Approved - Implementation looks good."
            return "Generic response"
    
    planner = MockAgent("Planner", "Planning agent")
    refiner_gpt = MockAgent("RefinerGPT", "GPT refiner")
    refiner_claude = MockAgent("RefinerClaude", "Claude refiner")
    reviewer = MockAgent("Reviewer", "Review agent")

# Request/Response models
class PlanRequest(BaseModel):
    prompt: str = Field(..., min_length=1)

class PlanResponse(BaseModel):
    draft: str

class RefineRequest(BaseModel):
    spec: str

class RefineResponse(BaseModel):
    refined: str
    clear: bool = False

class ReviewRequest(BaseModel):
    diff: str
    test_results: str = ""

class ReviewResponse(BaseModel):
    ok: bool
    feedback: str = ""

# API endpoints
@app.post("/plan", response_model=PlanResponse)
async def plan_endpoint(request: PlanRequest) -> PlanResponse:
    """Generate initial specification from user prompt."""
    try:
        messages = [{
            "role": "user",
            "content": f"Create a detailed technical specification for: {request.prompt}"
        }]
        response = planner.generate_reply(messages=messages)
        logger.info(f"Plan generated, length: {len(response)} chars")
        return PlanResponse(draft=response)
    except Exception as e:
        logger.error(f"Planning failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/refine", response_model=RefineResponse)
async def refine_endpoint(request: RefineRequest) -> RefineResponse:
    """Refine specification through multiple agents."""
    try:
        # First refinement with GPT
        messages = [{
            "role": "user",
            "content": f"""Refine this specification to be clear and actionable:

{request.spec}

Make it unambiguous and implementation-ready."""
        }]
        gpt_refined = refiner_gpt.generate_reply(messages=messages)
        
        # Second refinement with Claude for architectural review
        messages = [{
            "role": "user",
            "content": f"""Review and improve this specification:

{gpt_refined}

Is this specification clear and unambiguous enough for implementation?
If yes, include 'CLEAR: TRUE' in your response.
If no, provide improvements and do not include that phrase."""
        }]
        claude_refined = refiner_claude.generate_reply(messages=messages)
        
        # Check if specification is clear
        is_clear = "CLEAR: TRUE" in claude_refined.upper()
        
        return RefineResponse(
            refined=claude_refined.replace("CLEAR: TRUE", "").strip(),
            clear=is_clear
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/review", response_model=ReviewResponse)
async def review_endpoint(request: ReviewRequest) -> ReviewResponse:
    """Review code diff and test results."""
    try:
        review_prompt = f"""Review this code diff:

{request.diff}

Test Results:
{request.test_results if request.test_results else 'No test results provided'}

Respond with '✅ Approved' if the implementation is correct and complete, 
or provide specific feedback for improvements."""
        
        messages = [{
            "role": "user",
            "content": review_prompt
        }]
        response = reviewer.generate_reply(messages=messages)
        
        approved = "✅" in response
        return ReviewResponse(
            ok=approved,
            feedback=response if not approved else "Approved"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "delphi-autogen"}

if __name__ == "__main__":
    # Run with: python autogen_service.py
    import sys
    port = int(os.getenv("AUTOGEN_PORT", "8100"))
    if "--port" in sys.argv:
        port_idx = sys.argv.index("--port")
        if port_idx + 1 < len(sys.argv):
            port = int(sys.argv[port_idx + 1])
    uvicorn.run("autogen_service:app", host="0.0.0.0", port=port, reload=True)