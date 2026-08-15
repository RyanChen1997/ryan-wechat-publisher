const blueDotNotes = require('./blue-dot-notes');
const purpleBadge = require('./purple-badge');
const vibrantBadge = require('./vibrant-badge');
const elegantMinimal = require('./elegant-minimal');
const geekTech = require('./geek-tech');
const wechatBlueYellow = require('./wechat-blue-yellow');

const PRESETS = {
  'blue-dot-notes': blueDotNotes,
  'purple-badge': purpleBadge,
  'vibrant-badge': vibrantBadge,
  'elegant-minimal': elegantMinimal,
  'geek-tech': geekTech,
  'wechat-blue-yellow': wechatBlueYellow,
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
