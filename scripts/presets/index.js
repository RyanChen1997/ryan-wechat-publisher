const blueDotNotes = require('./blue-dot-notes/index');
const purpleBadge = require('./purple-badge/index');
const vibrantBadge = require('./vibrant-badge/index');
const elegantMinimal = require('./elegant-minimal/index');
const geekTech = require('./geek-tech/index');
const wechatBlueYellow = require('./wechat-blue-yellow/index');
const childlikeDoodle = require('./childlike-doodle/index');

const PRESETS = {
  'blue-dot-notes': blueDotNotes,
  'purple-badge': purpleBadge,
  'vibrant-badge': vibrantBadge,
  'elegant-minimal': elegantMinimal,
  'geek-tech': geekTech,
  'wechat-blue-yellow': wechatBlueYellow,
  'childlike-doodle': childlikeDoodle,
};

function getPreset(id) {
  return PRESETS[id] || null;
}

function listPresets() {
  return Object.values(PRESETS).map(p => ({
    id: p.id,
    name: p.name,
    tagline: p.tagline,
    description: p.description,
    suitableFor: p.suitableFor,
    meta: p.meta,
  }));
}

module.exports = { PRESETS, getPreset, listPresets };
