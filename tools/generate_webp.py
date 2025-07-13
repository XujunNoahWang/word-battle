import os
import sys
from PIL import Image
import time

# 配置图片目录
IMG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'images')

# 支持的源图片格式
SRC_EXTS = ['.jpg', '.jpeg', '.png']
WEBP_EXT = '.webp'

# 日志输出

def log(msg):
    print(msg)

def get_mtime(path):
    try:
        return os.path.getmtime(path)
    except Exception:
        return 0

def main():
    if not os.path.isdir(IMG_DIR):
        log(f'❌ 图片目录不存在: {IMG_DIR}')
        sys.exit(1)

    files = os.listdir(IMG_DIR)
    src_files = [f for f in files if os.path.splitext(f)[1].lower() in SRC_EXTS]
    total = len(src_files)
    updated = 0
    skipped = 0
    failed = 0

    log(f'🔍 检查 {total} 张图片...')
    for fname in src_files:
        src_path = os.path.join(IMG_DIR, fname)
        base, _ = os.path.splitext(fname)
        webp_path = os.path.join(IMG_DIR, base + WEBP_EXT)

        src_mtime = get_mtime(src_path)
        webp_mtime = get_mtime(webp_path)

        # 只有webp不存在，或源图比webp新，才需要生成
        if not os.path.exists(webp_path) or src_mtime > webp_mtime:
            try:
                img = Image.open(src_path)
                img.save(webp_path, 'webp', quality=85, method=6)
                updated += 1
                log(f'✅ 生成/更新: {fname} → {os.path.basename(webp_path)}')
            except Exception as e:
                failed += 1
                log(f'❌ 失败: {fname}，原因: {e}')
        else:
            skipped += 1
            log(f'⏭️  跳过: {fname}（webp已是最新）')

    log('\n📊 处理结果:')
    log(f'✅ 生成/更新: {updated} 张')
    log(f'⏭️  跳过: {skipped} 张')
    log(f'❌ 失败: {failed} 张')
    log('🎉 执行完毕！')

if __name__ == '__main__':
    main() 