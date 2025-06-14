# -*- coding: utf-8 -*-
import requests
from PIL import Image, ImageDraw, ImageFont
import os

def generate_title_image(text, width, height, font_path="arial.ttf", font_size=50):
    """Generates a title image with the given text."""
    try:
        font = ImageFont.truetype(font_path, font_size)
    except IOError:
        print(f"Font not found at {font_path}, using default font.")
        font = ImageFont.load_default()

    image = Image.new("RGB", (width, height), color="lightblue")
    draw = ImageDraw.Draw(image)

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

    x = (width - text_width) // 2
    y = (height - text_height) // 2

    draw.text((x, y), text, font=font, fill="black")
    return image

def get_latest_repos(username, count=5):
    """Fetches the latest public repositories for a given GitHub username."""
    api_url = f"https://api.github.com/users/{username}/repos?sort=created&direction=desc"
    try:
        response = requests.get(api_url, timeout=10) # Added timeout
        response.raise_for_status()  # Raises an HTTPError for bad responses (4XX or 5XX)
        repos = response.json()
        return repos[:count]
    except requests.exceptions.RequestException as e:
        print(f"Error fetching repositories: {e}")
        return []

def format_repos_to_markdown(repos):
    """Formats the list of repository data into a Markdown string."""
    markdown_list = []
    if not repos:
        markdown_list.append("- No repositories found or error in fetching.")
    else:
        for repo in repos:
            name = repo.get("name")
            url = repo.get("html_url")
            description = repo.get("description", "No description available.") # Provide default
            # Ensure description is on a single line and escape Markdown sensitive characters if necessary
            description_oneline = description.replace('\n', ' ').replace('\r', '') if description else "No description available."
            markdown_list.append(f"- [{name}]({url}): {description_oneline}")
    return "\n".join(markdown_list)

if __name__ == "__main__":
    # Create generated_images directory if it doesn't exist
    if not os.path.exists("generated_images"):
        os.makedirs("generated_images")

    # Generate title image
    title_text = "最新项目"
    title_image_width = 300
    title_image_height = 60
    title_font_size = 30

    # Attempt to use a common Chinese font, fallback to arial or default
    # Common fonts on typical CI/CD runners might be limited.
    # Noto Sans CJK is a good option if available.
    # For broader compatibility, stick to common system fonts or ensure font installation.
    font_paths = ["msyh.ttc", "simsun.ttc", "NotoSansCJK-Regular.otf", "arial.ttf"]
    selected_font_path = "arial.ttf" # Default fallback

    font_found = False
    for font_path_option in font_paths:
        try:
            # Test if font can be loaded - this doesn't guarantee it has Chinese glyphs
            # but it's a basic check for font file availability.
            ImageFont.truetype(font_path_option, 10)
            selected_font_path = font_path_option
            font_found = True
            print(f"Attempting to use font: {selected_font_path}")
            break
        except IOError:
            print(f"Font {font_path_option} not found or cannot be opened.")

    if not font_found:
        print("None of the specified fonts were found. Will rely on Pillow's default font or a basic system font.")
        # generate_title_image will use its internal fallback (arial.ttf then ImageFont.load_default())

    title_image = generate_title_image(title_text, title_image_width, title_image_height, font_path=selected_font_path, font_size=title_font_size)
    title_image_path = "generated_images/latest_projects_title.png"
    title_image.save(title_image_path)

    print(f"TITLE_IMG_PATH:{title_image_path}")

    # Fetch and format latest repositories
    github_username = "LIghtJUNction"
    latest_repos = get_latest_repos(github_username, count=5)
    repo_markdown_list = format_repos_to_markdown(latest_repos)

    print("---REPO_LIST_START---")
    print(repo_markdown_list)
    print("---REPO_LIST_END---")
