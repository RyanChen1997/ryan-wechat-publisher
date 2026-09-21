#!/usr/bin/env bash
#
# ryan-wechat-publisher 安装脚本
#
# 把本 skill 安装到指定目录（默认 ~/.pi/agent/skills）。只装 skill 运行需要的东西
# （assets / references / scripts / package.json / package-lock.json / SKILL.md / README.md），
# 开发资料（docs / gotomarket / research）与 node_modules 不装。
#
# 已装旧版时的处理：读取目标目录里同名文件夹的 package.json 版本
#   · 旧版本 <  当前版本 → 整个旧文件夹删掉，换成新的
#   · 旧版本 >= 当前版本 → 不动（不降级、不重复安装），只提示
#   · 版本读不出来     → 不动，只提示（拿不准就别覆盖，用 --force 强上）
#
# 用法:
#   ./install.sh                         # 装到 ~/.pi/agent/skills/<skill 名>
#   ./install.sh ~/somewhere/skills      # 装到指定目录下的 <skill 名> 子目录
#   ./install.sh ~/somewhere/skills -f   # 忽略版本比较，强制覆盖
#   ./install.sh ~/somewhere/skills -n   # 只演习：打印会做什么，不落盘
#   ./install.sh -h                      # 看帮助
#
# 退出码: 0 安装/已是最新；1 参数或环境有问题；2 目标目录里是更高版本（未改动）

set -euo pipefail

# ---------- 常量 ----------
# 安装清单：只装 skill 需要的，开发资料与产物不装
ITEMS=(assets references scripts package.json package-lock.json SKILL.md README.md)
# 复制时排除的杂物
EXCLUDES=(.DS_Store __pycache__ '*.pyc' node_modules .git)
DEFAULT_TARGET="$HOME/.pi/agent/skills"

SKILL_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---------- 输出 ----------
info()  { printf '  %s\n' "$*"; }
step()  { printf '\n▸ %s\n' "$*"; }
warn()  { printf '  ! %s\n' "$*" >&2; }
die()   { printf '✗ %s\n' "$*" >&2; exit 1; }

usage() {
  # 打印文件顶部的注释块（跳过 shebang，遇到第一行非注释就停）
  awk 'NR>1 && /^#/ { sub(/^# ?/, ""); print; next } NR>1 { exit }' "${BASH_SOURCE[0]}"
}

# ---------- JSON 读字段（优先 node，没有 node 就用 sed 兜底）----------
json_field() { # $1=文件绝对路径 $2=字段名
  local file="$1" field="$2" value=''
  if command -v node >/dev/null 2>&1; then
    value=$(node -e 'try{const v=require(process.argv[1])[process.argv[2]];if(v!=null)process.stdout.write(String(v))}catch(e){}' "$file" "$field" 2>/dev/null || true)
  fi
  if [ -z "$value" ]; then
    value=$(sed -n "s/.*\"$field\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" "$file" | head -n 1)
  fi
  printf '%s' "$value"
}

# ---------- 版本比较（只比前三段，忽略 -beta 之类后缀）----------
# 1.1.0 → 000100010000；固定 12 位宽，之后直接用字符串比较（bash 算术会把 08 当八进制）
version_key() {
  local raw="${1%%-*}" parts major minor patch
  if ! [[ "$raw" =~ ^[0-9]+(\.[0-9]+)*$ ]]; then
    printf ''
    return
  fi
  IFS='.' read -r -a parts <<< "$raw"
  major="${parts[0]:-0}"; minor="${parts[1]:-0}"; patch="${parts[2]:-0}"
  for n in "$major" "$minor" "$patch"; do
    if [ "${#n}" -gt 4 ]; then
      printf ''
      return
    fi
  done
  printf '%04d%04d%04d' "$major" "$minor" "$patch"
}

copy_item() {
  local item="$1" src="$SKILL_ROOT/$1" args=()
  [ -e "$src" ] || die "源目录里缺少 ${item}（在 $SKILL_ROOT 里没找到）"
  if command -v rsync >/dev/null 2>&1; then
    args=(-a)
    for e in "${EXCLUDES[@]}"; do args+=(--exclude "$e"); done
    rsync "${args[@]}" "$src" "$TMP/"
  else
    cp -R "$src" "$TMP/"
  fi
}

# ---------- 参数 ----------
TARGET=""
FORCE=0
DRY_RUN=0
while [ $# -gt 0 ]; do
  case "$1" in
    -f|--force)   FORCE=1 ;;
    -n|--dry-run) DRY_RUN=1 ;;
    -h|--help)    usage; exit 0 ;;
    -*)           printf '未知参数: %s\n\n' "$1" >&2; usage >&2; exit 1 ;;
    *)            [ -z "$TARGET" ] || die "只能指定一个目标目录（多了：$1）"; TARGET="$1" ;;
  esac
  shift
done
[ -n "$TARGET" ] || TARGET="$DEFAULT_TARGET"

# ---------- 源信息 ----------
NAME="$(json_field "$SKILL_ROOT/package.json" name)"
[ -n "$NAME" ] || NAME="$(basename "$SKILL_ROOT")"
SRC_VERSION="$(json_field "$SKILL_ROOT/package.json" version)"
[ -n "$SRC_VERSION" ] || die "读不到 $SKILL_ROOT/package.json 的 version"
SRC_KEY="$(version_key "$SRC_VERSION")"
[ -n "$SRC_KEY" ] || die "版本号格式不认识: $SRC_VERSION"

# 目标目录：先建出来，再取绝对路径（顺带把 ~ 展开）
mkdir -p "$TARGET" || die "创建目标目录失败: $TARGET"
TARGET_ROOT="$(cd "$TARGET" && pwd)"
DEST="$TARGET_ROOT/$NAME"

# 防呆：别把自己删了（目标 == 源，或目标在源里面）
case "$DEST" in
  "$SKILL_ROOT"|"$SKILL_ROOT"/*) die "目标目录落在源目录里（${DEST}），拒绝安装 —— 换一个目标目录" ;;
esac

step "安装 $NAME $SRC_VERSION"
info "源:   $SKILL_ROOT"
info "目标: $DEST"

# ---------- 版本比较 ----------
OLD_VERSION=""
OLD_KEY=""
REPLACING=0
if [ -f "$DEST/package.json" ]; then
  OLD_VERSION="$(json_field "$DEST/package.json" version)"
  OLD_KEY="$(version_key "$OLD_VERSION")"
  step "目标目录里已经装了：${OLD_VERSION:-（版本号读不出来）}"

  if [ "$FORCE" = 1 ]; then
    REPLACING=1
    info "带 --force：跳过版本比较，直接覆盖"
  elif [ -z "$OLD_KEY" ]; then
    warn "旧版本的 version 字段读不出来，保守起见不改动它"
    warn "确认要覆盖就重跑一次并加 --force"
    exit 1
  elif [ "$OLD_KEY" = "$SRC_KEY" ]; then
    info "版本一致（${OLD_VERSION}），已经是最新的，什么都没做"
    exit 0
  elif [ "$OLD_KEY" \< "$SRC_KEY" ]; then
    REPLACING=1
    info "旧版本较低：${OLD_VERSION} → ${SRC_VERSION}，替换整个文件夹"
  else
    warn "目标目录里的是更高版本（${OLD_VERSION} > ${SRC_VERSION}），没有改动它"
    warn "确实要降级就重跑一次并加 --force"
    exit 2
  fi
elif [ -e "$DEST" ]; then
  die "$DEST 已存在，但不是 skill 目录（没有 package.json），先自己处理掉它"
else
  info "目标目录里没有同名文件夹，全新安装"
fi

# ---------- 先装到临时目录，再整体换过去 ----------
STAGE="$(mktemp -d "$TARGET_ROOT/.${NAME}.new.XXXXXX")"
TMP="$STAGE"
cleanup() { [ -d "$STAGE" ] && rm -rf "$STAGE"; }
trap cleanup EXIT
for item in "${ITEMS[@]}"; do
  copy_item "$item"
done
# 非 rsync 路径下的兜底清理
find "$TMP" -name '.DS_Store' -delete 2>/dev/null || true
find "$TMP" -name '__pycache__' -type d -prune -exec rm -rf {} + 2>/dev/null || true

if [ "$DRY_RUN" = 1 ]; then
  step "演习模式，不落盘。本来会装这些："
  (cd "$TMP" && find . -maxdepth 1 -mindepth 1 | sed 's|^\./|  |' | sort)
  info "目标位置: $DEST"
  exit 0
fi

BACKUP=""
if [ -d "$DEST" ]; then
  BACKUP="$TARGET_ROOT/.${NAME}.old.$$"
  mv "$DEST" "$BACKUP"
fi
if ! mv "$TMP" "$DEST"; then
  [ -n "$BACKUP" ] && mv "$BACKUP" "$DEST"   # 换失败就把旧的放回去
  die "移动到 $DEST 失败（旧版本已还原）"
fi
[ -n "$BACKUP" ] && rm -rf "$BACKUP"
trap - EXIT

# ---------- 结果 ----------
step "$([ "$REPLACING" = 1 ] && echo '已更新' || echo '已安装')"
info "${DEST}  （${SRC_VERSION}）"
if [ ! -d "$DEST/node_modules" ]; then
  info "提示: 依赖还没装。Word 解析 / SVG 转 PNG 需要它："
  info "  cd \"${DEST}\" && npm install --omit=dev"
fi
info "检查依赖: node -e \"['mammoth','@resvg/resvg-js','sharp'].forEach(m=>{try{require.resolve(m);console.log('OK   '+m)}catch(e){console.log('MISS '+m)}})\""
