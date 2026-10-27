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
    active = false;
    state('idle');
  });
  audio.addEventListener('error', () => {
    if (audio.error) failed(version);
  });
  return {play, stop, isActive: () => active};
}
