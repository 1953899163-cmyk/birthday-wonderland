(() => {
  'use strict';

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const toast = $('#toast');
  const toastText = $('#toastText');
  let toastTimer;

  function showToast(message) {
    if (!toast || !toastText) return;
    toastText.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 3600);
  }

  function safeStorageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (_) { /* Storage can be disabled. */ }
  }

  function safeStorageGet(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }

  function copyText(text, successMessage) {
    const fallbackCopy = () => {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
      showToast(successMessage);
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => showToast(successMessage)).catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
  }

  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());

  /* Mobile navigation */
  const menuToggle = $('#menuToggle');
  const mainNav = $('#mainNav');
  function closeMenu() {
    if (!menuToggle || !mainNav) return;
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', '打开导航');
    mainNav.classList.remove('is-open');
  }
  if (menuToggle && mainNav) {
    menuToggle.addEventListener('click', () => {
      const open = menuToggle.getAttribute('aria-expanded') === 'true';
      menuToggle.setAttribute('aria-expanded', String(!open));
      menuToggle.setAttribute('aria-label', open ? '打开导航' : '关闭导航');
      mainNav.classList.toggle('is-open', !open);
    });
    mainNav.addEventListener('click', (event) => {
      if (event.target.closest('a')) closeMenu();
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 820) closeMenu();
    }, { passive: true });
  }

  /* Scroll progress, header state and active navigation */
  const header = $('.site-header');
  const progress = $('#scrollProgress');
  function updateScrollUI() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    if (progress) progress.style.width = `${ratio * 100}%`;
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 16);
  }
  window.addEventListener('scroll', updateScrollUI, { passive: true });
  updateScrollUI();

  const navLinks = $$('.nav-link');
  const observedSections = ['wish-lab', 'playground', 'toolbox'].map((id) => document.getElementById(id)).filter(Boolean);
  if ('IntersectionObserver' in window) {
    const navObserver = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      navLinks.forEach((link) => {
        const active = link.getAttribute('href') === `#${visible.target.id}`;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-32% 0px -58%', threshold: [0.08, 0.2, 0.45] });
    observedSections.forEach((section) => navObserver.observe(section));

    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8%', threshold: 0.08 });
    $$('.reveal').forEach((element) => reducedMotion ? element.classList.add('is-visible') : revealObserver.observe(element));
  } else {
    $$('.reveal').forEach((element) => element.classList.add('is-visible'));
  }

  /* Confetti canvas */
  const canvas = $('#confettiCanvas');
  const context = canvas ? canvas.getContext('2d') : null;
  let particles = [];
  let animationFrame = 0;
  let confettiEnabled = true;
  const palette = () => {
    const styles = getComputedStyle(document.body);
    return [
      styles.getPropertyValue('--primary').trim() || '#c52d5d',
      styles.getPropertyValue('--secondary').trim() || '#ffd76a',
      styles.getPropertyValue('--tertiary').trim() || '#82b9ff',
      styles.getPropertyValue('--mint').trim() || '#6fc9ab',
      '#ff8fb5'
    ];
  };

  function resizeCanvas() {
    if (!canvas || !context) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * ratio);
    canvas.height = Math.floor(window.innerHeight * ratio);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas, { passive: true });

  function drawConfetti() {
    if (!context || !canvas) return;
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    particles.forEach((particle) => {
      context.save();
      context.globalAlpha = particle.life;
      context.translate(particle.x, particle.y);
      context.rotate(particle.rotation);
      context.fillStyle = particle.color;
      if (particle.shape === 'circle') {
        context.beginPath();
        context.arc(0, 0, particle.size * .48, 0, Math.PI * 2);
        context.fill();
      } else {
        context.fillRect(-particle.size * .34, -particle.size * .7, particle.size * .68, particle.size * 1.4);
      }
      context.restore();
    });

    particles = particles.filter((particle) => particle.life > 0 && particle.y < window.innerHeight + 80);
    particles.forEach((particle) => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.12;
      particle.vx *= 0.992;
      particle.rotation += particle.spin;
      particle.life -= particle.fade;
    });

    if (particles.length) animationFrame = requestAnimationFrame(drawConfetti);
    else {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }
  }

  function burstConfetti(x = window.innerWidth / 2, y = window.innerHeight * .3, count = 54) {
    if (!confettiEnabled || reducedMotion || !context) return;
    const colors = palette();
    for (let i = 0; i < count; i += 1) {
      const angle = (-Math.PI / 2) + (Math.random() - .5) * Math.PI * 1.35;
      const speed = 4 + Math.random() * 7;
      particles.push({
        x: x + (Math.random() - .5) * 22,
        y: y + (Math.random() - .5) * 18,
        vx: Math.cos(angle) * speed + (Math.random() - .5) * 2.2,
        vy: Math.sin(angle) * speed - Math.random() * 2,
        size: 5 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: Math.random() > .72 ? 'circle' : 'rect',
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - .5) * .24,
        life: .9 + Math.random() * .18,
        fade: .009 + Math.random() * .009
      });
    }
    if (!animationFrame) animationFrame = requestAnimationFrame(drawConfetti);
  }

  function popSparkles(x, y, count = 8) {
    if (reducedMotion) return;
    const colors = palette();
    for (let i = 0; i < count; i += 1) {
      const particle = document.createElement('i');
      particle.className = 'spark-particle';
      particle.style.left = `${x + (Math.random() - .5) * 40}px`;
      particle.style.top = `${y + (Math.random() - .5) * 30}px`;
      particle.style.background = colors[Math.floor(Math.random() * colors.length)];
      particle.style.rotate = `${Math.random() * 180}deg`;
      particle.style.animationDelay = `${Math.random() * 80}ms`;
      document.body.appendChild(particle);
      window.setTimeout(() => particle.remove(), 850);
    }
  }

  /* Background music */
  const audio = $('#birthdayAudio');
  const musicPlayer = $('#musicPlayer');
  const musicToggle = $('#musicToggle');
  const headerMusicToggle = $('#headerMusicToggle');
  const headerMusicLabel = $('#headerMusicLabel');
  const musicStatus = $('#musicStatus');
  const heroPlayMusic = $('#heroPlayMusic');
  const volumeRange = $('#volumeRange');
  const volumeOutput = $('#volumeOutput');
  let manuallyPaused = false;

  function setMusicUI(playing) {
    if (musicPlayer) musicPlayer.classList.toggle('is-playing', playing);
    if (headerMusicToggle) headerMusicToggle.classList.toggle('is-playing', playing);
    if (musicToggle) {
      musicToggle.setAttribute('aria-pressed', String(playing));
      musicToggle.setAttribute('aria-label', playing ? '暂停生日快乐背景音乐' : '播放生日快乐背景音乐');
    }
    if (headerMusicToggle) {
      headerMusicToggle.setAttribute('aria-pressed', String(playing));
      headerMusicToggle.setAttribute('aria-label', playing ? '暂停生日快乐背景音乐' : '播放生日快乐背景音乐');
    }
    if (headerMusicLabel) headerMusicLabel.textContent = playing ? '暂停生日歌' : '播放生日歌';
    if (musicStatus) musicStatus.textContent = playing ? '音乐盒正在播放 · 纯音乐' : '点一下播放音乐盒旋律';
    if (musicPlayer) musicPlayer.classList.toggle('needs-play', !playing);
  }

  function playMusic(fromUser = false) {
    if (!audio) return;
    if (fromUser) manuallyPaused = false;
    audio.loop = true;
    audio.play().then(() => setMusicUI(true)).catch(() => {
      setMusicUI(false);
      showToast('浏览器阻止了自动播放，请再点一次音乐按钮。');
    });
  }

  function pauseMusic(fromUser = false) {
    if (!audio) return;
    if (fromUser) manuallyPaused = true;
    audio.pause();
    setMusicUI(false);
  }

  function toggleMusic() {
    if (!audio) return;
    if (audio.paused) playMusic(true);
    else pauseMusic(true);
  }

  if (audio) {
    audio.volume = .52;
    audio.addEventListener('play', () => setMusicUI(true));
    audio.addEventListener('pause', () => setMusicUI(false));
    audio.addEventListener('error', () => showToast('音乐文件加载失败，请确认 assets 文件夹是否完整。'));
    window.setTimeout(() => {
      if (manuallyPaused) return;
      audio.play().then(() => setMusicUI(true)).catch(() => setMusicUI(false));
    }, 800);
  }
  [musicToggle, headerMusicToggle, heroPlayMusic].forEach((button) => button?.addEventListener('click', toggleMusic));
  volumeRange?.addEventListener('input', () => {
    const value = Number(volumeRange.value);
    if (audio) audio.volume = value / 100;
    if (volumeOutput) volumeOutput.textContent = `${value}%`;
  });

  /* Navigation CTA that confirms audio state */
  $('a[href="#wish-lab"].button-primary')?.addEventListener('click', () => {
    if (audio && audio.paused && !manuallyPaused) playMusic(true);
  });

  /* Wish card maker */
  const wishForm = $('#wishForm');
  const messageInput = $('#birthdayMessage');
  const messageCount = $('#messageCount');
  const cardMessage = $('#cardMessage');
  const birthdayCard = $('#birthdayCard');
  const randomWish = $('#randomWish');
  const shareCard = $('#shareCard');
  const copyWish = $('#copyWish');
  const wishes = [
    '愿你的新一岁，甜甜的愿望都实现，喜欢的风景都遇见。',
    '今天的快乐不打烊，明天的好运自动续费。',
    '愿你像生日蜡烛一样，永远明亮，永远有光。',
    '愿所有小小期待，都在这一年长成漂亮的答案。',
    '祝你被爱包围，也拥有一个人发光的勇气。',
    '愿新一岁的生活，像拆礼物一样处处有惊喜。'
  ];

  function updateCard() {
    if (cardMessage) cardMessage.textContent = messageInput?.value.trim() || '愿你今天超级开心，明天也同样开心。';
    if (messageCount && messageInput) messageCount.textContent = String(messageInput.value.length);
  }

  function clearFieldError(input) {
    const field = input?.closest('.field');
    const error = field?.querySelector('.field-error');
    field?.classList.remove('has-error');
    if (error) error.textContent = '';
  }

  function setFieldError(input, message) {
    const field = input?.closest('.field');
    const error = field?.querySelector('.field-error');
    field?.classList.add('has-error');
    if (error) error.textContent = message;
  }

  function validateWishForm() {
    const errors = [];

    if (!messageInput?.value.trim()) {
      setFieldError(messageInput, '写一句祝福再生成卡片吧。');
      errors.push(messageInput);
    } else clearFieldError(messageInput);

    if (errors.length) {
      errors[0].focus();
      showToast('还差一点点，请检查红色提示。');
      return false;
    }
    return true;
  }

  [messageInput].forEach((input) => {
    input?.addEventListener('input', () => {
      clearFieldError(input);
      updateCard();
    });
    input?.addEventListener('blur', () => {
      if (input.required && !input.value.trim()) setFieldError(input, '这一项不能为空。');
    });
  });

  $$('.theme-option').forEach((button) => {
    button.addEventListener('click', () => {
      const theme = button.dataset.cardTheme || 'candy';
      $$('.theme-option').forEach((item) => {
        const selected = item === button;
        item.classList.toggle('is-selected', selected);
        item.setAttribute('aria-pressed', String(selected));
      });
      birthdayCard?.classList.remove('card-theme-candy', 'card-theme-sky', 'card-theme-matcha');
      birthdayCard?.classList.add(`card-theme-${theme}`);
    });
  });

  wishForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!validateWishForm()) return;
    updateCard();
    birthdayCard?.classList.remove('is-popping');
    void birthdayCard?.offsetWidth;
    birthdayCard?.classList.add('is-popping');
    const rect = birthdayCard?.getBoundingClientRect();
    if (rect) burstConfetti(rect.left + rect.width / 2, rect.top + rect.height * .36, 64);
    showToast('生日卡生成好啦，可以分享出去了。');
  });

  randomWish?.addEventListener('click', (event) => {
    if (!messageInput) return;
    let next = messageInput.value;
    while (next === messageInput.value) next = wishes[Math.floor(Math.random() * wishes.length)];
    messageInput.value = next;
    updateCard();
    clearFieldError(messageInput);
    const rect = event.currentTarget.getBoundingClientRect();
    burstConfetti(rect.left + rect.width / 2, rect.top, 28);
  });

  shareCard?.addEventListener('click', () => {
    const text = `TO 被全世界偏爱的你：${messageInput?.value.trim() || '生日快乐！'} 20 岁生日快乐，愿你新的一岁闪闪发光。`;
    copyText(text, '祝福文字已复制，去发给寿星吧。');
  });
  copyWish?.addEventListener('click', () => copyText(`20 岁的被全世界偏爱的你，生日快乐！${messageInput?.value.trim() || '愿所有美好都如期而至。'}`, '生日祝福已复制。'));

  /* Candle game */
  const miniCandles = $$('.mini-candles span');
  const blowCandle = $('#blowCandle');
  const candleButtonText = $('#candleButtonText');
  const candleStatus = $('#candleStatus');
  let litCandles = miniCandles.length;

  function updateCandleStatus() {
    if (candleStatus) candleStatus.textContent = litCandles > 0 ? `还有 ${litCandles} 根蜡烛亮着` : '三根蜡烛全部吹灭，愿望已送达';
    if (candleButtonText) candleButtonText.textContent = litCandles > 0 ? '吹灭一根蜡烛' : '重新点亮蜡烛';
  }

  blowCandle?.addEventListener('click', () => {
    const rect = blowCandle.getBoundingClientRect();
    if (litCandles === 0) {
      miniCandles.forEach((candle) => candle.classList.remove('is-out'));
      litCandles = miniCandles.length;
      updateCandleStatus();
      showToast('蜡烛重新点亮，再许一次愿吧。');
      return;
    }
    const candle = miniCandles[litCandles - 1];
    candle?.classList.add('is-out');
    litCandles -= 1;
    updateCandleStatus();
    burstConfetti(rect.left + rect.width / 2, rect.top, litCandles === 0 ? 52 : 18);
    if (litCandles === 0) {
      showToast('呼——全部吹灭，生日愿望一定会实现。');
      popSparkles(rect.left + rect.width / 2, rect.top, 12);
    }
  });

  /* Gift boxes */
  const giftBoxes = $$('.gift-box');
  const giftMessages = [
    '愿你今天收到很多很多爱，也记得把一些留给自己。',
    '愿生活偶尔撒糖，偶尔放假，永远不缺少好心情。',
    '愿你想要的都拥有，得不到的都释怀。',
    '愿你的快乐不用等到特别的日子。',
    '愿新一岁的每个选择，都把你带向更喜欢的地方。',
    '愿有人懂你的奇奇怪怪，也陪你一起可可爱爱。'
  ];

  giftBoxes.forEach((box, index) => {
    const messageNode = box.closest('.gift-row')?.querySelector('.gift-message');
    box.addEventListener('click', () => {
      const message = giftMessages[index % giftMessages.length];
      box.classList.add('is-open');
      box.setAttribute('aria-expanded', 'true');
      box.setAttribute('aria-label', `第 ${index + 1} 个礼物已打开：${message}`);
      if (messageNode) {
        messageNode.textContent = message;
        messageNode.classList.add('is-revealed');
      }
      const rect = box.getBoundingClientRect();
      burstConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2, 22);
    });
  });

  /* Energy meter */
  const energyButton = $('#energyButton');
  const energyRing = $('#energyRing');
  const energyNumber = $('#energyNumber');
  let energy = 0;
  energyButton?.addEventListener('click', (event) => {
    energy = Math.min(100, energy + 10);
    if (energyRing) energyRing.style.setProperty('--progress', String(energy));
    if (energyNumber) energyNumber.textContent = String(energy);
    const rect = event.currentTarget.getBoundingClientRect();
    popSparkles(rect.left + rect.width / 2, rect.top, 5);
    if (energy === 100) {
      energyButton.disabled = true;
      energyButton.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#icon-check"></use></svg> 许愿能量满格啦';
      energyRing?.classList.add('is-full');
      burstConfetti(rect.left + rect.width / 2, rect.top, 70);
      showToast('许愿能量 100%，今天的快乐正式满格。');
    }
  });

  /* Toolbox interactions */
  const confettiToggle = $('#confettiToggle');
  confettiToggle?.addEventListener('click', (event) => {
    confettiEnabled = !confettiEnabled;
    confettiToggle.setAttribute('aria-checked', String(confettiEnabled));
    if (confettiEnabled) {
      const rect = event.currentTarget.getBoundingClientRect();
      burstConfetti(rect.left + rect.width / 2, rect.top, 30);
      showToast('彩带模式已开启。');
    } else {
      showToast('彩带模式已关闭，动效更轻盈。');
    }
  });

  $('#burstButton')?.addEventListener('click', (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    burstConfetti(rect.left + rect.width / 2, rect.top, 58);
  });
  $('#toastButton')?.addEventListener('click', () => showToast('这是一条会自动消失的可爱提示。'));

  const tagButton = $('#tagButton');
  const tagText = $('#tagText');
  tagButton?.addEventListener('click', () => {
    const pressed = tagButton.getAttribute('aria-pressed') === 'true';
    tagButton.setAttribute('aria-pressed', String(!pressed));
    if (tagText) tagText.textContent = pressed ? '收藏今天' : '今天已收藏';
    showToast(pressed ? '已取消收藏。' : '已把今天放进收藏夹。');
  });

  const pageThemes = $$('[data-page-theme]');
  pageThemes.forEach((button) => {
    button.addEventListener('click', () => {
      const theme = button.dataset.pageTheme || 'candy';
      document.body.dataset.theme = theme;
      safeStorageSet('birthday-theme', theme);
      pageThemes.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
      const rect = button.getBoundingClientRect();
      burstConfetti(rect.left + rect.width / 2, rect.top, 26);
      showToast(`已切换到${button.textContent.trim()}主题。`);
    });
  });
  const savedTheme = safeStorageGet('birthday-theme');
  if (savedTheme && pageThemes.some((button) => button.dataset.pageTheme === savedTheme)) {
    document.body.dataset.theme = savedTheme;
    pageThemes.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.pageTheme === savedTheme)));
  }

  /* Surprise dialog */
  const surpriseDialog = $('#surpriseDialog');
  const dialogText = $('#dialogText');
  const fortunes = [
    '今天的你，会被一件很小的事情温柔击中。',
    '接下来的一周，适合大胆许愿，也适合慢慢实现。',
    '你会遇见一个懂你的梗，也懂你沉默的人。',
    '新一岁的好运，藏在一个看似普通的决定里。',
    '今天适合做主角，不需要向任何人解释快乐。',
    '你惦记的那件事，正在悄悄变好。',
    '你就是我的全世界',
  ];
  function openSurprise() {
    if (!surpriseDialog) return;
    if (dialogText) dialogText.textContent = fortunes[Math.floor(Math.random() * fortunes.length)];
    if (typeof surpriseDialog.showModal === 'function') surpriseDialog.showModal();
    else surpriseDialog.setAttribute('open', '');
    const rect = document.querySelector('#surpriseButton')?.getBoundingClientRect();
    if (rect) burstConfetti(rect.left + rect.width / 2, rect.top, 42);
  }
  $('#surpriseButton')?.addEventListener('click', openSurprise);
  $('#finalSurprise')?.addEventListener('click', openSurprise);
  $('#anotherFortune')?.addEventListener('click', () => {
    if (dialogText) dialogText.textContent = fortunes[Math.floor(Math.random() * fortunes.length)];
    const rect = surpriseDialog?.getBoundingClientRect();
    if (rect) burstConfetti(rect.left + rect.width / 2, rect.top + 90, 34);
  });
  $('#dialogClose')?.addEventListener('click', () => surpriseDialog?.close());
  surpriseDialog?.addEventListener('click', (event) => {
    if (event.target === surpriseDialog) surpriseDialog.close();
  });

  /* Pointer-reactive hero card */
  const heroArtCard = $('#heroArtCard');
  if (heroArtCard && finePointer && !reducedMotion) {
    heroArtCard.addEventListener('pointermove', (event) => {
      const rect = heroArtCard.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - .5;
      const y = (event.clientY - rect.top) / rect.height - .5;
      heroArtCard.style.transform = `rotateY(${x * 7}deg) rotateX(${-y * 6}deg) translateY(-3px)`;
    });
    heroArtCard.addEventListener('pointerleave', () => {
      heroArtCard.style.transform = '';
    });
  }

  /* Re-align deep links after web fonts finish loading. */
  let hashTimers = [];
  function realignHash() {
    if (!window.location.hash || window.location.hash.length < 2) return;
    const target = document.querySelector(window.location.hash);
    if (!target) return;
    target.scrollIntoView({ block: 'start', behavior: 'auto' });
  }
  window.addEventListener('load', () => {
    hashTimers.forEach((timer) => window.clearTimeout(timer));
    hashTimers = [window.setTimeout(realignHash, 120), window.setTimeout(realignHash, 520)];
  });
  if (document.fonts?.ready) document.fonts.ready.then(() => window.setTimeout(realignHash, 80));
  /* Refresh canvas if viewport changes orientation. */
  window.addEventListener('orientationchange', () => window.setTimeout(resizeCanvas, 250), { passive: true });
})();
