"""
GitHub Profile README Auto-Update Script (Simplified)
======================================================

This script automatically updates your GitHub profile README with:
- ASCII art title
- Latest repository information with detailed stats
- Recent commits from the last 7 days
- Weekly activity summary
- Automatic archival of previous weekly reports

Author: LIghtJUNction
Updated: 2025
"""

import requests
import os
from datetime import datetime, timedelta
import json
import shutil
import glob


def generate_ascii_title(text):
    """Generate ASCII art title."""
    # Simple ASCII art box around text
    border = "═" * (len(text) + 4)
    return f"""
╔{border}╗
║  {text}  ║
╚{border}╝
"""


def get_github_token():
    """Get GitHub token from environment variable."""
    return os.environ.get('GITHUB_TOKEN', '')


def make_github_request(url, token=''):
    """Make a request to GitHub API with authentication."""
    headers = {}
    if token:
        headers['Authorization'] = f'token {token}'
    headers['Accept'] = 'application/vnd.github.v3+json'
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching from {url}: {e}")
        return None


def get_latest_repos(username, count=5, token=''):
    """Fetches the latest public repositories for a given GitHub username."""
    api_url = f"https://api.github.com/users/{username}/repos?sort=updated&direction=desc&per_page={count}"
    repos = make_github_request(api_url, token)
    return repos[:count] if repos else []


def get_user_stats(username, token=''):
    """Fetches user statistics."""
    api_url = f"https://api.github.com/users/{username}"
    user_data = make_github_request(api_url, token)
    
    if not user_data:
        return {'repos': 0, 'stars': 0, 'forks': 0}
    
    # Get total stars and forks across all repos
    repos_url = f"https://api.github.com/users/{username}/repos?per_page=100"
    repos = make_github_request(repos_url, token)
    
    total_stars = 0
    total_forks = 0
    if repos:
        for repo in repos:
            total_stars += repo.get('stargazers_count', 0)
            total_forks += repo.get('forks_count', 0)
    
    return {
        'repos': user_data.get('public_repos', 0),
        'stars': total_stars,
        'forks': total_forks
    }


def get_recent_commits(username, token='', days=7, max_commits=10):
    """Fetches recent commits from the user across all repositories."""
    # Get all repos first
    repos_url = f"https://api.github.com/users/{username}/repos?sort=updated&direction=desc&per_page=10"
    repos = make_github_request(repos_url, token)
    
    if not repos:
        return []
    
    all_commits = []
    since_date = (datetime.now() - timedelta(days=days)).isoformat()
    
    for repo in repos:
        commits_url = f"https://api.github.com/repos/{username}/{repo['name']}/commits?author={username}&since={since_date}&per_page=5"
        commits = make_github_request(commits_url, token)
        
        if commits:
            for commit in commits:
                all_commits.append({
                    'repo': repo['name'],
                    'repo_url': repo['html_url'],
                    'message': commit['commit']['message'].split('\n')[0],  # First line only
                    'sha': commit['sha'][:7],
                    'url': commit['html_url'],
                    'date': commit['commit']['committer']['date']
                })
    
    # Sort by date and return most recent
    all_commits.sort(key=lambda x: x['date'], reverse=True)
    return all_commits[:max_commits]


def get_detailed_weekly_stats(username, token='', days=7):
    """Get comprehensive statistics for the week including code additions/deletions."""
    repos_url = f"https://api.github.com/users/{username}/repos?sort=updated&direction=desc&per_page=20"
    repos = make_github_request(repos_url, token)
    
    if not repos:
        return None
    
    stats = {
        'total_commits': 0,
        'total_additions': 0,
        'total_deletions': 0,
        'files_changed': 0,
        'languages': {},
        'repo_count': 0,
        'commit_details': []
    }
    
    since_date = (datetime.now() - timedelta(days=days)).isoformat()
    
    for repo in repos:
        # Get commits for this repo
        commits_url = f"https://api.github.com/repos/{username}/{repo['name']}/commits?author={username}&since={since_date}&per_page=30"
        commits = make_github_request(commits_url, token)
        
        if commits:
            stats['repo_count'] += 1
            stats['total_commits'] += len(commits)
            
            # Get detailed stats for each commit
            for commit in commits[:10]:  # Limit to avoid rate limits
                commit_sha = commit['sha']
                commit_detail_url = f"https://api.github.com/repos/{username}/{repo['name']}/commits/{commit_sha}"
                commit_detail = make_github_request(commit_detail_url, token)
                
                if commit_detail and 'stats' in commit_detail:
                    stats['total_additions'] += commit_detail['stats'].get('additions', 0)
                    stats['total_deletions'] += commit_detail['stats'].get('deletions', 0)
                    
                    if 'files' in commit_detail:
                        stats['files_changed'] += len(commit_detail['files'])
        
        # Track languages
        lang = repo.get('language')
        if lang:
            stats['languages'][lang] = stats['languages'].get(lang, 0) + 1
    
    return stats


def format_repos_to_markdown(repos):
    """Formats the list of repository data into a Markdown string with detailed information."""
    markdown_list = []
    if not repos:
        markdown_list.append("- No repositories found or error in fetching.")
    else:
        for repo in repos:
            name = repo.get("name")
            url = repo.get("html_url")
            description = repo.get("description", "No description available.")
            description_oneline = description.replace('\n', ' ').replace('\r', '') if description else "No description available."
            
            # Add statistics
            stars = repo.get("stargazers_count", 0)
            forks = repo.get("forks_count", 0)
            language = repo.get("language", "Unknown")
            updated = repo.get("updated_at", "")
            
            # Format updated date
            if updated:
                try:
                    updated_date = datetime.fromisoformat(updated.replace('Z', '+00:00'))
                    updated_str = updated_date.strftime("%Y-%m-%d")
                except:
                    updated_str = updated[:10]
            else:
                updated_str = "Unknown"
            
            # Build repository entry without emoji - use simple text indicators
            repo_entry = f"- **[{name}]({url})** - {description_oneline}\n"
            repo_entry += f"  - `Stars: {stars} | Forks: {forks} | Language: {language} | Updated: {updated_str}`"
            
            markdown_list.append(repo_entry)
    return "\n".join(markdown_list)


def format_commits_to_markdown(commits):
    """Formats the list of commits into a Markdown string."""
    if not commits:
        return "No recent commits found."
    
    markdown_list = []
    for commit in commits:
        # Parse date
        try:
            commit_date = datetime.fromisoformat(commit['date'].replace('Z', '+00:00'))
            date_str = commit_date.strftime("%Y-%m-%d %H:%M")
        except:
            date_str = commit['date'][:16].replace('T', ' ')
        
        markdown_list.append(
            f"- **[{commit['repo']}]({commit['repo_url']})** - [{commit['sha']}]({commit['url']}) - {commit['message']} `{date_str}`"
        )
    return "\n".join(markdown_list)


def get_weekly_summary(username, token='', previous_archive_link=''):
    """Generate a comprehensive weekly summary."""
    stats = get_detailed_weekly_stats(username, token, days=7)
    
    if not stats:
        return "Unable to generate weekly summary at this time."
    
    # Sort languages by frequency
    sorted_languages = sorted(stats['languages'].items(), key=lambda x: x[1], reverse=True)
    
    # Build summary
    summary = []
    summary.append("### Weekly Activity Summary\n")
    
    # Commit statistics
    summary.append("- **Commit Statistics**")
    summary.append(f"  - Total commits: **{stats['total_commits']}** across **{stats['repo_count']}** repositories")
    if stats['total_commits'] > 0:
        summary.append(f"  - Daily average: **{stats['total_commits'] / 7:.1f}** commits")
        summary.append(f"  - Code changes: **+{stats['total_additions']}** / **-{stats['total_deletions']}** lines")
        summary.append(f"  - Modified files: **{stats['files_changed']}** files")
        summary.append(f"  - Total changes: **{stats['total_additions'] + stats['total_deletions']:,}** lines")
        if stats['total_commits'] > 0:
            summary.append(f"  - Average per commit: **{(stats['total_additions'] + stats['total_deletions']) // stats['total_commits']}** lines\n")
    
    # Most active repos
    repos_url = f"https://api.github.com/users/{username}/repos?sort=updated&direction=desc&per_page=20"
    repos = make_github_request(repos_url, token)
    
    if repos:
        since_date = (datetime.now() - timedelta(days=7)).isoformat()
        repo_commits = {}
        
        for repo in repos[:10]:
            commits_url = f"https://api.github.com/repos/{username}/{repo['name']}/commits?author={username}&since={since_date}&per_page=100"
            commits = make_github_request(commits_url, token)
            if commits and len(commits) > 0:
                repo_commits[repo['name']] = len(commits)
        
        if repo_commits:
            sorted_repos = sorted(repo_commits.items(), key=lambda x: x[1], reverse=True)[:3]
            summary.append("- **Most Active Repositories**:")
            for idx, (repo_name, commit_count) in enumerate(sorted_repos, 1):
                percentage = (commit_count / stats['total_commits'] * 100) if stats['total_commits'] > 0 else 0
                summary.append(f"  {idx}. **{repo_name}**: {commit_count} commits ({percentage:.1f}%)")
    
    summary.append("")
    
    # Programming languages
    if sorted_languages:
        total_repos = sum(count for _, count in sorted_languages)
        summary.append("- **Programming Languages**")
        for lang, count in sorted_languages[:4]:
            percentage = (count / total_repos * 100) if total_repos > 0 else 0
            bar_length = int(percentage / 10)
            bar = "█" * bar_length + "░" * (10 - bar_length)
            summary.append(f"  - {bar} **{lang}**: {count} repositories ({percentage:.1f}%)")
    
    summary.append("")
    
    # Repository overview
    repos_all = make_github_request(f"https://api.github.com/users/{username}/repos?per_page=100", token)
    if repos_all:
        total_stars = sum(r.get('stargazers_count', 0) for r in repos_all)
        total_forks = sum(r.get('forks_count', 0) for r in repos_all)
        total_watchers = sum(r.get('watchers_count', 0) for r in repos_all)
        total_size = sum(r.get('size', 0) for r in repos_all) / 1024  # Convert to MB
        
        # Find most popular repo
        most_popular = max(repos_all, key=lambda x: x.get('stargazers_count', 0), default=None)
        
        # Find most recently updated
        most_recent = max(repos_all, key=lambda x: x.get('updated_at', ''), default=None)
        
        # Count open issues
        total_issues = sum(r.get('open_issues_count', 0) for r in repos_all)
        
        summary.append("- **Repository Overview**")
        summary.append(f"  - Total repositories: **{len(repos_all)}** (recently active)")
        summary.append(f"  - Total stars: **{total_stars}** | Forks: **{total_forks}** | Watchers: **{total_watchers}**")
        if most_popular:
            summary.append(f"  - Most popular: **{most_popular['name']}** (Stars: {most_popular.get('stargazers_count', 0)})")
        if most_recent:
            summary.append(f"  - Most recent update: **{most_recent['name']}**")
        summary.append(f"  - Open issues: **{total_issues}**")
        summary.append(f"  - Total codebase size: **{total_size:.1f} MB**")
    
    summary.append("")
    
    # Activity analysis
    if stats['total_commits'] > 0:
        summary.append("- **Activity Analysis**")
        daily_avg = stats['total_commits'] / 7
        summary.append(f"  - Weekly activity score: **{stats['total_commits'] * 10 + stats['repo_count'] * 5 + (stats['total_additions'] + stats['total_deletions']) // 100}**")
        
        if daily_avg >= 3:
            summary.append("  - High productivity week (3+ commits/day)")
        elif daily_avg >= 1:
            summary.append("  - Steady development week (1+ commits/day)")
        else:
            summary.append("  - Light activity week")
        
        if stats['repo_count'] > 2:
            summary.append(f"  - Multi-repository collaboration ({stats['repo_count']} active repositories)")
        elif stats['repo_count'] == 1:
            summary.append("  - Focused single-project development")
    
    summary.append("")
    
    # Add link to previous report
    if previous_archive_link:
        summary.append(f"- [View Last Week's Report]({previous_archive_link})")
    
    return "\n".join(summary)


def archive_weekly_report(readme_path='Readme.md', archive_dir='archives/weekly_reports', max_archives=208):
    """
    Archive the current weekly summary section from README.
    
    Args:
        readme_path: Path to the README file
        archive_dir: Directory to store archives
        max_archives: Maximum number of archives to keep (default: 208 = 4 years of weekly reports)
    
    Returns:
        str: Path to the created archive file
    """
    # Create archive directory if it doesn't exist
    os.makedirs(archive_dir, exist_ok=True)
    
    # Read current README
    try:
        with open(readme_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        print(f"README file not found: {readme_path}")
        return None
    
    # Extract the weekly summary section
    start_marker = "<!-- START_DYNAMIC_SUMMARY -->"
    end_marker = "<!-- END_DYNAMIC_SUMMARY -->"
    
    start_idx = content.find(start_marker)
    end_idx = content.find(end_marker)
    
    if start_idx == -1 or end_idx == -1:
        print("Could not find weekly summary markers in README")
        return None
    
    # Extract content between markers
    summary_content = content[start_idx + len(start_marker):end_idx].strip()
    
    # Only archive if there's actual content
    if not summary_content or len(summary_content) < 100:
        print("No substantial content to archive")
        return None
    
    # Create archive filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    archive_filename = f"weekly_report_{timestamp}.md"
    archive_path = os.path.join(archive_dir, archive_filename)
    
    # Write archive
    with open(archive_path, 'w', encoding='utf-8') as f:
        f.write(f"# Weekly Report - {datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n")
        f.write(summary_content)
    
    print(f"Archived weekly report to: {archive_path}")
    
    # Clean up old archives if needed
    cleanup_old_archives(archive_dir, max_archives)
    
    return archive_path


def cleanup_old_archives(archive_dir, max_archives):
    """
    Remove old archive files if there are more than max_archives.
    
    Args:
        archive_dir: Directory containing archived reports
        max_archives: Maximum number of archives to keep
    """
    archive_pattern = os.path.join(archive_dir, "weekly_report_*.md")
    archives = sorted(glob.glob(archive_pattern), key=os.path.getmtime)
    
    if len(archives) > max_archives:
        archives_to_remove = archives[:len(archives) - max_archives]
        for archive in archives_to_remove:
            try:
                os.remove(archive)
                print(f"Removed old archive: {archive}")
            except OSError as e:
                print(f"Error removing archive {archive}: {e}")


def get_latest_archive_link(archive_dir='archives/weekly_reports'):
    """
    Get the path to the most recent archived report.
    
    Args:
        archive_dir: Directory containing archived reports
    
    Returns:
        str: Relative path to the latest archive, or empty string if none found
    """
    archive_pattern = os.path.join(archive_dir, "weekly_report_*.md")
    archives = sorted(glob.glob(archive_pattern), key=os.path.getmtime, reverse=True)
    
    if archives:
        # Return relative path for GitHub
        return archives[0]
    return ''


if __name__ == "__main__":
    # Get GitHub token for API authentication
    github_token = get_github_token()
    github_username = os.environ.get('GITHUB_REPOSITORY_OWNER', 'LIghtJUNction')

    # Fetch user statistics
    print("Fetching user statistics...")
    user_stats = get_user_stats(github_username, github_token)
    print(f"User stats: {user_stats}")

    # Generate ASCII title
    title_text = "最新项目 (Latest Projects)"
    ascii_title = generate_ascii_title(title_text)
    
    print("TITLE_ASCII:")
    print(ascii_title)

    # Fetch and format latest repositories
    print("Fetching latest repositories...")
    latest_repos = get_latest_repos(github_username, count=5, token=github_token)
    repo_markdown_list = format_repos_to_markdown(latest_repos)

    print("---REPO_LIST_START---")
    print(repo_markdown_list)
    print("---REPO_LIST_END---")

    # Fetch and format recent commits
    print("Fetching recent commits...")
    recent_commits = get_recent_commits(github_username, token=github_token, days=7, max_commits=10)
    commits_markdown = format_commits_to_markdown(recent_commits)

    print("---COMMITS_START---")
    print(commits_markdown)
    print("---COMMITS_END---")

    # Archive current README before generating new content
    print("Archiving previous weekly report...")
    archive_path = archive_weekly_report(readme_path='Readme.md', archive_dir='archives/weekly_reports', max_archives=208)
    
    # Get link to latest archive for inclusion in summary
    previous_archive_link = get_latest_archive_link('archives/weekly_reports')
    print(f"Previous archive link: {previous_archive_link}")

    # Generate weekly summary with link to previous report
    print("Generating weekly summary...")
    weekly_summary = get_weekly_summary(github_username, token=github_token, previous_archive_link=previous_archive_link)

    print("---SUMMARY_START---")
    print(weekly_summary)
    print("---SUMMARY_END---")
