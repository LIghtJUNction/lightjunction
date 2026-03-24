#!/usr/bin/env python3
"""
ai-enhance.py - Use AI to enhance README content
Uses GitHub Copilot API (models.githubusercontent.com)
"""

import json
import os
import requests
from pathlib import Path

REPO_OWNER = os.environ.get("GITHUB_REPOSITORY_OWNER", "LIghtJUNction")
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")

BASE_URL = "https://models.githubusercontent.com/v1/chat/completions"
MODEL = "gpt-4o-mini"


def chat(messages: list, system: str = "") -> str:
    """Call AI chat API with GitHub token authentication."""
    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    full_messages = []
    if system:
        full_messages.append({"role": "system", "content": system})
    full_messages.extend(messages)

    payload = {
        "model": MODEL,
        "messages": full_messages,
        "temperature": 0.7,
        "max_tokens": 2000,
    }

    try:
        resp = requests.post(BASE_URL, headers=headers, json=payload, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"[WARN] AI API error: {e}")
        return None


def generate_weekly_summary(data: dict) -> str:
    """Generate human-readable weekly summary using AI."""
    total, repo_commits = data["weekly"]
    commits = data["commits"][:10]

    if total == 0:
        return "No commits this week. Rest time is important too! 🎉"

    commits_text = "\n".join([f"- {c['repo']}: {c['message']}" for c in commits])

    prompt = [{
        "role": "user",
        "content": f"""Write a brief weekly summary for a developer's GitHub profile.
Write in English, be casual and concise, 2-3 sentences max.

Activity this week ({total} commits total):
{commits_text}

Top repositories:
{chr(10).join([f"- {name}: {info['count']} commits" for name, info in repo_commits[:3]])}

Start directly with the content. Examples:
- "This week focused on updating rulesets for MagicMihomo and improving the AstrBot dashboard..."
- "Worked on network tools and Android modules, with several proxy-related commits..."
"""
    }]

    result = chat(prompt)
    if result:
        return result.strip()
    return None


def generate_project_insights(repos: list) -> str:
    """Generate AI insights about recent projects."""
    if not repos:
        return ""

    repos_text = "\n".join([
        f"- **{r['name']}**: {r.get('description', 'No description')} (⭐{r.get('stargazers_count', 0)}, {r.get('language', 'Unknown')})"
        for r in repos[:5]
    ])

    prompt = [{
        "role": "user",
        "content": f"""Analyze these repositories and write ONE short sentence (under 100 chars) describing the developer's main focus/strengths.

Repositories:
{repos_text}

Output ONLY the insight sentence. Be specific.
Examples:
- "Focuses on network tools and Android automation with Shell/Python"
- "Builds AI chatbot interfaces and proxy utilities"
- "Develops gaming tools and DevOps automation"
"""
    }]

    result = chat(prompt)
    if result:
        return result.strip()
    return None


def generate_commit_insights(commits: list) -> str:
    """Generate insights from recent commits."""
    if not commits:
        return None

    commits_text = "\n".join([f"- {c['message']} ({c['repo']})" for c in commits[:8]])

    prompt = [{
        "role": "user",
        "content": f"""Analyze these commits and write a brief (1 sentence) summary of what the developer has been working on.

Commits:
{commits_text}

Write in past tense, casual tone. Start directly.
"""
    }]

    result = chat(prompt)
    return result.strip() if result else None


def main():
    data_path = Path("github_data.json")
    if not data_path.exists():
        print("[WARN] No github_data.json found, skipping AI enhancement")
        return

    data = json.loads(data_path.read_text())
    enhanced = {}

    print("🤖 Generating AI summaries...")

    weekly = generate_weekly_summary(data)
    if weekly:
        enhanced["weekly_summary"] = weekly
        print(f"   ✅ Weekly: {weekly[:60]}...")

    insights = generate_project_insights(data["repos"])
    if insights:
        enhanced["project_insights"] = insights
        print(f"   ✅ Insights: {insights}")

    commit_insights = generate_commit_insights(data["commits"])
    if commit_insights:
        enhanced["commit_insights"] = commit_insights
        print(f"   ✅ Commit summary: {commit_insights}")

    output_path = Path("ai_enhanced.json")
    output_path.write_text(json.dumps(enhanced, indent=2, ensure_ascii=False))
    print(f"✅ AI content saved to {output_path}")


if __name__ == "__main__":
    main()
