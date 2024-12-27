from PIL import Image, ImageDraw, ImageFont
import numpy as np

def generate_depth_map(text, image_size=(500, 300), font_size=50):
    """
    生成基于文本的深度图。
    :param text: 要隐藏的文字内容
    :param image_size: 图像大小（宽, 高）
    :param font_size: 字体大小
    :return: 深度图（灰度图）
    """
    # 创建空白图像
    depth_map = Image.new("L", image_size, color=0)
    draw = ImageDraw.Draw(depth_map)

    # 加载字体
    try:
        font = ImageFont.truetype("arial.ttf", font_size)  # 替换为系统中的字体路径
    except IOError:
        font = ImageFont.load_default()  # 默认字体

    # 将文字居中绘制到图像
    text_width, text_height = draw.textsize(text, font=font)
    text_x = (image_size[0] - text_width) // 2
    text_y = (image_size[1] - text_height) // 2
    draw.text((text_x, text_y), text, fill=255, font=font)

    return np.array(depth_map)

def generate_stereogram(depth_map, texture_width=10):
    """
    根据深度图生成隐藏立体图。
    :param depth_map: 深度图（灰度图）
    :param texture_width: 纹理宽度
    :return: 隐藏立体图
    """
    height, width = depth_map.shape
    stereogram = np.zeros((height, width), dtype=np.uint8)

    # 随机生成纹理图案
    texture = np.random.randint(0, 256, (height, texture_width), dtype=np.uint8)

    # 填充隐藏立体图
    for y in range(height):
        for x in range(width):
            offset = depth_map[y, x] // 10  # 偏移量由深度图决定
            src_x = (x - offset) % texture_width
            stereogram[y, x] = texture[y, src_x]

    return Image.fromarray(stereogram, mode="L")

# 主函数
if __name__ == "__main__":
    # 配置参数
    text = "Hello World"  # 要隐藏的文字
    image_size = (500, 300)  # 图像大小
    font_size = 50  # 字体大小

    # 生成深度图
    depth_map = generate_depth_map(text, image_size, font_size)

    # 生成隐藏立体图
    stereogram = generate_stereogram(depth_map)

    # 保存结果
    depth_image = Image.fromarray(depth_map)
    depth_image.save("depth_map.png")
    stereogram.save("stereogram.png")

    # 显示结果
    depth_image.show()
    stereogram.show()
