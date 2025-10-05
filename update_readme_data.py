# -*- coding: utf-8 -*-
"""
GitHub Profile README Auto-Update Script
=========================================

This script automatically updates your GitHub profile README with:
- Enhanced title image with gradient background and statistics
- Latest repository information with detailed stats
- Recent commits from the last 7 days
- Weekly activity summary
- Automatic archival of previous weekly reports

Features:
- GitHub API authentication to avoid rate limits
- Beautiful gradient title images with Chinese character support
- Collapsible sections for better readability
- Detailed repository statistics (stars, forks, language, last update)
- Weekly report archival system with 4-year retention

Author: LIghtJUNction
Updated: 2025
"""

import requests
from PIL import Image, ImageDraw, ImageFont
import os
from datetime import datetime, timedelta
import json
import shutil
import glob

def generate_title_image(text, width, height, font_path="arial.ttf", font_size=50, stats=None):
    """Generates a title image with the given text and optional statistics."""
    try:
        font = ImageFont.truetype(font_path, font_size)
        small_font = ImageFont.truetype(font_path, font_size // 2)
    except IOError:
        print(f"Font not found at {font_path}, using default font.")
        font = ImageFont.load_default()
        small_font = ImageFont.load_default()

    # Create image with gradient background
    image = Image.new("RGB", (width, height), color="white")
    draw = ImageDraw.Draw(image)
    
    # Draw gradient background (from top to bottom)
    for i in range(height):
        # Gradient from light blue to lighter blue
        r = int(135 + (225 - 135) * i / height)
        g = int(206 + (245 - 206) * i / height)
        b = int(235 + (255 - 235) * i / height)
        draw.rectangle([(0, i), (width, i + 1)], fill=(r, g, b))

    # Calculate text size and position
    try:
        # Pillow 10.0.0+
        text_bbox = draw.textbbox((0, 0), text, font=font)
    except AttributeError:
        # Older Pillow versions
        text_width, text_height = draw.textsize(text, font=font)
        text_bbox = (0, 0, text_width, text_height)

    text_width = text_bbox[2] - text_bbox[0]
    text_height = text_bbox[3] - text_bbox[1]

    # Center the main text (slightly higher if we have stats)
    x = (width - text_width) // 2
    y = (height - text_height) // 2 - (15 if stats else 0)

    # Draw text with shadow for better visibility
    shadow_offset = 2
    draw.text((x + shadow_offset, y + shadow_offset), text, font=font, fill=(100, 100, 100))
    draw.text((x, y), text, font=font, fill=(30, 30, 30))
    
    # Add statistics if provided
    if stats:
        stats_y = y + text_height + 10
        stats_text = f"📊 {stats.get('repos', 0)} Repos | ⭐ {stats.get('stars', 0)} Stars | 🍴 {stats.get('forks', 0)} Forks"
        try:
            stats_bbox = draw.textbbox((0, 0), stats_text, font=small_font)
            stats_width = stats_bbox[2] - stats_bbox[0]
        except AttributeError:
            stats_width, _ = draw.textsize(stats_text, font=small_font)
        stats_x = (width - stats_width) // 2
        draw.text((stats_x, stats_y), stats_text, font=small_font, fill=(50, 50, 50))
    
    return image

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
            
            # Build repository entry with badges
            repo_entry = f"- **[{name}]({url})** - {description_oneline}\n"
            repo_entry += f"  - 📊 `⭐ {stars} | 🍴 {forks} | 💻 {language} | 🕒 {updated_str}`"
            
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
    """Generate a weekly summary of user activities."""
    repos = get_latest_repos(username, count=10, token=token)
    commits = get_recent_commits(username, token=token, days=7, max_commits=20)
    
    summary = []
    summary.append("### 📊 本周活动摘要 (Weekly Activity Summary)\n")
    
    # Count commits by repo
    commit_counts = {}
    for commit in commits:
        repo = commit['repo']
        commit_counts[repo] = commit_counts.get(repo, 0) + 1
    
    if commit_counts:
        summary.append(f"- 📝 本周共有 **{len(commits)}** 次提交分布在 **{len(commit_counts)}** 个仓库中")
        summary.append("- 🔥 最活跃的仓库:")
        sorted_repos = sorted(commit_counts.items(), key=lambda x: x[1], reverse=True)[:3]
        for repo, count in sorted_repos:
            summary.append(f"  - **{repo}**: {count} 次提交")
    else:
        summary.append("- 📝 本周暂无提交活动")
    
    # Recent repo updates
    if repos:
        summary.append(f"\n- 🔄 最近更新的仓库: **{repos[0].get('name')}**")
    
    # Add link to previous week's report if available
    if previous_archive_link:
        summary.append(f"\n- 📋 [查看上周报告 (View Last Week's Report)]({previous_archive_link})")
    
    return "\n".join(summary)

def archive_weekly_report(readme_path='Readme.md', archive_dir='archives/weekly_reports', max_archives=208):
    """
    Archive the current README as a weekly report.
    
    Args:
        readme_path: Path to the README file
        archive_dir: Directory to store archived reports
        max_archives: Maximum number of archives to keep (default: 208 = 4 years of weekly reports)
    
    Returns:
        str: Path to the archived file (relative path for GitHub links)
    """
    # Create archive directory if it doesn't exist
    os.makedirs(archive_dir, exist_ok=True)
    
    # Check if README exists
    if not os.path.exists(readme_path):
        print(f"Warning: {readme_path} not found, cannot archive.")
        return None
    
    # Generate timestamp for archive filename with microseconds to ensure uniqueness
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    archive_filename = f"weekly_report_{timestamp}.md"
    archive_path = os.path.join(archive_dir, archive_filename)
    
    # Copy current README to archive
    try:
        shutil.copy2(readme_path, archive_path)
        print(f"Archived weekly report to: {archive_path}")
    except Exception as e:
        print(f"Error archiving report: {e}")
        return None
    
    # Clean up old archives if we exceed max_archives
    cleanup_old_archives(archive_dir, max_archives)
    
    return archive_path

def cleanup_old_archives(archive_dir, max_archives):
    """
    Remove oldest archives if we exceed the maximum number.
    
    Args:
        archive_dir: Directory containing archived reports
        max_archives: Maximum number of archives to keep
    """
    # Get all archive files sorted by modification time (oldest first)
    archive_pattern = os.path.join(archive_dir, "weekly_report_*.md")
    archives = sorted(glob.glob(archive_pattern), key=os.path.getmtime)
    
    # Remove oldest archives if we exceed the limit
    if len(archives) > max_archives:
        archives_to_remove = archives[:len(archives) - max_archives]
        for archive in archives_to_remove:
            try:
                os.remove(archive)
                print(f"Removed old archive: {archive}")
            except Exception as e:
                print(f"Error removing archive {archive}: {e}")

def get_latest_archive_link(archive_dir='archives/weekly_reports'):
    """
    Get the relative link to the most recent archived report.
    
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
    # Create generated_images directory if it doesn't exist
    if not os.path.exists("generated_images"):
        os.makedirs("generated_images")

    # Get GitHub token for API authentication
    github_token = get_github_token()
    github_username = "LIghtJUNction"

    # Fetch user statistics
    print("Fetching user statistics...")
    user_stats = get_user_stats(github_username, github_token)
    print(f"User stats: {user_stats}")

    # Generate title image with statistics
    title_text = "最新项目"
    title_image_width = 600
    title_image_height = 120
    title_font_size = 40

    # Use Noto Sans CJK for proper Chinese character rendering
    # Priority order: Noto Sans CJK (best for Chinese) > Liberation > DejaVu > fallback
    font_paths = [
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "msyh.ttc",  # Microsoft YaHei (Windows)
        "simsun.ttc",  # SimSun (Windows)
        "arial.ttf"
    ]
    selected_font_path = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc" # Default

    font_found = False
    for font_path_option in font_paths:
        try:
            # Test if font can be loaded with Chinese characters
            test_font = ImageFont.truetype(font_path_option, 10)
            selected_font_path = font_path_option
            font_found = True
            print(f"Using font: {selected_font_path}")
            break
        except (IOError, OSError) as e:
            print(f"Font {font_path_option} not found or cannot be opened: {e}")

    if not font_found:
        print("Warning: None of the specified fonts were found. Chinese characters may not render correctly.")

    title_image = generate_title_image(
        title_text, 
        title_image_width, 
        title_image_height, 
        font_path=selected_font_path, 
        font_size=title_font_size,
        stats=user_stats
    )
    title_image_path = "generated_images/latest_projects_title.png"
    title_image.save(title_image_path)

    print(f"TITLE_IMG_PATH:{title_image_path}")

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
