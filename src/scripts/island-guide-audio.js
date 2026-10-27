// One player, no autoplay; stale play promises cannot revive a stopped clip.
export function bindExclusiveAudio(doc, onOtherAudio, AudioType = HTMLAudioElement) {
  doc.addEventListener('play', event => {
    if (!(event.target instanceof AudioType)) return;
    if (event.target.id !== 'jasonGuideAudio') onOtherAudio();
    doc.querySelectorAll('audio').forEach(audio => {
      if (audio !== event.target) audio.pause();
    });
  }, true);
}

export function createGuideAudio(audio, {onState = () => {}, onError = () => {}} = {}) {
  audio.loop = false;
  audio.autoplay = false;
  let version = 0, active = false;
  const state = value => onState(value);
  function stop() {
    version++;
    active = false;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    state('idle');
  }
  function failed(id) {
    if (id !== version || !active) return;
    active = false;
    audio.pause();
    state('error');
    onError();
  }
  async function play(src) {
    stop();
    const id = version;
    active = true;
    audio.src = src;
    state('loading');
    try {
      await audio.play();
      if (id === version && active) state('playing');
    } catch {
      failed(id);
    }
  }
  audio.addEventListener('ended', () => {
    if (!active || !audio.ended) return;
    stop();
  });
  audio.addEventListener('error', () => {
    if (audio.error) failed(version);
  });
  return {play, stop, isActive: () => active};
}

// Selecting or arriving at a station never starts speech. Only toggle() may play.
export function createStationGuide(player, stations, onSpeak = () => {}) {
  let selected = stations[0]?.island;
  return {
    select(id) {
      if (!stations.some(station => station.island === id)) return;
      if (id !== selected) player.stop();
      selected = id;
    },
    toggle() {
      if (player.isActive()) { player.stop(); return; }
      const station = stations.find(station => station.island === selected);
      if (!station?.audio) return;
      onSpeak(station.jason);
      player.play(station.audio);
    }
  };
}
