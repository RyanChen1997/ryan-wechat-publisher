const fs = require('fs');
const path = require('path');

const SKILL_ROOT = path.resolve(__dirname, '../../..');
const { svgToPngBuffer } = require(path.join(SKILL_ROOT, 'scripts/utils/svg-to-png'));

const templatePath = path.join(__dirname, 'svg/number-template.svg');
const outputDir = path.join(__dirname, 'assets/numbers');
const template = fs.readFileSync(templatePath, 'utf8');
const colors = ['#FF6657', '#F5B92E', '#72BCEA'];

function fillTemplate(source, values) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, String(value)),
    source,
  );
}

fs.mkdirSync(outputDir, { recursive: true });

for (let number = 1; number <= 10; number += 1) {
  const twoDigits = number >= 10;
  const svg = fillTemplate(template, {
    NUMBER: number,
    COLOR: colors[(number - 1) % colors.length],
    SEED: 20 + number,
    FONT_SIZE: twoDigits ? 470 : 610,
    TEXT_WIDTH: twoDigits ? 610 : 360,
  });
  const fileName = `number-${String(number).padStart(2, '0')}.png`;
  fs.writeFileSync(path.join(outputDir, fileName), svgToPngBuffer(svg, 760));
  console.log(`generated ${fileName}`);
}
