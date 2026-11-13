:root {
  --bg: #0b0d10;
  --bg-soft: #11151a;
  --panel: #171c22;
  --panel-2: #1d232b;
  --text: #f2efe8;
  --muted: #d0d4d8;
  --muted-2: #8c939a;
  --line: rgba(255, 255, 255, 0.08);
  --accent: #d9b26d;
  --accent-soft: #f4d79d;
  --accent-2: #8f6d2f;
  --success: #6fe1a3;
  --shadow: rgba(0, 0, 0, 0.25);
  --radius: 22px;
}

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  font-family: "Inter", sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
}

a {
  color: inherit;
  text-decoration: none;
}

img {
  max-width: 100%;
  display: block;
}

button,
input,
select,
textarea {
  font: inherit;
}

.container {
  width: min(1120px, calc(100% - 2rem));
  margin: 0 auto;
}

.section {
  padding: 96px 0;
}

.section-light {
  background: #f7f3ee;
  color: #171b1f;
}

.section-dark {
  background: #0c1014;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  backdrop-filter: blur(16px);
  background: rgba(11, 13, 16, 0.7);
  border-bottom: 1px solid var(--line);
}

.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 76px;
  gap: 1rem;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  font-weight: 800;
  letter-spacing: -0.04em;
}

.brand-mark {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(217, 178, 109, 0.12);
}

.menu {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  color: var(--muted);
  font-size: 0.96rem;
}

.menu a:hover {
  color: var(--text);
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid transparent;
  padding: 0.9rem 1.4rem;
  font-weight: 700;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  cursor: pointer;
}

.button:hover {
  transform: translateY(-1px);
}

.button-small {
  padding: 0.7rem 1rem;
  font-size: 0.92rem;
}

.button-primary {
  background: linear-gradient(135deg, var(--accent), var(--accent-soft));
  color: #141414;
  box-shadow: 0 18px 30px rgba(217, 178, 109, 0.2);
}

.button-secondary {
  background: transparent;
  border-color: rgba(255, 255, 255, 0.2);
  color: var(--text);
}

.button-dark {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.12);
  color: var(--text);
}

.full-width {
  width: 100%;
}

.hero {
  padding: 80px 0 56px;
  background:
    radial-gradient(circle at top left, rgba(217, 178, 109, 0.18), transparent 28%),
    radial-gradient(circle at bottom right, rgba(143, 109, 47, 0.14), transparent 22%),
    var(--bg);
}

.hero-grid {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 2.5rem;
  align-items: center;
}

.eyebrow {
  margin: 0 0 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--accent-soft);
}

.eyebrow-dark {
  color: #5f4a2b;
}

.hero-copy h1,
.section-heading h2,
.waitlist-copy h2 {
  margin: 0 0 1rem;
  letter-spacing: -0.06em;
  line-height: 1.04;
}

.hero-copy h1 {
  font-size: clamp(3rem, 5vw, 5rem);
}

.lead {
  max-width: 620px;
  color: var(--muted);
  font-size: 1.05rem;
}

.cta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.9rem;
  margin-top: 2rem;
}

.mini-stats {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(3, minmax(100px, 1fr));
  gap: 1rem;
  padding: 0;
  margin: 2.2rem 0 0;
}

.mini-stats li {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 1rem 1rem 0.8rem;
}

.mini-stats strong,
.mini-stats span {
  display: block;
}

.mini-stats strong {
  font-size: 1rem;
  margin-bottom: 0.2rem;
}

.mini-stats span {
  color: var(--muted);
  font-size: 0.82rem;
}

.hero-card {
  display: flex;
  justify-content: center;
}

.player-window {
  width: min(100%, 440px);
  background: linear-gradient(180deg, rgba(17, 21, 26, 0.9), rgba(11, 13, 16, 0.96));
  border: 1px solid var(--line);
  border-radius: 28px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
  padding: 1rem;
}

.window-bar {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem 0 1rem;
}

.window-bar span {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  display: inline-block;
}

.window-bar span:nth-child(1) { background: #ef6b5b; }
.window-bar span:nth-child(2) { background: #f1c55b; }
.window-bar span:nth-child(3) { background: #51c774; }

.track-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid var(--line);
  border-radius: 20px;
  padding: 1rem;
}

.cover-art {
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  background: linear-gradient(135deg, var(--accent), #7a5835);
  font-size: 2rem;
  color: #1d1a17;
  font-weight: 800;
}

.track-meta {
  min-width: 0;
}

.track-meta .label {
  margin: 0 0 0.3rem;
  color: var(--muted-2);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.track-meta h3 {
  margin: 0;
  font-size: 1.35rem;
}

.track-meta p {
  margin: 0.2rem 0 0;
  color: var(--muted);
  font-size: 0.9rem;
}

.progress {
  height: 8px;
  margin-top: 1.2rem;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.progress-bar {
  width: 68%;
  height: 100%;
  background: linear-gradient(90deg, var(--accent-soft), var(--accent));
}

.controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 1.2rem;
}

.controls button {
  width: 46px;
  height: 46px;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.02);
  color: var(--text);
  cursor: pointer;
}

.controls .play {
  width: 58px;
  height: 58px;
  font-size: 1.1rem;
  background: linear-gradient(135deg, var(--accent), var(--accent-soft));
  color: #111;
  border: none;
}

.section-heading {
  margin-bottom: 2.2rem;
}

.section-heading h2,
.waitlist-copy h2 {
  font-size: clamp(2.1rem, 3vw, 3.4rem);
  max-width: 700px;
}

.narrow {
  max-width: 620px;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.3rem;
}

.feature-card {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: var(--radius);
  padding: 1.5rem;
}

.section-light .feature-card {
  background: rgba(17, 21, 26, 0.03);
  border-color: rgba(23, 27, 31, 0.08);
}

.feature-icon {
  width: 52px;
  height: 52px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 15px;
  background: rgba(217, 178, 109, 0.12);
  font-size: 1.5rem;
  margin-bottom: 1rem;
}

.feature-card h3 {
  margin: 0 0 0.8rem;
  font-size: 1.2rem;
}

.feature-card p,
.veto-box p,
.waitlist-copy p,
.timeline-item p {
  margin: 0;
  color: inherit;
}

.tags-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  margin-top: 1.5rem;
}

.tags-wrap span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 0.7rem 1rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--line);
  color: var(--muted);
  font-size: 0.95rem;
}

.veto-box {
  margin-top: 2rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--line);
  border-radius: 20px;
  padding: 1.2rem 1.4rem;
}

.two-column {
  display: grid;
  grid-template-columns: 0.8fr 1.2fr;
  gap: 2rem;
  align-items: start;
}

.timeline {
  display: grid;
  gap: 1.3rem;
}

.timeline-item {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  padding: 1rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.dot {
  width: 12px;
  height: 12px;
  margin-top: 0.55rem;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 6px rgba(217, 178, 109, 0.15);
}

.timeline-item h3 {
  margin: 0 0 0.35rem;
  font-size: 1.12rem;
}

.compact .feature-card {
  padding: 1.35rem;
}

.waitlist {
  background: linear-gradient(180deg, rgba(217, 178, 109, 0.08), rgba(11, 13, 16, 0.06));
}

.waitlist-grid {
  display: grid;
  grid-template-columns: 0.9fr 1.1fr;
  gap: 2rem;
  align-items: center;
}

.waitlist-form {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 1.5rem;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.18);
}

.waitlist-form label {
  display: block;
  margin-bottom: 1rem;
  color: var(--muted);
  font-size: 0.93rem;
}

.waitlist-form input,
.waitlist-form select,
.waitlist-form textarea {
  width: 100%;
  margin-top: 0.45rem;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.02);
  color: var(--text);
  padding: 0.9rem 1rem;
}

.waitlist-form textarea {
  resize: vertical;
  min-height: 120px;
}

.form-message {
  min-height: 1.5rem;
  margin: 0.9rem 0 0;
  color: var(--success);
  font-weight: 600;
}

.footer {
  border-top: 1px solid var(--line);
  background: #0b0d10;
  padding: 1.2rem 0;
}

.footer-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.footer-brand {
  font-size: 1.05rem;
}

.footer p {
  margin: 0;
  color: var(--muted);
}

@media (max-width: 860px) {
  .hero-grid,
  .two-column,
  .waitlist-grid,
  .feature-grid {
    grid-template-columns: 1fr;
  }

  .nav {
    flex-wrap: wrap;
    justify-content: center;
    padding: 0.7rem 0;
  }

  .menu {
    width: 100%;
    justify-content: center;
    flex-wrap: wrap;
  }

  .hero {
    padding-top: 56px;
  }

  .section {
    padding: 72px 0;
  }
}

@media (max-width: 560px) {
  .topbar {
    position: static;
  }

  .cta-row {
    flex-direction: column;
    align-items: stretch;
  }

  .button,
  .button-small {
    width: 100%;
  }

  .mini-stats {
    grid-template-columns: 1fr;
  }
}
