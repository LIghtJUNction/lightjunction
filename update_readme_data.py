# -*- coding: utf-8 -*-
import requests
from PIL import Image, ImageDraw, ImageFont
import numpy as np
import os

def generate_depth_map(text, width, height, font_path="arial.ttf", font_size=50):
    """Generates a depth map image for the given text."""
    try:
        font = ImageFont.truetype(font_path, font_size)
    except IOError:
        print(f"Font not found at {font_path}, using default font.")
        font = ImageFont.load_default()

    image = Image.new("L", (width, height), color="black")
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

    draw.text((x, y), text, font=font, fill="white")
    return image

def generate_stereogram(depth_map_image, pattern_size=50):
    """Generates a stereogram from a depth map image."""
    depth_map = np.array(depth_map_image)
    width, height = depth_map.shape[1], depth_map.shape[0]
    stereogram = Image.new("RGB", (width, height))

    # Generate a random pattern for the base of the stereogram
    # Ensure pattern is somewhat dense for better effect
    pattern_source = np.random.randint(0, 256, size=(height, pattern_size * 2), dtype=np.uint8)

    for y_pat in range(height):
        for x_pat in range(pattern_size):
            # Make pattern binary for sharper edges in stereogram
            color_val = 255 if pattern_source[y_pat, x_pat] > 128 else 0
            rgb_color = (color_val, color_val, color_val) # Use grayscale pattern
            stereogram.putpixel((x_pat,y_pat),rgb_color)


    for y in range(height):
        for x in range(pattern_size, width): # Start filling from end of pattern
            # Normalize depth_map to range 0-1, then scale for shift
            # Deeper points (lighter in depth_map) get smaller shift
            normalized_depth = depth_map[y, x] / 255.0
            # Max shift should be less than pattern_size, e.g., pattern_size / 2 or / 3
            # Invert depth effect: lighter areas appear closer (larger shift)
            # shift = int((1 - normalized_depth) * (pattern_size / 3))
            # Standard depth effect: darker areas appear closer (larger shift, if depth map is inverted)
            # Or, if white is "further away" in depth map, then white = small shift
            shift = int(normalized_depth * (pattern_size / 3)) # Adjust divisor for depth effect

            # Ensure x_shifted is within the original pattern's bounds
            x_shifted = x - pattern_size + shift

            # The pixel to copy comes from x - shift
            # The reference point in the pattern is (x - shift) % pattern_size
            # More accurately, for autostereograms, the separation (eye_sep) is related to pattern_size
            # And the shift is related to depth.
            # Left eye sees point (x_left, y)
            # Right eye sees point (x_right, y)
            # x_right - x_left = eye_sep - depth_factor * depth_value_at_x
            # Here, we simplify: copy from (x - pattern_width + shift, y)

            # The color at (x,y) is determined by the color at (x-s,y) where s is the shift.
            # The shift 's' is derived from the depth map.
            # We need a base pattern that repeats.
            # Let the pattern be P of width Wp (pattern_size).
            # Color(x,y) = P( (x - shift(x,y)) % Wp, y)
            # Where shift(x,y) is derived from depth_map[y,x].
            # A common way: shift = mu * (1 - depth_map[y,x]/max_depth_value)
            # mu is the separation factor, related to eye distance and viewing distance.
            # Let's try a simpler approach often used:
            # stereogram_pixel(x,y) = stereogram_pixel(x - pattern_width + local_shift, y)

            # Corrected logic attempt:
            # The shift value determines how far left to look for the pixel to copy.
            # A larger shift means looking further left, making that point appear further away.
            # Depth map: black (0) is near, white (255) is far.
            # So, shift should be small for black, large for white.
            # shift = depth_map[y, x] // N  (N controls depth sensitivity)

            # Let's use the standard SIS algorithm logic:
            # For each pixel (x,y), its color C(x,y) is C(x - separation + disparity, y)
            # disparity is proportional to depth_map[y,x]
            # separation is a constant, effectively our pattern_size

            local_shift = depth_map[y,x] // 16 # Smaller divisor = more depth

            # Ensure the source pixel is within the already drawn part of the stereogram
            src_x = x - pattern_size + local_shift
            src_x = max(0, min(x - 1, src_x)) # clamp src_x to be safe

            if src_x < x : # Ensure we are copying from a pixel to the left
                 pixel_color = stereogram.getpixel((src_x, y))
                 stereogram.putpixel((x,y), pixel_color)
            else: # Should not happen if src_x is clamped correctly relative to x
                 # Fallback: copy from the initial random pattern if src_x is problematic
                 # This indicates an issue in logic or parameters.
                 pattern_x = x % pattern_size
                 base_pattern_pixel_color = stereogram.getpixel((pattern_x,y))
                 stereogram.putpixel((x,y), base_pattern_pixel_color)

    return stereogram

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
    title_image_width = 450
    title_image_height = 120
    title_font_size = 60 # Increased for visibility

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
        # generate_depth_map will use its internal fallback (arial.ttf then ImageFont.load_default())

    depth_map = generate_depth_map(title_text, title_image_width, title_image_height, font_path=selected_font_path, font_size=title_font_size)
    stereogram_image = generate_stereogram(depth_map, pattern_size=60) # Adjusted pattern_size
    title_image_path = "generated_images/latest_projects_title.png"
    stereogram_image.save(title_image_path)

    print(f"TITLE_IMG_PATH:{title_image_path}")

    # Fetch and format latest repositories
    github_username = "LIghtJUNction"
    latest_repos = get_latest_repos(github_username, count=5)
    repo_markdown_list = format_repos_to_markdown(latest_repos)

    print("---REPO_LIST_START---")
    print(repo_markdown_list)
    print("---REPO_LIST_END---")
