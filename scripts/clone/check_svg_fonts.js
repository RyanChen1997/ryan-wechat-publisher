const fs = require('fs');
const path = require('path');

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

function checkSvgFonts(presetDir) {
  const svgFiles = walk(path.join(presetDir, 'svg')).filter((file) => file.endsWith('.svg'));
  const textSvgs = svgFiles.filter((file) => /<text\b/i.test(fs.readFileSync(file, 'utf8')));
  if (!textSvgs.length) return { status: 'pass', mode: 'no-svg-text', textSvgFiles: [] };

  const policyPath = path.join(presetDir, 'font-policy.json');
  if (!fs.existsSync(policyPath)) {
    return {
      status: 'fail',
      reason: 'SVG 含 <text>，但缺少 font-policy.json；必须声明 bundled、path 或 system-fallback 策略',
      textSvgFiles: textSvgs,
    };
  }
  const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  if (!['bundled', 'path', 'system-fallback'].includes(policy.mode)) {
    return { status: 'fail', reason: `未知字体策略: ${policy.mode}`, textSvgFiles: textSvgs };
  }
  if (policy.mode === 'bundled') {
    const missing = (policy.files || []).filter((file) => !fs.existsSync(path.join(presetDir, file)));
    if (!(policy.files || []).length || missing.length) {
      return { status: 'fail', reason: `bundled 字体缺失: ${missing.join(', ') || '未声明 files'}`, textSvgFiles: textSvgs };
    }
  }
  if (policy.mode === 'system-fallback' && !policy.boundary_tests) {
    return { status: 'fail', reason: 'system-fallback 必须声明 boundary_tests', textSvgFiles: textSvgs };
  }
  return {
    status: policy.mode === 'system-fallback' ? 'warn' : 'pass',
    mode: policy.mode,
    reason: policy.mode === 'system-fallback' ? '渲染结果依赖系统字体，持久化前必须检查边界预览' : null,
    textSvgFiles: textSvgs,
  };
}

if (require.main === module) {
  const presetDir = process.argv[2];
  if (!presetDir) {
    console.error('用法: node check_svg_fonts.js <preset-package-dir>');
    process.exit(1);
  }
  const result = checkSvgFonts(path.resolve(presetDir));
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === 'fail' ? 1 : 0);
}

module.exports = { checkSvgFonts };
