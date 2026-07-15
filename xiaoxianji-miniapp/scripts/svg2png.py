"""将 tabbar SVG 图标转换为 PNG"""
from PIL import Image, ImageDraw
import os

OUT = r"d:\新建文件夹 (2)\小鲜鸡\xiaoxianji-miniapp\static\tabbar"
SIZE = 162  # 2x
R = SIZE // 2
CX = CY = SIZE // 2
BG = (254, 240, 230)     # #FEF0E6
ORANGE = (200, 92, 34)    # #C85C22
GRAY = (176, 173, 166)    # #B0ADA6
WHITE = (254, 240, 230)

def circ(draw, cx, cy, r, fill=None, stroke=None, sw=0):
    """画圆：fill=填充色 stroke=描边色 sw=描边宽度"""
    if fill:
        draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=fill)
    if stroke and sw:
        draw.ellipse([cx-r, cy-r, cx+r, cy+r], outline=stroke, width=sw)

def draw_home(draw, c):
    """房子"""
    # 屋顶
    draw.line([(CX-24, CY-6), (CX, CY-24), (CX+24, CY-6)], fill=c, width=5, joint="curve")
    # 房体
    draw.rounded_rectangle([CX-20, CY-6, CX+20, CY+24], radius=4, outline=c, width=5)
    # 门
    draw.rounded_rectangle([CX-6, CY+6, CX+6, CY+24], radius=3, fill=c)

def draw_home_active(draw):
    """房子-激活"""
    draw.line([(CX-24, CY-6), (CX, CY-24), (CX+24, CY-6)], fill=ORANGE, width=5, joint="curve")
    draw.rounded_rectangle([CX-20, CY-6, CX+20, CY+24], radius=4, fill=ORANGE, outline=ORANGE, width=5)
    draw.rounded_rectangle([CX-6, CY+6, CX+6, CY+24], radius=3, fill=WHITE)

def draw_cart(draw, c):
    """购物车"""
    circ(draw, CX-14, CY+12, 5, fill=c)
    circ(draw, CX+14, CY+12, 5, fill=c)
    # 车身 (梯形)
    pts = [(CX-26, CY-12), (CX-20, CY-10), (CX-18, CY-4), (CX+20, CY-4), (CX+24, CY-12)]
    draw.line([pts[0], pts[1]], fill=c, width=5, joint="curve")
    draw.line([pts[1], pts[2]], fill=c, width=5, joint="curve")
    draw.line([pts[2], pts[3]], fill=c, width=5, joint="curve")
    draw.line([pts[3], pts[4]], fill=c, width=5, joint="curve")
    # 把手
    draw.line([(CX-26, CY-12), (CX-28, CY-22)], fill=c, width=5, joint="curve")

def draw_cart_active(draw):
    """购物车-激活"""
    draw_cart(draw, ORANGE)

def draw_order(draw, c, line_c=None):
    """订单文档"""
    if line_c is None:
        line_c = c
    draw.rounded_rectangle([CX-22, CY-26, CX+22, CY+26], radius=5, outline=c, width=5)
    for i, (y_off, w) in enumerate([(-8, 22), (2, 16), (12, 18)]):
        draw.line([(CX-14, CY+y_off), (CX-14+w, CY+y_off)], fill=line_c, width=5)

def draw_order_active(draw):
    """订单文档-激活"""
    draw.rounded_rectangle([CX-22, CY-26, CX+22, CY+26], radius=5, fill=ORANGE, outline=ORANGE, width=5)
    for i, (y_off, w) in enumerate([(-8, 22), (2, 16), (12, 18)]):
        draw.line([(CX-14, CY+y_off), (CX-14+w, CY+y_off)], fill=WHITE, width=5)

def draw_profile(draw, c):
    """人物"""
    circ(draw, CX, CY-16, 12, stroke=c, sw=5)
    # 身体弧线
    draw.arc([CX-24, CY-4, CX+24, CY+40], 200, 340, fill=c, width=5)

def draw_profile_active(draw):
    """人物-激活"""
    circ(draw, CX, CY-16, 12, fill=ORANGE, stroke=ORANGE, sw=5)
    draw.arc([CX-24, CY-4, CX+24, CY+40], 200, 340, fill=ORANGE, width=5)

def make_icon(name, draw_fn):
    img = Image.new("RGBA", (SIZE, SIZE), (0,0,0,0))
    d = ImageDraw.Draw(img)
    circ(d, CX, CY, R, fill=BG)
    draw_fn(d)
    path = os.path.join(OUT, f"tab-{name}.png")
    img.save(path)
    print(f"  {os.path.basename(path)}")

def make_active_icon(name, draw_fn):
    img = Image.new("RGBA", (SIZE, SIZE), (0,0,0,0))
    d = ImageDraw.Draw(img)
    circ(d, CX, CY, R, fill=BG)
    draw_fn(d)
    path = os.path.join(OUT, f"tab-{name}-active.png")
    img.save(path)
    print(f"  {os.path.basename(path)}")

print("Generating tabbar PNG icons (162x162, 2x)...")
make_icon("home", lambda d: draw_home(d, GRAY))
make_active_icon("home", draw_home_active)
make_icon("cart", lambda d: draw_cart(d, GRAY))
make_active_icon("cart", draw_cart_active)
make_icon("order", lambda d: draw_order(d, GRAY))
make_active_icon("order", draw_order_active)
make_icon("profile", lambda d: draw_profile(d, GRAY))
make_active_icon("profile", draw_profile_active)
print("Done!")