"""Maps each agent to its preferred model, per Part F of the spec.

Documentation/Decomposition/Planner favor Gemini (large free daily quota).
Critic/Security explanation favor Groq (fastest, good for high-volume
validation calls). Test generation favors Mistral Codestral (code-tuned).
"""

AGENT_MODEL_PREFERENCE: dict[str, list[str]] = {
    "planner": ["gemini", "groq", "mistral", "ollama"],
    "documentation": ["gemini", "groq", "mistral", "ollama"],
    "decomposition": ["gemini", "groq", "mistral", "ollama"],
    "test_generator": ["mistral", "gemini", "groq", "ollama"],
    "security": ["groq", "gemini", "mistral", "ollama"],
    "critic": ["groq", "gemini", "mistral", "ollama"],
    "evaluator": ["gemini", "groq", "mistral", "ollama"],
}

LITELLM_MODEL_IDS: dict[str, str] = {
    "gemini": "gemini/gemini-1.5-flash",
    "groq": "groq/llama-3.3-70b-versatile",
    "mistral": "mistral/codestral-latest",
    "ollama": "ollama/llama3.2",
}


def get_provider_chain(agent_type: str) -> list[str]:
    return AGENT_MODEL_PREFERENCE.get(agent_type, ["gemini", "groq", "mistral", "ollama"])


def get_litellm_model_id(provider: str) -> str:
    return LITELLM_MODEL_IDS[provider]
